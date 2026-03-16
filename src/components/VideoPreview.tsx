import React, { useRef, useState, useEffect } from 'react';
import { EditSegment } from '../services/ai';
import { Play, Pause, RotateCcw, Share, Type, Trash2, Check, Frame } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VideoPreviewProps {
  videoBlob: Blob;
  editScript: EditSegment[];
  vibe: string;
  onReset: () => void;
}

interface UserText {
  id: string;
  text: string;
  fontFamily: string;
}

const VIBE_AUDIO: Record<string, string> = {
  'Energetic': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  'Cinematic': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  'Minimalist': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  'Cyberpunk': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3'
};

const FONTS = ['inter', 'anton', 'caveat', 'playfair', 'space', 'bebas', 'pacifico', 'cinzel', 'marker', 'righteous', 'oswald'];

export function VideoPreview({ videoBlob, editScript, vibe, onReset }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSegment, setCurrentSegment] = useState<EditSegment | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  
  const [userTexts, setUserTexts] = useState<UserText[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);

  const [activeFrame, setActiveFrame] = useState<string>(editScript[0]?.frameStyle || 'none');
  const [customFrames, setCustomFrames] = useState<string[]>([]);
  const [showFrameMenu, setShowFrameMenu] = useState(false);

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
    
    const checkTime = () => {
      if (videoRef.current) {
        const time = videoRef.current.currentTime;
        const segment = editScript.find(s => time >= s.startTime && time <= s.endTime) || editScript[editScript.length - 1];
        
        if (segment) {
          setCurrentSegment(segment);
          // Apply playback rate
          if (videoRef.current.playbackRate !== segment.playbackRate) {
            videoRef.current.playbackRate = segment.playbackRate;
          }
        }
      }
      animationFrameId = requestAnimationFrame(checkTime);
    };

    animationFrameId = requestAnimationFrame(checkTime);
    return () => cancelAnimationFrame(animationFrameId);
  }, [editScript]);

  const togglePlay = () => {
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
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const addText = () => {
    const newId = Date.now().toString();
    setUserTexts([...userTexts, { id: newId, text: 'YENİ METİN', fontFamily: 'inter' }]);
    setSelectedTextId(newId);
    setShowFrameMenu(false);
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
      <audio ref={audioRef} src={VIBE_AUDIO[vibe] || VIBE_AUDIO['Energetic']} loop />

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
          {userTexts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, scale: 0.8, filter: 'blur(4px)' }}
              animate={{ 
                opacity: 1, 
                scale: selectedTextId === t.id ? 1.05 : 1,
                filter: 'blur(0px)'
              }}
              exit={{ opacity: 0, scale: 0.8, filter: 'blur(4px)' }}
              whileHover={{ scale: selectedTextId === t.id ? 1.05 : 1.02 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              drag
              dragMomentum={false}
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

      {/* Bottom Controls */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-4 px-6">
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
        
        <button className="p-4 rounded-full bg-zinc-800/80 text-zinc-300 backdrop-blur-md hover:bg-zinc-700 hover:text-white transition-colors hidden sm:block">
          <Share size={24} />
        </button>
      </div>
    </div>
  );
}
