import React from 'react';
import { Activity, Sparkles, CheckCircle2, AlertTriangle, Cpu, TrendingUp } from 'lucide-react';

const STREAM_ITEMS = [
  {
    id: 1,
    tag: 'MDP DISPATCH',
    text: "Lay's Classic 50g: Auto-dispatched 24 units",
    meta: 'Q-Value +48.2 (Converged in 12ms)',
    status: 'success',
  },
  {
    id: 2,
    tag: 'SHELF VISION',
    text: 'Aisle 3 Snack Bay: 94.2% planogram compliance',
    meta: '0 visible stockouts detected',
    status: 'active',
  },
  {
    id: 3,
    tag: 'GOVERNANCE',
    text: 'Bingo Masala: Human approval requested for 32 units',
    meta: 'Threshold check triggered (Spend > $500)',
    status: 'warning',
  },
  {
    id: 4,
    tag: 'RL RESEARCH',
    text: 'Deep Q-Network: Target network weights synced',
    meta: 'Loss: 0.0034 • Epsilon: 0.05',
    status: 'info',
  },
  {
    id: 5,
    tag: 'SERVICE LEVEL',
    text: 'Coca-Cola 500ml: 99.4% in-stock availability',
    meta: 'Lead time: 2 days • Safety stock: 34 units',
    status: 'success',
  },
  {
    id: 6,
    tag: 'AUDIT TRACE',
    text: 'Audit #4892: State -> Action -> EDI Requisition logged',
    meta: 'Immutable 5-stage log verified',
    status: 'active',
  },
];

export const LiveOperationsStream: React.FC = () => {
  return (
    <div className="w-full overflow-hidden bg-white/70 backdrop-blur-md border-y border-[#E8E3D8] py-3 select-none">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-4 mb-1">
        <div className="flex items-center gap-2 text-xs font-black text-[#274735] uppercase tracking-wider flex-shrink-0 bg-[#E3EBDD] px-3 py-1 rounded-full border border-[#D4E2CC]">
          <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
          <Activity className="w-3.5 h-3.5" />
          <span>Live Store Stream</span>
        </div>
        <p className="text-[11px] text-[#6A7B70] font-medium hidden sm:block">
          Continuous autonomous store telemetry and MDP decisions
        </p>
      </div>

      <div className="relative w-full overflow-hidden flex mask-gradient-x">
        {/* Infinite CSS Marquee with duplicated stream */}
        <div className="animate-marquee flex items-center gap-4 py-1">
          {[...STREAM_ITEMS, ...STREAM_ITEMS].map((item, idx) => (
            <div
              key={`${item.id}-${idx}`}
              className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-white border border-[#E8E4DA] shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex-shrink-0 hover:border-[#CAD8C5] transition-all"
            >
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                  item.status === 'success'
                    ? 'bg-[#EAF0E7] text-[#274735] border border-[#D7E5D3]'
                    : item.status === 'warning'
                    ? 'bg-[#FDF4E7] text-[#B86A1B] border border-[#F9E2C6]'
                    : item.status === 'info'
                    ? 'bg-[#F2EEFA] text-[#6B46C1] border border-[#E0D7F5]'
                    : 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#DBEAFE]'
                }`}
              >
                {item.tag}
              </span>
              <span className="text-xs font-bold text-[#19211D]">{item.text}</span>
              <span className="text-[11px] font-medium text-[#7C8D82]">• {item.meta}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
