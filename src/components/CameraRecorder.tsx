import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

interface CameraRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  onCancel: () => void;
  maxDuration?: number;
}

export function CameraRecorder({ onRecordingComplete, onCancel, maxDuration = 10 }: CameraRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(maxDuration);
  const chunksRef = useRef<Blob[]>([]);

  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    async function setupCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera API is not supported in this browser.");
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        console.warn("Failed with environment camera, trying any camera...", err);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (fallbackErr: any) {
          console.error("Error accessing camera:", fallbackErr);
          setCameraError(fallbackErr.message || "Permission denied");
        }
      }
    }
    setupCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (e) {}
    if (!videoRef.current || !videoRef.current.srcObject) return;
    
    const stream = videoRef.current.srcObject as MediaStream;
    
    let options: MediaRecorderOptions = {};
    const mimeTypes = [
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,vorbis',
      'video/webm;codecs=vp8,vorbis',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ];
    
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        options.mimeType = type;
        break;
      }
    }

    let mediaRecorder;
    try {
      mediaRecorder = new MediaRecorder(stream, options);
    } catch (e) {
      mediaRecorder = new MediaRecorder(stream); // Ultimate fallback
    }
    
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const type = chunksRef.current[0]?.type || mediaRecorder.mimeType || options.mimeType || 'video/mp4';
      const blob = new Blob(chunksRef.current, { type });
      if (blob.size === 0) {
        console.error("Recording failed: empty blob");
        setCameraError("Recording failed. Please try again.");
        return;
      }
      onRecordingComplete(blob);
    };

    mediaRecorder.start(500); // Collect data every 500ms
    setIsRecording(true);
    setTimeLeft(maxDuration);
  }, [maxDuration, onRecordingComplete]);

  const stopRecording = useCallback(async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {}
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  useEffect(() => {
    let interval: number;
    if (isRecording && timeLeft > 0) {
      interval = window.setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (isRecording && timeLeft === 0) {
      stopRecording();
    }
    return () => clearInterval(interval);
  }, [isRecording, timeLeft, stopRecording]);

  return (
    <div className="relative w-full h-full bg-black flex flex-col">
      {cameraError ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
            <span className="text-red-500 text-2xl">!</span>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Camera Access Denied</h2>
          <p className="text-zinc-400 mb-6">{cameraError}</p>
          <p className="text-sm text-zinc-500 mb-8">
            Please allow camera access in your browser settings and try again.
          </p>
          <button 
            onClick={onCancel}
            className="px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-colors"
          >
            Go Back
          </button>
        </div>
      ) : (
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="flex-1 object-cover w-full h-full"
        />
      )}
      
      {/* Overlay UI */}
      {!cameraError && (
        <div className="absolute inset-0 flex flex-col justify-between p-6 pointer-events-none">
        <div className="flex justify-between items-center mt-4">
          <button 
            onClick={onCancel}
            className="pointer-events-auto bg-black/50 text-white px-4 py-2 rounded-full font-medium text-sm backdrop-blur-md border border-white/10 hover:bg-black/70 transition-colors"
          >
            Cancel
          </button>
          <div className="bg-black/50 text-white px-4 py-1.5 rounded-full font-mono text-sm backdrop-blur-md border border-white/10">
            00:{timeLeft.toString().padStart(2, '0')}
          </div>
          {isRecording && (
            <div className="flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10">
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
              <span className="text-white text-xs font-bold tracking-wider">REC</span>
            </div>
          )}
        </div>

        <div className="flex justify-center pb-12 pointer-events-auto">
          {!isRecording ? (
            <button 
              onClick={startRecording}
              className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-white/10 backdrop-blur-md active:scale-95 transition-transform"
            >
              <div className="w-16 h-16 rounded-full bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]" />
            </button>
          ) : (
            <button 
              onClick={stopRecording}
              className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-white/10 backdrop-blur-md active:scale-95 transition-transform"
            >
              <div className="w-8 h-8 rounded-sm bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]" />
            </button>
          )}
        </div>
        </div>
      )}
    </div>
  );
}
