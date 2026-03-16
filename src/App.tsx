import React, { useState } from 'react';
import { CameraRecorder } from './components/CameraRecorder';
import { VideoPreview } from './components/VideoPreview';
import { generateVideoEditScript, EditSegment } from './services/ai';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Video, Music, Wand2, Upload } from 'lucide-react';

type AppStep = 'setup' | 'recording' | 'processing' | 'preview';

const VIBES = ['Energetic', 'Cinematic', 'Minimalist', 'Cyberpunk'];

export default function App() {
  const [step, setStep] = useState<AppStep>('setup');
  const [vibe, setVibe] = useState<string>(VIBES[0]);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [editScript, setEditScript] = useState<EditSegment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRecordingComplete = async (blob: Blob) => {
    setVideoBlob(blob);
    setStep('processing');
    setError(null);
    try {
      const script = await generateVideoEditScript(blob, vibe);
      setEditScript(script);
      setStep('preview');
    } catch (err) {
      console.error(err);
      setError("Failed to generate AI edit. Please try again.");
      setStep('setup');
    }
  };

  const reset = () => {
    setStep('setup');
    setVideoBlob(null);
    setEditScript(null);
    setError(null);
  };

  return (
    <div className="w-full h-[100dvh] bg-zinc-950 text-zinc-50 overflow-hidden font-sans">
      <AnimatePresence mode="wait">
        {step === 'setup' && (
          <motion.div 
            key="setup"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="h-full flex flex-col items-center justify-center p-6 max-w-md mx-auto"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-indigo-500/20">
              <Sparkles size={40} className="text-white" />
            </div>
            
            <h1 className="text-4xl font-bold mb-2 tracking-tight text-center">SpinEdit AI</h1>
            <p className="text-zinc-400 text-center mb-12">Shoot 360° products. Let AI do the editing.</p>

            <div className="w-full space-y-8">
              <div>
                <label className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Music size={16} /> Select Vibe
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {VIBES.map(v => (
                    <button
                      key={v}
                      onClick={() => setVibe(v)}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        vibe === v 
                          ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300' 
                          : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800'
                      }`}
                    >
                      <span className="font-medium">{v}</span>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setStep('recording')}
                  className="w-full py-5 rounded-2xl bg-white text-black font-bold text-lg flex items-center justify-center gap-3 hover:bg-zinc-200 transition-colors active:scale-95"
                >
                  <Video size={24} />
                  Start Recording
                </button>

                <div className="relative w-full">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleRecordingComplete(file);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <button
                    className="w-full py-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold text-lg flex items-center justify-center gap-3 hover:bg-zinc-800 transition-colors active:scale-95"
                  >
                    <Upload size={20} />
                    Upload Video (Test)
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
            <CameraRecorder onRecordingComplete={handleRecordingComplete} maxDuration={10} />
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
              Analyzing your 360° product video and applying the {vibe.toLowerCase()} vibe.
            </p>
          </motion.div>
        )}

        {step === 'preview' && videoBlob && editScript && (
          <motion.div 
            key="preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full w-full"
          >
            <VideoPreview 
              videoBlob={videoBlob} 
              editScript={editScript} 
              vibe={vibe}
              onReset={reset}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
