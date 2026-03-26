'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

const FlowCanvas = dynamic(() => import('@/components/FlowCanvas'), {
  ssr: false,
});

const Starfield: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const stars: Array<{ x: number; y: number; size: number; speed: number; opacity: number }> = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const initStars = () => {
      const starCount = 200;
      for (let i = 0; i < starCount; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 2 + 0.5,
          speed: Math.random() * 0.5 + 0.1,
          opacity: Math.random() * 0.5 + 0.5,
        });
      }
    };

    const draw = () => {
      ctx.fillStyle = 'rgba(17, 24, 39, 1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      stars.forEach(star => {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
        ctx.fill();

        star.y -= star.speed;
        if (star.y < 0) {
          star.y = canvas.height;
          star.x = Math.random() * canvas.width;
        }

        star.opacity += (Math.random() - 0.5) * 0.05;
        star.opacity = Math.max(0.3, Math.min(1, star.opacity));
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    resize();
    initStars();
    draw();

    const handleResize = () => {
      resize();
      stars.length = 0;
      initStars();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ background: 'linear-gradient(to bottom, #0f0f23, #1a1a2e)' }}
    />
  );
};

const CanvasLoginGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [granted, setGranted] = useState<boolean>(false);
  const [input, setInput] = useState<string>('');
  const [error, setError] = useState<string>('');

  if (granted) return <>{children}</>;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = input.trim() === 'Jasonhuang';
    if (ok) {
      setGranted(true);
      setError('');
    } else {
      setError('密钥错误');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden">
      <Starfield />

      <div className="relative z-10 w-full max-w-sm">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-white/20">
          <h1 className="text-2xl font-semibold text-white mb-4">Canvas 访问</h1>
          <p className="text-sm text-gray-300 mb-6">请输入访问密钥后进入。</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">访问密钥</label>
              <input
                type="password"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="输入密钥"
                className="w-full p-2 border border-gray-500/50 rounded-md bg-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent backdrop-blur-sm"
              />
            </div>
            {error && (
              <div className="text-red-400 text-sm bg-red-500/20 rounded-md p-2">{error}</div>
            )}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-2 rounded-md hover:from-green-600 hover:to-emerald-700 transition-all duration-200 font-medium shadow-lg"
            >
              进入画布
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default function CanvasPage() {
  return (
    <CanvasLoginGate>
      <FlowCanvas />
    </CanvasLoginGate>
  );
}