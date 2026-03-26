import React, { useRef, useState, useEffect } from 'react';
import { EditSegment } from '../services/ai';
import { Play, Pause, RotateCcw, Share, Type, Trash2, Check, Frame, Download, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share as CapShare } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { EffectsOverlay } from './EffectsOverlay';

interface VideoPreviewProps {
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
}

const VIBE_AUDIO: Record<string, string> = {
  'Energetic': 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/audio/bodenstaendig_2000_in_rock_4bit.mp3',
  'Cinematic': 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/audio/CatAstroPhi_shmup_normal.mp3',
  'Minimalist': 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/audio/tech/bass.mp3',
  'Cyberpunk': 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/audio/oedipus_wizball_highscore.mp3'
};

const FONTS = ['inter', 'anton', 'caveat', 'playfair', 'space', 'bebas', 'pacifico', 'cinzel', 'marker', 'righteous', 'oswald'];

export function VideoPreview({ videoBlob, editScript, vibe, initialTexts = [], customAudioBlob, onReset }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSegment, setCurrentSegment] = useState<EditSegment | null>(null);
  const currentSegmentRef = useRef<EditSegment | null>(null);
  const [visibleTexts, setVisibleTexts] = useState<UserText[]>([]);
  const visibleTextsRef = useRef<string>('');
  const [customAudioUrl, setCustomAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    if (customAudioBlob) {
      const url = URL.createObjectURL(customAudioBlob);
      setCustomAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [customAudioBlob]);

  const initAudioContext = () => {
    try {
      if (!audioCtxRef.current && audioRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        audioCtxRef.current = ctx;
        
        const source = ctx.createMediaElementSource(audioRef.current);
        const dest = ctx.createMediaStreamDestination();
        
        source.connect(dest);
        source.connect(ctx.destination);
        audioDestRef.current = dest;
      }
      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    } catch (e) {
      console.warn("Audio context initialization failed", e);
    }
  };
  const [videoUrl, setVideoUrl] = useState<string>('');
  
  const [userTexts, setUserTexts] = useState<UserText[]>(() => {
    return initialTexts.map((t, i) => ({
      id: `auto-${i}`,
      text: t.text,
      fontFamily: t.fontFamily || 'inter',
      startTime: t.startTime,
      endTime: t.endTime,
      yOffset: t.yOffset || 0
    }));
  });

  // Initialize visible texts on mount or when userTexts change
  useEffect(() => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      const currentVisibleTexts = userTexts.filter(t => t.startTime === undefined || (time >= t.startTime && time <= t.endTime));
      setVisibleTexts(currentVisibleTexts);
      visibleTextsRef.current = currentVisibleTexts.map(t => t.id).join(',');
    } else {
      setVisibleTexts(userTexts.filter(t => t.startTime === undefined || (0 >= t.startTime && 0 <= t.endTime)));
    }
  }, [userTexts]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);

  const [activeFrame, setActiveFrame] = useState<string>(editScript[0]?.frameStyle || 'none');
  const [activeEffect, setActiveEffect] = useState<string>(editScript[0]?.effect || 'none');
  const [customFrames, setCustomFrames] = useState<string[]>([]);
  const [showFrameMenu, setShowFrameMenu] = useState(false);
  const [showEffectMenu, setShowEffectMenu] = useState(false);

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const handleCustomFrameUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomFrames(prev => [...prev, url]);
      setActiveFrame(url);
    }
  };

  useEffect(() => {
    const url = URL.createObjectURL(videoBlob);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [videoBlob]);

  useEffect(() => {
    let animationFrameId: number;
    let lastPlaybackRate = -1;
    
    const checkTime = () => {
      if (videoRef.current) {
        const time = videoRef.current.currentTime;
        
        const segment = editScript.find(s => time >= s.startTime && time <= s.endTime) || editScript[editScript.length - 1];
        
        if (segment) {
          if (segment !== currentSegmentRef.current) {
            setCurrentSegment(segment);
            currentSegmentRef.current = segment;
            if (segment.frameStyle) setActiveFrame(segment.frameStyle);
            if (segment.effect) setActiveEffect(segment.effect);
          }

          // Apply playback rate
          let rate = segment.playbackRate;
          if (typeof rate !== 'number' || isNaN(rate) || rate <= 0) rate = 1;
          if (rate < 0.5) rate = 0.5;
          if (rate > 5.0) rate = 5.0;

          if (lastPlaybackRate !== rate) {
            videoRef.current.playbackRate = rate;
            lastPlaybackRate = rate;
          }
        }

        // Update visible texts
        const currentVisibleTexts = userTexts.filter(t => t.startTime === undefined || (time >= t.startTime && time <= t.endTime));
        const visibleIds = currentVisibleTexts.map(t => t.id).join(',');
        if (visibleIds !== visibleTextsRef.current) {
          setVisibleTexts(currentVisibleTexts);
          visibleTextsRef.current = visibleIds;
        }
      }
      animationFrameId = requestAnimationFrame(checkTime);
    };

    animationFrameId = requestAnimationFrame(checkTime);
    return () => cancelAnimationFrame(animationFrameId);
  }, [editScript, isExporting]);

  const togglePlay = async () => {
    initAudioContext();
    if (videoRef.current && audioRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        // Ensure video is muted before playing to satisfy autoplay policies on some mobile browsers
        videoRef.current.muted = true;
        
        const p1 = videoRef.current.play();
        const p2 = audioRef.current.play();
        
        let videoSuccess = false;
        try {
          if (p1 !== undefined) await p1;
          videoSuccess = true;
        } catch (e) {
          console.error("Video play failed", e);
        }
        
        let audioSuccess = false;
        try {
          if (p2 !== undefined) await p2;
          audioSuccess = true;
        } catch (e) {
          console.error("Audio play failed", e);
        }
        
        if (videoSuccess) {
          setIsPlaying(true);
          if (!audioSuccess) {
            console.warn("Playing video without audio because audio failed");
          }
        } else {
          // If video failed, pause audio just in case it succeeded
          audioRef.current.pause();
          setIsPlaying(false);
          alert("Video oynatılamadı. Lütfen farklı bir video yüklemeyi deneyin.");
        }
      }
    }
  };

  const handleVideoEnded = () => {
    if (!isExporting) {
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  };

  const addText = () => {
    const newId = Date.now().toString();
    setUserTexts([...userTexts, { id: newId, text: 'YENİ METİN', fontFamily: 'inter' }]);
    setSelectedTextId(newId);
    setShowFrameMenu(false);
  };

  const exportVideo = async () => {
    if (!videoRef.current || !audioRef.current || isExporting) return;
    setIsExporting(true);
    setExportProgress(0);
    setIsPlaying(false);

    const video = videoRef.current;
    const audio = audioRef.current;
    
    // Initialize audio context and play immediately to preserve user gesture context on iOS
    initAudioContext();
    
    try {
      const vp = video.play();
      const ap = audio.play();
      if (vp !== undefined) await vp;
      if (ap !== undefined) await ap;
      video.pause();
      audio.pause();
    } catch (e) {
      console.error("Initial playback for export failed", e);
      try {
        await video.play();
        video.pause();
      } catch (err) {
        console.error("Video fallback playback failed during export", err);
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 1280;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      setIsExporting(false);
      return;
    }

    let frameImg: HTMLImageElement | null = null;
    if (activeFrame.startsWith('blob:')) {
      frameImg = new Image();
      frameImg.src = activeFrame;
      await new Promise(resolve => {
        if (frameImg) {
          frameImg.onload = resolve;
          frameImg.onerror = resolve;
        } else {
          resolve(null);
        }
      });
    }

    const canvasStream = canvas.captureStream ? canvas.captureStream(30) : (canvas as any).mozCaptureStream ? (canvas as any).mozCaptureStream(30) : null;
    
    if (!canvasStream) {
      console.error("captureStream not supported");
      setIsExporting(false);
      alert("Cihazınız veya tarayıcınız video dışa aktarmayı desteklemiyor.");
      return;
    }
    
    const audioStream = audioDestRef.current?.stream;
    
    const tracks = [...canvasStream.getVideoTracks()];
    if (audioStream) {
      tracks.push(...audioStream.getAudioTracks());
    }
    
    const combinedStream = new MediaStream(tracks);
    
    const supportedTypes = [
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,vorbis',
      'video/webm;codecs=vp8,vorbis',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ];
    const mimeType = supportedTypes.find(t => MediaRecorder.isTypeSupported(t)) || 'video/mp4';
    // Force .mp4 extension as requested by user, even if recorded as webm
    const extension = 'mp4';
    
    const recorder = new MediaRecorder(combinedStream, { mimeType });
    const chunks: Blob[] = [];
    
    recorder.ondataavailable = e => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (recorder.state === 'recording') {
          recorder.pause();
          video.pause();
          audio.pause();
        }
      } else {
        if (recorder.state === 'paused') {
          recorder.resume();
          video.play().catch(console.error);
          audio.play().catch(console.error);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    recorder.onstop = async () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Force the blob type to video/mp4 for better compatibility when downloading with .mp4 extension
      const finalBlob = new Blob(chunks, { type: 'video/mp4' });
      const fileName = `spinedit-${Date.now()}.${extension}`;
      
      if (Capacitor.isNativePlatform()) {
        try {
          const reader = new FileReader();
          reader.readAsDataURL(finalBlob);
          reader.onloadend = async () => {
            const base64data = reader.result as string;
            
            const savedFile = await Filesystem.writeFile({
              path: fileName,
              data: base64data,
              directory: Directory.Cache
            });
            
            await CapShare.share({
              title: 'My SpinEdit Video',
              url: savedFile.uri,
              dialogTitle: 'Share Video'
            });
          };
        } catch (e) {
          console.error("Error saving/sharing", e);
          alert("Error saving video.");
        }
      } else {
        const url = URL.createObjectURL(finalBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
      setIsExporting(false);
      setExportProgress(100);
      setTimeout(() => setExportProgress(0), 1000);
    };
    
    recorder.start();
    
    video.currentTime = 0;
    audio.currentTime = 0;
    
    // We need to play to capture the stream
    try {
      video.muted = true; // Ensure muted for autoplay policy
      const vp = video.play();
      const ap = audio.play();
      
      let videoSuccess = false;
      try {
        if (vp !== undefined) await vp;
        videoSuccess = true;
      } catch (e) {
        console.error("Video play failed during export", e);
      }
      
      let audioSuccess = false;
      try {
        if (ap !== undefined) await ap;
        audioSuccess = true;
      } catch (e) {
        console.error("Audio play failed during export", e);
      }
      
      if (!videoSuccess) {
        audio.pause();
        setIsExporting(false);
        alert("Video oynatılamadı. Lütfen tekrar deneyin.");
        return;
      }
    } catch (e) {
      console.error("Playback setup failed during export", e);
      audio.pause();
      setIsExporting(false);
      return;
    }
    
    let duration = video.duration;
    if (!duration || duration === Infinity || isNaN(duration)) {
      duration = editScript[editScript.length - 1]?.endTime || 10;
    }
    let lastPlaybackRate = -1;
    
    let currentEffect = 'none';
    let particles: any[] = [];
    
    const initParticles = (effect: string) => {
      if (effect === currentEffect) return;
      currentEffect = effect;
      if (effect === 'snow') {
        particles = Array.from({ length: 50 }).map(() => ({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 4 + 2,
          speedY: Math.random() * 3 + 2,
          speedX: Math.random() * 2 - 1
        }));
      } else if (effect === 'confetti') {
        const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
        particles = Array.from({ length: 100 }).map(() => ({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 8 + 4,
          color: colors[Math.floor(Math.random() * colors.length)],
          speedY: Math.random() * 5 + 3,
          speedX: Math.random() * 4 - 2,
          rotation: Math.random() * 360,
          rotSpeed: Math.random() * 10 - 5
        }));
      } else if (effect === 'balloons') {
        const colors = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'];
        particles = Array.from({ length: 15 }).map(() => ({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 20 + 30,
          color: colors[Math.floor(Math.random() * colors.length)],
          speedY: -(Math.random() * 3 + 2),
          speedX: Math.random() * 2 - 1
        }));
      } else {
        particles = [];
      }
    };

    const drawFrame = () => {
      if (video.currentTime >= duration - 0.1 || video.ended) {
        if (recorder.state === 'recording') {
          recorder.stop();
          video.pause();
          audio.pause();
        }
        return;
      }
      
      const time = video.currentTime;
      setExportProgress((time / duration) * 100);
      
      const segment = editScript.find(s => time >= s.startTime && time <= s.endTime) || editScript[editScript.length - 1];
      
      let currentFrameStyle = activeFrame;
      let currentEffectStyle = activeEffect;
      
      if (segment) {
        let rate = segment.playbackRate;
        if (typeof rate !== 'number' || isNaN(rate) || rate <= 0) rate = 1;
        if (rate < 0.5) rate = 0.5;
        if (rate > 5.0) rate = 5.0;

        if (lastPlaybackRate !== rate) {
          video.playbackRate = rate;
          lastPlaybackRate = rate;
        }
        if (segment.cssFilter && segment.cssFilter !== 'none') {
          ctx.filter = segment.cssFilter;
        } else {
          ctx.filter = 'none';
        }
        if (segment.frameStyle) currentFrameStyle = segment.frameStyle;
        if (segment.effect) currentEffectStyle = segment.effect;
      }
      
      initParticles(currentEffectStyle);
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Draw Effects
      if (currentEffectStyle !== 'none' && particles.length > 0) {
        ctx.filter = 'none';
        particles.forEach(p => {
          if (currentEffectStyle === 'snow') {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            p.y += p.speedY;
            p.x += p.speedX;
            if (p.y > canvas.height) p.y = -10;
            if (p.x < 0) p.x = canvas.width;
            if (p.x > canvas.width) p.x = 0;
          } else if (currentEffectStyle === 'confetti') {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation * Math.PI / 180);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 4, -p.size / 2, p.size / 2, p.size);
            ctx.restore();
            p.y += p.speedY;
            p.x += p.speedX;
            p.rotation += p.rotSpeed;
            if (p.y > canvas.height) p.y = -10;
            if (p.x < 0) p.x = canvas.width;
            if (p.x > canvas.width) p.x = 0;
          } else if (currentEffectStyle === 'balloons') {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, p.size / 2, p.size * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y + p.size * 0.6);
            ctx.lineTo(p.x, p.y + p.size * 0.6 + 40);
            ctx.stroke();
            p.y += p.speedY;
            p.x += p.speedX;
            if (p.y < -p.size) p.y = canvas.height + p.size;
            if (p.x < 0) p.x = canvas.width;
            if (p.x > canvas.width) p.x = 0;
          }
        });
      }

      // Draw CSS Frames
      ctx.filter = 'none';
      if (currentFrameStyle === 'cinematic') {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height * 0.08);
        ctx.fillRect(0, canvas.height * 0.92, canvas.width, canvas.height * 0.08);
      } else if (currentFrameStyle === 'polaroid') {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, 16);
        ctx.fillRect(0, 0, 16, canvas.height);
        ctx.fillRect(canvas.width - 16, 0, 16, canvas.height);
        ctx.fillRect(0, canvas.height - 64, canvas.width, 64);
      } else if (currentFrameStyle === 'neon') {
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 8;
        ctx.shadowColor = 'rgba(236,72,153,0.8)';
        ctx.shadowBlur = 30;
        ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
        ctx.shadowBlur = 0;
      } else if (currentFrameStyle === 'vintage') {
        ctx.strokeStyle = '#8b5a2b';
        ctx.lineWidth = 40;
        ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
      } else if (currentFrameStyle === 'glitch') {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.5)';
        ctx.fillRect(0, 0, 8, canvas.height);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.5)';
        ctx.fillRect(canvas.width - 8, 0, 8, canvas.height);
      } else if (currentFrameStyle === 'minimal') {
        ctx.strokeStyle = '#f4f4f5';
        ctx.lineWidth = 16;
        ctx.beginPath();
        ctx.roundRect(8, 8, canvas.width - 16, canvas.height - 16, 24);
        ctx.stroke();
      } else if (currentFrameStyle === 'bold') {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 24;
        ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
      }
      
      if (frameImg && currentFrameStyle.startsWith('blob:')) {
        ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
      }
      
      if (userTexts.length > 0) {
        ctx.filter = 'none';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        userTexts.forEach((t, index) => {
          if (t.startTime !== undefined && t.endTime !== undefined) {
            if (time < t.startTime || time > t.endTime) return;
          }

          const fontSize = canvas.width * 0.1; 
          ctx.font = `bold ${fontSize}px ${t.fontFamily}, sans-serif`;
          ctx.fillStyle = 'white';
          ctx.strokeStyle = 'black';
          ctx.lineWidth = fontSize * 0.05;
          
          const x = canvas.width / 2;
          const y = canvas.height / 2 + (t.yOffset || (index * fontSize * 1.2));
          
          ctx.strokeText(t.text, x, y);
          ctx.fillText(t.text, x, y);
        });
      }
      
      requestAnimationFrame(drawFrame);
    };
    
    requestAnimationFrame(drawFrame);
  };

  // Frame styles
  const getFrameClasses = (style?: string) => {
    switch (style) {
      case 'cinematic': return 'border-y-[8vh] border-black';
      case 'polaroid': return 'border-[16px] border-b-[64px] border-white shadow-2xl bg-white';
      case 'neon': return 'border-4 border-pink-500 shadow-[0_0_30px_rgba(236,72,153,0.8)]';
      case 'vintage': return 'border-[20px] border-[#8b5a2b] shadow-inner';
      case 'glitch': return 'border-l-4 border-r-4 border-l-red-500 border-r-blue-500';
      case 'minimal': return 'border-[8px] border-zinc-100 rounded-3xl shadow-sm';
      case 'bold': return 'border-[12px] border-yellow-400';
      default: return '';
    }
  };

  // Font styles
  const getFontClass = (font?: string) => {
    switch(font) {
      case 'anton': return 'font-["Anton"] tracking-wide uppercase';
      case 'caveat': return 'font-["Caveat"] text-5xl md:text-6xl capitalize';
      case 'playfair': return 'font-["Playfair_Display"] italic capitalize';
      case 'space': return 'font-["Space_Grotesk"] tracking-tighter uppercase';
      case 'bebas': return 'font-["Bebas_Neue"] tracking-wider text-5xl md:text-6xl uppercase';
      case 'pacifico': return 'font-["Pacifico"] text-4xl md:text-5xl capitalize font-normal';
      case 'cinzel': return 'font-["Cinzel"] tracking-widest uppercase font-bold';
      case 'marker': return 'font-["Permanent_Marker"] text-4xl md:text-5xl uppercase';
      case 'righteous': return 'font-["Righteous"] tracking-wide uppercase';
      case 'oswald': return 'font-["Oswald"] tracking-tight uppercase font-bold';
      case 'inter':
      default: return 'font-["Inter"] font-black tracking-tighter uppercase';
    }
  };

  return (
    <div className="relative w-full h-full bg-zinc-950 flex flex-col items-center justify-center overflow-hidden">
      {/* Audio Track */}
      <audio ref={audioRef} src={customAudioUrl || VIBE_AUDIO[vibe] || VIBE_AUDIO['Energetic']} loop crossOrigin={customAudioUrl ? undefined : "anonymous"} />

      {/* Video Container */}
      <div 
        className={`relative w-full max-w-md aspect-[9/16] transition-all duration-500 overflow-hidden ${getFrameClasses(activeFrame.startsWith('blob:') ? 'none' : activeFrame)}`}
        onClick={() => { setSelectedTextId(null); setShowFrameMenu(false); setShowEffectMenu(false); }}
      >
        <EffectsOverlay effect={activeEffect} />
        {activeFrame.startsWith('blob:') && (
          <img 
            src={activeFrame} 
            alt="Custom Frame" 
            className="absolute inset-0 w-full h-full object-fill pointer-events-none z-20" 
          />
        )}
        {videoUrl && (
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-cover transition-all duration-300"
            style={{ filter: currentSegment?.cssFilter && currentSegment.cssFilter !== 'none' ? currentSegment.cssFilter : 'none' }}
            onEnded={handleVideoEnded}
            onError={(e) => {
              console.error("Video error:", e);
              const error = (e.target as HTMLVideoElement).error;
              if (error && error.code === 4) {
                alert("Bu video formatı tarayıcınız tarafından desteklenmiyor. Lütfen farklı bir video (örneğin .mp4) yüklemeyi deneyin.");
              }
            }}
            playsInline
            webkit-playsinline="true"
            controls={false}
            preload="auto"
            muted // Mute original video audio
          />
        )}
        
        {/* User Draggable Texts */}
        <AnimatePresence>
          {visibleTexts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, scale: 0.8, filter: 'blur(4px)' }}
              animate={{ 
                opacity: 1, 
                scale: selectedTextId === t.id ? 1.05 : 1,
                filter: 'blur(0px)',
                y: t.yOffset ? t.yOffset : 0
              }}
              exit={{ opacity: 0, scale: 0.8, filter: 'blur(4px)' }}
              whileHover={{ scale: selectedTextId === t.id ? 1.05 : 1.02 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              drag
              dragMomentum={false}
              onDragEnd={(e, info) => {
                setUserTexts(texts => texts.map(text => text.id === t.id ? { ...text, yOffset: (text.yOffset || 0) + info.offset.y } : text));
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTextId(t.id);
              }}
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-move p-2 rounded-lg z-30 transition-colors ${selectedTextId === t.id ? 'ring-2 ring-white/50 bg-white/10 backdrop-blur-sm shadow-xl' : 'hover:bg-white/5'}`}
            >
              <motion.h2 
                animate={{
                  y: selectedTextId === t.id ? [0, -4, 0] : [0, -2, 0],
                  textShadow: selectedTextId === t.id 
                    ? "0px 8px 20px rgba(0,0,0,0.9)" 
                    : "0px 4px 10px rgba(0,0,0,0.8)"
                }}
                transition={{
                  duration: selectedTextId === t.id ? 2 : 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className={`text-4xl md:text-5xl text-white text-center whitespace-nowrap ${getFontClass(t.fontFamily)}`}
                style={{ WebkitTextStroke: '1px rgba(0,0,0,0.5)' }}
              >
                {t.text}
              </motion.h2>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Text Edit Controls */}
      <AnimatePresence>
        {selectedTextId && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute bottom-32 left-4 right-4 max-w-md mx-auto bg-zinc-900/95 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl z-50 flex flex-col gap-4"
          >
            <div className="flex items-center gap-2">
              <input 
                type="text" 
                value={userTexts.find(t => t.id === selectedTextId)?.text || ''}
                onChange={e => setUserTexts(texts => texts.map(t => t.id === selectedTextId ? { ...t, text: e.target.value } : t))}
                className="flex-1 bg-black/50 border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                placeholder="Metin girin..."
                autoFocus
              />
              <button 
                onClick={() => setSelectedTextId(null)}
                className="p-3 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-colors"
              >
                <Check size={20} />
              </button>
            </div>
            
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <div className="flex gap-2">
                {FONTS.map(font => (
                  <button 
                    key={font}
                    onClick={() => setUserTexts(texts => texts.map(t => t.id === selectedTextId ? { ...t, fontFamily: font } : t))}
                    className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                      userTexts.find(t => t.id === selectedTextId)?.fontFamily === font 
                        ? 'bg-white text-black font-bold' 
                        : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                    }`}
                  >
                    {font.charAt(0).toUpperCase() + font.slice(1)}
                  </button>
                ))}
              </div>
              <button 
                onClick={() => {
                  setUserTexts(texts => texts.filter(t => t.id !== selectedTextId));
                  setSelectedTextId(null);
                }} 
                className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors ml-2 shrink-0"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Frame Menu */}
      <AnimatePresence>
        {showFrameMenu && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute bottom-32 left-4 right-4 max-w-md mx-auto bg-zinc-900/95 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl z-40 flex flex-col gap-4"
          >
            <h3 className="text-white font-medium text-sm">Çerçeve Seç</h3>
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {['none', 'cinematic', 'polaroid', 'neon', 'vintage', 'glitch', 'minimal', 'bold'].map(f => (
                <button
                  key={f}
                  onClick={() => setActiveFrame(f)}
                  className={`px-4 py-2 rounded-xl text-sm capitalize whitespace-nowrap transition-colors ${
                    activeFrame === f ? 'bg-indigo-500 text-white' : 'bg-white/10 text-zinc-300 hover:bg-white/20'
                  }`}
                >
                  {f}
                </button>
              ))}
              
              {customFrames.map((url) => (
                <button
                  key={url}
                  onClick={() => setActiveFrame(url)}
                  className={`relative w-16 h-10 rounded-lg overflow-hidden shrink-0 border-2 ${
                    activeFrame === url ? 'border-indigo-500' : 'border-transparent'
                  }`}
                >
                  <img src={url} className="w-full h-full object-cover" />
                </button>
              ))}

              <label className="flex items-center justify-center px-4 py-2 rounded-xl bg-white/10 text-zinc-300 hover:bg-white/20 cursor-pointer shrink-0 transition-colors text-sm font-medium border border-dashed border-white/30">
                <input type="file" accept="image/png, image/webp, image/gif" className="hidden" onChange={handleCustomFrameUpload} />
                + Şeffaf Çerçeve Yükle (PNG)
              </label>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Effect Menu */}
      <AnimatePresence>
        {showEffectMenu && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute bottom-32 left-4 right-4 max-w-md mx-auto bg-zinc-900/95 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl z-40 flex flex-col gap-4"
          >
            <h3 className="text-white font-medium text-sm">Efekt Seç</h3>
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {['none', 'snow', 'confetti', 'balloons'].map(e => (
                <button
                  key={e}
                  onClick={() => setActiveEffect(e)}
                  className={`px-4 py-2 rounded-xl text-sm capitalize whitespace-nowrap transition-colors ${
                    activeEffect === e ? 'bg-indigo-500 text-white' : 'bg-white/10 text-zinc-300 hover:bg-white/20'
                  }`}
                >
                  {e === 'none' ? 'Yok' : e === 'snow' ? 'Kar' : e === 'confetti' ? 'Konfeti' : 'Balon'}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exporting Overlay */}
      <AnimatePresence>
        {isExporting && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none"
          >
            <div className="bg-zinc-900/95 p-8 rounded-3xl shadow-2xl flex flex-col items-center border border-white/10 backdrop-blur-md">
              <Loader2 size={48} className="text-indigo-500 animate-spin mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Video Kaydediliyor...</h2>
              <div className="w-64 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-300 ease-out"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
              <p className="text-zinc-400 mt-2">{Math.round(exportProgress)}%</p>
              <p className="text-amber-400 text-xs mt-4 text-center max-w-[200px] font-medium">
                ⚠️ Lütfen işlem bitene kadar bu ekranda kalın ve sekmeyi değiştirmeyin.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Controls */}
      <div 
        className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-4 px-6 z-40"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <button onClick={onReset} className="p-4 rounded-full bg-zinc-800/80 text-zinc-300 backdrop-blur-md hover:bg-zinc-700 hover:text-white transition-colors">
          <RotateCcw size={24} />
        </button>
        
        <button onClick={togglePlay} className="p-6 rounded-full bg-white text-black shadow-xl hover:scale-105 transition-transform">
          {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
        </button>

        <button onClick={addText} className="p-4 rounded-full bg-zinc-800/80 text-zinc-300 backdrop-blur-md hover:bg-zinc-700 hover:text-white transition-colors">
          <Type size={24} />
        </button>

        <button 
          onClick={() => { setShowFrameMenu(!showFrameMenu); setShowEffectMenu(false); setSelectedTextId(null); }} 
          className={`p-4 rounded-full backdrop-blur-md transition-colors shadow-lg ${showFrameMenu ? 'bg-indigo-500 text-white shadow-indigo-500/20' : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-white'}`}
        >
          <Frame size={24} />
        </button>

        <button 
          onClick={() => { setShowEffectMenu(!showEffectMenu); setShowFrameMenu(false); setSelectedTextId(null); }} 
          className={`p-4 rounded-full backdrop-blur-md transition-colors shadow-lg ${showEffectMenu ? 'bg-indigo-500 text-white shadow-indigo-500/20' : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-white'}`}
        >
          <Sparkles size={24} />
        </button>
        
        <button 
          onClick={exportVideo}
          disabled={isExporting}
          className="p-4 rounded-full bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-600 transition-colors disabled:opacity-50"
        >
          <Download size={24} />
        </button>
      </div>
    </div>
  );
}
