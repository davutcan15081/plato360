import React, { useState, useEffect } from 'react';
import { CameraRecorder } from './components/CameraRecorder';
import { VideoPreview } from './components/VideoPreview';
import { Settings } from './components/Settings';
import { generateVideoEditScript, generateAutoMagicEdit, EditSegment, AutoMagicResult } from './services/ai';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Video, Music, Wand2, Upload, Zap, Settings as SettingsIcon } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

type AppStep = 'setup' | 'recording' | 'processing' | 'preview' | 'settings';

const VIBES = ['Auto Magic', 'Energetic', 'Cinematic', 'Minimalist', 'Cyberpunk'];

export default function App() {
  const [step, setStep] = useState<AppStep>('setup');
  const [vibe, setVibe] = useState<string>(VIBES[0]);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [customAudioBlob, setCustomAudioBlob] = useState<Blob | null>(null);
  const [editScript, setEditScript] = useState<EditSegment[] | null>(null);
  const [initialTexts, setInitialTexts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isAutoMagic, setIsAutoMagic] = useState(false);
  const [showApiWarning, setShowApiWarning] = useState(false);

  useEffect(() => {
    const initCapacitor = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: '#09090b' });
        } catch (e) {
          console.warn('Status bar not available', e);
        }

        CapacitorApp.addListener('backButton', ({ canGoBack }) => {
          if (!canGoBack) {
            CapacitorApp.exitApp();
          } else {
            window.history.back();
          }
        });
      }
    };
    initCapacitor();
    
    return () => {
      if (Capacitor.isNativePlatform()) {
        CapacitorApp.removeAllListeners();
      }
    };
  }, []);

  const handleRecordingComplete = async (blob: Blob, forceAutoMagic: boolean = false) => {
    if (blob.size === 0) {
      setError("Recorded video is empty. Please try again.");
      setStep('setup');
      return;
    }
    // Unified blob handling (Force mime type for Android stability)
    const secureBlob = (blob.type && blob.type.length > 0) ? blob : new Blob([blob], { type: 'video/mp4' });
    setVideoBlob(secureBlob);
    setStep('processing');
    setError(null);
    setIsVideoLoading(true);

    try {
      // Convert to Base64 Data URL immediately. 
      // This is much MORE STABLE on Android than Blob URLs for long waits.
      const [duration, base64Url] = await Promise.all([
        import('./services/ai').then(m => m.getVideoDuration(secureBlob)),
        new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onloadend = () => resolve(r.result as string);
          r.onerror = reject;
          r.readAsDataURL(secureBlob);
        })
      ]);
      
      setVideoDuration(duration);
      setVideoUrl(base64Url);
      setIsVideoLoading(false);

      const useAutoMagic = forceAutoMagic || vibe === 'Auto Magic';
      setIsAutoMagic(useAutoMagic);

      if (useAutoMagic) {
        const result = await generateAutoMagicEdit(secureBlob, duration, customAudioBlob || undefined);
        setVibe(result.vibe);
        setEditScript(result.editScript);
        setInitialTexts(result.texts);
      } else {
        const script = await generateVideoEditScript(secureBlob, duration, vibe, customAudioBlob || undefined);
        setEditScript(script);
        setInitialTexts([]);
      }
      // Small delay to let browser media resources settle
      await new Promise(resolve => setTimeout(resolve, 300));
      setStep('preview');
      try {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } catch (e) {}
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate AI edit. Please try again.';
      
      // Show API warning for any API-related error
      if (errorMessage.includes('API') || errorMessage.includes('kotası') || errorMessage.includes('bağlanılamadı') || errorMessage.includes('sunucusuna')) {
        setShowApiWarning(true);
      }
      
      // Check if it's a quota-related error and suggest Test Mode
      if (errorMessage.includes('kotası aşıldı') || errorMessage.includes('API limit')) {
        setError(errorMessage + ' 🚀');
      } else {
        setError(errorMessage);
      }
      setStep('setup');
    }
  };

  const reset = () => {
    setStep('setup');
    if (videoUrl && videoUrl.startsWith('blob:')) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    setVideoBlob(null);
    setCustomAudioBlob(null);
    setEditScript(null);
    setInitialTexts([]);
    setError(null);
    setIsAutoMagic(false);
    setShowApiWarning(false);
  };

  const handleVibeSelect = async (v: string) => {
    setVibe(v);
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {}
  };

  const handleStartRecording = async () => {
    setStep('recording');
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (e) {}
  };

  return (
    <div className="w-full h-[100dvh] bg-zinc-950 text-zinc-50 overflow-hidden font-sans">
      {/* API Warning Banner */}
      <AnimatePresence>
        {showApiWarning && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-r from-orange-600 to-red-600 text-white p-3 text-center"
          >
            <div className="flex items-center justify-center gap-3">
              <span className="text-sm font-medium">⚠️ API Sorunu Tespit Edildi</span>
              <button
                onClick={async () => {
                  const { saveSettings } = await import('./services/settings');
                  await saveSettings({ aiProvider: 'mock' });
                  setShowApiWarning(false);
                  setError('Test Modu aktif! Artık API limitsiz kullanabilirsiniz. 🎉');
                  try {
                    await Haptics.impact({ style: ImpactStyle.Light });
                  } catch (e) {}
                  setTimeout(() => setError(null), 3000);
                }}
                className="px-3 py-1 bg-white text-orange-600 rounded-lg text-sm font-bold hover:bg-gray-100 transition-colors active:scale-95"
              >
                🚀 Test Modu'na Geç
              </button>
              <button
                onClick={() => setShowApiWarning(false)}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        {step === 'setup' && (
          <motion.div 
            key="setup"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="h-full w-full flex flex-col items-center p-6 max-w-md mx-auto relative overflow-y-auto scrollbar-hide"
            style={{ 
              paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2rem)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)'
            }}
          >
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-3 mt-1 shadow-2xl shadow-indigo-500/20">
              <Sparkles size={28} className="text-white" />
            </div>
            
            <h1 className="text-2xl font-bold mb-0.5 tracking-tight text-center">SpinEdit AI</h1>
            <p className="text-zinc-400 text-center mb-4 text-[13px]">Shoot 360° products. Let AI do the editing.</p>

            <button
              onClick={() => setStep('settings')}
              className="absolute top-4 right-4 p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 transition-colors active:scale-95 border border-white/5 backdrop-blur-sm"
            >
              <SettingsIcon size={18} className="text-zinc-400" />
            </button>

            <div className="w-full space-y-4">
              <div>
                <label className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Music size={16} /> Select Vibe
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {VIBES.map(v => (
                    <button
                      key={v}
                      onClick={() => handleVibeSelect(v)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        vibe === v 
                          ? (v === 'Auto Magic' ? 'border-purple-500 bg-purple-500/20 text-purple-300' : 'border-indigo-500 bg-indigo-500/10 text-indigo-300')
                          : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800'
                      }`}
                    >
                      <span className="font-semibold text-[11px] flex items-center gap-1.5">
                        {v === 'Auto Magic' && <Zap size={12} className="text-yellow-400" />}
                        {v}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                  <div className="text-center mb-3">{error}</div>
                  {(error.includes('kotası aşıldı') || error.includes('API') || error.includes('bağlanılamadı') || error.includes('sunucusuna')) && (
                    <button
                      onClick={async () => {
                        const { saveSettings } = await import('./services/settings');
                        await saveSettings({ aiProvider: 'mock' });
                        setError('Test Modu aktif! Artık API limitsiz kullanabilirsiniz. 🎉');
                        try {
                          await Haptics.impact({ style: ImpactStyle.Light });
                        } catch (e) {}
                        setTimeout(() => setError(null), 3000);
                      }}
                      className="w-full px-3 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors active:scale-95"
                    >
                      🚀 Hemen Test Modu'na Geç
                    </button>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setVibe('Auto Magic');
                    handleStartRecording();
                  }}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-base flex items-center justify-center gap-3 hover:opacity-90 transition-opacity shadow-lg shadow-indigo-500/20 active:scale-95"
                >
                  <Zap size={20} className="text-yellow-300" />
                  Otomatik Sihirli Çekim
                </button>

                <button
                  onClick={handleStartRecording}
                  className="w-full py-3 rounded-xl bg-white text-black font-bold text-base flex items-center justify-center gap-3 hover:bg-zinc-200 transition-colors active:scale-95"
                >
                  <Video size={18} />
                  Normal Çekim
                </button>

                <div className="relative w-full">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setVibe('Auto Magic');
                        handleRecordingComplete(file, true);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <button
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 text-white font-bold text-base flex items-center justify-center gap-3 hover:opacity-90 transition-opacity shadow-lg shadow-rose-500/20 active:scale-95"
                  >
                    <Zap size={20} className="text-yellow-300" />
                    Otomatik Sihirli Yükle
                  </button>
                </div>

                <div className="relative w-full">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleRecordingComplete(file, false);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <button
                    className="w-full py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold text-base flex items-center justify-center gap-3 hover:bg-zinc-800 transition-colors active:scale-95"
                  >
                    <Upload size={18} />
                    Normal Video Yükle
                  </button>
                </div>

                <div className="relative w-full">
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setCustomAudioBlob(file);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <button
                    className={`w-full py-3 rounded-xl border font-bold text-base flex items-center justify-center gap-3 transition-colors active:scale-95 ${
                      customAudioBlob 
                        ? 'bg-green-500/20 border-green-500 text-green-400' 
                        : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    <Music size={18} />
                    {customAudioBlob ? 'Müzik Eklendi' : 'Kendi Müziğini Ekle'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'recording' && (
          <motion.div 
            key="recording"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full w-full"
          >
            <CameraRecorder 
              onRecordingComplete={handleRecordingComplete} 
              onCancel={() => setStep('setup')}
              maxDuration={10} 
            />
          </motion.div>
        )}

        {step === 'processing' && (
          <motion.div 
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full flex flex-col items-center justify-center p-6"
          >
            <div className="relative w-24 h-24 mb-8">
              <div className="absolute inset-0 border-4 border-zinc-800 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Wand2 size={32} className="text-indigo-400 animate-pulse" />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-2 text-center">AI is editing...</h2>
            <p className="text-zinc-400 text-center max-w-xs">
              {isVideoLoading 
                ? "Preparing video data..."
                : isAutoMagic 
                  ? "Analyzing video, choosing the best vibe, and generating promotional texts..."
                  : `Analyzing your 360° product video and applying the ${vibe.toLowerCase()} vibe.`}
            </p>
          </motion.div>
        )}

        {step === 'preview' && videoUrl && editScript && (
          <motion.div 
            key="preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full w-full"
          >
            <VideoPreview 
              videoUrl={videoUrl} 
              videoBlob={videoBlob!}
              editScript={editScript} 
              vibe={vibe}
              initialTexts={initialTexts}
              customAudioBlob={customAudioBlob}
              onReset={reset}
            />
          </motion.div>
        )}

        {step === 'settings' && (
          <motion.div 
            key="settings"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full w-full"
          >
            <Settings onBack={() => setStep('setup')} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
