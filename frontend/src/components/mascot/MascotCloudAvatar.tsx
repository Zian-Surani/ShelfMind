import React, { useState, useEffect, useRef } from 'react';

interface MascotCloudAvatarProps {
  mood?: 'calm' | 'thinking' | 'attention' | 'success' | 'critical';
  size?: 'sm' | 'md' | 'lg' | 'hero';
  className?: string;
  onClick?: () => void;
}

export const MascotCloudAvatar: React.FC<MascotCloudAvatarProps> = ({
  mood = 'calm',
  size = 'md',
  className = '',
  onClick,
}) => {
  const avatarRef = useRef<HTMLDivElement>(null);
  const [pupilOffset, setPupilOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isBlinking, setIsBlinking] = useState(false);

  // Eyeball cursor tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!avatarRef.current) return;
      const rect = avatarRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = e.clientX - centerX;
      const deltaY = e.clientY - centerY;
      const angle = Math.atan2(deltaY, deltaX);
      const distance = Math.hypot(deltaX, deltaY);

      // Max pupil movement radius in pixels
      const maxRadius = size === 'hero' ? 6 : size === 'lg' ? 4.5 : size === 'md' ? 3.5 : 2;
      const dist = Math.min(maxRadius, distance * 0.025);

      setPupilOffset({
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [size]);

  // Automatic periodic blinking
  useEffect(() => {
    const interval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 140);
    }, 3800);

    return () => clearInterval(interval);
  }, []);

  const dimensions = {
    sm: { w: 42, h: 42, eyeSize: 8, pupilSize: 4.5 },
    md: { w: 68, h: 68, eyeSize: 13, pupilSize: 7 },
    lg: { w: 96, h: 96, eyeSize: 18, pupilSize: 10 },
    hero: { w: 180, h: 180, eyeSize: 32, pupilSize: 18 },
  }[size];

  // Glow aura matching mood
  const moodAura = {
    calm: 'from-[#C4D7C2]/40 to-[#E3EBDD]/20',
    thinking: 'from-purple-300/50 to-indigo-200/30 animate-pulse',
    attention: 'from-amber-300/60 to-orange-200/40 animate-pulse',
    success: 'from-emerald-300/60 to-teal-200/40',
    critical: 'from-rose-400/60 to-red-200/40 animate-ping',
  }[mood];

  return (
    <div
      ref={avatarRef}
      onClick={onClick}
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: dimensions.w, height: dimensions.h }}
    >
      {/* Soft clay mood aura */}
      <div
        className={`absolute inset-0 rounded-full bg-gradient-to-tr ${moodAura} blur-xl -z-10 transition-all duration-500`}
      />

      {/* Main Clay Cloud Character Body */}
      <div className="relative w-full h-full flex items-center justify-center animate-float">
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full filter drop-shadow-[0_8px_16px_rgba(39,71,53,0.12)]"
        >
          <defs>
            {/* Clay gradient with warm ivory light */}
            <linearGradient id="cloudBodyGrad" x1="20%" y1="0%" x2="80%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="55%" stopColor="#FAF8F2" />
              <stop offset="100%" stopColor="#E2ECE0" />
            </linearGradient>

            <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#5E966C" />
              <stop offset="100%" stopColor="#2E553B" />
            </linearGradient>

            <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="1.5" floodColor="#274735" floodOpacity="0.1" />
            </filter>
          </defs>

          {/* Leaf Sprout on top */}
          <g className="transition-transform duration-300 origin-bottom" style={{ transformOrigin: '50px 25px' }}>
            <path
              d="M 50 25 C 45 10, 32 8, 30 18 C 30 24, 42 24, 50 25 Z"
              fill="url(#leafGrad)"
              filter="url(#softShadow)"
            />
            <path
              d="M 50 25 C 55 10, 68 8, 70 18 C 70 24, 58 24, 50 25 Z"
              fill="url(#leafGrad)"
              filter="url(#softShadow)"
            />
          </g>

          {/* Soft Clay Cloud Body (Organic puffy curves) */}
          <path
            d="M 28 65 
               C 15 65, 12 48, 24 38 
               C 22 26, 40 22, 50 28 
               C 60 22, 78 26, 76 38 
               C 88 48, 85 65, 72 65 
               C 74 76, 62 82, 50 80 
               C 38 82, 26 76, 28 65 Z"
            fill="url(#cloudBodyGrad)"
            stroke="#E3DDD1"
            strokeWidth="1.2"
          />

          {/* Rosy Cheeks */}
          <ellipse cx="28" cy="56" rx="6" ry="3.5" fill="#FCA5A5" opacity="0.65" />
          <ellipse cx="72" cy="56" rx="6" ry="3.5" fill="#FCA5A5" opacity="0.65" />

          {/* EYES CONTAINER */}
          {!isBlinking ? (
            <g>
              {/* Left Eye Sclera */}
              <ellipse cx="38" cy="46" rx="7" ry="9" fill="#FFFFFF" stroke="#E2DDD1" strokeWidth="0.8" />
              {/* Left Pupil (Tracks Cursor) */}
              <circle
                cx={38 + pupilOffset.x}
                cy={46 + pupilOffset.y}
                r={mood === 'attention' ? 5 : 4.2}
                fill={mood === 'thinking' ? '#4338CA' : '#192820'}
              />
              {/* Left Pupil Highlight */}
              <circle
                cx={38 + pupilOffset.x - 1.2}
                cy={46 + pupilOffset.y - 1.5}
                r="1.5"
                fill="#FFFFFF"
              />

              {/* Right Eye Sclera */}
              <ellipse cx="62" cy="46" rx="7" ry="9" fill="#FFFFFF" stroke="#E2DDD1" strokeWidth="0.8" />
              {/* Right Pupil (Tracks Cursor) */}
              <circle
                cx={62 + pupilOffset.x}
                cy={46 + pupilOffset.y}
                r={mood === 'attention' ? 5 : 4.2}
                fill={mood === 'thinking' ? '#4338CA' : '#192820'}
              />
              {/* Right Pupil Highlight */}
              <circle
                cx={62 + pupilOffset.x - 1.2}
                cy={46 + pupilOffset.y - 1.5}
                r="1.5"
                fill="#FFFFFF"
              />
            </g>
          ) : (
            /* Closed Blinking Eyes */
            <g stroke="#192820" strokeWidth="2.2" strokeLinecap="round" fill="none">
              <path d="M 32 47 Q 38 52 44 47" />
              <path d="M 56 47 Q 62 52 68 47" />
            </g>
          )}

          {/* MOUTH EXPRESSIONS (Reacts to mood) */}
          {mood === 'calm' && (
            <path
              d="M 45 57 Q 50 62 55 57"
              stroke="#192820"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          )}

          {mood === 'success' && (
            <path
              d="M 44 56 Q 50 65 56 56 Z"
              fill="#D9534F"
              stroke="#192820"
              strokeWidth="1.2"
            />
          )}

          {mood === 'thinking' && (
            <path
              d="M 46 59 Q 50 57 54 59"
              stroke="#192820"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          )}

          {mood === 'attention' && (
            <ellipse
              cx="50"
              cy="58"
              rx="3"
              ry="4.5"
              fill="#192820"
            />
          )}

          {mood === 'critical' && (
            <path
              d="M 44 60 Q 50 55 56 60"
              stroke="#C8403C"
              strokeWidth="2.2"
              strokeLinecap="round"
              fill="none"
            />
          )}
        </svg>

        {/* Small Mood Indicator Pill on the bottom right */}
        {size !== 'sm' && (
          <span
            className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white shadow-xs ${
              mood === 'attention'
                ? 'bg-amber-500'
                : mood === 'thinking'
                ? 'bg-purple-600'
                : mood === 'success'
                ? 'bg-emerald-600'
                : 'bg-[#274735]'
            }`}
          />
        )}
      </div>
    </div>
  );
};
