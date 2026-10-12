import React, { useState } from 'react';
import {
  Search,
  Plus,
  Minus,
  Layers,
  Package,
  ArrowRight,
} from 'lucide-react';
import { useApp } from '../store/appStore';
import { Product } from '../types';

export const Inventory: React.FC = () => {
  const {
    products,
    searchQuery,
    setSearchQuery,
    setSelectedDecision,
    decisions,
    reallocateShelf,
    setCurrentTab,
  } = useApp();

  const [activeFilter, setActiveFilter] = useState<'all' | 'low' | 'healthy' | 'overstock' | 'critical'>('all');

  // Filter products by search and status
  const filteredProducts = products.filter((p: Product) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (activeFilter === 'all') return true;
    if (activeFilter === 'critical') return p.status === 'critical' || p.status === 'low';
    return p.status === activeFilter;
  });

  const getStatusBadge = (status: Product['status']) => {
    switch (status) {
      case 'healthy':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#EAF5EC] text-[#267343] border border-[#D5EED8]">
            Healthy
          </span>
        );
      case 'low':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#FEF2E8] text-[#B86A1B] border border-[#FAD0AC]">
            Low Stock
          </span>
        );
      case 'critical':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#FEF0EF] text-[#C8403C] border border-[#F6CBC8] animate-pulse">
            Critical
          </span>
        );
      case 'overstock':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#F5F2EB] text-[#7A6953] border border-[#E8E1D5]">
            Overstock
          </span>
        );
    }
  };

  const handleOpenDecision = (product: Product) => {
    const dec = decisions.find((d) => d.productId === product.id);
    if (dec) {
      setSelectedDecision(dec);
    } else {
      setCurrentTab('decisions');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#19211D] tracking-tight">
            Inventory & Shelf Allocation
          </h1>
          <p className="text-xs font-medium text-[#68756D] mt-0.5">
            Real-time stock velocity, shelf capacity facings, and MDP policy recommendations.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setCurrentTab('shelfwatch')}
            className="px-4 py-2 rounded-full bg-white border border-[#E2DDD3] text-xs font-bold text-[#2D4739] shadow-2xs hover:bg-[#FAF8F5] transition-all flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5 text-[#375B42]" />
            <span>Planogram Map</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Row */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-3 rounded-3xl border border-[#EAE5DA] shadow-xs">
        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {[
            { id: 'all', label: 'All', count: products.length },
            { id: 'low', label: 'Low Stock', count: products.filter((p: Product) => p.status === 'low').length },
            { id: 'healthy', label: 'Healthy', count: products.filter((p: Product) => p.status === 'healthy').length },
            { id: 'overstock', label: 'Overstock', count: products.filter((p: Product) => p.status === 'overstock').length },
            { id: 'critical', label: 'Attention', count: products.filter((p: Product) => p.status === 'critical' || p.status === 'low').length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeFilter === tab.id
                  ? 'bg-[#E3EBDD] text-[#22382D] shadow-2xs'
                  : 'text-[#68756D] hover:bg-[#F6F5F0] hover:text-[#19211D]'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeFilter === tab.id ? 'bg-[#2D4739] text-white' : 'bg-[#EFECE5] text-[#78887E]'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search inside inventory */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8A968E]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by snack or category..."
            className="w-full bg-[#FAF8F5] border border-[#E5E0D6] rounded-full pl-9 pr-4 py-1.5 text-xs text-[#19211D] placeholder-[#8A968E] focus:outline-none focus:border-[#375B42]"
          />
        </div>
      </div>

      {/* Inventory Table Container */}
      <div className="bg-white rounded-3xl border border-[#EAE5DA] shadow-[0_8px_24px_rgba(25,33,29,0.03)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#EFECE6] bg-[#FAF8F5]/80 text-[11px] font-extrabold uppercase tracking-wider text-[#68756D]">
                <th className="py-4 px-6">Product</th>
                <th className="py-4 px-4">Current Stock</th>
                <th className="py-4 px-4">Demand</th>
                <th className="py-4 px-4">Status</th>
                <th className="py-4 px-4">Shelf Allocation</th>
                <th className="py-4 px-4">Recommendation</th>
                <th className="py-4 px-6 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#F1EDE5] text-xs font-medium">
              {filteredProducts.map((p: Product) => {
                const totalCap = p.shelfCapacity;
                const fillPercent = Math.min(100, Math.round((p.shelfStock / totalCap) * 100));

                return (
                  <tr
                    key={p.id}
                    className="hover:bg-[#FAF9F6] transition-colors group cursor-pointer"
                    onClick={() => handleOpenDecision(p)}
                  >
                    {/* Product Name & Image */}
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-11 rounded-xl bg-white border border-[#EAE5DA] p-1 flex items-center justify-center flex-shrink-0 shadow-2xs">
                          {p.image ? <img
                            src={p.image}
                            alt={p.name}
                            className="w-full h-full object-contain"
                          /> : <Package className="w-6 h-6 text-[#78887E]" aria-label="No product image" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#19211D] group-hover:text-[#2D4739] transition-colors">
                            {p.name}
                          </p>
                          <p className="text-[11px] text-[#78887E]">{p.category}</p>
                        </div>
                      </div>
                    </td>

                    {/* Current Stock */}
                    <td className="py-3.5 px-4">
                      <span className="text-sm font-extrabold text-[#19211D]">
                        {p.currentStock}
                      </span>
                      <span className="text-[11px] text-[#8A968E] block">
                        {p.shelfStock} shelf · {p.backroomStock} back
                      </span>
                    </td>

                    {/* Demand Rate */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[#19211D]">
                          {p.demandRate}/day
                        </span>
                        {p.demandTrend === 'up' && (
                          <span className="text-[10px] font-bold text-[#267343] flex items-center">
                            ↑{p.demandTrendPercent}%
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4">
                      {getStatusBadge(p.status)}
                    </td>

                    {/* Shelf Allocation & Facings */}
                    <td className="py-3.5 px-4 min-w-[170px]" onClick={(e) => e.stopPropagation()}>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-[#2D4739]">
                            {p.shelfPositions} positions
                          </span>
                          <span className="text-[#8A968E]">
                            {p.shelfStock}/{p.shelfCapacity}
                          </span>
                        </div>

                        {/* Visual Shelf Bar */}
                        <div className="w-full h-2 bg-[#EFECE5] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              fillPercent < 30 ? 'bg-[#E06D67]' : fillPercent > 80 ? 'bg-[#E59E44]' : 'bg-[#375B42]'
                            }`}
                            style={{ width: `${fillPercent}%` }}
                          />
                        </div>

                        {/* Interactive Position Tuner */}
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <button
                            onClick={() => reallocateShelf(p.id, -1)}
                            className="w-5 h-5 rounded-md bg-[#FAF8F5] border border-[#E0DBD0] flex items-center justify-center text-[#68756D] hover:bg-[#EAE5DA]"
                            title="Decrease shelf facing position"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => reallocateShelf(p.id, 1)}
                            className="w-5 h-5 rounded-md bg-[#FAF8F5] border border-[#E0DBD0] flex items-center justify-center text-[#68756D] hover:bg-[#EAE5DA]"
                            title="Increase shelf facing position"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <span className="text-[10px] text-[#8A968E]">Adjust facings</span>
                        </div>
                      </div>
                    </td>

                    {/* Recommendation */}
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${
                        p.recommendation.startsWith('BUY')
                          ? 'bg-[#EAF5EC] text-[#267343] border border-[#C6E4CC]'
                          : 'bg-[#F2EFE8] text-[#5A685F]'
                      }`}>
                        {p.recommendation}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-6 text-right">
                      <button
                        onClick={() => handleOpenDecision(p)}
                        className="p-2 rounded-full hover:bg-[#EAE5DA] text-[#4A554E] hover:text-[#19211D] transition-colors"
                        title="View detailed MDP decision"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
