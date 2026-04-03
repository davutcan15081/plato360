import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';

interface EffectsOverlayProps {
  effect: string;
}

export function EffectsOverlay({ effect }: EffectsOverlayProps) {
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; size: number; color?: string; delay: number; duration: number }[]>([]);

  useEffect(() => {
    if (effect === 'snow') {
      const newParticles = Array.from({ length: 50 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: -10 - Math.random() * 20,
        size: Math.random() * 4 + 2,
        delay: Math.random() * 5,
        duration: Math.random() * 3 + 3,
      }));
      setParticles(newParticles);
    } else if (effect === 'confetti') {
      const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
      const newParticles = Array.from({ length: 100 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: -10 - Math.random() * 20,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 2,
        duration: Math.random() * 2 + 2,
      }));
      setParticles(newParticles);
    } else if (effect === 'balloons') {
      const colors = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'];
      const newParticles = Array.from({ length: 15 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: 110 + Math.random() * 20,
        size: Math.random() * 20 + 30,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 5,
        duration: Math.random() * 4 + 4,
      }));
      setParticles(newParticles);
    } else if (effect === 'rain') {
      const newParticles = Array.from({ length: 80 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: -10 - Math.random() * 20,
        size: Math.random() * 2 + 1,
        delay: Math.random() * 2,
        duration: Math.random() * 0.5 + 0.5,
      }));
      setParticles(newParticles);
    } else if (effect === 'hearts') {
      const colors = ['#ff4d6d', '#ff758f', '#ff85a1', '#fbb1bd', '#ffb3c1'];
      const newParticles = Array.from({ length: 20 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: 110 + Math.random() * 20,
        size: Math.random() * 15 + 15,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 5,
        duration: Math.random() * 3 + 4,
      }));
      setParticles(newParticles);
    } else if (effect === 'stars') {
      const newParticles = Array.from({ length: 40 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 6 + 4,
        delay: Math.random() * 5,
        duration: Math.random() * 1.5 + 1,
      }));
      setParticles(newParticles);
    } else if (effect === 'matrix') {
      const chars = '0123456789ABCDEF'.split('');
      const newParticles = Array.from({ length: 40 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: -10 - Math.random() * 20,
        size: Math.random() * 14 + 10,
        delay: Math.random() * 4,
        duration: Math.random() * 2 + 2,
        char: chars[Math.floor(Math.random() * chars.length)]
      }));
      setParticles(newParticles as any);
    } else {
      setParticles([]);
    }
  }, [effect]);

  if (effect === 'none' || !effect) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      {effect === 'snow' && particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-white/80"
          style={{ width: p.size, height: p.size, left: `${p.x}%`, top: `${p.y}%` }}
          animate={{
            y: ['0vh', '120vh'],
            x: [`${p.x}%`, `${p.x + (Math.random() * 10 - 5)}%`]
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: 'linear'
          }}
        />
      ))}

      {effect === 'confetti' && particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute"
          style={{ width: p.size / 2, height: p.size, backgroundColor: p.color, left: `${p.x}%`, top: `${p.y}%` }}
          animate={{
            y: ['0vh', '120vh'],
            x: [`${p.x}%`, `${p.x + (Math.random() * 20 - 10)}%`],
            rotateX: [0, 360],
            rotateY: [0, 360],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: 'linear'
          }}
        />
      ))}

      {effect === 'balloons' && particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{ 
            width: p.size, 
            height: p.size * 1.2, 
            backgroundColor: p.color, 
            left: `${p.x}%`, 
            top: `${p.y}%`,
            boxShadow: 'inset -5px -5px 10px rgba(0,0,0,0.2)'
          }}
          animate={{
            y: ['0vh', '-120vh'],
            x: [`${p.x}%`, `${p.x + (Math.random() * 10 - 5)}%`]
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: 'linear'
          }}
        >
          {/* Balloon string */}
          <div className="absolute top-full left-1/2 w-[1px] h-10 bg-white/50 -translate-x-1/2" />
        </motion.div>
      ))}
      {effect === 'rain' && particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute bg-blue-300/40"
          style={{ width: 1, height: p.size * 15, left: `${p.x}%`, top: `${p.y}%` }}
          animate={{ y: ['0vh', '120vh'] }}
          transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: 'linear' }}
        />
      ))}

      {effect === 'hearts' && particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute text-2xl flex items-center justify-center"
          style={{ width: p.size, height: p.size, left: `${p.x}%`, top: `${p.y}%`, color: p.color }}
          animate={{ y: ['0vh', '-120vh'], opacity: [0, 1, 1, 0], scale: [0.5, 1, 1.2, 1] }}
          transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: 'easeOut' }}
        >
          ❤
        </motion.div>
      ))}

      {effect === 'stars' && particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute text-yellow-200"
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
          animate={{ 
            opacity: [0, 1, 0],
            scale: [0.5, 1.2, 0.5],
            rotate: [0, 180, 360]
          }}
          transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
        >
          ✦
        </motion.div>
      ))}

      {effect === 'matrix' && particles.map((p: any) => (
        <motion.div
          key={p.id}
          className="absolute font-mono text-green-500 font-bold opacity-70"
          style={{ fontSize: p.size, left: `${p.x}%`, top: `${p.y}%`, textShadow: '0 0 8px rgba(34, 197, 94, 0.8)' }}
          animate={{ y: ['0vh', '120vh'] }}
          transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: 'linear' }}
        >
          {p.char}
        </motion.div>
      ))}
    </div>
  );
}
