import React, { useRef, useState, useEffect } from 'react';
import { EditSegment } from '../services/ai';
import { Play, Pause, RotateCcw, Share, Type, Trash2, Check, Frame, Download, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share as CapShare } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

interface VideoPreviewProps {
  videoBlob: Blob;
  editScript: EditSegment[];
  vibe: string;
  initialTexts?: any[];
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

export function VideoPreview({ videoBlob, editScript, vibe, initialTexts = [], onReset }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSegment, setCurrentSegment] = useState<EditSegment | null>(null);
  const currentSegmentRef = useRef<EditSegment | null>(null);
  const [visibleTexts, setVisibleTexts] = useState<UserText[]>([]);
  const visibleTextsRef = useRef<string>('');

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
  const [customFrames, setCustomFrames] = useState<string[]>([]);
  const [showFrameMenu, setShowFrameMenu] = useState(false);

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

  const togglePlay = () => {
    initAudioContext();
    if (videoRef.current && audioRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        audioRef.current.pause();
      } else {
        videoRef.current.play();
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
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

    initAudioContext();
    const canvasStream = canvas.captureStream(30);
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
    const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
    
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
      const finalBlob = new Blob(chunks, { type: mimeType });
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
    
    // Fix for webm blobs not seeking properly in Chrome
    if (videoUrl.startsWith('blob:')) {
      video.src = videoUrl;
    } else {
      video.currentTime = 0;
    }
    audio.currentTime = 0;
    
    // We need to play to capture the stream
    try {
      await video.play();
      await audio.play();
    } catch (e) {
      console.error("Playback failed during export", e);
      setIsExporting(false);
      return;
    }
    
    let duration = video.duration;
    if (!duration || duration === Infinity || isNaN(duration)) {
      duration = editScript[editScript.length - 1]?.endTime || 10;
    }
    let lastPlaybackRate = -1;
    
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
      }
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      if (frameImg) {
        ctx.filter = 'none';
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
      <audio ref={audioRef} src={VIBE_AUDIO[vibe] || VIBE_AUDIO['Energetic']} loop crossOrigin="anonymous" />

      {/* Video Container */}
      <div 
        className={`relative w-full max-w-md aspect-[9/16] transition-all duration-500 overflow-hidden ${getFrameClasses(activeFrame.startsWith('blob:') ? 'none' : activeFrame)}`}
        onClick={() => { setSelectedTextId(null); setShowFrameMenu(false); }}
      >
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
            playsInline
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
              {['none', 'cinematic', 'polaroid', 'neon'].map(f => (
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
          onClick={() => { setShowFrameMenu(!showFrameMenu); setSelectedTextId(null); }} 
          className={`p-4 rounded-full backdrop-blur-md transition-colors shadow-lg ${showFrameMenu ? 'bg-indigo-500 text-white shadow-indigo-500/20' : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-white'}`}
        >
          <Frame size={24} />
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
