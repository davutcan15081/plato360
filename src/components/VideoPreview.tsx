import React, { useRef, useState, useEffect } from 'react';
import { EditSegment } from '../services/ai';
import {
  Play, Pause, Type, Trash2, Check, Download,
  Loader2, AlignLeft, AlignCenter, AlignRight, Frame, Sparkles, X, Menu
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
  'Energetic': 'https://raw.githubusercontent.com/photonstorm/phalcon3-examples/master/public/assets/audio/bodenstaendig_2000_in_rock_4bit.mp3',
  'Cinematic': 'https://raw.githubusercontent.com/photonstorm/phalcon3-examples/master/public/assets/audio/CatAstroPhi_shmup_normal.mp3',
  'Minimalist': 'https://raw.githubusercontent.com/photonstorm/phalcon3-examples/master/public/assets/audio/tech/bass.mp3',
  'Cyberpunk': 'https://raw.githubusercontent.com/photonstorm/phalcon3-examples/master/public/assets/audio/oedipus_wizball_highscore.mp3',
};

const FONTS = ['inter', 'anton', 'caveat', 'playfair', 'bebas', 'pacifico', 'cinzel', 'oswald', 'montserrat', 'quicksand', 'lobster', 'abril'];

const FRAME_OPTIONS = ['none', 'cinematic', 'neon', 'aurora', 'cyber', 'fire', 'ice', 'galaxy', 'retro', 'gold', 'crystal', 'minimal', 'tv', 'comic', 'newspaper'];
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

