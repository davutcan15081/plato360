import React, { useRef, useState, useEffect } from 'react';
import { EditSegment } from '../services/ai';
import {
  Play, Pause, RotateCcw, Type, Trash2, Check, Download,
  Loader2, AlignLeft, AlignCenter, AlignRight, Frame, Sparkles, X, Music, Scissors
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share as CapShare } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { EffectsOverlay } from './EffectsOverlay';

interface VideoPreviewProps {
  videoUrl: string;
  videoBlob: Blob;
  editScript: EditSegment[];
  vibe: string;
  initialTexts?: any[];
  customAudioBlob?: Blob | null;
  onReset: () => void;
}

interface UserText {
  id: string;
  text: string;
  fontFamily: string;
  startTime?: number;
  endTime?: number;
  yOffset?: number;
  xOffset?: number;
  scale?: number;
  textAlign?: 'left' | 'center' | 'right';
}

const VIBE_AUDIO: Record<string, string> = {
  'Energetic': 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/audio/bodenstaendig_2000_in_rock_4bit.mp3',
  'Cinematic': 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/audio/CatAstroPhi_shmup_normal.mp3',
  'Minimalist': 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/audio/tech/bass.mp3',
  'Cyberpunk': 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/audio/oedipus_wizball_highscore.mp3',
};

const FONTS = ['inter', 'anton', 'caveat', 'playfair', 'bebas', 'pacifico', 'cinzel', 'oswald', 'montserrat', 'quicksand', 'lobster', 'abril'];

const FRAME_OPTIONS = ['none', 'cinematic', 'polaroid', 'neon', 'vintage', 'glitch', 'minimal', 'bold', 'tv', 'comic', 'glam', 'newspaper'];
const EFFECT_OPTIONS = [
  { key: 'none', label: 'Yok' },
  { key: 'snow', label: 'Kar' },
  { key: 'confetti', label: 'Konfeti' },
  { key: 'balloons', label: 'Balon' },
  { key: 'rain', label: 'Yağmur' },
  { key: 'hearts', label: 'Kalp' },
  { key: 'stars', label: 'Yıldız' },
  { key: 'matrix', label: 'Matrix' },
];

type Panel = 'text' | 'frame' | 'effect' | 'music' | null;

