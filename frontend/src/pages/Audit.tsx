import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  Cpu,
  Layers,
  UserCheck,
  Building2,
} from 'lucide-react';
import { useApp } from '../store/appStore';
import { AuditCategory, AuditRecord } from '../types';

export const Audit: React.FC = () => {
  const { auditLogs } = useApp();
  const [activeCategory, setActiveCategory] = useState<'ALL' | AuditCategory>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredLogs = auditLogs.filter((log: AuditRecord) => {
    if (activeCategory === 'ALL') return true;
    return log.category === activeCategory;
  });

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getCategoryIcon = (cat: AuditCategory) => {
    switch (cat) {
      case 'AI':
        return <Eye className="w-4 h-4 text-[#3E5C76]" />;
      case 'MDP':
        return <Layers className="w-4 h-4 text-[#267343]" />;
      case 'RL':
        return <Cpu className="w-4 h-4 text-[#5540B0]" />;
      case 'HUMAN':
        return <UserCheck className="w-4 h-4 text-[#B86A1B]" />;
      case 'SYSTEM':
      default:
        return <Building2 className="w-4 h-4 text-[#4A554E]" />;
    }
  };

  const getCategoryBadge = (cat: AuditCategory) => {
    switch (cat) {
      case 'AI':
        return 'bg-[#E3E8FD] text-[#3E5C76] border-[#C7D4F7]';
      case 'MDP':
        return 'bg-[#EAF5EC] text-[#267343] border-[#D0ECC6]';
      case 'RL':
        return 'bg-[#EAE6F9] text-[#5540B0] border-[#D6CDF5]';
      case 'HUMAN':
        return 'bg-[#FEF2E8] text-[#B86A1B] border-[#FAD0AC]';
      case 'SYSTEM':
      default:
        return 'bg-[#F4F6F3] text-[#4E5C53] border-[#E0E8DC]';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#19211D] tracking-tight">
            Autonomous Decision Audit Timeline
          </h1>
          <p className="text-xs font-medium text-[#68756D] mt-0.5">
            Cryptographically timestamped 5-stage pipeline: Observation → State → Action → Execution → Outcome.
          </p>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap items-center gap-1.5 bg-white p-1.5 rounded-full border border-[#EAE5DA] shadow-2xs">
          {[
            { id: 'ALL', label: 'All Logs' },
            { id: 'AI', label: 'AI Visual' },
            { id: 'MDP', label: 'MDP State' },
            { id: 'RL', label: 'RL Policy' },
            { id: 'HUMAN', label: 'Human' },
            { id: 'SYSTEM', label: 'System' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveCategory(item.id as any)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                activeCategory === item.id
                  ? 'bg-[#375B42] text-white shadow-2xs'
                  : 'text-[#68756D] hover:bg-[#FAF8F5]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Audit List Container */}
      <div className="space-y-3">
        {filteredLogs.map((log: AuditRecord) => {
          const isExpanded = expandedId === log.id;

          return (
            <div
              key={log.id}
              className="bg-white rounded-3xl border border-[#EAE5DA] shadow-[0_4px_16px_rgba(25,33,29,0.025)] overflow-hidden transition-all duration-200"
            >
              {/* Summary Row */}
              <div
                onClick={() => toggleExpand(log.id)}
                className="p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-[#FAF8F5] transition-colors"
              >
                <div className="flex items-center gap-3.5 flex-1 min-w-0">
                  <div className={`w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 border ${getCategoryBadge(log.category)}`}>
                    {getCategoryIcon(log.category)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${getCategoryBadge(log.category)}`}>
                        {log.category}
                      </span>
                      <span className="text-xs font-bold text-[#19211D] truncate">
                        {log.action}
                      </span>
                    </div>

                    <p className="text-xs text-[#68756D] truncate">
                      {log.observation}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                    log.outcome === 'SUCCESS'
                      ? 'bg-[#EAF5EC] text-[#267343]'
                      : 'bg-[#FEF2E8] text-[#B86A1B]'
                  }`}>
                    {log.outcome}
                  </span>

                  <span className="text-xs text-[#8A968E] font-medium hidden sm:inline min-w-[65px] text-right">
                    {log.timeAgo}
                  </span>

                  <button className="text-[#8A968E]">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* 5-Stage Pipeline Detail Drawer */}
              {isExpanded && (
                <div className="px-6 pb-6 pt-2 border-t border-[#EFECE5] bg-[#FAF8F5]/80 space-y-4 text-xs animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
                    {/* Stage 1: Observation */}
                    <div className="p-3 bg-white rounded-2xl border border-[#EAE5DA] space-y-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#68756D] block">
                        1. Observation
                      </span>
                      <p className="text-xs font-semibold text-[#19211D]">
                        {log.observation}
                      </p>
                    </div>

                    {/* Stage 2: State */}
                    <div className="p-3 bg-white rounded-2xl border border-[#EAE5DA] space-y-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#68756D] block">
                        2. MDP State
                      </span>
                      <p className="text-xs font-mono text-[#2D4739] font-medium">
                        {log.state}
                      </p>
                    </div>

                    {/* Stage 3: Action */}
                    <div className="p-3 bg-white rounded-2xl border border-[#EAE5DA] space-y-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#68756D] block">
                        3. Action
                      </span>
                      <p className="text-xs font-bold text-[#19211D]">
                        {log.action}
                      </p>
                    </div>

                    {/* Stage 4: Execution */}
                    <div className="p-3 bg-white rounded-2xl border border-[#EAE5DA] space-y-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#68756D] block">
                        4. Execution
                      </span>
                      <p className="text-xs font-semibold text-[#375B42]">
                        {log.execution}
                      </p>
                    </div>

                    {/* Stage 5: Outcome */}
                    <div className="p-3 bg-[#EAF5EC] rounded-2xl border border-[#D5EED8] space-y-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#267343] block">
                        5. Outcome
                      </span>
                      <p className="text-xs font-bold text-[#19211D]">
                        {log.outcomeLabel}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-white border border-[#EAE5DA] text-[11px] text-[#68756D]">
                    <strong className="text-[#19211D]">Audit Trace:</strong> {log.details}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
