import React, { useState, useEffect } from 'react';
import { X, Check, ArrowRight, PackageCheck, AlertCircle } from 'lucide-react';
import { useApp } from '../../store/appStore';

interface ShelfRestockModalProps {
  onClose: () => void;
}

export const ShelfRestockModal: React.FC<ShelfRestockModalProps> = ({ onClose }) => {
  const { products, restockShelfItem } = useApp();
  const [selectedProduct, setSelectedProduct] = useState(
    products.find((p) => p.status === 'low') || products[0]
  );
  const [restockQty, setRestockQty] = useState<number>(6);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    restockShelfItem(selectedProduct.name, restockQty);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/30 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-[#E5E0D6] animate-in zoom-in-95">
        <div className="flex items-center justify-between pb-4 border-b border-[#EAE6DD]">
          <div className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-[#375B42]" />
            <h3 className="text-base font-bold text-[#19211D]">
              Restock Shelf From Backroom
            </h3>
          </div>
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
              Select Product to Restock
            </label>
            <select
              value={selectedProduct.id}
              onChange={(e) => {
                const found = products.find((p) => p.id === e.target.value);
                if (found) setSelectedProduct(found);
              }}
              className="w-full bg-[#FAF8F5] border border-[#DCD6C9] rounded-2xl px-4 py-2.5 text-sm font-semibold text-[#19211D] focus:outline-none focus:border-[#375B42]"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Shelf: {p.shelfStock} | Backroom: {p.backroomStock})
                </option>
              ))}
            </select>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#F6F5F0] border border-[#E8E4DA] space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[#68756D]">Visible Shelf Quantity:</span>
              <span className="font-bold text-[#19211D]">{selectedProduct.shelfStock} units</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#68756D]">Backroom Inventory Available:</span>
              <span className="font-bold text-[#2D4739]">{selectedProduct.backroomStock} units</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#68756D]">Shelf Capacity:</span>
              <span className="font-bold text-[#19211D]">{selectedProduct.shelfCapacity} units</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#4A554E] mb-1.5">
              Transfer Quantity to Shelf
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max={selectedProduct.backroomStock}
                value={restockQty}
                onChange={(e) => setRestockQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-[#FAF8F5] border border-[#DCD6C9] rounded-2xl px-4 py-2.5 text-base font-bold text-[#19211D] focus:outline-none focus:border-[#375B42]"
                required
              />
              <span className="text-xs font-bold text-[#78887E]">units</span>
            </div>
          </div>

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
              disabled={selectedProduct.backroomStock === 0}
              className="px-5 py-2.5 rounded-full bg-[#375B42] text-white text-xs font-bold shadow-md hover:bg-[#2C4935] flex items-center gap-1.5 transition-transform active:scale-95 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              Restock Shelf
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
