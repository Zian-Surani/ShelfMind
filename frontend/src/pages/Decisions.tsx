import React, { useState } from 'react';
import {
  Check,
  Edit3,
  Ban,
  ArrowRight,
  Play,
  Package,
} from 'lucide-react';
import { useApp } from '../store/appStore';
import { Decision, DecisionStatus } from '../types';
import { ModifyModal } from '../components/decisions/ModifyModal';
import { shelfmindApi } from '../lib/shelfmindApi';

export const Decisions: React.FC = () => {
  const {
    decisions,
    setSelectedDecision,
    approveDecision,
    rejectDecision,
    refreshBackendState,
  } = useApp();

  const [filter, setFilter] = useState<'ALL' | DecisionStatus>('ALL');
  const [activeModifyDecision, setActiveModifyDecision] = useState<Decision | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const generate = async () => {
    setGenerating(true);
    setGenerationError(null);
    try { await shelfmindApi.generateDecisions(); await refreshBackendState(); }
    catch (error) { setGenerationError(error instanceof Error ? error.message : 'Could not generate decisions'); }
    finally { setGenerating(false); }
  };

  const filteredDecisions = decisions.filter((d: Decision) => {
    if (filter === 'ALL') return true;
    return d.status === filter;
  });

  const todayList = filteredDecisions.filter((d: Decision) => d.dateGroup === 'TODAY');
  const yesterdayList = filteredDecisions.filter((d: Decision) => d.dateGroup !== 'TODAY');

  const getStatusPill = (status: DecisionStatus) => {
    switch (status) {
      case 'AUTO_EXECUTED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#EAF5EC] text-[#267343] border border-[#D0ECC6]">
            Auto Approved / Executed
          </span>
        );
      case 'APPROVAL_REQUIRED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#FEF2E8] text-[#B86A1B] border border-[#FAD0AC] animate-pulse">
            Approval Required
          </span>
        );
      case 'APPROVED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#EAF5EC] text-[#267343]">
            ✓ Approved
          </span>
        );
      case 'MODIFIED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#EAE6F9] text-[#5540B0]">
            Modified & Approved
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#FEF0EF] text-[#C8403C]">
            Rejected
          </span>
        );
      case 'SUPERSEDED':
        return <span className="text-xs font-semibold text-[#68756D]">Replaced by newer count</span>;
      case 'HOLD':
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#F4F6F3] text-[#4E5C53] border border-[#E0E8DC]">
            MDP Hold
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <button onClick={generate} disabled={generating} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#375B42] text-white text-sm disabled:opacity-50">
        <Play size={16} />{generating ? 'Evaluating...' : 'Generate recommendations'}
      </button>
      {generationError && <p role="alert" className="text-sm text-red-700">{generationError}</p>}
      {decisions.length === 0 && <p className="text-sm text-[#68756D]">No recommendations recorded.</p>}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#19211D] tracking-tight">
            Replenishment & Policy Decisions
          </h1>
          <p className="text-xs font-medium text-[#68756D] mt-0.5">
            Markov Decision Process & Value Iteration recommendations grouped by audit timestamp.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-white p-1.5 rounded-full border border-[#EAE5DA] shadow-2xs">
          {[
            { id: 'ALL', label: 'All Decisions' },
            { id: 'APPROVAL_REQUIRED', label: 'Pending Approval' },
            { id: 'AUTO_EXECUTED', label: 'Auto Executed' },
            { id: 'HOLD', label: 'Hold' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id as any)}
              className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all ${
                filter === item.id
                  ? 'bg-[#375B42] text-white shadow-2xs'
                  : 'text-[#68756D] hover:bg-[#FAF8F5]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* TODAY SECTION */}
      {todayList.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#4A554E]">
              Today
            </span>
            <div className="h-px flex-1 bg-[#EBE7DF]" />
          </div>

          <div className="grid grid-cols-1 gap-3.5">
            {todayList.map((dec: Decision) => (
              <div
                key={dec.id}
                onClick={() => setSelectedDecision(dec)}
                className="group bg-white rounded-3xl p-5 border border-[#EAE5DA] shadow-[0_4px_16px_rgba(25,33,29,0.03)] hover:shadow-md hover:border-[#DDD7CB] transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Product & Action info */}
                <div className="flex items-center gap-4">
                  <div className="w-13 h-14 rounded-2xl bg-white border border-[#EAE5DA] p-1.5 flex items-center justify-center flex-shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                    {dec.productImage ? <img
                      src={dec.productImage}
                      alt={dec.productName}
                      className="w-full h-full object-contain"
                    /> : <Package size={24} aria-label="No product image" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-[#19211D] group-hover:text-[#2D4739] transition-colors">
                        {dec.productName}
                      </h3>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#FAF8F5] border border-[#EFECE5] text-[#78887E]">
                        {dec.engine}
                      </span>
                    </div>

                    <p className="text-xs font-medium text-[#68756D] mt-0.5">
                      <strong className="text-[#19211D] font-extrabold text-sm">
                        {dec.action} {dec.quantity > 0 ? `${dec.quantity} units` : ''}
                      </strong>{' '}
                      · Current stock: {dec.currentStock} · Risk: {dec.stockoutRisk}%
                    </p>

                    <p className="text-xs text-[#526057] italic mt-1 line-clamp-1 max-w-xl">
                      “{dec.reason}”
                    </p>
                  </div>
                </div>

                {/* Right Status & Inline Actions */}
                <div
                  className="flex flex-wrap items-center gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-[#F1EDE5] justify-between md:justify-end"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-2">
                    {getStatusPill(dec.status)}
                    <span className="text-xs text-[#8A968E] font-medium min-w-[50px] text-right">
                      {dec.timeAgo}
                    </span>
                  </div>

                  {/* Inline quick buttons for approval required */}
                  {dec.status === 'APPROVAL_REQUIRED' && (
                    <div className="flex items-center gap-1.5 ml-2">
                      <button
                        onClick={() => approveDecision(dec.id)}
                        className="px-3.5 py-1.5 rounded-full bg-[#375B42] text-white text-xs font-bold shadow-2xs hover:bg-[#2C4935] flex items-center gap-1 active:scale-95 transition-all"
                        title="Approve immediately"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>

                      <button
                        onClick={() => setActiveModifyDecision(dec)}
                        className="px-3 py-1.5 rounded-full bg-white border border-[#D5CFBF] text-[#2D4739] text-xs font-bold hover:bg-[#FAF8F5] active:scale-95 transition-all"
                        title="Modify quantity"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => rejectDecision(dec.id, 'Manual override by store manager')}
                        className="p-1.5 rounded-full hover:bg-[#FEF0EF] text-[#C8403C] transition-colors"
                        title="Reject decision"
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {dec.status === 'AUTO_EXECUTED' && (
                    <span className="text-xs text-[#267343] font-semibold ml-2">
                      PO recorded
                    </span>
                  )}

                  <button
                    onClick={() => setSelectedDecision(dec)}
                    className="p-2 rounded-full hover:bg-[#EAE5DA] text-[#68756D] ml-1"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* YESTERDAY SECTION */}
      {yesterdayList.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#4A554E]">
              Earlier
            </span>
            <div className="h-px flex-1 bg-[#EBE7DF]" />
          </div>

          <div className="grid grid-cols-1 gap-3.5">
            {yesterdayList.map((dec: Decision) => (
              <div
                key={dec.id}
                onClick={() => setSelectedDecision(dec)}
                className="group bg-white rounded-3xl p-5 border border-[#EAE5DA] shadow-[0_4px_16px_rgba(25,33,29,0.03)] hover:shadow-md hover:border-[#DDD7CB] transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 opacity-90"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-13 rounded-2xl bg-white border border-[#EAE5DA] p-1 flex items-center justify-center flex-shrink-0 shadow-2xs">
                    {dec.productImage ? <img
                      src={dec.productImage}
                      alt={dec.productName}
                      className="w-full h-full object-contain"
                    /> : <Package size={24} aria-label="No product image" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[#19211D]">
                        {dec.productName}
                      </h3>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#FAF8F5] border border-[#EFECE5] text-[#78887E]">
                        {dec.engine}
                      </span>
                    </div>

                    <p className="text-xs font-medium text-[#68756D] mt-0.5">
                      <strong className="text-[#19211D] font-bold">
                        {dec.action} {dec.quantity > 0 ? `${dec.quantity} units` : ''}
                      </strong>{' '}
                      · Current stock: {dec.currentStock}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {getStatusPill(dec.status)}
                  <span className="text-xs text-[#8A968E] font-medium">
                    {dec.timeAgo}
                  </span>
                  <ArrowRight className="w-4 h-4 text-[#8A968E]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modify Modal */}
      {activeModifyDecision && (
        <ModifyModal
          decision={activeModifyDecision}
          onClose={() => setActiveModifyDecision(null)}
        />
      )}
    </div>
  );
};
