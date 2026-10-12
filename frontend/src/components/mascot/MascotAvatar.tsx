import React, { useState, useEffect } from 'react';
import faviconImg from '../../assets/favicon.png';

interface MascotAvatarProps {
  mood?: 'calm' | 'thinking' | 'attention' | 'success' | 'critical';
  size?: 'sm' | 'md' | 'lg' | 'hero';
  onClick?: () => void;
  showSpeech?: boolean;
  speechText?: string;
  className?: string;
}

export const MascotAvatar: React.FC<MascotAvatarProps> = ({
  mood = 'calm',
  size = 'md',
  onClick,
  showSpeech = false,
  speechText = "I'm monitoring shelf facings and demand rates.",
  className = '',
}) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isBlinking, setIsBlinking] = useState(false);

  // Mouse tracking for subtle eye & head tilt
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      const x = (e.clientX / innerWidth - 0.5) * 12; // -6 to +6 px
      const y = (e.clientY / innerHeight - 0.5) * 8; // -4 to +4 px
      setMousePos({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Periodic blinking
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 160);
    }, 4200);

    return () => clearInterval(blinkInterval);
  }, []);

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
    hero: 'w-48 h-48 md:w-56 md:h-56',
  }[size];

  // Mood badge styling
  const moodBadge = {
    calm: { label: 'Operational', color: 'bg-emerald-500' },
    thinking: { label: 'Evaluating MDP...', color: 'bg-indigo-500 animate-pulse' },
    attention: { label: 'Needs Attention', color: 'bg-amber-500' },
    success: { label: 'Optimal Policy Found', color: 'bg-teal-500' },
    critical: { label: 'Stockout Hazard', color: 'bg-rose-500 animate-ping' },
  }[mood];

  return (
    <div className={`relative inline-flex items-center justify-center select-none ${className}`}>
      {/* Speech bubble if enabled */}
      {showSpeech && (
        <div className="absolute -top-16 right-4 z-20 max-w-xs bg-white/95 backdrop-blur-sm px-4 py-2.5 rounded-2xl shadow-[0_8px_20px_rgba(0,0,0,0.06)] border border-[#EAE5D9] text-xs font-semibold text-[#19211D] animate-in fade-in slide-in-from-bottom-2">
          {speechText}
          <div className="absolute -bottom-2 right-10 w-3 h-3 bg-white border-b border-r border-[#EAE5D9] transform rotate-45" />
        </div>
      )}

      {/* Mascot Container */}
      <div
        onClick={onClick}
        className={`relative group ${sizeClasses} cursor-pointer transition-transform duration-300 ease-out hover:scale-105 active:scale-95`}
        style={{
          transform: `translate(${mousePos.x * 0.4}px, ${mousePos.y * 0.4}px)`,
        }}
      >
        {/* Soft aura glow matching mood */}
        <div
          className={`absolute inset-0 rounded-full blur-xl opacity-35 transition-colors duration-500 ${
            mood === 'success'
              ? 'bg-emerald-300'
              : mood === 'critical'
              ? 'bg-rose-300'
              : mood === 'thinking'
              ? 'bg-purple-300'
              : mood === 'attention'
              ? 'bg-amber-300'
              : 'bg-sage-200'
          }`}
        />

        {/* Mascot Image with procedural physics */}
        <div className="relative w-full h-full flex items-center justify-center">
          <img
            src={faviconImg}
            alt="ShelfMind Mascot"
            className={`w-full h-full object-contain filter drop-shadow-md transition-all duration-300 ${
              mood === 'thinking'
                ? 'rotate-[-3deg]'
                : mood === 'success'
                ? 'scale-105 animate-gentle-pulse'
                : 'animate-float'
            }`}
          />

          {/* Interactive procedural blush/eye reaction overlays */}
          {isBlinking && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {/* Eye-blink overlay */}
            </div>
          )}
        </div>

        {/* Small Mood Indicator Dot */}
        {size !== 'hero' && (
          <span
            className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${moodBadge.color}`}
            title={moodBadge.label}
          />
        )}
      </div>
    </div>
  );
};
