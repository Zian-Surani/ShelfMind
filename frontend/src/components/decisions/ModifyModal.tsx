import React, { useState, useEffect, useRef } from 'react';
import { X, Check } from 'lucide-react';
import { Decision } from '../../types';
import { useApp } from '../../store/appStore';

interface ModifyModalProps {
  decision: Decision;
  onClose: () => void;
}

export const ModifyModal: React.FC<ModifyModalProps> = ({ decision, onClose }) => {
  const { modifyDecision } = useApp();
  const [quantity, setQuantity] = useState<number>(decision.quantity);
  const [reason, setReason] = useState<string>('budget constraint');
  const [customNote, setCustomNote] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto focus input and handle ESC key
  useEffect(() => {
    inputRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const REASONS = [
    'budget constraint',
    'supplier issue',
    'manual adjustment',
    'seasonal promotion',
    'other',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = reason === 'other' && customNote ? customNote : reason;
    modifyDecision(decision.id, quantity, finalReason);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/30 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-[#E5E0D6] animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-[#EAE6DD]">
          <h3 className="text-base font-bold text-[#19211D]">
            Modify Order: {decision.productName}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#78887E] hover:bg-[#F3EFE6] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div>
            <label className="block text-xs font-semibold text-[#4A554E] mb-1.5">
              Order Quantity (Recommended: {decision.quantity} units)
            </label>
            <div className="flex items-center gap-3">
              <input
                ref={inputRef}
                type="number"
                min="0"
                max="100"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-[#FAF8F5] border border-[#DCD6C9] rounded-2xl px-4 py-2.5 text-base font-bold text-[#19211D] focus:outline-none focus:border-[#375B42] focus:ring-2 focus:ring-[#375B42]/10"
                required
              />
              <span className="text-xs font-bold text-[#78887E]">units</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#4A554E] mb-1.5">
              Reason for Adjustment
            </label>
            <div className="grid grid-cols-2 gap-2">
              {REASONS.map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => setReason(r)}
                  className={`text-xs font-medium py-2 px-3 rounded-xl border text-left capitalize transition-all ${
                    reason === r
                      ? 'bg-[#E3EBDD] border-[#375B42] text-[#22382D] font-bold'
                      : 'bg-[#FAF8F5] border-[#E8E3D8] text-[#55635B] hover:bg-[#F2ECE0]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {reason === 'other' && (
            <div>
              <label className="block text-xs font-semibold text-[#4A554E] mb-1">
                Custom Explanation
              </label>
              <input
                type="text"
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder="Explain the override reason..."
                className="w-full bg-[#FAF8F5] border border-[#DCD6C9] rounded-xl px-3 py-2 text-xs text-[#19211D] focus:outline-none focus:border-[#375B42]"
              />
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#EAE6DD]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-semibold text-[#68756D] hover:bg-[#F3EFE6] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-full bg-[#375B42] text-white text-xs font-bold shadow-md hover:bg-[#2C4935] flex items-center gap-1.5 transition-transform active:scale-95"
            >
              <Check className="w-3.5 h-3.5" />
              Save & Apply
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