type Panel = 'text' | 'frame' | 'effect' | null;

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

  /* effects */
  useEffect(() => {
    if (customAudioBlob) {
      const u = URL.createObjectURL(customAudioBlob);
      setCustomAudioUrl(u);
      return () => URL.revokeObjectURL(u);
    }
  }, [customAudioBlob]);

  useEffect(() => { setVideoUrl(initialVideoUrl); }, [initialVideoUrl]);

  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    const onMeta = () => setVideoDuration(v.duration || 0);
    v.addEventListener('loadedmetadata', onMeta);
    return () => v.removeEventListener('loadedmetadata', onMeta);
  }, [videoUrl]);

  useEffect(() => {
    let raf: number;
    const tick = () => {
      const v = videoRef.current;
      if (v) {
        const time = v.currentTime;
        const seg = editScript.find(s => time >= s.startTime && time <= s.endTime) ?? editScript.at(-1)!;
        if (seg && seg !== segRef.current) { setCurrentSeg(seg); segRef.current = seg; }
        
        // Timing logic for Frame and Effect
        let rf = userFrame, re = userEffect;
        if (!frameTiming.isFull && (time < frameTiming.startTime || time > frameTiming.endTime)) rf = 'none';
        if (!effectTiming.isFull && (time < effectTiming.startTime || time > effectTiming.endTime)) re = 'none';
        
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
  }, [editScript, userTexts, userFrame, userEffect, frameTiming, effectTiming, activeFrame, activeEffect]);

  const fmt = (s: number) => {
    if (!s || isNaN(s) || s === Infinity) return '0:00';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  const initAudio = () => {
    try {
      if (!audioCtxRef.current && audioRef.current) {
        const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
        const ctx = new AC(); audioCtxRef.current = ctx;
        const src = ctx.createMediaElementSource(audioRef.current);
        const dest = ctx.createMediaStreamDestination();
        src.connect(dest); src.connect(ctx.destination); audioDestRef.current = dest;
      }
      if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
    } catch { }
  };

  const togglePlay = async () => {
    initAudio();
    const v = videoRef.current, a = audioRef.current;
    if (!v || !a) return;
    if (isPlaying) {
      v.pause(); a.pause(); setIsPlaying(false);
    } else {
      v.muted = true;
      try { await v.play(); await a.play(); setIsPlaying(true); } catch { setIsPlaying(false); }
    }
  };

  const handleEnded = () => {
    if (!isExporting) {
      setIsPlaying(false);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    }
  };

  const addText = () => {
    const id = Date.now().toString();
    setUserTexts(p => [...p, {
      id, text: 'YENİ METİN', fontFamily: 'inter',
      startTime: 0, endTime: videoDuration || 10,
      scale: 1, yOffset: 0, xOffset: 0, textAlign: 'center'
    }]);
    setSelectedId(id); setOpenPanel('text');
  };

  const sel = userTexts.find(t => t.id === selectedId);
  const updateSel = (patch: Partial<UserText>) =>
    setUserTexts(ts => ts.map(t => t.id === selectedId ? { ...t, ...patch } : t));

  /* ── UPDATED: Canlı ve Tematik Çerçeveler ───────────────────────────────────── */
  const getFrameCls = (f?: string) => {
    const m: Record<string, string> = {
      cinematic: 'border-y-[10vh] border-black shadow-[inset_0_0_80px_rgba(0,0,0,0.9)] relative before:absolute before:inset-0 before:border-y-[1px] before:border-white/10',
      neon: 'border-[4px] border-fuchsia-500 shadow-[0_0_20px_#ec4899,0_0_40px_#ec4899,inset_0_0_20px_#ec4899] animate-pulse',
      aurora: 'border-[8px] border-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-teal-500 bg-clip-border shadow-[0_0_40px_rgba(168,85,247,0.5)]',
      cyber: 'border-2 border-cyan-400 shadow-[0_0_15px_#22d3ee] before:absolute before:top-0 before:left-0 before:w-4 before:h-4 before:border-t-4 before:border-l-4 before:border-yellow-400 after:absolute after:bottom-0 after:right-0 after:w-4 after:h-4 after:border-b-4 after:border-r-4 after:border-yellow-400',
      fire: 'border-[6px] border-orange-600 shadow-[0_0_40px_#ea580c,0_0_70px_#f43f5e] after:absolute after:inset-0 after:bg-gradient-to-t after:from-orange-500/10 after:to-transparent',
      ice: 'border-[10px] border-blue-100/50 shadow-[0_0_30px_#bae6fd,inset_0_0_20px_white] backdrop-blur-[2px]',
      galaxy: 'border-[8px] border-indigo-900 shadow-[0_0_50px_#4338ca,inset_0_0_40px_black] relative overflow-hidden before:absolute before:inset-0 before:bg-[radial-gradient(circle,white_1px,transparent_1px)] before:bg-[size:20px_20px] before:opacity-20',
      retro: 'border-[10px] border-pink-500 shadow-[6px_6px_0px_#4ade80,-6px_-6px_0px_#8b5cf6]',
      gold: 'border-[12px] border-transparent bg-gradient-to-br from-yellow-200 via-yellow-500 to-amber-700 bg-clip-border shadow-[0_10px_30px_rgba(0,0,0,0.5)]',
      crystal: 'border-[10px] border-white/40 shadow-[0_0_25px_white,inset_0_0_15px_rgba(255,255,255,0.5)] backdrop-blur-md',
      minimal: 'border-[1px] border-white/20 m-6 shadow-2xl',
      tv: 'rounded-[40px] border-[18px] border-zinc-800 shadow-[0_0_0_8px_#27272a,inset_0_0_80px_black] overflow-hidden',
      comic: 'border-[8px] border-black shadow-[10px_10px_0_black] bg-white',
      newspaper: 'border-[25px] border-zinc-200 grayscale contrast-125 shadow-[inset_0_0_40px_black] border-style-double',
    };
    return m[f ?? 'none'] ?? '';
  };

  const getFontCls = (f?: string) => {
    const m: Record<string, string> = {
      anton: 'font-["Anton"] tracking-wide uppercase',
      caveat: 'font-["Caveat"] capitalize',
      playfair: 'font-["Playfair_Display"] italic capitalize',
      bebas: 'font-["Bebas_Neue"] tracking-wider uppercase',
      pacifico: 'font-["Pacifico"] capitalize font-normal',
      cinzel: 'font-["Cinzel"] tracking-widest uppercase font-bold',
      oswald: 'font-["Oswald"] tracking-tight uppercase font-bold',
      montserrat: 'font-["Montserrat"] font-extrabold tracking-tight',
      quicksand: 'font-["Quicksand"] font-bold',
      lobster: 'font-["Lobster"]',
      abril: 'font-["Abril_Fatface"]',
    };
    return m[f ?? ''] ?? 'font-["Inter"] font-black tracking-tighter uppercase';
  };

  /* ── Export Video ── */
  const exportVideo = async () => {
    if (!videoRef.current || !audioRef.current || isExporting) return;
    setIsExporting(true); setExportProgress(0); setIsPlaying(false);
    const video = videoRef.current, audio = audioRef.current;
    initAudio();

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 1280;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setIsExporting(false); return; }

    const cs = (canvas as any).captureStream?.(30) || (canvas as any).mozCaptureStream?.(30);
    const as = audioDestRef.current?.stream;
    const rec = new MediaRecorder(new MediaStream([...cs.getVideoTracks(), ...(as?.getAudioTracks() ?? [])]), { mimeType: 'video/mp4' });
    const chunks: Blob[] = [];
    rec.ondataavailable = e => chunks.push(e.data);

    rec.onstop = async () => {
      const blob = new Blob(chunks, { type: 'video/mp4' });
      const fn = `spin-${Date.now()}.mp4`;
      if (Capacitor.isNativePlatform()) {
        const reader = new FileReader(); reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const s = await Filesystem.writeFile({ path: fn, data: reader.result as string, directory: Directory.Cache });
          await CapShare.share({ url: s.uri });
        };
      } else {
        const url = URL.createObjectURL(blob);
        Object.assign(document.createElement('a'), { href: url, download: fn }).click();
      }
      setIsExporting(false);
    };

    rec.start(); video.currentTime = 0; audio.currentTime = 0;
    await video.play(); await audio.play();

    const drawFrame = () => {
      if (video.ended || !isExporting) { rec.stop(); return; }
      setExportProgress((video.currentTime / video.duration) * 100);
      
      // Video
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Frame drawing on Canvas
      if (activeFrame === 'cinematic') {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height * 0.1);
        ctx.fillRect(0, canvas.height * 0.9, canvas.width, canvas.height * 0.1);
      } else if (activeFrame === 'neon') {
        ctx.strokeStyle = '#ec4899'; ctx.lineWidth = 15; ctx.shadowBlur = 20; ctx.shadowColor = '#ec4899';
        ctx.strokeRect(0, 0, canvas.width, canvas.height); ctx.shadowBlur = 0;
      } else if (activeFrame === 'aurora') {
        const g = ctx.createLinearGradient(0, 0, canvas.width, 0);
        g.addColorStop(0, '#6366f1'); g.addColorStop(1, '#14b8a6');
        ctx.strokeStyle = g; ctx.lineWidth = 25; ctx.strokeRect(0, 0, canvas.width, canvas.height);
      } else if (activeFrame === 'gold') {
        const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        g.addColorStop(0, '#fde047'); g.addColorStop(0.5, '#fbbf24'); g.addColorStop(1, '#b45309');
        ctx.strokeStyle = g; ctx.lineWidth = 30; ctx.strokeRect(0, 0, canvas.width, canvas.height);
      }

      // Texts
      userTexts.forEach(tx => {
        const t = video.currentTime;
        if (t < (tx.startTime || 0) || t > (tx.endTime || video.duration)) return;
        ctx.font = `bold ${canvas.width * 0.08 * (tx.scale || 1)}px sans-serif`;
        ctx.fillStyle = 'white'; ctx.textAlign = tx.textAlign || 'center';
        ctx.shadowColor = 'black'; ctx.shadowBlur = 10;
        ctx.fillText(tx.text, canvas.width/2 + (tx.xOffset || 0), canvas.height/2 + (tx.yOffset || 0));
        ctx.shadowBlur = 0;
      });

      requestAnimationFrame(drawFrame);
    };
    drawFrame();
  };

  return (
    <div className="w-full h-full bg-zinc-950 flex flex-col overflow-hidden relative">
      <audio ref={audioRef} src={customAudioUrl || VIBE_AUDIO[vibe] || VIBE_AUDIO['Energetic']} loop />

      <div className="flex-1 min-h-0 overflow-hidden relative p-4 flex items-center justify-center">
        <div
          ref={containerRef}
          className={`relative w-full aspect-[9/16] max-h-full transition-all duration-500 ease-in-out ${getFrameCls(activeFrame)}`}
          onClick={() => { setSelectedId(null); setOpenPanel(null); }}
        >
          <EffectsOverlay effect={activeEffect} />
          
          <video
            ref={videoRef} src={videoUrl}
            className="w-full h-full object-cover"
            onEnded={handleEnded}
            playsInline muted
          />

          <AnimatePresence>
            {visibleTexts.map(t => (
              <motion.div
                key={t.id}
                drag dragMomentum={false}
                onDragEnd={(_, info) => updateSel({ xOffset: (t.xOffset || 0) + info.offset.x, yOffset: (t.yOffset || 0) + info.offset.y })}
                className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-move z-30
                  ${selectedId === t.id ? 'ring-2 ring-indigo-500 p-2' : ''}`}
                onClick={(e) => { e.stopPropagation(); setSelectedId(t.id); setOpenPanel('text'); }}
              >
                <h2 className={`${getFontCls(t.fontFamily)} text-white text-3xl drop-shadow-2xl text-center`}
                    style={{ transform: `scale(${t.scale || 1})`, pointerEvents: 'none' }}>
                  {t.text}
                </h2>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-6 py-2 bg-zinc-950">
         <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500" style={{ width: `${videoProgress}%` }} />
         </div>
      </div>

      {/* Toolbar */}
      <div className="p-4 bg-zinc-900 border-t border-white/5 flex items-center justify-around">
        <ToolBtn icon={<Type />} label="Metin" active={openPanel === 'text'} onClick={() => togglePanel('text')} />
        <ToolBtn icon={<Frame />} label="Çerçeve" active={openPanel === 'frame'} onClick={() => togglePanel('frame')} />
        <ToolBtn icon={<Sparkles />} label="Efekt" active={openPanel === 'effect'} onClick={() => togglePanel('effect')} />
        
        <button onClick={togglePlay} className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-black shadow-xl">
          {isPlaying ? <Pause fill="black" /> : <Play fill="black" />}
        </button>

        <button onClick={exportVideo} className="p-4 bg-indigo-600 rounded-2xl text-white">
          {isExporting ? <Loader2 className="animate-spin" /> : <Download />}
        </button>
      </div>

      {/* Panels */}
      <AnimatePresence>
        {openPanel === 'frame' && (
          <Sheet title="Çerçeve Seç" onClose={() => setOpenPanel(null)}>
            <div className="flex gap-3 overflow-x-auto p-2 scrollbar-hide">
              {FRAME_OPTIONS.map(f => (
                <button
                  key={f}
                  onClick={() => setUserFrame(f)}
                  className={`px-4 py-3 rounded-xl capitalize whitespace-nowrap border-2 transition-all
                    ${userFrame === f ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-zinc-800 text-zinc-400'}`}
                >
                  {f}
                </button>
              ))}
            </div>
            <TimingRow 
              isFull={frameTiming.isFull} 
              onToggle={(v) => setFrameTiming(p => ({...p, isFull: v}))}
              startTime={frameTiming.startTime}
              endTime={frameTiming.endTime}
              onStart={(v) => setFrameTiming(p => ({...p, startTime: v}))}
              onEnd={(v) => setFrameTiming(p => ({...p, endTime: v}))}
              videoDuration={videoDuration}
            />
          </Sheet>
        )}
      </AnimatePresence>

      {/* Text Panel & Effect Panel similarly... */}

    </div>
  );
}

