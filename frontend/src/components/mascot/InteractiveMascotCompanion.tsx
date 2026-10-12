import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../store/appStore';
import { MascotCloudAvatar } from './MascotCloudAvatar';
import { X, MessageSquare } from 'lucide-react';

interface Position {
  x: number;
  y: number;
}

export const InteractiveMascotCompanion: React.FC = () => {
  const {
    mascotMood,
    setMascotMood,
    isAssistantOpen,
    setIsAssistantOpen,
    currentTab,
    metrics,
    shelfWatch,
  } = useApp();

  // Position state (defaults to bottom-right corner)
  const [position, setPosition] = useState<Position>({
    x: typeof window !== 'undefined' ? window.innerWidth - 120 : 1200,
    y: typeof window !== 'undefined' ? window.innerHeight - 140 : 700,
  });

  const [isDragging, setIsDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const [showSpeech, setShowSpeech] = useState(true);
  const [speechMessage, setSpeechMessage] = useState<string>('Everything is under control!');

  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0,
  });

  // Keep within viewport boundaries on resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => ({
        x: Math.min(Math.max(20, prev.x), window.innerWidth - 110),
        y: Math.min(Math.max(20, prev.y), window.innerHeight - 130),
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 100% AUTOMATIC EMOTIONS & CONTEXTUAL SPEECH
  useEffect(() => {
    if (metrics.approvalRequiredCount > 0) {
      setSpeechMessage(`${metrics.approvalRequiredCount} order${metrics.approvalRequiredCount === 1 ? '' : 's'} waiting for your sign-off.`);
      setMascotMood('attention');
    } else if (metrics.attentionCount > 0) {
      setSpeechMessage(`${metrics.attentionCount} items have low shelf stock.`);
      setMascotMood('attention');
    } else if (currentTab === 'shelfwatch') {
      setSpeechMessage(shelfWatch.latestAnalysis ? `${shelfWatch.latestAnalysis.product_count} facings in the latest image. SKU mapping is pending.` : 'No shelf image analyzed yet.');
      setMascotMood('calm');
    } else if (currentTab === 'rl') {
      setSpeechMessage('Q-Learning policy looks optimal!');
      setMascotMood('thinking');
    } else {
      setSpeechMessage('Ready to help! Drag me anywhere or click to chat.');
      setMascotMood('calm');
    }

    setShowSpeech(true);
    const timer = setTimeout(() => setShowSpeech(false), 7000);
    return () => clearTimeout(timer);
  }, [currentTab, metrics.approvalRequiredCount, metrics.attentionCount, shelfWatch.shelfCompliance, setMascotMood]);

  // Spontaneous lifelike expression changes (Automatic periodic animation)
  useEffect(() => {
    const expressionInterval = setInterval(() => {
      // If there are store issues, preserve attention
      if (metrics.approvalRequiredCount > 0 || metrics.attentionCount > 0) {
        setMascotMood('attention');
        return;
      }
      if (currentTab === 'rl') {
        setMascotMood('thinking');
        return;
      }

      // Automatically cycle through natural expressions
      const randomExpressions: Array<'calm' | 'thinking' | 'success'> = ['calm', 'thinking', 'success'];
      const nextMood = randomExpressions[Math.floor(Math.random() * randomExpressions.length)];
      setMascotMood(nextMood);

      // Return to calm after 2.5s
      if (nextMood !== 'calm') {
        setTimeout(() => {
          if (metrics.approvalRequiredCount === 0 && metrics.attentionCount === 0) {
            setMascotMood('calm');
          }
        }, 2600);
      }
    }, 9000);

    return () => clearInterval(expressionInterval);
  }, [metrics.approvalRequiredCount, metrics.attentionCount, currentTab, setMascotMood]);

  // Handle ESC key to dismiss speech bubble or assistant
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSpeech(false);
        if (isAssistantOpen) {
          setIsAssistantOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAssistantOpen, setIsAssistantOpen]);

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setHasMoved(false);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;

      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        setHasMoved(true);
      }

      const newX = Math.min(Math.max(16, dragRef.current.posX + dx), window.innerWidth - 100);
      const newY = Math.min(Math.max(16, dragRef.current.posY + dy), window.innerHeight - 120);

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Touch drag handlers for tablet/mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    setIsDragging(true);
    setHasMoved(false);
    dragRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      posX: position.x,
      posY: position.y,
    };
  };

  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - dragRef.current.startX;
      const dy = e.touches[0].clientY - dragRef.current.startY;

      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        setHasMoved(true);
      }

      const newX = Math.min(Math.max(16, dragRef.current.posX + dx), window.innerWidth - 100);
      const newY = Math.min(Math.max(16, dragRef.current.posY + dy), window.innerHeight - 120);

      setPosition({ x: newX, y: newY });
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging]);

  // Clicking mascot directly opens the chatbot (opens into one)
  const handleClick = () => {
    if (!hasMoved) {
      setIsAssistantOpen(true);
    }
  };

  // When chatbot is open, hide the floating avatar so it docks seamlessly into the chat panel
  if (isAssistantOpen) {
    return null;
  }

  // Calculate boundary-safe positions for speech boxes so they NEVER cut through the page
  const screenW = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const openBelow = position.y < 220;

  // Clamped box coordinates
  const speechTop = openBelow ? position.y + 88 : Math.max(16, position.y - 70);
  const speechLeft = Math.max(16, Math.min(position.x - 70, screenW - 240));

  return (
    <>
      {/* Speech Bubble Contextual Message (Position-optimized, will not cut off) */}
      {showSpeech && (
        <div
          style={{
            position: 'fixed',
            left: `${speechLeft}px`,
            top: `${speechTop}px`,
            zIndex: 55,
          }}
          onClick={handleClick}
          className="hidden sm:block w-56 bg-white/95 backdrop-blur-md px-3.5 py-2.5 rounded-2xl shadow-[0_12px_28px_rgba(0,0,0,0.12)] border border-[#E3EBDD] text-xs font-semibold text-[#19211D] animate-in fade-in zoom-in-95 pointer-events-auto cursor-pointer hover:border-[#CAD8C5] transition-all"
          title="Click to open ShelfMind Assistant"
        >
          <div className="flex items-start justify-between gap-1.5">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-[#274735] flex-shrink-0" />
              <p className="leading-snug">{speechMessage}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSpeech(false);
              }}
              className="text-[#9BAAA0] hover:text-[#274735]"
              title="Dismiss"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Main Draggable Mascot Character (Click opens chatbot directly) */}
      <div
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          zIndex: 50,
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onClick={handleClick}
        className={`group relative w-20 h-20 rounded-full flex items-center justify-center cursor-${
          isDragging ? 'grabbing' : 'grab'
        } transition-transform duration-200 select-none ${
          isDragging ? 'scale-110 shadow-2xl' : 'hover:scale-105 hover:shadow-xl'
        }`}
        title="ShelfMind AI Mascot — Click to chat, drag to move"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setIsAssistantOpen(true);
          }
        }}
      >
        {/* Soft Clay Aura / Glow based on Automatic Emotion */}
        <div
          className={`absolute inset-0 rounded-full blur-xl opacity-60 transition-colors duration-500 ${
            mascotMood === 'attention'
              ? 'bg-amber-400 animate-pulse'
              : mascotMood === 'thinking'
              ? 'bg-purple-400 animate-pulse'
              : mascotMood === 'success'
              ? 'bg-emerald-400'
              : mascotMood === 'critical'
              ? 'bg-rose-400 animate-ping'
              : 'bg-[#C4D7C2]'
          }`}
        />

        {/* Tactile 3D Clay Base Pedestal */}
        <div className="absolute inset-1 rounded-full bg-gradient-to-br from-[#FFFFFF] via-[#FAF8F3] to-[#E3EBDD] border-2 border-white shadow-[0_8px_20px_rgba(39,71,53,0.12)] flex items-center justify-center overflow-hidden">
          {/* Eye-tracking & automatic expressions avatar */}
          <MascotCloudAvatar mood={mascotMood} size="md" />
        </div>
      </div>
    </>
  );
};
