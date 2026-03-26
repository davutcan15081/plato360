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
    </div>
  );
}
