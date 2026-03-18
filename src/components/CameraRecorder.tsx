import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

interface CameraRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  maxDuration?: number;
}

export function CameraRecorder({ onRecordingComplete, maxDuration = 10 }: CameraRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(maxDuration);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    async function setupCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        alert("Camera access is required to record product videos.");
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
    
    let options = { mimeType: 'video/webm;codecs=vp9' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/mp4' }; // Fallback for iOS Safari
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
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const mimeType = mediaRecorder.mimeType || 'video/mp4';
      const blob = new Blob(chunksRef.current, { type: mimeType });
      onRecordingComplete(blob);
    };

    mediaRecorder.start();
    setIsRecording(true);
    setTimeLeft(maxDuration);
  }, [maxDuration, onRecordingComplete]);

  const stopRecording = useCallback(async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {}
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.requestData();
      } catch (e) {
        // Ignore if requestData fails
      }
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
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className="flex-1 object-cover w-full h-full"
      />
      
      {/* Overlay UI */}
      <div className="absolute inset-0 flex flex-col justify-between p-6 pointer-events-none">
        <div className="flex justify-between items-center mt-4">
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
    </div>
  );
}
