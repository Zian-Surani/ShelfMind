import React from 'react';
import { Package } from 'lucide-react';
import { Decision } from '../../types';
import { useApp } from '../../store/appStore';

interface DecisionCardProps {
  decision: Decision;
  compact?: boolean;
}

export const DecisionCard: React.FC<DecisionCardProps> = ({ decision, compact = false }) => {
  const { setSelectedDecision } = useApp();

  const getStatusBadge = (status: Decision['status']) => {
    switch (status) {
      case 'AUTO_EXECUTED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#D2E8D4] text-[#267343] border border-[#B8D9BC]">
            Auto
          </span>
        );
      case 'APPROVAL_REQUIRED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FEE8D6] text-[#B86A1B] border border-[#FAD0AC]">
            Approval
          </span>
        );
      case 'APPROVED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#D2E8D4] text-[#267343]">
            Approved
          </span>
        );
      case 'MODIFIED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EAE6F9] text-[#5540B0]">
            Modified
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FCE3E1] text-[#C8403C]">
            Rejected
          </span>
        );
      case 'SUPERSEDED':
        return <span className="text-xs font-semibold text-[#68756D]">Replaced by newer count</span>;
      case 'HOLD':
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EAF0E7] text-[#4A5E50] border border-[#D5E1D1]">
            MDP
          </span>
        );
    }
  };

  return (
    <div
      onClick={() => setSelectedDecision(decision)}
      className="group flex items-center justify-between p-2.5 rounded-2xl hover:bg-[#F9F8F5] cursor-pointer transition-all duration-150 border border-transparent hover:border-[#E8E4DA]"
    >
      <div className="flex items-center gap-3.5">
        {/* Product Thumbnail */}
        <div className="w-11 h-12 rounded-xl bg-white border border-[#EAE5DA] p-1 flex items-center justify-center flex-shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
          {decision.productImage ? <img
            src={decision.productImage}
            alt={decision.productName}
            className="w-full h-full object-contain"
          /> : <Package size={24} aria-label="No product image" />}
        </div>

        {/* Product & Action Info */}
        <div>
          <h4 className="text-[14px] font-bold text-[#19211D] leading-snug group-hover:text-[#2D4739] transition-colors">
            {decision.productName}
          </h4>
          <p className="text-[12px] font-medium text-[#68756D]">
            {decision.action === 'BUY'
              ? `BUY ${decision.quantity} units`
              : decision.action === 'HOLD'
              ? 'HOLD'
              : `${decision.action} ${decision.quantity}`}
          </p>
        </div>
      </div>

      {/* Right Side: Status Badge & Timestamp */}
      <div className="flex items-center gap-3">
        {getStatusBadge(decision.status)}
        <span className="text-[12px] text-[#8A978E] font-medium min-w-[44px] text-right">
          {decision.timeAgo}
        </span>
      </div>
    </div>
  );
};
