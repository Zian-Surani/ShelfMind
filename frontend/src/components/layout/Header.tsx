import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Bell,
  CheckCheck,
  CircleAlert,
  ShoppingCart,
  Clock,
  Home,
  Sparkles,
  ArrowLeft,
  X,
  LogOut,
} from 'lucide-react';
import { useApp } from '../../store/appStore';

export const Header: React.FC = () => {
  const {
    searchQuery,
    setSearchQuery,
    notifications,
    markNotificationRead,
    openAssistantWithQuestion,
    currentTab,
    setCurrentTab,
    setSelectedDecision,
    setIsAssistantOpen,
    setAssistantInitialPrompt,
    setMascotMood,
  } = useApp();

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const formattedDate = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(now);
  const formattedTime = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  // Click outside to close notification dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ESC key listener to dismiss notifications
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsNotifOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      searchQuery.trim().toLowerCase().startsWith('why') ||
      searchQuery.trim().toLowerCase().startsWith('what') ||
      searchQuery.trim().toLowerCase().startsWith('how')
    ) {
      openAssistantWithQuestion(searchQuery);
    }
  };

  const exitDashboard = () => {
    setSelectedDecision(null);
    setIsAssistantOpen(false);
    setAssistantInitialPrompt('');
    setMascotMood('calm');
    setSearchQuery('');
    setCurrentTab('landing');
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  return (
    <header className="sticky top-0 z-30 bg-[#F6F5F0]/95 backdrop-blur-md px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-[#EAE6DD]/70">
      {/* Left side: Back to Home quick button when navigating subpages */}
      <div className="hidden lg:flex items-center gap-3">
        {currentTab !== 'home' && (
          <button
            onClick={() => setCurrentTab('home')}
            className="px-3 py-2 rounded-2xl bg-white border border-[#E5E0D6] shadow-[0_2px_6px_rgba(0,0,0,0.03)] text-xs font-bold text-[#2D4739] hover:bg-[#E3EBDD] flex items-center gap-1.5 transition-all active:scale-95"
            title="Go back to Home Command Center"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <Home className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </button>
        )}
      </div>

      {/* Center: Search Bar matching sample UI pill */}
      <div className="order-2 basis-full min-w-0 sm:order-none sm:flex-1 sm:basis-auto sm:max-w-xl">
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#7C8B82]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products, decisions, or orders..."
            className="w-full bg-[#FFFFFF] pl-11 pr-4 py-2.5 rounded-full border border-[#E5E0D6] shadow-[0_2px_8px_rgba(0,0,0,0.03)] text-sm text-[#19211D] placeholder-[#8A968E] focus:outline-none focus:border-[#375B42] focus:ring-2 focus:ring-[#375B42]/10 transition-all"
          />
        </form>
      </div>

      {/* Right Controls: Notifications & Date/Status */}
      <div className="flex w-full shrink-0 items-center justify-between gap-3 sm:w-auto">
        {/* Notification Bell with Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="relative w-10 h-10 rounded-full bg-[#FFFFFF] border border-[#E5E0D6] shadow-[0_2px_6px_rgba(0,0,0,0.03)] flex items-center justify-center text-[#4A554E] hover:bg-[#F9F8F5] transition-all"
            aria-label="Notifications"
            title="Store Alerts & Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-[#C8403C] ring-2 ring-white animate-pulse" />
            )}
          </button>

          {/* Roomy, Well-Spaced Notifications Popover */}
          {isNotifOpen && (
            <div className="absolute left-0 sm:left-auto sm:right-0 mt-3 w-96 sm:w-[420px] max-w-[90vw] bg-white rounded-3xl p-5 shadow-[0_24px_48px_rgba(0,0,0,0.12)] border border-[#E5E0D6] z-50 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-3.5 border-b border-[#EAE6DD]">
                <div className="flex items-center gap-2.5">
                  <span className="font-extrabold text-base text-[#19211D]">Store Alerts</span>
                  {unreadCount > 0 ? (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#FCE3E1] text-[#C8403C] font-bold border border-[#F6CBC8]">
                      {unreadCount} new
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#EAF0E7] text-[#2D4739] font-semibold">
                      All caught up
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => notifications.forEach((n) => markNotificationRead(n.id))}
                    className="text-xs text-[#375B42] hover:text-[#192820] font-bold flex items-center gap-1 transition-colors"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                  <button
                    onClick={() => setIsNotifOpen(false)}
                    className="w-6 h-6 rounded-full hover:bg-[#F0EFEA] flex items-center justify-center text-[#78887E]"
                    title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Notification List with Spacious Clay Items */}
              <div className="divide-y divide-[#F1EDE5] max-h-80 overflow-y-auto mt-3 space-y-2 pr-1">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => markNotificationRead(notif.id)}
                    className={`p-3 rounded-2xl transition-all cursor-pointer ${
                      notif.read
                        ? 'opacity-70 hover:bg-[#FAF8F5]'
                        : 'bg-[#F9F8F4] hover:bg-[#F3EFE7] border border-[#EAE5D9]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 p-2 rounded-xl bg-white shadow-sm border border-[#EBE6DC] flex-shrink-0">
                        {notif.type === 'order' && <ShoppingCart className="w-4 h-4 text-[#267343]" />}
                        {notif.type === 'approval' && <CircleAlert className="w-4 h-4 text-[#B86A1B]" />}
                        {notif.type === 'alert' && <Clock className="w-4 h-4 text-[#3E5C76]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-extrabold text-[#19211D] truncate">{notif.title}</p>
                          <span className="text-[10px] font-medium text-[#9CA7A0] flex-shrink-0">
                            {notif.time}
                          </span>
                        </div>
                        <p className="text-[12px] text-[#55645B] leading-relaxed mt-1">
                          {notif.message}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Date & Time block */}
        <div className="text-right pl-2 pr-1 border-r border-[#EAE6DD]">
          <div className="flex items-center justify-end gap-1.5 mb-0.5">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
            <p className="text-[11.5px] font-semibold text-[#37453C]">{formattedDate}</p>
          </div>
          <p className="text-[14px] font-bold text-[#19211D] tracking-tight leading-none">{formattedTime}</p>
        </div>

        <button
          type="button"
          onClick={exitDashboard}
          title="Return to the landing page"
          aria-label="Exit to landing page"
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-[#E5E0D6] bg-white px-3 text-sm font-semibold text-[#2D4739] transition-colors hover:bg-[#E3EBDD] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#375B42]"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span>Exit</span>
        </button>
      </div>
    </header>
  );
};
