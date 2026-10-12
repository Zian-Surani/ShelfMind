import React, { useState, useEffect, useRef } from 'react';
import { X, Send, ArrowRight } from 'lucide-react';
import { useApp } from '../../store/appStore';
import { MascotCloudAvatar } from './MascotCloudAvatar';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  actionLink?: {
    label: string;
    tab: string;
  };
}

const PRESET_PROMPTS = [
  'What needs my attention?',
  'What happened while I was away?',
  "Why did you buy Lay's?",
  'Why did you reduce Pringles?',
];

export const AssistantPanel: React.FC = () => {
  const {
    isAssistantOpen,
    setIsAssistantOpen,
    assistantInitialPrompt,
    setAssistantInitialPrompt,
    setCurrentTab,
    mascotMood,
    setMascotMood,
    queryAssistant,
    settings,
  } = useApp();

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm-init',
      sender: 'assistant',
      text: `Hello ${settings.managerName.split(' ')[0]}. I am connected to the ShelfMind backend, so I can answer from the current store, decision, ShelfWatch, and audit records.`,
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ESC key listener to exit panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAssistantOpen) {
        setIsAssistantOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAssistantOpen, setIsAssistantOpen]);

  // Auto-focus input on open
  useEffect(() => {
    if (isAssistantOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isAssistantOpen]);

  useEffect(() => {
    if (isAssistantOpen && assistantInitialPrompt) {
      void handleSendPrompt(assistantInitialPrompt);
      setAssistantInitialPrompt('');
    }
  }, [isAssistantOpen, assistantInitialPrompt]);

  useEffect(() => {
    setMessages((prev) =>
      prev.length === 1 && prev[0].id === 'm-init'
        ? [
            {
              ...prev[0],
              text: `Hello ${settings.managerName.split(' ')[0]}. I am connected to the ShelfMind backend, so I can answer from the current store, decision, ShelfWatch, and audit records.`,
            },
          ]
        : prev
    );
  }, [settings.managerName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const actionLinkFor = (query: string): { label: string; tab: string } | undefined => {
    const q = query.toLowerCase();

    if (q.includes('attention') || q.includes('need')) {
      return { label: 'Review Pending Approvals', tab: 'decisions' };
    }

    if (q.includes('away') || q.includes('happen') || q.includes('summary')) {
      return { label: 'Inspect Activity Log', tab: 'audit' };
    }

    if (q.includes('buy') || q.includes('order') || q.includes('why')) {
      return { label: 'View Decisions', tab: 'decisions' };
    }

    if (q.includes('shelfwatch') || q.includes('camera') || q.includes('compliance')) {
      return { label: 'Open ShelfWatch', tab: 'shelfwatch' };
    }

    if (q.includes('q-learning') || q.includes('mdp') || q.includes('value iteration') || q.includes('dqn')) {
      return { label: 'Inspect RL Models', tab: 'rl' };
    }

    return { label: 'View Command Center', tab: 'home' };
  };

  const handleSendPrompt = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    setMascotMood('thinking');

    try {
      const answer = await queryAssistant(text);
      const assistantMsg: Message = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        text: answer,
        actionLink: actionLinkFor(text),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      const assistantMsg: Message = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        text: error instanceof Error ? error.message : 'I could not reach the ShelfMind backend.',
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setIsTyping(false);
      setMascotMood('calm');
    }
  };

  if (!isAssistantOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-brand-navy/20 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md h-full bg-[#FFFFFF] shadow-[-10px_0_40px_rgba(0,0,0,0.12)] border-l border-[#E5E0D6] flex flex-col justify-between animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-5 border-b border-[#EAE6DD] flex items-center justify-between bg-[#FAF8F5]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#E3EBDD] flex items-center justify-center p-0.5 shadow-sm border border-[#D5DFC9] overflow-hidden">
              <MascotCloudAvatar mood={mascotMood} size="sm" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-sm text-[#19211D]">ShelfMind Assistant</h3>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-xs text-[#68756D]">Retail Operational AI Companion</p>
            </div>
          </div>
          <button
            onClick={() => setIsAssistantOpen(false)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#68756D] hover:bg-[#EAE5DA] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-3xl p-4 text-[13.5px] leading-relaxed shadow-sm ${
                  m.sender === 'user'
                    ? 'bg-[#375B42] text-white rounded-br-sm'
                    : 'bg-[#F6F5F0] text-[#19211D] border border-[#EAE5D9] rounded-bl-sm'
                }`}
              >
                {m.text}
              </div>

              {m.actionLink && (
                <button
                  onClick={() => {
                    setCurrentTab(m.actionLink!.tab);
                    setIsAssistantOpen(false);
                  }}
                  className="mt-2 text-xs font-semibold text-[#2D4739] hover:text-[#1E3226] bg-[#E3EBDD] px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-[#D1DECA] transition-all hover:translate-x-0.5"
                >
                  <span>{m.actionLink.label}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex items-center gap-2 p-3 bg-[#F6F5F0] rounded-2xl w-24 text-xs text-[#68756D]">
              <span className="w-2 h-2 rounded-full bg-[#8A968E] animate-bounce" />
              <span className="w-2 h-2 rounded-full bg-[#8A968E] animate-bounce [animation-delay:0.2s]" />
              <span className="w-2 h-2 rounded-full bg-[#8A968E] animate-bounce [animation-delay:0.4s]" />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Presets & Input */}
        <div className="p-4 border-t border-[#EAE6DD] bg-[#FAF8F5] space-y-3">
          {/* Preset Chips */}
          <div className="flex flex-wrap gap-1.5">
            {PRESET_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => void handleSendPrompt(prompt)}
                className="text-[11.5px] px-3 py-1.5 rounded-full bg-white border border-[#E2DDD3] text-[#37453C] hover:bg-[#EAF0E7] hover:border-[#CADAC5] hover:text-[#22382D] transition-all text-left font-medium shadow-2xs"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSendPrompt(input);
            }}
            className="relative flex items-center"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask ShelfMind (Press ESC to close, Tab to navigate)..."
              className="w-full bg-white pl-4 pr-12 py-3 rounded-full border border-[#DCD6C9] text-sm text-[#19211D] placeholder-[#8A968E] focus:outline-none focus:border-[#375B42] focus:ring-2 focus:ring-[#375B42]/10 shadow-sm"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="absolute right-2 w-8 h-8 rounded-full bg-[#375B42] text-white flex items-center justify-center disabled:opacity-40 hover:bg-[#2C4935] transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