/* Helpers */
function ToolBtn({ icon, label, active, onClick }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 ${active ? 'text-indigo-400' : 'text-zinc-500'}`}>
      {icon}
      <span className="text-[10px] font-bold uppercase">{label}</span>
    </button>
  );
}

function Sheet({ title, onClose, children }: any) {
  return (
    <motion.div
      initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      className="absolute bottom-0 left-0 right-0 bg-zinc-900 rounded-t-3xl border-t border-white/10 p-6 z-50 shadow-2xl"
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white font-bold">{title}</h3>
        <button onClick={onClose} className="p-2 bg-zinc-800 rounded-full"><X size={16} /></button>
      </div>
      {children}
    </motion.div>
  );
}

function TimingRow({ isFull, onToggle, startTime, endTime, onStart, onEnd, videoDuration }: any) {
    return (
        <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-4">
            <button onClick={() => onToggle(!isFull)} className={`px-3 py-1 rounded-lg text-xs ${isFull ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                Tüm Video
            </button>
            {!isFull && (
                <div className="flex gap-2 items-center text-white text-sm">
                    <input type="number" className="w-12 bg-zinc-800 rounded p-1" value={startTime} onChange={e => onStart(+e.target.value)} />
                    <span>-</span>
                    <input type="number" className="w-12 bg-zinc-800 rounded p-1" value={endTime || videoDuration} onChange={e => onEnd(+e.target.value)} />
                </div>
            )}
        </div>
    )
}