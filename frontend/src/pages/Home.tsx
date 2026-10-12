import React from 'react';
import {
  ArrowRight,
  ShoppingCart,
  AlertCircle,
  UserCheck,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Camera,
  ChevronDown,
  FileText,
} from 'lucide-react';
import { useApp } from '../store/appStore';
import { DonutChart } from '../components/charts/DonutChart';
import { DemandLineChart } from '../components/charts/DemandLineChart';
import { DecisionCard } from '../components/decisions/DecisionCard';
import { ShelfCameraCard } from '../components/shelfwatch/ShelfCameraCard';
import { MascotAvatar } from '../components/mascot/MascotAvatar';
import { ShaderSurface } from '../components/mascot/ShaderSurface';
import { Decision, ActivityItem } from '../types';

export const Home: React.FC = () => {
  const {
    metrics,
    decisions,
    activity,
    setCurrentTab,
    setIsAssistantOpen,
    mascotMood,
    settings,
    products,
    demandSeries,
    isDataLoading,
    dataError,
  } = useApp();

  const todayDecisions = decisions.slice(0, 3);
  const healthyCount = products.filter((product) => product.status === 'healthy').length;
  const lowStockCount = products.filter((product) => product.status === 'low' || product.status === 'critical').length;
  const overstockCount = products.filter((product) => product.status === 'overstock').length;
  const healthPercent = products.length > 0 ? Math.round((healthyCount / products.length) * 100) : 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const strongestTrend = [...products].sort((a, b) => Math.abs(b.demandTrendPercent) - Math.abs(a.demandTrendPercent))[0];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. HERO BENTO CARD (Exact match to sample UI.png) */}
      <div className="relative overflow-hidden bg-white rounded-4xl p-8 border border-[#EAE5DA] shadow-[0_10px_32px_rgba(25,33,29,0.035)]">
        {/* Subtle moving ShaderGradient background atmosphere */}
        <ShaderSurface intensity={0.4} />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          {/* Left Column: Greeting & Summary Badges */}
          <div className="space-y-5 flex-1 max-w-xl">
            <div>
              <h1 className="text-3xl font-extrabold text-[#19211D] tracking-tight flex items-center gap-2.5">
                <span>{greeting}, {settings.managerName.split(' ')[0]}.</span>
              </h1>
              <p className="text-[14.5px] text-[#68756D] font-medium mt-1">
                {dataError ? 'Backend connection needs attention.' : isDataLoading ? 'Loading current store state...' : 'Here is the latest store state from Supabase.'}
              </p>
            </div>

            {/* 3 Summary Pill Cards */}
            <div className="flex flex-wrap gap-3.5 pt-1">
              {/* Card 1: Auto executed */}
              <div
                onClick={() => setCurrentTab('decisions')}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#EAF5EC] border border-[#D3ECD7] cursor-pointer hover:scale-102 hover:shadow-sm transition-all"
              >
                <div className="w-9 h-9 rounded-full bg-[#D2E8D4] text-[#267343] flex items-center justify-center flex-shrink-0 shadow-2xs">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xl font-extrabold text-[#19211D] leading-none block">
                    {metrics.autoExecutedCount}
                  </span>
                  <span className="text-[11px] text-[#486350] font-semibold leading-tight block mt-0.5">
                    actions completed<br />automatically
                  </span>
                </div>
              </div>

              {/* Card 2: Items need attention */}
              <div
                onClick={() => setCurrentTab('inventory')}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#FEF0EF] border border-[#FADBD8] cursor-pointer hover:scale-102 hover:shadow-sm transition-all"
              >
                <div className="w-9 h-9 rounded-full bg-[#FCE3E1] text-[#C8403C] flex items-center justify-center flex-shrink-0 shadow-2xs">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xl font-extrabold text-[#19211D] leading-none block">
                    {metrics.attentionCount}
                  </span>
                  <span className="text-[11px] text-[#8C3F3B] font-semibold leading-tight block mt-0.5">
                    items need<br />attention
                  </span>
                </div>
              </div>

              {/* Card 3: Approval required */}
              <div
                onClick={() => setCurrentTab('decisions')}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#FEF4EC] border border-[#FCE0CC] cursor-pointer hover:scale-102 hover:shadow-sm transition-all"
              >
                <div className="w-9 h-9 rounded-full bg-[#FEE8D6] text-[#B86A1B] flex items-center justify-center flex-shrink-0 shadow-2xs">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xl font-extrabold text-[#19211D] leading-none block">
                    {metrics.approvalRequiredCount}
                  </span>
                  <span className="text-[11px] text-[#945618] font-semibold leading-tight block mt-0.5">
                    approval<br />required
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Mascot Speech Bubble & 3D Avatar */}
          <div className="flex flex-col sm:flex-row items-center gap-4 relative">
            {/* Speech Bubble & Action Button */}
            <div className="space-y-3.5 w-full sm:w-auto max-w-xs text-left">
              <div className="relative bg-white/95 backdrop-blur-sm p-4 rounded-3xl border border-[#EAE5DA] shadow-[0_4px_16px_rgba(0,0,0,0.04)] text-[13px] text-[#2D3E33] leading-relaxed font-medium">
                {lowStockCount} of {products.length} products need stock review. {metrics.approvalRequiredCount} recommendations await approval.
                <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-t border-r border-[#EAE5DA] transform rotate-45" />
              </div>

              <div className="flex justify-end sm:justify-start">
                <button
                  onClick={() => setCurrentTab('decisions')}
                  className="px-6 py-2.5 rounded-full bg-[#375B42] text-white text-[13.5px] font-bold shadow-md hover:bg-[#2C4A35] flex items-center gap-2 hover:gap-3 transition-all active:scale-95"
                >
                  <span>Show me</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Mascot Hero Graphic (Visual only) */}
            <div className="hidden sm:flex relative flex-col items-center select-none pointer-events-none">
              <MascotAvatar mood={mascotMood} size="hero" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. SECOND ROW BENTO GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Bento 1: Inventory Health */}
        <div className="bg-white rounded-3xl p-6 border border-[#EAE5DA] shadow-[0_8px_24px_rgba(25,33,29,0.03)] flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-[#19211D] mb-4">
              Inventory Health
            </h3>

            <div className="flex items-center justify-between gap-4 py-2">
              <DonutChart
                percentage={healthPercent}
                healthyCount={healthyCount}
                lowStockCount={lowStockCount}
                overstockCount={overstockCount}
                size={130}
              />

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#375B42]" />
                  <div>
                    <span className="font-bold text-[#19211D] block leading-tight">Healthy</span>
                    <span className="text-[#68756D] text-[11px]">{healthyCount} products</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E06D67]" />
                  <div>
                    <span className="font-bold text-[#19211D] block leading-tight">Low Stock</span>
                    <span className="text-[#68756D] text-[11px]">{lowStockCount} products</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E59E44]" />
                  <div>
                    <span className="font-bold text-[#19211D] block leading-tight">Overstock</span>
                    <span className="text-[#68756D] text-[11px]">{overstockCount} products</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#F1EDE5] mt-4 text-right">
            <button
              onClick={() => setCurrentTab('inventory')}
              className="text-xs font-semibold text-[#375B42] hover:text-[#22382D] inline-flex items-center gap-1 transition-colors"
            >
              <span>View Inventory</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Bento 2: Today's Key Decisions */}
        <div className="bg-white rounded-3xl p-6 border border-[#EAE5DA] shadow-[0_8px_24px_rgba(25,33,29,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-[#19211D]">
                Today’s Key Decisions
              </h3>
              <button
                onClick={() => setCurrentTab('decisions')}
                className="text-xs font-semibold text-[#68756D] hover:text-[#375B42] flex items-center gap-1 transition-colors"
              >
                <span>See all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-[#F1EDE5]">
              {todayDecisions.map((decision: Decision) => (
                <DecisionCard key={decision.id} decision={decision} compact />
              ))}
            </div>
          </div>
        </div>

        {/* Bento 3: Store Snapshot (ShelfWatch) */}
        <div className="bg-white rounded-3xl p-6 border border-[#EAE5DA] shadow-[0_8px_24px_rgba(25,33,29,0.03)]">
          <ShelfCameraCard />
        </div>
      </div>

      {/* 3. THIRD ROW BENTO GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Bento 4: Demand Trend */}
        <div className="bg-white rounded-3xl p-6 border border-[#EAE5DA] shadow-[0_8px_24px_rgba(25,33,29,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-bold text-[#19211D]">
                Demand Trend <span className="text-xs font-normal text-[#68756D]">(Selected Products)</span>
              </h3>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-[#4A554E] bg-[#FAF8F5] px-2.5 py-1 rounded-full border border-[#EAE5DA] cursor-pointer">
                <span>Last 7 days</span>
                <ChevronDown className="w-3 h-3 text-[#78887E]" />
              </div>
            </div>

            <div className="mt-2">
              <DemandLineChart data={demandSeries} />
            </div>
          </div>

          <div className="pt-2 border-t border-[#F1EDE5] mt-3">
            <p className="text-[11.5px] text-[#4A554E] font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#375B42]" />
              <span>{strongestTrend ? `${strongestTrend.name} demand trend is ${strongestTrend.demandTrendPercent > 0 ? '+' : ''}${strongestTrend.demandTrendPercent}% from recent observations.` : 'Demand trend is waiting for product observations.'}</span>
            </p>
          </div>
        </div>

        {/* Bento 5: Recent Activity */}
        <div className="bg-white rounded-3xl p-6 border border-[#EAE5DA] shadow-[0_8px_24px_rgba(25,33,29,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-[#19211D]">
                Recent Activity
              </h3>
              <button
                onClick={() => setCurrentTab('audit')}
                className="text-xs font-semibold text-[#68756D] hover:text-[#375B42] flex items-center gap-1 transition-colors"
              >
                <span>See all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {activity.slice(0, 4).map((act: ActivityItem) => (
                <div key={act.id} className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full ${act.iconBg} ${act.iconColor} flex items-center justify-center flex-shrink-0 mt-0.5 shadow-2xs`}>
                    {act.type === 'auto_order' && <ShoppingCart className="w-3.5 h-3.5" />}
                    {act.type === 'shelfwatch' && <Camera className="w-3.5 h-3.5" />}
                    {act.type === 'approval_pending' && <AlertCircle className="w-3.5 h-3.5" />}
                    {act.type === 'delivery' && <TrendingUp className="w-3.5 h-3.5" />}
                    {act.type === 'human_action' && <UserCheck className="w-3.5 h-3.5" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-[#19211D] truncate">
                        {act.title}
                      </p>
                      <span className="text-[10.5px] text-[#8A968E] font-medium ml-2 flex-shrink-0">
                        {act.timestamp}
                      </span>
                    </div>
                    <p className="text-[11.5px] text-[#68756D] truncate mt-0.5">
                      {act.subtitle}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bento 6: System Performance */}
        <div className="bg-white rounded-3xl p-6 border border-[#EAE5DA] shadow-[0_8px_24px_rgba(25,33,29,0.03)] flex flex-col justify-between">
          <div>
            <div className="mb-3">
              <h3 className="text-base font-bold text-[#19211D]">
                System Performance
              </h3>
              <p className="text-xs text-[#68756D] -mt-0.5 font-medium">
                Imported history totals
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EFECE5]">
                <div className="flex items-center justify-between">
                  <span className="text-xl font-extrabold text-[#19211D]">
                    {metrics.serviceLevel}%
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-[#267343]" />
                </div>
                <p className="text-[11px] font-semibold text-[#68756D] mt-1">
                  Service level
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EFECE5]">
                <div className="flex items-center justify-between">
                  <span className="text-xl font-extrabold text-[#19211D]">
                    {metrics.stockoutRate}%
                  </span>
                  <ArrowDownRight className="w-4 h-4 text-[#B86A1B]" />
                </div>
                <p className="text-[11px] font-semibold text-[#68756D] mt-1">
                  Stockouts
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EFECE5]">
                <div className="flex items-center justify-between">
                  <span className="text-xl font-extrabold text-[#19211D]">
                    {metrics.unitsSold.toLocaleString()}
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-[#267343]" />
                </div>
                <p className="text-[11px] font-semibold text-[#68756D] mt-1">
                  Units sold
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EFECE5]">
                <div className="flex items-center justify-between">
                  <span className="text-xl font-extrabold text-[#19211D]">
                    {metrics.wasteUnits.toLocaleString()}
                  </span>
                  <ArrowDownRight className="w-4 h-4 text-[#C8403C]" />
                </div>
                <p className="text-[11px] font-semibold text-[#68756D] mt-1">
                  Waste units
                </p>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#F1EDE5] mt-4 text-right">
            <button
              onClick={() => setCurrentTab('analytics')}
              className="text-xs font-semibold text-[#375B42] hover:text-[#22382D] inline-flex items-center gap-1 transition-colors"
            >
              <span>View Analytics</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. BOTTOM BANNER */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#DDE7DA] via-[#EEF3EA] to-[#E2EBE0] rounded-3xl p-6 border border-[#CAD8C5] shadow-[0_4px_20px_rgba(45,71,57,0.04)] flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-white shadow-[0_4px_16px_rgba(45,71,57,0.08)] border border-[#C4D7C2] flex items-center justify-center flex-shrink-0">
            <FileText className="w-7 h-7 text-[#274735]" />
          </div>

          <div>
            <h4 className="text-base font-extrabold text-[#192820]">
              Optimizing today for a fuller tomorrow.
            </h4>
            <p className="text-xs font-medium text-[#44564B] mt-0.5">
              AI decisions. Real impact. Happier stores.
            </p>
          </div>
        </div>

        <button
          onClick={() => setCurrentTab('audit')}
          className="px-6 py-2.5 rounded-full bg-[#2D4739] text-white text-xs font-bold shadow-md hover:bg-[#22382D] flex items-center gap-2 transition-all flex-shrink-0"
        >
          <span>View Full Report</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