export function VideoPreview({
  videoUrl: initialVideoUrl, videoBlob, editScript, vibe,
  initialTexts = [], customAudioBlob, onReset,
}: VideoPreviewProps) {

  /* refs */
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const segRef = useRef<EditSegment | null>(null);
  const visRef = useRef<string>('');

  /* state */
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState(initialVideoUrl);
  const [retryCount, setRetryCount] = useState(0);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentSeg, setCurrentSeg] = useState<EditSegment | null>(null);
  const [customAudioUrl, setCustomAudioUrl] = useState<string | null>(null);
  const [userTexts, setUserTexts] = useState<UserText[]>(() =>
    initialTexts.map((t, i) => ({
      id: `auto-${i}`, text: t.text, fontFamily: t.fontFamily || 'inter',
      startTime: t.startTime, endTime: t.endTime, yOffset: t.yOffset || 0
    }))
  );

  const [visibleTexts, setVisibleTexts] = useState<UserText[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userFrame, setUserFrame] = useState(editScript[0]?.frameStyle || 'none');
  const [userEffect, setUserEffect] = useState(editScript[0]?.effect || 'none');
  const [activeFrame, setActiveFrame] = useState(editScript[0]?.frameStyle || 'none');
  const [activeEffect, setActiveEffect] = useState(editScript[0]?.effect || 'none');
  const [customFrames, setCustomFrames] = useState<string[]>([]);
  const [frameTiming, setFrameTiming] = useState({ startTime: 0, endTime: 0, isFull: true });
  const [effectTiming, setEffectTiming] = useState({ startTime: 0, endTime: 0, isFull: true });
  const [openPanel, setOpenPanel] = useState<Panel>(null);
  const togglePanel = (p: Panel) => setOpenPanel(prev => prev === p ? null : p);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Müzik kırpma
  const musicFileRef = useRef<HTMLInputElement>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const trimStartRef = useRef(0);
  const trimEndRef = useRef(0);
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimApplied, setTrimApplied] = useState(false);
  const sourceBlobRef = useRef<string | null>(null);
  const trimBarRef = useRef<HTMLDivElement>(null);
  const trimDragging = useRef<'start' | 'end' | null>(null);

  /* effects */
  useEffect(() => {
    if (customAudioBlob) { const u = URL.createObjectURL(customAudioBlob); setCustomAudioUrl(u); return () => URL.revokeObjectURL(u); }
  }, [customAudioBlob]);

  // Ses süresi yüklenince trim sınırlarını başlat
  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    const onMeta = () => {
      const d = a.duration;
      if (!d || !isFinite(d)) return;
      setAudioDuration(d);
      // Sadece ilk yüklemede veya yeni ses geldiğinde sıfırla
      setTrimStart(0); trimStartRef.current = 0;
      setTrimEnd(d);   trimEndRef.current = d;
    };
    a.addEventListener('loadedmetadata', onMeta);
    // Eğer zaten yüklüyse hemen tetikle
    if (a.duration && isFinite(a.duration)) onMeta();
    return () => a.removeEventListener('loadedmetadata', onMeta);
  }, [customAudioUrl]);

  useEffect(() => { setVideoUrl(initialVideoUrl); }, [initialVideoUrl]);

  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    const onMeta = () => setVideoDuration(v.duration || 0);
    v.addEventListener('loadedmetadata', onMeta);
    return () => v.removeEventListener('loadedmetadata', onMeta);
  }, [videoUrl]);

  useEffect(() => {
    const time = videoRef.current?.currentTime ?? 0;
    const vis = userTexts.filter(t => t.startTime === undefined || (time >= (t.startTime ?? 0) && time <= (t.endTime ?? Infinity)));
    setVisibleTexts(vis); visRef.current = vis.map(t => t.id).join(',');
  }, [userTexts]);

  useEffect(() => {
    let raf: number, lastRate = -1;
    const DRIFT_THRESHOLD = 0.15;
    const tick = () => {
      const v = videoRef.current;
      const a = audioRef.current;
      if (v) {
        const time = v.currentTime;
        const seg = editScript.find(s => time >= s.startTime && time <= s.endTime) ?? editScript.at(-1)!;
        if (seg && seg !== segRef.current) { setCurrentSeg(seg); segRef.current = seg; }
        if (seg) { let r = seg.playbackRate ?? 1; if (!r || isNaN(r) || r <= 0) r = 1; r = Math.min(5, Math.max(0.5, r)); if (r !== lastRate) { v.playbackRate = r; lastRate = r; } }

        // Trim loop: trimEnd'e ulaşınca trimStart'a dön
        if (a && !a.paused && trimEndRef.current > 0) {
          if (a.currentTime >= trimEndRef.current - 0.05) {
            a.currentTime = trimStartRef.current;
          }
          // trimStart'ın altındaysa da düzelt (seek sonrası vb.)
          if (a.currentTime < trimStartRef.current) {
            a.currentTime = trimStartRef.current;
          }
        }

        let rf = userFrame, re = userEffect;
        if (!frameTiming.isFull && (time < frameTiming.startTime || time > frameTiming.endTime)) rf = seg?.frameStyle || 'none';
        if (!effectTiming.isFull && (time < effectTiming.startTime || time > effectTiming.endTime)) re = seg?.effect || 'none';

        if (rf !== activeFrame) setActiveFrame(rf);
        if (re !== activeEffect) setActiveEffect(re);

        const vis = userTexts.filter(t => t.startTime === undefined || (time >= (t.startTime ?? 0) && time <= (t.endTime ?? Infinity)));
        const id = vis.map(t => t.id).join(',');
        if (id !== visRef.current) { setVisibleTexts(vis); visRef.current = id; }

        if (v.duration) setVideoProgress((time / v.duration) * 100);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [editScript, userTexts, userFrame, userEffect, frameTiming, effectTiming]);

  /* helpers */
  const fmt = (s: number) => {
    if (!s || isNaN(s) || s === Infinity) return '0:00';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  const initAudio = () => {
    try {
      if (!audioCtxRef.current && audioRef.current) {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AC(); audioCtxRef.current = ctx;
        const src = ctx.createMediaElementSource(audioRef.current);
        const dest = ctx.createMediaStreamDestination();
        src.connect(dest); src.connect(ctx.destination); audioDestRef.current = dest;
      }
      if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
    } catch { }
  };

  /* playback */
  const togglePlay = async () => {
    initAudio();
    const v = videoRef.current, a = audioRef.current;
    if (!v || !a) return;
    if (isPlaying) { v.pause(); a.pause(); setIsPlaying(false); }
    else {
      v.muted = true;
      // Ses pozisyonunu trimStart'a hizala
      a.currentTime = trimStartRef.current;
      let ok = false;
      try { await v.play(); ok = true; } catch { }
      try { await a.play(); } catch { }
      if (ok) setIsPlaying(true);
      else { a.pause(); alert('Video oynatılamadı.'); }
    }
  };

  const handleEnded = () => {
    if (!isExporting) { setIsPlaying(false); if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; } }
  };

  /* text */
  const addText = () => {
    const id = Date.now().toString();
    setUserTexts(p => [...p, { id, text: 'YENİ METİN', fontFamily: 'inter', startTime: 0, endTime: videoDuration || 10, scale: 1, yOffset: 0, xOffset: 0, textAlign: 'center' }]);
    setSelectedId(id); setOpenPanel('text');
  };

  const sel = userTexts.find(t => t.id === selectedId);
  const updateSel = (patch: Partial<UserText>) => setUserTexts(ts => ts.map(t => t.id === selectedId ? { ...t, ...patch } : t));

  /* frame cls */
  const getFrameCls = (f?: string) => {
    const m: Record<string, string> = {
      cinematic: 'border-y-[8vh] border-black',
      polaroid: 'border-[16px] border-b-[64px] border-white shadow-2xl',
      neon: 'border-4 border-pink-500 shadow-[0_0_30px_rgba(236,72,153,0.8)]',
      vintage: 'border-[20px] border-[#8b5a2b]',
      glitch: 'border-l-4 border-r-4 border-l-red-500 border-r-blue-500',
      minimal: 'border-[8px] border-zinc-100 rounded-3xl',
      bold: 'border-[12px] border-yellow-400',
      tv: 'border-[20px] border-zinc-900 rounded-[40px]',
      comic: 'border-[10px] border-black shadow-[10px_10px_0_rgba(0,0,0,1)]',
      glam: 'border-[15px] border-yellow-500',
      newspaper: 'border-[25px] border-zinc-300 grayscale contrast-125',
    };
    return m[f] ?? '';
  };

  const getFontCls = (f?: string) => {
    const m: Record<string, string> = {
      anton: 'font-["Anton"] tracking-wide uppercase', caveat: 'font-["Caveat"] capitalize',
      playfair: 'font-["Playfair_Display"] italic capitalize', bebas: 'font-["Bebas_Neue"] tracking-wider uppercase',
      pacifico: 'font-["Pacifico"] capitalize font-normal', cinzel: 'font-["Cinzel"] tracking-widest uppercase font-bold',
      oswald: 'font-["Oswald"] tracking-tight uppercase font-bold', montserrat: 'font-["Montserrat"] font-extrabold tracking-tight',
      quicksand: 'font-["Quicksand"] font-bold', lobster: 'font-["Lobster"]', abril: 'font-["Abril_Fatface"]',
    };
    return m[f] ?? 'font-["Inter"] font-black tracking-tighter uppercase';
  };

  /* Müzik kırpma — Web Audio offline render */
  const applyTrim = async () => {
    const src = sourceBlobRef.current || customAudioUrl;
    if (!src || isTrimming) return;
    const start = trimStartRef.current;
    const end   = trimEndRef.current;
    if (end <= start) return;

    setIsTrimming(true);
    try {
      // 1. Kaynağı fetch et → ArrayBuffer
      const resp = await fetch(src);
      const buf  = await resp.arrayBuffer();

      // 2. Decode
      const AC  = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AC() as AudioContext;
      const decoded = await ctx.decodeAudioData(buf);
      await ctx.close();

      // 3. Seçili aralığı offline context'te render et
      const sampleRate  = decoded.sampleRate;
      const startFrame  = Math.floor(start * sampleRate);
      const endFrame    = Math.min(Math.ceil(end * sampleRate), decoded.length);
      const frameCount  = endFrame - startFrame;
      const channels    = decoded.numberOfChannels;

      const offCtx = new OfflineAudioContext(channels, frameCount, sampleRate);
      const offBuf  = offCtx.createBuffer(channels, frameCount, sampleRate);
      for (let ch = 0; ch < channels; ch++) {
        offBuf.copyToChannel(
          decoded.getChannelData(ch).subarray(startFrame, endFrame), ch
        );
      }
      const src2 = offCtx.createBufferSource();
      src2.buffer = offBuf;
      src2.connect(offCtx.destination);
      src2.start();
      const rendered = await offCtx.startRendering();

      // 4. PCM → WAV blob
      const wavBlob = audioBufferToWav(rendered);
      const newUrl  = URL.createObjectURL(wavBlob);

      // 5. Eski kırpılmış url'yi temizle (orijinal kaynağa dokunma)
      if (customAudioUrl && customAudioUrl !== sourceBlobRef.current) {
        URL.revokeObjectURL(customAudioUrl);
      }

      // 6. Audio elementini güncelle — hemen çal
      setCustomAudioUrl(newUrl);
      setAudioDuration(rendered.duration);
      // Trim sınırlarını yeni dosyaya göre sıfırla
      setTrimStart(0); trimStartRef.current = 0;
      setTrimEnd(rendered.duration); trimEndRef.current = rendered.duration;

      if (audioRef.current) {
        audioRef.current.src = newUrl;
        audioRef.current.load();
        audioRef.current.currentTime = 0;
        if (isPlaying) {
          try { await audioRef.current.play(); } catch {}
        }
      }

      setTrimApplied(true);
      setOpenPanel(null); // paneli kapat
      setTimeout(() => setTrimApplied(false), 2000);
    } catch (err) {
      console.error('Trim failed:', err);
      alert('Kırpma işlemi başarısız oldu.');
    } finally {
      setIsTrimming(false);
    }
  };

  /** PCM AudioBuffer → WAV Blob (44-byte header + 16-bit PCM) */
  const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const numCh   = buffer.numberOfChannels;
    const sr      = buffer.sampleRate;
    const len     = buffer.length;
    const bytesPerSample = 2;
    const blockAlign     = numCh * bytesPerSample;
    const byteRate       = sr * blockAlign;
    const dataSize       = len * blockAlign;
    const wavBuf         = new ArrayBuffer(44 + dataSize);
    const view           = new DataView(wavBuf);

    const w = (off: number, val: number, sz: number) => {
      if (sz === 4) view.setUint32(off, val, true);
      else          view.setUint16(off, val, true);
    };
    const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };

    writeStr(0, 'RIFF'); w(4, 36 + dataSize, 4); writeStr(8, 'WAVE');
    writeStr(12, 'fmt '); w(16, 16, 4); w(20, 1, 2); w(22, numCh, 2);
    w(24, sr, 4); w(28, byteRate, 4); w(32, blockAlign, 2); w(34, 16, 2);
    writeStr(36, 'data'); w(40, dataSize, 4);

    // Interleave channels
    let offset = 44;
    for (let i = 0; i < len; i++) {
      for (let ch = 0; ch < numCh; ch++) {
        const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
      }
    }
    return new Blob([wavBuf], { type: 'audio/wav' });
  };

  /* export */
  const exportVideo = async () => {
    if (!videoRef.current || !audioRef.current || isExporting) return;
    setIsExporting(true); setExportProgress(0);
    setIsPlaying(false);
    const video = videoRef.current, audio = audioRef.current;
    initAudio();
    try { await video.play(); video.pause(); } catch { }
    try { await audio.play(); audio.pause(); } catch { }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 720; canvas.height = video.videoHeight || 1280;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setIsExporting(false); return; }

    let frameImg: HTMLImageElement | null = null;
    if (activeFrame.startsWith('blob:')) {
      frameImg = new Image(); frameImg.src = activeFrame;
      await new Promise(r => { frameImg!.onload = r; frameImg!.onerror = r; });
    }

    const cs = canvas.captureStream?.(30) ?? (canvas as any).mozCaptureStream?.(30);
    if (!cs) { setIsExporting(false); alert('Dışa aktarma desteklenmiyor.'); return; }
    const as = audioDestRef.current?.stream;
    const rec = new MediaRecorder(new MediaStream([...cs.getVideoTracks(), ...(as?.getAudioTracks() ?? [])]),
      { mimeType: ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t)) ?? 'video/mp4' });
    const chunks: Blob[] = [];
    rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

    const onVis = () => {
      if (document.hidden && rec.state === 'recording') { rec.pause(); video.pause(); audio.pause(); }
      else if (!document.hidden && rec.state === 'paused') { rec.resume(); video.play().catch(() => { }); audio.play().catch(() => { }); }
    };
    document.addEventListener('visibilitychange', onVis);

    rec.onstop = async () => {
      document.removeEventListener('visibilitychange', onVis);
      const blob = new Blob(chunks, { type: 'video/mp4' });
      const fn = `spinedit-${Date.now()}.mp4`;
      if (Capacitor.isNativePlatform()) {
        try {
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = async () => {
            const saved = await Filesystem.writeFile({ path: fn, data: reader.result as string, directory: Directory.Cache });
            await CapShare.share({ title: 'SpinEdit Video', url: saved.uri, dialogTitle: 'Paylaş' });
          };
        } catch { alert('Kayıt hatası.'); }
      } else {
        const url = URL.createObjectURL(blob);
        Object.assign(document.createElement('a'), { href: url, download: fn }).click();
        URL.revokeObjectURL(url);
      }
      setIsExporting(false); setExportProgress(100);
      setTimeout(() => setExportProgress(0), 800);
    };

    rec.start(); video.currentTime = 0; audio.currentTime = 0; video.muted = true;
    // Canvas ölçümünden ÖNCE fontların tam yüklenmesini bekle
    await document.fonts.ready;
    if (userTexts.length > 0) {
      await Promise.allSettled(
        userTexts.map(tx =>
          document.fonts.load(`bold ${Math.round(canvas.width * 0.1 * (tx.scale || 1))}px ${tx.fontFamily}`)
        )
      );
    }
    try { await video.play(); await audio.play(); } catch { setIsExporting(false); rec.stop(); return; }

    let dur = video.duration;
    if (!dur || dur === Infinity || isNaN(dur)) dur = editScript.at(-1)?.endTime ?? 10;
    let lastRate = -1, curFx = '', parts: any[] = [];

    const initPfx = (fx: string) => {
      if (fx === curFx) return; curFx = fx;
      if (fx === 'snow') parts = Array.from({ length: 50 }).map(() => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, size: Math.random() * 4 + 2, sy: Math.random() * 3 + 2, sx: Math.random() * 2 - 1 }));
      else if (fx === 'confetti') { const cs = ['#f00', '#0f0', '#00f', '#ff0', '#f0f', '#0ff']; parts = Array.from({ length: 100 }).map(() => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, size: Math.random() * 8 + 4, c: cs[0 | Math.random() * 6], sy: Math.random() * 5 + 3, sx: Math.random() * 4 - 2, r: Math.random() * 360, rs: Math.random() * 10 - 5 })); }
      else if (fx === 'balloons') { const cs = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93']; parts = Array.from({ length: 15 }).map(() => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, size: Math.random() * 20 + 30, c: cs[0 | Math.random() * 5], sy: -(Math.random() * 3 + 2), sx: Math.random() * 2 - 1 })); }
      else parts = [];
    };

    const drawFrame = () => {
      if (video.currentTime >= dur - 0.1 || video.ended) { if (rec.state === 'recording') { rec.stop(); video.pause(); audio.pause(); } return; }
      const t = video.currentTime; setExportProgress((t / dur) * 100);
      const seg = editScript.find(s => t >= s.startTime && t <= s.endTime) ?? editScript.at(-1)!;
      let rf = userFrame, re = userEffect;
      if (!frameTiming.isFull && (t < frameTiming.startTime || t > frameTiming.endTime)) rf = seg?.frameStyle || 'none';
      if (!effectTiming.isFull && (t < effectTiming.startTime || t > effectTiming.endTime)) re = seg?.effect || 'none';
      let r = seg?.playbackRate ?? 1; if (!r || isNaN(r) || r <= 0) r = 1; r = Math.min(5, Math.max(0.5, r));
      if (r !== lastRate) { video.playbackRate = r; lastRate = r; }
      ctx.filter = seg?.cssFilter && seg.cssFilter !== 'none' ? seg.cssFilter : 'none';
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      initPfx(re);

      if (re !== 'none' && parts.length > 0) {
        ctx.filter = 'none';
        parts.forEach(p => {
          if (re === 'snow') { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); p.y += p.sy; p.x += p.sx; if (p.y > canvas.height) p.y = -10; if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0; }
          else if (re === 'confetti') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r * Math.PI / 180); ctx.fillStyle = p.c; ctx.fillRect(-p.size / 4, -p.size / 2, p.size / 2, p.size); ctx.restore(); p.y += p.sy; p.x += p.sx; p.r += p.rs; if (p.y > canvas.height) p.y = -10; }
          else if (re === 'balloons') { ctx.fillStyle = p.c; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size / 2, p.size * 0.6, 0, 0, Math.PI * 2); ctx.fill(); p.y += p.sy; if (p.y < -p.size) p.y = canvas.height + p.size; }
        });
      }

      ctx.filter = 'none';
      if (rf === 'cinematic') { ctx.fillStyle = 'black'; ctx.fillRect(0, 0, canvas.width, canvas.height * 0.08); ctx.fillRect(0, canvas.height * 0.92, canvas.width, canvas.height * 0.08); }
      else if (rf === 'neon') { ctx.strokeStyle = '#ec4899'; ctx.lineWidth = 8; ctx.shadowColor = 'rgba(236,72,153,0.8)'; ctx.shadowBlur = 30; ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8); ctx.shadowBlur = 0; }
      else if (rf === 'vintage') { ctx.strokeStyle = '#8b5a2b'; ctx.lineWidth = 40; ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40); }
      else if (rf === 'glitch') { ctx.fillStyle = 'rgba(239,68,68,0.5)'; ctx.fillRect(0, 0, 8, canvas.height); ctx.fillStyle = 'rgba(59,130,246,0.5)'; ctx.fillRect(canvas.width - 8, 0, 8, canvas.height); }
      else if (rf === 'minimal') { ctx.strokeStyle = '#f4f4f5'; ctx.lineWidth = 16; ctx.beginPath(); ctx.roundRect(8, 8, canvas.width - 16, canvas.height - 16, 24); ctx.stroke(); }
      else if (rf === 'bold') { ctx.strokeStyle = '#facc15'; ctx.lineWidth = 24; ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24); }
      if (frameImg && rf.startsWith('blob:')) ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);

      ctx.filter = 'none'; ctx.textBaseline = 'middle';

      // Ekrandan (HTML Container) videoya taşınırken oranlama hesabı
      const container = containerRef.current;
      const scaleX = container ? canvas.width / container.clientWidth : 1;
      const scaleY = container ? canvas.height / container.clientHeight : 1;

      userTexts.forEach(tx => {
        if (tx.startTime !== undefined && tx.endTime !== undefined && (t < tx.startTime || t > tx.endTime)) return;
        const scaleVal = tx.scale || 1;
        const fs = Math.max(1, Math.round(canvas.width * 0.1 * scaleVal));
        ctx.font = `bold ${fs}px "${tx.fontFamily}", sans-serif`;
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = fs * 0.05;
        ctx.textAlign = tx.textAlign || 'center';

        // CSS Case Dönüşümlerini Canvas'a Yediriyoruz
        const fontFam = tx.fontFamily || 'inter';
        let drawnText = tx.text;
        const upFonts = ['anton', 'bebas', 'cinzel', 'oswald'];
        const capFonts = ['caveat', 'playfair', 'pacifico'];

        if (upFonts.includes(fontFam) || !FONTS.includes(fontFam) || fontFam === 'inter') {
          drawnText = drawnText.toUpperCase();
        } else if (capFonts.includes(fontFam)) {
          drawnText = drawnText.replace(/\b\w/g, c => c.toUpperCase());
        }

        // CSS Harf Aralığını (Tracking) Canvas'a Yediriyoruz
        if (fontFam === 'anton') ctx.letterSpacing = '0.025em';
        else if (fontFam === 'bebas') ctx.letterSpacing = '0.05em';
        else if (fontFam === 'cinzel') ctx.letterSpacing = '0.1em';
        else if (fontFam === 'oswald' || fontFam === 'montserrat') ctx.letterSpacing = '-0.025em';
        else if (['caveat', 'playfair', 'pacifico', 'quicksand', 'lobster', 'abril'].includes(fontFam)) ctx.letterSpacing = '0px';
        else ctx.letterSpacing = '-0.05em';

        // \r\n → \n normalize et, ardından satır sar
        const normalizedText = drawnText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        // Max Width değerine scale'i dahil ediyoruz ki HTML'deki CSS transform ile birebir eşleşsin
        const maxWidth = canvas.width * 0.86 * scaleVal;
        const lines: string[] = [];

        normalizedText.split('\n').forEach(para => {
          if (para.trim() === '') {
            lines.push('');
            return;
          }

          // Eğer paragraf zaten maxWidth'e sığıyorsa, doğrudan ekle
          if (ctx.measureText(para).width <= maxWidth) {
            lines.push(para);
            return;
          }

          // HTML'deki word-break: break-word simülasyonu
          const words = para.split(' ');
          let currentLine = '';

          for (let i = 0; i < words.length; i++) {
            const word = words[i];

            // Kelimenin tek başına maxWidth'i aşıp aşmadığına bak
            if (ctx.measureText(word).width > maxWidth) {
              if (currentLine.trim()) {
                lines.push(currentLine);
                currentLine = '';
              }
              // Kelimeyi karakter karakter kır
              let tempStr = '';
              for (const char of word) {
                if (ctx.measureText(tempStr + char).width <= maxWidth) {
                  tempStr += char;
                } else {
                  if (tempStr) lines.push(tempStr);
                  tempStr = char;
                }
              }
              currentLine = tempStr;
            } else {
              const testLine = currentLine + (currentLine ? ' ' : '') + word;
              if (ctx.measureText(testLine).width <= maxWidth) {
                currentLine = testLine;
              } else {
                if (currentLine.trim()) lines.push(currentLine);
                currentLine = word;
              }
            }
          }

          if (currentLine.trim()) lines.push(currentLine);
        });

        // Pozisyonların Canvas ölçülerine tam çevrilmesi
        const canvasXOffset = (tx.xOffset || 0) * scaleX;
        const canvasYOffset = (tx.yOffset || 0) * scaleY;

        let x = canvas.width / 2 + canvasXOffset;
        if (tx.textAlign === 'left') x = canvas.width * 0.07 + canvasXOffset;
        if (tx.textAlign === 'right') x = canvas.width * 0.93 + canvasXOffset;

        const lh = fs * 1.2;
        const sy = (canvas.height / 2 + canvasYOffset) - (lines.length - 1) * lh / 2;

        lines.forEach((l, i) => {
          const ly = sy + i * lh;
          ctx.strokeText(l, x, ly);
          ctx.fillText(l, x, ly);
        });

        ctx.letterSpacing = '0px'; // Diğer yazılar için sıfırla
      });
      requestAnimationFrame(drawFrame);
    };
    requestAnimationFrame(drawFrame);
  };

  /* ── render ─────────────────────────────────────────────────────────── */
  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #0a0a0e 0%, #0d0d12 100%)' }}
    >
      <audio
        ref={audioRef}
        src={customAudioUrl || VIBE_AUDIO[vibe] || VIBE_AUDIO['Energetic']}
        crossOrigin={customAudioUrl ? undefined : 'anonymous'}
      />

      {/* ── ZONE 1: TOP BAR — brand only ────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-center px-4 pt-4 pb-2">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
          <span
            className="text-[10px] font-black uppercase select-none"
            style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.35em' }}
          >
            SpinEdit
          </span>
        </div>
      </div>

      {/* ── ZONE 2: VIDEO ────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 px-3 py-1">
        <div
          ref={containerRef}
          className={`relative w-full h-full overflow-hidden rounded-2xl transition-all duration-500 ${getFrameCls(activeFrame.startsWith('blob:') ? 'none' : activeFrame)
            }`}
          style={{
            boxShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 24px 60px rgba(0,0,0,0.6)',
            containerType: 'inline-size'
          }}
          onClick={() => { setSelectedId(null); setOpenPanel(null); }}
        >
          <EffectsOverlay effect={activeEffect} />

          {activeFrame.startsWith('blob:') && (
            <img src={activeFrame} alt=""
              className="absolute inset-0 w-full h-full object-fill pointer-events-none z-20" />
          )}

          <video
            key={videoUrl}
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-cover"
            style={{ filter: currentSeg?.cssFilter && currentSeg.cssFilter !== 'none' ? currentSeg.cssFilter : 'none' }}
            onEnded={handleEnded}
            onError={e => {
              const err = (e.target as HTMLVideoElement).error;
              if (err?.code === 4 && retryCount < 2) { setTimeout(() => { setRetryCount(c => c + 1); setVideoUrl(URL.createObjectURL(videoBlob)); }, 800); }
              else if (err?.code === 4) { alert('Bu video formatı desteklenmiyor.'); }
            }}
            playsInline webkit-playsinline="true" controls={false} preload="auto" muted
          />

          {/* Bottom gradient vignette for legibility */}
          <div
            className="absolute bottom-0 left-0 right-0 h-28 pointer-events-none z-10"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 100%)' }}
          />

          {/* Text overlays */}
          <AnimatePresence>
            {visibleTexts.map(t => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: (selectedId === t.id ? 1.05 : 1) * (t.scale || 1), y: t.yOffset ?? 0, x: t.xOffset ?? 0 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                drag dragMomentum={false} dragConstraints={containerRef} dragElastic={0}
                onDragEnd={(_, info) => setUserTexts(ts => ts.map(x => x.id === t.id ? { ...x, yOffset: (x.yOffset || 0) + info.offset.y, xOffset: (x.xOffset || 0) + info.offset.x } : x))}
                onClick={e => { e.stopPropagation(); setSelectedId(t.id); setOpenPanel('text'); }}
                className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl z-30 cursor-grab active:cursor-grabbing
                  ${selectedId === t.id ? 'ring-4 ring-amber-400/50 bg-white/10 backdrop-blur-sm' : 'hover:bg-white/5'}`}
                style={{ width: '86%' }}
              >
                <h2
                  className={`text-white text-4xl ${getFontCls(t.fontFamily)}`}
                  style={{
                    fontSize: '10cqw',
                    lineHeight: '1.2',
                    WebkitTextStroke: '1.5px rgba(0,0,0,0.7)',
                    textAlign: t.textAlign || 'center',
                    textShadow: '0 4px 16px rgba(0,0,0,0.9)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    width: '100%',
                    display: 'block',
                  }}
                >
                  {t.text}
                </h2>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* ── ZONE 3: SEEK BAR ─────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-3 px-5 pt-2.5 pb-1.5">
        <span className="text-[10px] text-zinc-600 font-mono w-8 text-right shrink-0 tabular-nums">
          {fmt(videoRef.current?.currentTime || 0)}
        </span>
        <div className="relative flex-1 h-6 flex items-center">
          {/* Track */}
          <div
            className="absolute left-0 right-0 h-[3px] rounded-full pointer-events-none"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            <div
              className="h-full rounded-full transition-none"
              style={{
                width: `${videoProgress}%`,
                background: 'linear-gradient(90deg, #f59e0b, #ea580c)',
                boxShadow: '0 0 8px rgba(245,158,11,0.5)',
              }}
            />
          </div>
          {/* Thumb dot */}
          <div
            className="absolute h-3 w-3 rounded-full pointer-events-none -translate-x-1/2 shadow-lg"
            style={{
              left: `${videoProgress}%`,
              background: '#f59e0b',
              boxShadow: '0 0 0 3px rgba(245,158,11,0.2), 0 2px 8px rgba(0,0,0,0.6)',
            }}
          />
          {/* Native input */}
          <input
            type="range" min="0" max="100" step="0.1" value={videoProgress}
            onChange={e => {
              const v = +e.target.value;
              setVideoProgress(v);
              if (videoRef.current?.duration) {
                const t = (v / 100) * videoRef.current.duration;
                videoRef.current.currentTime = t;
                if (audioRef.current) audioRef.current.currentTime = trimStartRef.current;
              }
            }}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
          />
        </div>
        <span className="text-[10px] text-zinc-600 font-mono w-8 shrink-0 tabular-nums">
          {fmt(videoDuration)}
        </span>
      </div>

      {/* ── ZONE 4: TOOLBAR ──────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 pt-1 pb-6">
        <div
          className="flex items-center justify-between rounded-2xl px-3 py-2.5"
          style={{
            background: 'linear-gradient(180deg, #151519 0%, #111115 100%)',
            border: '1px solid rgba(255,255,255,0.07)',
            boxShadow: '0 -1px 0 rgba(255,255,255,0.03), 0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          {/* Left: tools */}
          <div className="flex gap-0.5">
            <ToolBtn icon={<Type size={17} />} label="Metin" active={openPanel === 'text'} onClick={() => togglePanel('text')} />
            <ToolBtn icon={<Frame size={17} />} label="Çerçeve" active={openPanel === 'frame'} onClick={() => togglePanel('frame')} />
            <ToolBtn icon={<Sparkles size={17} />} label="Efekt" active={openPanel === 'effect'} onClick={() => togglePanel('effect')} />
            <ToolBtn icon={<Music size={17} />} label="Müzik" active={openPanel === 'music'} onClick={() => togglePanel('music')} />
          </div>

          {/* Center: play + action buttons */}
          <div className="flex items-center gap-2">
            {/* Sıfırla button */}
            <button
              onClick={onReset}
              title="Sıfırla"
              className="flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200 text-zinc-500 hover:text-zinc-200"
              style={{ background: 'transparent' }}
            >
              <RotateCcw size={17} />
              <span className="text-[8px] font-bold uppercase tracking-widest leading-none">Sıfırla</span>
            </button>

            {/* Play button */}
            <button
              onClick={togglePlay}
              className="w-14 h-14 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200 shrink-0"
              style={{
                background: isPlaying
                  ? 'linear-gradient(135deg, #e5e5e5 0%, #ffffff 100%)'
                  : 'linear-gradient(135deg, #ffffff 0%, #e8e8e8 100%)',
                boxShadow: '0 0 0 1px rgba(255,255,255,0.15), 0 8px 28px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)',
                color: '#0a0a0e',
              }}
            >
              {isPlaying
                ? <Pause size={24} fill="currentColor" />
                : <Play size={24} fill="currentColor" className="ml-0.5" />
              }
            </button>

            {/* Kaydet button */}
            <button
              onClick={exportVideo}
              disabled={isExporting}
              className="flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: isExporting ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.15)',
                color: '#f59e0b',
              }}
            >
              {isExporting
                ? <Loader2 size={17} className="animate-spin" />
                : <Download size={17} />
              }
              <span className="text-[8px] font-bold uppercase tracking-widest leading-none">
                {isExporting ? `${Math.round(exportProgress)}%` : 'Kaydet'}
              </span>
            </button>
          </div>

          {/* Right: empty for balance */}
          <div className="w-20" />
        </div>
      </div>

      {/* ── PANELS ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {openPanel === 'text' && (
          <Sheet title={selectedId ? 'Metin Düzenle' : 'Metin Ekle'} onClose={() => setOpenPanel(null)}>
            {!selectedId ? (
              <button
                onClick={addText}
                className="w-full py-3 rounded-xl text-sm font-bold tracking-wide transition-all hover:opacity-90 active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                  color: '#000',
                  boxShadow: '0 4px 16px rgba(245,158,11,0.25)',
                }}
              >
                + Yeni Metin Ekle
              </button>
            ) : sel ? (
              <div className="flex flex-col gap-3">
                {/* Input row */}
                <div className="flex gap-2">
                  <textarea
                    value={sel.text}
                    onChange={e => updateSel({ text: e.target.value })}

                    autoFocus rows={5}
                    className="flex-1 text-white text-sm px-3 py-2.5 rounded-xl resize-none focus:outline-none transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = 'rgba(245,158,11,0.5)';
                      e.target.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.08)';
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                      e.target.style.boxShadow = 'none';
                    }}
                    placeholder="Metin girin..."
                  />
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => setSelectedId(null)}
                      className="p-2.5 rounded-xl text-black font-bold transition-all hover:opacity-90"
                      style={{ background: 'linear-gradient(135deg, #f59e0b, #ea580c)' }}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => { setUserTexts(t => t.filter(x => x.id !== selectedId)); setSelectedId(null); }}
                      className="p-2.5 rounded-xl text-red-400 transition-all hover:text-red-300"
                      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.15)' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Scale + align */}
                <div
                  className="flex items-center gap-3 rounded-xl p-2.5"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-[10px] text-zinc-600 font-black">A</span>
                    <input
                      type="range" min="0.5" max="3" step="0.1" value={sel.scale || 1}
                      onChange={e => updateSel({ scale: +e.target.value })}
                      className="flex-1 cursor-pointer"
                      style={{ accentColor: '#f59e0b', height: '3px' }}
                    />
                    <span className="text-sm text-zinc-400 font-black leading-none">A</span>
                  </div>
                  <div className="w-px h-4 bg-white/8" />
                  <div className="flex gap-0.5">
                    {(['left', 'center', 'right'] as const).map(a => (
                      <button key={a} onClick={() => updateSel({ textAlign: a })}
                        className="p-1.5 rounded-lg transition-all"
                        style={{
                          background: (sel.textAlign || 'center') === a ? 'rgba(245,158,11,0.2)' : 'transparent',
                          color: (sel.textAlign || 'center') === a ? '#f59e0b' : 'rgba(255,255,255,0.25)',
                        }}
                      >
                        {a === 'left' ? <AlignLeft size={13} /> : a === 'center' ? <AlignCenter size={13} /> : <AlignRight size={13} />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Timing */}
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold shrink-0">Süre</span>
                  <div
                    className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.04)' }}
                  >
                    <input type="number" step="0.1" min="0" value={Math.round((sel.startTime || 0) * 10) / 10}
                      onChange={e => updateSel({ startTime: +e.target.value || 0 })}
                      className="w-10 bg-transparent text-[12px] text-white text-center focus:outline-none font-mono tabular-nums" />
                    <span className="text-zinc-700 text-xs">→</span>
                    <input type="number" step="0.1" min="0" value={Math.round((sel.endTime || videoDuration || 10) * 10) / 10}
                      onChange={e => updateSel({ endTime: +e.target.value || videoDuration })}
                      className="w-10 bg-transparent text-[12px] text-white text-center focus:outline-none font-mono tabular-nums" />
                    <span className="text-[10px] text-zinc-700 ml-1">sn</span>
                  </div>
                </div>

                {/* Fonts */}
                <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
                  {FONTS.map(f => (
                    <button key={f} onClick={() => updateSel({ fontFamily: f })}
                      className="px-3 py-1.5 rounded-lg text-xs whitespace-nowrap font-semibold shrink-0 transition-all"
                      style={{
                        background: sel.fontFamily === f ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${sel.fontFamily === f ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.06)'}`,
                        color: sel.fontFamily === f ? '#f59e0b' : 'rgba(255,255,255,0.4)',
                      }}
                    >
                      {f[0].toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-zinc-600 text-sm text-center py-3">Videodaki bir metne dokun</p>
            )}
          </Sheet>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {openPanel === 'frame' && (
          <Sheet title="Çerçeve" onClose={() => setOpenPanel(null)}>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
              {FRAME_OPTIONS.map(f => (
                <button key={f} onClick={() => setUserFrame(f)}
                  className="px-3 py-1.5 rounded-lg text-xs capitalize whitespace-nowrap font-semibold shrink-0 transition-all"
                  style={{
                    background: userFrame === f ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${userFrame === f ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.06)'}`,
                    color: userFrame === f ? '#f59e0b' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {f === 'none' ? 'Yok' : f}
                </button>
              ))}
              {customFrames.map(url => (
                <button key={url} onClick={() => setUserFrame(url)}
                  className="w-14 h-9 rounded-lg overflow-hidden shrink-0 border-2 transition-all"
                  style={{ borderColor: userFrame === url ? '#f59e0b' : 'transparent' }}>
                  <img src={url} className="w-full h-full object-cover" />
                </button>
              ))}
              <label
                className="flex items-center px-3 py-1.5 rounded-lg text-zinc-500 text-xs cursor-pointer shrink-0 hover:text-zinc-300 transition-colors whitespace-nowrap font-semibold"
                style={{ border: '1px dashed rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)' }}
              >
                <input type="file" accept="image/png,image/webp" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) { const u = URL.createObjectURL(f); setCustomFrames(p => [...p, u]); setUserFrame(u); } }} />
                + PNG
              </label>
            </div>
            <TimingRow isFull={frameTiming.isFull} startTime={frameTiming.startTime} endTime={frameTiming.endTime}
              videoDuration={videoDuration}
              onToggle={v => setFrameTiming(p => ({ ...p, isFull: v }))}
              onStart={v => setFrameTiming(p => ({ ...p, startTime: v }))}
              onEnd={v => setFrameTiming(p => ({ ...p, endTime: v }))} />
          </Sheet>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {openPanel === 'effect' && (
          <Sheet title="Efekt" onClose={() => setOpenPanel(null)}>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
              {EFFECT_OPTIONS.map(e => (
                <button key={e.key} onClick={() => setUserEffect(e.key)}
                  className="px-3 py-1.5 rounded-lg text-xs whitespace-nowrap font-semibold shrink-0 transition-all"
                  style={{
                    background: userEffect === e.key ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${userEffect === e.key ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.06)'}`,
                    color: userEffect === e.key ? '#f59e0b' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {e.label}
                </button>
              ))}
            </div>
            <TimingRow isFull={effectTiming.isFull} startTime={effectTiming.startTime} endTime={effectTiming.endTime}
              videoDuration={videoDuration}
              onToggle={v => setEffectTiming(p => ({ ...p, isFull: v }))}
              onStart={v => setEffectTiming(p => ({ ...p, startTime: v }))}
              onEnd={v => setEffectTiming(p => ({ ...p, endTime: v }))} />
          </Sheet>
        )}
      </AnimatePresence>

      {/* ── MÜZİK PANELİ ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {openPanel === 'music' && (
          <Sheet title="Müzik" onClose={() => setOpenPanel(null)}>
            {/* Gizli file input */}
            <input
              ref={musicFileRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const url = URL.createObjectURL(file);
                // Önceki custom url'yi temizle
                if (customAudioUrl) URL.revokeObjectURL(customAudioUrl);
                setCustomAudioUrl(url);
                sourceBlobRef.current = url; // orijinal kaynağı sakla
                // Trim sıfırlanacak — metadata effect halleder
                setTrimStart(0); trimStartRef.current = 0;
                setTrimEnd(0);   trimEndRef.current = 0;
                setTrimApplied(false);
                e.target.value = '';
              }}
            />

            {/* Mevcut müzik adı + değiştir butonu */}
            <div
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(245,158,11,0.15)' }}>
                <Music size={15} style={{ color: '#f59e0b' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-bold truncate">
                  {customAudioUrl ? 'Özel Müzik' : `${vibe} Teması`}
                </p>
                <p className="text-zinc-600 text-[10px] font-mono tabular-nums">
                  {audioDuration > 0 ? fmt(audioDuration) : '--:--'}
                  {trimEnd > 0 && audioDuration > 0 && (trimStart > 0 || trimEnd < audioDuration) &&
                    <span className="ml-1 text-amber-500/70">
                      · kırpma: {fmt(trimStart)}–{fmt(trimEnd)}
                    </span>
                  }
                </p>
              </div>
              <button
                onClick={() => musicFileRef.current?.click()}
                className="px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all active:scale-95"
                style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}
              >
                Değiştir
              </button>
            </div>

            {/* Kırpma alanı — sadece ses yüklüyse göster */}
            {audioDuration > 0 && trimEnd > 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Kırpma Aralığı</span>
                  <button
                    onClick={() => {
                      setTrimStart(0); trimStartRef.current = 0;
                      setTrimEnd(audioDuration); trimEndRef.current = audioDuration;
                    }}
                    className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors font-medium"
                  >
                    Sıfırla
                  </button>
                </div>

                {/* Tek trim bar */}
                {(() => {
                  const posToTime = (clientX: number) => {
                    const rect = trimBarRef.current?.getBoundingClientRect();
                    if (!rect) return 0;
                    return Math.max(0, Math.min(audioDuration, ((clientX - rect.left) / rect.width) * audioDuration));
                  };
                  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
                    const rect = trimBarRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    const clickPx = e.clientX - rect.left;
                    const startPx = (trimStartRef.current / audioDuration) * rect.width;
                    const endPx   = (trimEndRef.current   / audioDuration) * rect.width;
                    trimDragging.current = Math.abs(clickPx - startPx) <= Math.abs(clickPx - endPx) ? 'start' : 'end';
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    e.preventDefault();
                  };
                  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
                    if (!trimDragging.current) return;
                    const t = posToTime(e.clientX);
                    if (trimDragging.current === 'start') {
                      const val = Math.min(t, trimEndRef.current - 0.5);
                      setTrimStart(val); trimStartRef.current = val;
                      if (audioRef.current) audioRef.current.currentTime = val;
                    } else {
                      const val = Math.max(t, trimStartRef.current + 0.5);
                      setTrimEnd(val); trimEndRef.current = val;
                    }
                  };
                  const onPointerUp = () => { trimDragging.current = null; };

                  const startPct = (trimStart / audioDuration) * 100;
                  const endPct   = (trimEnd   / audioDuration) * 100;

                  return (
                    <div className="flex flex-col gap-2 select-none">
                      <div
                        ref={trimBarRef}
                        className="relative h-10 flex items-center cursor-pointer touch-none"
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onPointerCancel={onPointerUp}
                      >
                        {/* Track bg */}
                        <div className="absolute inset-x-0 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
                        {/* Sol kırpılan */}
                        <div className="absolute h-2 rounded-l-full" style={{ left: 0, width: `${startPct}%`, background: 'rgba(255,255,255,0.1)' }} />
                        {/* Seçili */}
                        <div className="absolute h-2" style={{
                          left: `${startPct}%`, width: `${endPct - startPct}%`,
                          background: 'linear-gradient(90deg,#f59e0b,#ea580c)',
                          boxShadow: '0 0 6px rgba(245,158,11,0.45)',
                        }} />
                        {/* Sağ kırpılan */}
                        <div className="absolute h-2 rounded-r-full" style={{ left: `${endPct}%`, right: 0, background: 'rgba(255,255,255,0.1)' }} />
                        {/* Start handle */}
                        <div className="absolute w-4 h-6 rounded-sm -translate-x-1/2 flex items-center justify-center pointer-events-none"
                          style={{ left: `${startPct}%`, background: '#f59e0b', boxShadow: '0 0 0 2px rgba(245,158,11,0.35),0 2px 8px rgba(0,0,0,0.5)' }}>
                          <div className="w-0.5 h-3 rounded-full bg-black/40" />
                        </div>
                        {/* End handle */}
                        <div className="absolute w-4 h-6 rounded-sm -translate-x-1/2 flex items-center justify-center pointer-events-none"
                          style={{ left: `${endPct}%`, background: '#ea580c', boxShadow: '0 0 0 2px rgba(234,88,12,0.35),0 2px 8px rgba(0,0,0,0.5)' }}>
                          <div className="w-0.5 h-3 rounded-full bg-black/40" />
                        </div>
                      </div>
                      {/* Zaman etiketleri */}
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          <span className="text-amber-400 text-[11px] font-mono font-bold tabular-nums">{fmt(trimStart)}</span>
                        </div>
                        <span className="text-zinc-600 text-[10px] font-mono tabular-nums">{fmt(trimEnd - trimStart)} seçili</span>
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: 'rgba(234,88,12,0.08)', border: '1px solid rgba(234,88,12,0.2)' }}>
                          <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                          <span className="text-orange-400 text-[11px] font-mono font-bold tabular-nums">{fmt(trimEnd)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Kaydet butonu */}
                <button
                  onClick={applyTrim}
                  disabled={isTrimming || trimEnd <= trimStart || (trimStart === 0 && trimEnd === audioDuration)}
                  className="w-full py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: trimApplied
                      ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                      : 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                    color: '#000',
                    boxShadow: trimApplied
                      ? '0 4px 16px rgba(34,197,94,0.3)'
                      : '0 4px 16px rgba(245,158,11,0.25)',
                  }}
                >
                  {isTrimming ? (
                    <><Loader2 size={14} className="animate-spin" /> Kırpılıyor...</>
                  ) : trimApplied ? (
                    <><Check size={14} /> Uygulandı</>
                  ) : (
                    <><Scissors size={14} /> Kırp ve Uygula</>
                  )}
                </button>
              </div>
            )}
          </Sheet>
        )}
      </AnimatePresence>

      {/* Export overlay */}
      <AnimatePresence>
        {isExporting && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(9,9,13,0.88)', backdropFilter: 'blur(12px)' }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 360 }}
              className="flex flex-col items-center gap-5 mx-6 w-full max-w-xs p-8 rounded-3xl"
              style={{
                background: 'linear-gradient(180deg, #151519 0%, #111115 100%)',
                border: '1px solid rgba(255,255,255,0.07)',
                boxShadow: '0 40px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
              }}
            >
              {/* Spinner ring */}
              <div className="relative w-14 h-14">
                <div
                  className="absolute inset-0 rounded-full"
                  style={{ border: '2px solid rgba(245,158,11,0.15)' }}
                />
                <div
                  className="absolute inset-0 rounded-full animate-spin"
                  style={{
                    border: '2px solid transparent',
                    borderTopColor: '#f59e0b',
                    borderRightColor: 'rgba(245,158,11,0.3)',
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-black text-amber-400 tabular-nums">
                    {Math.round(exportProgress)}
                  </span>
                </div>
              </div>

              <div className="text-center">
                <p className="text-white font-bold text-sm tracking-wide">Video kaydediliyor</p>
                <p className="text-zinc-600 text-xs mt-1">%{Math.round(exportProgress)} tamamlandı</p>
              </div>

              <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <motion.div
                  className="h-full rounded-full"
                  animate={{ width: `${exportProgress}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  style={{ background: 'linear-gradient(90deg, #f59e0b, #ea580c)' }}
                />
              </div>

              <p className="text-amber-500/50 text-[10px] text-center font-medium">
                ⚠ Sekmeyi değiştirmeyin
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function ToolBtn({
  icon, label, active = false, onClick
}: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-0.5 px-3.5 py-2 rounded-xl transition-all duration-200"
      style={{
        background: active ? 'rgba(245,158,11,0.12)' : 'transparent',
        color: active ? '#f59e0b' : 'rgba(255,255,255,0.28)',
      }}
    >
      {icon}
      <span className="text-[8px] font-bold uppercase tracking-widest leading-none">
        {label}
      </span>
    </button>
  );
}

function Sheet({
  title, onClose, children
}: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 40, opacity: 0 }}
      transition={{ type: 'spring', damping: 32, stiffness: 420 }}
      className="absolute bottom-[92px] left-3 right-3 rounded-2xl z-40 overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #161619 0%, #121215 100%)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 -4px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <span className="text-xs font-black uppercase tracking-[0.15em] text-zinc-300">
          {title}
        </span>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-full transition-all"
          style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }}
        >
          <X size={12} />
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {children}
      </div>
    </motion.div>
  );
}

function TimingRow({
  isFull, startTime, endTime, videoDuration, onToggle, onStart, onEnd
}: {
  isFull: boolean; startTime: number; endTime: number; videoDuration: number;
  onToggle: (v: boolean) => void; onStart: (v: number) => void; onEnd: (v: number) => void;
}) {
  return (
    <div
      className="flex items-center gap-3 pt-3"
      style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      <button
        onClick={() => onToggle(!isFull)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0"
        style={{
          background: isFull ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${isFull ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.07)'}`,
          color: isFull ? '#f59e0b' : 'rgba(255,255,255,0.35)',
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: isFull ? '#f59e0b' : 'rgba(255,255,255,0.2)', boxShadow: isFull ? '0 0 6px rgba(245,158,11,0.6)' : 'none' }}
        />
        Tüm video
      </button>
      {!isFull && (
        <div
          className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        >
          <input type="number" step="0.1" min="0" value={Math.round(startTime * 10) / 10}
            onChange={e => onStart(+e.target.value || 0)}
            className="w-10 bg-transparent text-[12px] text-white text-center focus:outline-none font-mono tabular-nums" />
          <span className="text-zinc-700 text-xs">→</span>
          <input type="number" step="0.1" min="0" value={Math.round((endTime || videoDuration) * 10) / 10}
            onChange={e => onEnd(+e.target.value || videoDuration)}
            className="w-10 bg-transparent text-[12px] text-white text-center focus:outline-none font-mono tabular-nums" />
          <span className="text-[10px] text-zinc-700 ml-auto">sn</span>
        </div>
      )}
    </div>
  );
}