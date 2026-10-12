import React from 'react';
import {
  Home,
  Package,
  TrendingUp,
  BarChart2,
  Camera,
  FileText,
  Settings,
  Cpu,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../store/appStore';
import logoImg from '../../assets/logo.png';
import faviconImg from '../../assets/favicon.png';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'shelfwatch', label: 'Image review', icon: Camera },
  { id: 'decisions', label: 'Approvals', icon: TrendingUp },
  { id: 'analytics', label: 'History', icon: BarChart2 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const ADVANCED_NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Overview', icon: Home },
  { id: 'inventory', label: 'Recorded inventory', icon: Package },
  { id: 'audit', label: 'Audit Logs', icon: FileText },
  { id: 'rl', label: 'RL Research', icon: Cpu },
];

export const Sidebar: React.FC = () => {
  const { currentTab, setCurrentTab, metrics, settings } = useApp();

  return (
    <aside className="hidden md:flex w-64 min-w-[16rem] h-screen sticky top-0 flex-col justify-between py-6 px-4 bg-[#F6F5F0] border-r border-[#EAE6DD] select-none">
      {/* Brand Header */}
      <div>
        <div 
          onClick={() => setCurrentTab('shelfwatch')}
          className="cursor-pointer mb-7 px-2 flex items-center gap-3 transition-opacity hover:opacity-90"
        >
          <img 
            src={logoImg} 
            alt="ShelfMind Logo" 
            className="h-16 w-auto max-w-[210px] object-contain drop-shadow-sm"
          />
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            const hasBadge = item.id === 'decisions' && metrics.approvalRequiredCount > 0;

            return (
              <button
                key={item.id}
                aria-label={item.label}
                onClick={() => setCurrentTab(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-[15px] font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-[#E3EBDD] text-[#22382D] font-semibold shadow-[0_2px_8px_rgba(45,71,57,0.06)]'
                    : 'text-[#4A554E] hover:bg-[#EDE9DF] hover:text-[#19211D]'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <Icon
                    className={`w-5 h-5 transition-transform duration-200 ${
                      isActive ? 'text-[#2D4739] scale-105' : 'text-[#68756D]'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {hasBadge && (
                  <span className="w-5 h-5 rounded-full bg-[#FCE3E1] text-[#C8403C] text-xs font-bold flex items-center justify-center border border-[#F6CBC8]">
                    {metrics.approvalRequiredCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <details className="mt-5 border-t border-[#EAE6DD] pt-4 text-sm text-[#68756D]">
          <summary className="cursor-pointer px-4">Advanced</summary>
          <nav className="mt-2 space-y-1" aria-label="Advanced navigation">
            {ADVANCED_NAV_ITEMS.map(item => <button key={item.id} onClick={() => setCurrentTab(item.id)} className={`flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-left text-sm ${currentTab === item.id ? 'bg-[#E3EBDD]' : 'hover:bg-white'}`}>
              <item.icon size={17} />{item.label}
            </button>)}
          </nav>
        </details>
      </div>

      {/* Bottom Section */}
      <div className="space-y-4 pt-4">
        {/* Decorative Quote Card */}
        <div className="relative rounded-2xl overflow-hidden shadow-sm border border-[#E8E4DA] bg-gradient-to-br from-[#FAF8F5] to-[#EAE4D7] p-3.5 group cursor-pointer hover:shadow-md transition-all">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/80 p-1 flex-shrink-0 shadow-sm border border-[#E3EBDD] flex items-center justify-center">
              <img 
                src={faviconImg} 
                alt="ShelfMind Mascot" 
                className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300"
              />
            </div>
            <div>
              <p className="text-xs font-bold text-[#2D3E33] leading-snug">
                Good shelves.<br />Happier customers.
              </p>
              <p className="text-[10px] text-[#78887E] mt-0.5 font-medium">ShelfMind Ops v2.4</p>
            </div>
          </div>
        </div>

        {/* User Profile */}
        <div 
          onClick={() => setCurrentTab('settings')}
          className="flex items-center justify-between p-2 rounded-2xl hover:bg-[#EAE5DA] cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#3B82F6] text-white font-bold text-sm flex items-center justify-center shadow-sm">
              {settings.managerName.charAt(0)}
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-[#19211D] leading-tight">
                {settings.managerName.split(' ')[0]}
              </p>
              <p className="text-xs text-[#68756D] leading-tight">Store Manager</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-[#8A978E]" />
        </div>
      </div>
    </aside>
  );
};
