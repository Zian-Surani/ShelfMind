import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Edit3,
  Ban,
  ChevronDown,
  ChevronUp,
  Cpu,
  TrendingDown,
  Clock,
  Boxes,
  Package,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Decision } from '../../types';
import { useApp } from '../../store/appStore';
import { ModifyModal } from './ModifyModal';

interface DecisionDetailDrawerProps {
  decision: Decision | null;
  onClose: () => void;
}

export const DecisionDetailDrawer: React.FC<DecisionDetailDrawerProps> = ({
  decision,
  onClose,
}) => {
  const { approveDecision, rejectDecision } = useApp();
  const [showTechnical, setShowTechnical] = useState(false);
  const [isModifyOpen, setIsModifyOpen] = useState(false);
  const [rejectPrompt, setRejectPrompt] = useState(false);
  const [rejectReason, setRejectReason] = useState('Supplier issue');

  // ESC key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isModifyOpen) {
          setIsModifyOpen(false);
        } else if (rejectPrompt) {
          setRejectPrompt(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isModifyOpen, rejectPrompt]);

  if (!decision) return null;

  const handleApprove = () => {
    approveDecision(decision.id);
  };

  const handleConfirmReject = () => {
    rejectDecision(decision.id, rejectReason);
    setRejectPrompt(false);
  };

  const isAuto = decision.status === 'AUTO_EXECUTED';
  const isApprovalRequired = decision.status === 'APPROVAL_REQUIRED';
  const isApproved = decision.status === 'APPROVED';
  const isModified = decision.status === 'MODIFIED';
  const isRejected = decision.status === 'REJECTED';

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end bg-black/25 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="w-full max-w-lg h-full bg-[#FFFFFF] shadow-[-12px_0_40px_rgba(0,0,0,0.12)] border-l border-[#E5E0D6] flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300">
          
          {/* Header */}
          <div className="p-6 border-b border-[#EAE6DD] flex items-center justify-between bg-[#FAF8F5]">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-white border border-[#E8E3D8] p-1.5 shadow-xs flex items-center justify-center">
                {decision.productImage ? <img
                  src={decision.productImage}
                  alt={decision.productName}
                  className="w-full h-full object-contain"
                /> : <Package size={24} aria-label="No product image" />}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#68756D]">
                  Product Decision Detail
                </p>
                <h2 className="text-lg font-bold text-[#19211D]">
                  {decision.productName}
                </h2>
                <p className="text-xs text-[#8A968E]">{decision.productCategory}</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#68756D] hover:bg-[#EAE5DA] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Body */}
          <div className="p-6 space-y-6 flex-1">
            
            {/* Status & Action Hero Pill */}
            <div className={`p-4 rounded-3xl border ${
              isAuto
                ? 'bg-[#EAF5EC] border-[#C8E5CD]'
                : isApprovalRequired
                ? 'bg-[#FEF4EC] border-[#FCE0CC]'
                : isApproved
                ? 'bg-[#EBF7EE] border-[#C8E8CF]'
                : isRejected
                ? 'bg-[#FDF0EE] border-[#F8CEC9]'
                : 'bg-[#F4F6F3] border-[#E0E8DC]'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#68756D]">
                  Action Recommendation
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                  isAuto
                    ? 'bg-[#D2E8D4] text-[#267343]'
                    : isApprovalRequired
                    ? 'bg-[#FEE8D6] text-[#B86A1B] animate-pulse'
                    : isApproved
                    ? 'bg-[#D2E8D4] text-[#267343]'
                    : isRejected
                    ? 'bg-[#FCE3E1] text-[#C8403C]'
                    : 'bg-[#E3EBDD] text-[#2D4739]'
                }`}>
                  {decision.status.replace('_', ' ')}
                </span>
              </div>

              <p className="text-2xl font-extrabold text-[#19211D] tracking-tight">
                {decision.action} {decision.quantity > 0 ? `${decision.quantity} UNITS` : ''}
              </p>

              {decision.executionNote && (
                <p className="text-xs text-[#2D4739] font-medium mt-1 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#375B42]" />
                  <span>{decision.executionNote}</span>
                </p>
              )}
            </div>

            {/* Core Metrics Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#FAF8F5] p-3.5 rounded-2xl border border-[#EAE6DD]">
                <div className="flex items-center gap-2 text-[#78887E] text-xs font-medium mb-1">
                  <Boxes className="w-3.5 h-3.5" />
                  <span>Current stock</span>
                </div>
                <p className="text-lg font-bold text-[#19211D]">
                  {decision.currentStock} units
                </p>
              </div>

              <div className="bg-[#FAF8F5] p-3.5 rounded-2xl border border-[#EAE6DD]">
                <div className="flex items-center gap-2 text-[#78887E] text-xs font-medium mb-1">
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span>Expected demand</span>
                </div>
                <p className="text-lg font-bold text-[#19211D]">
                  {decision.expectedDemand} / day
                </p>
              </div>

              <div className="bg-[#FAF8F5] p-3.5 rounded-2xl border border-[#EAE6DD]">
                <div className="flex items-center gap-2 text-[#78887E] text-xs font-medium mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Supplier lead time</span>
                </div>
                <p className="text-lg font-bold text-[#19211D]">
                  {decision.supplierLeadTime} days
                </p>
              </div>

              <div className="bg-[#FAF8F5] p-3.5 rounded-2xl border border-[#EAE6DD]">
                <div className="flex items-center gap-2 text-[#78887E] text-xs font-medium mb-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Stockout risk</span>
                </div>
                <p className={`text-lg font-bold ${decision.stockoutRisk > 5 ? 'text-[#C8403C]' : 'text-[#375B42]'}`}>
                  {decision.stockoutRisk}%
                </p>
              </div>
            </div>

            {/* Operational Reason Section (Plain English) */}
            <div className="bg-[#FAF9F6] p-4 rounded-2xl border border-[#EAE6DD]">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#4A554E] mb-1.5 flex items-center gap-1.5">
                <span>WHY?</span>
              </h4>
              <p className="text-[13.5px] leading-relaxed text-[#19211D] font-medium">
                “{decision.reason}”
              </p>
            </div>

            {/* Technical Reasoning Expandable (MDP / Value Iteration) */}
            <div className="border border-[#E4DFD5] rounded-3xl overflow-hidden bg-white shadow-2xs">
              <button
                onClick={() => setShowTechnical(!showTechnical)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-[#FAF8F5] transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#E3EBDD] flex items-center justify-center text-[#2D4739]">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#19211D] block">
                      Technical Reasoning
                    </span>
                    <span className="text-[11px] text-[#68756D]">
                      MDP Bellman Equation & Evaluated Q-Values
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs font-semibold text-[#375B42]">
                  <span>{showTechnical ? 'Hide' : 'View'}</span>
                  {showTechnical ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {showTechnical && (
                <div className="p-4 pt-1 border-t border-[#EFECE5] bg-[#FAF8F5]/80 space-y-4 text-xs animate-in fade-in duration-200">
                  {/* MDP State */}
                  <div>
                    <span className="font-bold text-[#4A554E] uppercase tracking-wide text-[10px] block mb-1">
                      MDP State Vector S
                    </span>
                    <div className="p-2.5 rounded-xl bg-white border border-[#E6E1D6] font-mono text-[11px] text-[#2D4739] space-y-0.5">
                      <p>Inventory: {decision.technicalReasoning.state.inventory} units</p>
                      <p>Demand Regime: {decision.technicalReasoning.state.demand}</p>
                      <p>Lead Time: {decision.technicalReasoning.state.leadTimeDays} days</p>
                      <p>Shelf Capacity: {decision.technicalReasoning.state.shelfCapacity} positions</p>
                    </div>
                  </div>

                  {/* Evaluated Actions Table */}
                  <div>
                    <span className="font-bold text-[#4A554E] uppercase tracking-wide text-[10px] block mb-1">
                      Actions Evaluated
                    </span>
                    <div className="space-y-1.5">
                      {decision.technicalReasoning.actionsEvaluated.map((act) => (
                        <div
                          key={act.action}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs ${
                            act.isOptimal
                              ? 'bg-[#E3EBDD] border border-[#BBD0B6] font-bold text-[#1E3326]'
                              : 'bg-white border border-[#EFECE6] text-[#68756D]'
                          }`}
                        >
                          <span className="font-medium">{act.action}</span>
                          <div className="flex items-center gap-2 font-mono">
                            <span>Value: {act.value}</span>
                            {act.isOptimal && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#375B42] text-white uppercase font-sans">
                                Optimal
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Engine Details */}
                  <div className="pt-2 border-t border-[#EAE6DD] text-[11px] text-[#68756D]">
                    <p className="font-semibold text-[#19211D]">
                      ENGINE: {decision.technicalReasoning.algorithm}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-[#55635A] leading-relaxed">
                      {decision.technicalReasoning.bellmanDetails}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Reject Reason Dialog if triggered */}
            {rejectPrompt && (
              <div className="p-4 rounded-2xl bg-[#FFF5F4] border border-[#FADBD8] space-y-3 animate-in zoom-in-95">
                <p className="text-xs font-bold text-[#C8403C]">
                  Select reason for rejecting this decision:
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {['Supplier issue', 'Budget constraint', 'Overstock risk', 'Manual hold'].map((r) => (
                    <button
                      key={r}
                      onClick={() => setRejectReason(r)}
                      className={`text-xs py-1.5 px-2 rounded-lg border text-left ${
                        rejectReason === r
                          ? 'bg-[#FCE3E1] border-[#C8403C] text-[#C8403C] font-bold'
                          : 'bg-white border-[#F0D5D3] text-[#68756D]'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setRejectPrompt(false)}
                    className="px-3 py-1 text-xs text-[#68756D] hover:underline"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmReject}
                    className="px-3 py-1 rounded-full bg-[#C8403C] text-white text-xs font-bold"
                  >
                    Confirm Rejection
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action Footer Bar */}
          <div className="p-5 border-t border-[#EAE6DD] bg-[#FAF8F5] flex items-center justify-between gap-3">
            {isApprovalRequired && (
              <div className="w-full flex items-center gap-2">
                <button
                  onClick={handleApprove}
                  className="flex-1 py-3 px-4 rounded-full bg-[#375B42] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md hover:bg-[#2C4935] active:scale-95 transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>APPROVE</span>
                </button>

                <button
                  onClick={() => setIsModifyOpen(true)}
                  className="py-3 px-4 rounded-full bg-white border border-[#D5CFBF] text-[#2D4739] text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs hover:bg-[#FAF8F5] active:scale-95 transition-all"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>MODIFY</span>
                </button>

                <button
                  onClick={() => setRejectPrompt(true)}
                  className="py-3 px-3 rounded-full bg-white border border-[#F3C5C2] text-[#C8403C] text-xs font-bold flex items-center justify-center shadow-2xs hover:bg-[#FFF5F4] active:scale-95 transition-all"
                  title="Reject decision"
                >
                  <Ban className="w-4 h-4" />
                </button>
              </div>
            )}

            {isAuto && (
              <div className="w-full flex items-center justify-between">
                <span className="text-xs text-[#267343] font-semibold flex items-center gap-1">
                  <Check className="w-4 h-4" /> Auto Executed
                </span>
                <span className="text-xs text-[#68756D] font-semibold">
                  Purchase order recorded
                </span>
              </div>
            )}

            {(isApproved || isModified || isRejected) && (
              <div className="w-full flex items-center justify-between text-xs text-[#68756D]">
                <span className="font-semibold">Workflow Completed</span>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-full bg-[#375B42] text-white text-xs font-bold hover:bg-[#2C4935]"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {isModifyOpen && (
        <ModifyModal decision={decision} onClose={() => setIsModifyOpen(false)} />
      )}
    </>
  );
};
