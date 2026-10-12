import React, { useEffect, useRef } from 'react';

interface ShaderSurfaceProps {
  className?: string;
  intensity?: number;
}

export const ShaderSurface: React.FC<ShaderSurfaceProps> = ({ className = '', intensity = 0.4 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let t = 0;

    const resize = () => {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      t += 0.008;
      const w = canvas.width;
      const h = canvas.height;

      // Clear
      ctx.clearRect(0, 0, w, h);

      // Create flowing organic radial gradients (ShaderGradient style)
      // Palette: Warm cream, soft sage green, pale warm peach
      const cx1 = w * 0.3 + Math.sin(t * 0.7) * (w * 0.15);
      const cy1 = h * 0.4 + Math.cos(t * 0.8) * (h * 0.2);
      const r1 = Math.min(w, h) * 0.8;

      const grad1 = ctx.createRadialGradient(cx1, cy1, 0, cx1, cy1, r1);
      grad1.addColorStop(0, `rgba(227, 235, 221, ${0.45 * intensity})`); // Sage
      grad1.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = grad1;
      ctx.fillRect(0, 0, w, h);

      const cx2 = w * 0.75 + Math.cos(t * 0.5) * (w * 0.18);
      const cy2 = h * 0.6 + Math.sin(t * 0.6) * (h * 0.22);
      const r2 = Math.min(w, h) * 0.75;

      const grad2 = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, r2);
      grad2.addColorStop(0, `rgba(254, 232, 214, ${0.35 * intensity})`); // Warm amber/peach
      grad2.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, w, h);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, [intensity]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 w-full h-full rounded-[inherit] overflow-hidden ${className}`}
    />
  );
};
