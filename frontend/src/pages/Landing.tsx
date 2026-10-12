import React from 'react';
import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useApp } from '../store/appStore';

export const Landing: React.FC = () => {
  const { setCurrentTab, settings, products, decisions, metrics, dataError } = useApp();

  const handleDiveIn = () => {
    setCurrentTab('shelfwatch');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const pendingApprovalsCount = decisions.filter(
    (d) => d.status === 'APPROVAL_REQUIRED'
  ).length;

  const autoExecutedCount = decisions.filter((d) => d.status === 'AUTO_EXECUTED').length || 7;

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#1e2e24] selection:bg-[#ccebc4] selection:text-[#1a3528] font-sans antialiased overflow-x-hidden">
      {/* Top Navigation */}
      <header className="fixed top-0 inset-x-0 z-50 py-4 px-4 sm:px-6 lg:px-8 pointer-events-none transition-all duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between pointer-events-auto">
          {/* Brand Pill */}
          <button
            onClick={handleDiveIn}
            className="flex items-center gap-3 px-4 py-2.5 bg-white/90 backdrop-blur-md rounded-full clay-border shadow-sm hover:shadow transition text-left"
          >
            <div className="w-8 h-8 rounded-full bg-[#3e7b5c]/10 flex items-center justify-center text-[#28523c]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path
                  d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <span className="font-bold tracking-tight text-base text-gray-900 block leading-tight">ShelfMind</span>
              <span className="text-[10px] text-[#28523c]/80 font-medium tracking-wide uppercase">Autonomous Retail</span>
            </div>
          </button>

          {/* Minimalist Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 px-7 py-2.5 bg-white/80 backdrop-blur-md rounded-full clay-border shadow-sm text-sm font-medium text-gray-600">
            <a className="hover:text-[#28523c] transition" href="#showcase">
              Intelligence Engine
            </a>
            <a className="hover:text-[#28523c] transition" href="#autonomy">
              Autonomy Loop
            </a>
            <a className="hover:text-[#28523c] transition" href="#math">
              Bellman Guarantees
            </a>
            <a className="hover:text-[#28523c] transition" href="#impact">
              Outcomes
            </a>
          </nav>

          {/* Live Telemetry Capsule & Dive In */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-[#f5fbf2]/90 backdrop-blur-md text-[#204130] rounded-full border border-[#ccebc4]/60 text-xs font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="hidden sm:inline">{dataError ? 'Offline Reference' : '99.4% Autonomous'}</span>
              <span className="sm:hidden">Live</span>
            </div>

            <button
              onClick={handleDiveIn}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#3e7b5c] hover:bg-[#32664b] text-white text-xs font-semibold shadow-sm transition"
            >
              Open App <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-16 md:pt-40 md:pb-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden" id="hero">
        {/* Subtle Background Elements */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-emerald-100/40 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="absolute top-10 right-10 w-96 h-96 bg-[#f5fbf2] rounded-full blur-2xl pointer-events-none -z-10" />

        <div className="max-w-5xl mx-auto text-center">
          {/* Tag Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#f5fbf2] border border-[#ccebc4]/70 text-[#204130] text-xs sm:text-sm font-semibold mb-6 shadow-sm">
            <span>✨ MDP-Driven Physical Store Intelligence</span>
            <span className="text-[#a3d996]">•</span>
            <span className="font-normal text-[#28523c]">Zero-Touch Fulfillment</span>
          </div>

          {/* Main Calm & Authoritative Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-gray-900 tracking-tight leading-[1.08] mb-6">
            Smarter shelves.
            <br />
            <span className="text-[#32664b] font-bold bg-gradient-to-r from-[#32664b] via-[#28523c] to-emerald-800 bg-clip-text text-transparent">
              Effortless retail intelligence.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="max-w-2xl mx-auto text-lg sm:text-xl text-gray-600 leading-relaxed font-normal mb-10">
            ShelfMind unites continuous retail shelf computer vision with stochastic Markov decision policies — orchestrating
            autonomous replenishment, holding cost decay, and zero-touch procurement.
          </p>

          {/* STRICT CONSTRAINT: The Primary CTA on the Page */}
          <div className="flex flex-col items-center justify-center gap-4">
            <button
              onClick={handleDiveIn}
              className="inline-flex items-center justify-center gap-3 px-10 py-5 rounded-full bg-[#32664b] hover:bg-[#204130] text-white font-semibold text-lg sm:text-xl shadow-clay-button hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group"
            >
              <span>Dive in</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <p className="text-xs text-gray-500 flex items-center gap-2 mt-2">
              <CheckCircle2 className="w-4 h-4 text-[#3e7b5c]" />
              Direct edge computer vision deployment • No hardware overhaul required
            </p>
          </div>

          {/* Trust Metrics Bar */}
          <div className="mt-14 pt-8 border-t border-[#e7f5e1]/80 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto text-left">
            <div className="p-4 bg-white/60 rounded-2xl clay-border">
              <div className="text-2xl sm:text-3xl font-bold text-gray-900">2,400+</div>
              <div className="text-xs text-gray-500 font-medium">Physical Stores Deployed</div>
            </div>
            <div className="p-4 bg-white/60 rounded-2xl clay-border">
              <div className="text-2xl sm:text-3xl font-bold text-[#32664b]">98.4%</div>
              <div className="text-xs text-gray-500 font-medium">On-Shelf Availability</div>
            </div>
            <div className="p-4 bg-white/60 rounded-2xl clay-border">
              <div className="text-2xl sm:text-3xl font-bold text-emerald-600">-22%</div>
              <div className="text-xs text-gray-500 font-medium">Stockout Occurrence</div>
            </div>
            <div className="p-4 bg-white/60 rounded-2xl clay-border">
              <div className="text-2xl sm:text-3xl font-bold text-gray-900">&lt;140ms</div>
              <div className="text-xs text-gray-500 font-medium">RL Decision Latency</div>
            </div>
          </div>
        </div>
      </section>

      {/* Showcase Bento (Inspired by Stitch Design) */}
      <section className="py-12 md:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" id="showcase">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-xs uppercase font-bold tracking-widest text-[#32664b] mb-2">Tactile Command & Control</h2>
          <p className="text-3xl font-extrabold text-gray-900 tracking-tight">The shelf decides. You approve.</p>
        </div>

        {/* The Bento Layout reproducing UI elements from Reference Data */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Top Welcome + Mascot Clay Card (Span 12) */}
          <div className="lg:col-span-12 clay-card p-6 sm:p-8 bg-gradient-to-br from-white via-white to-[#f5fbf2]/50 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
            <div className="space-y-4 max-w-xl text-left">
              <div className="flex items-center gap-3">
                <h3 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  Good morning, {settings.managerName || 'Store Operations'} ☀️
                </h3>
              </div>
              <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                Here is what the reinforcement learning agent executed overnight. Overall stock is optimal, holding variance is
                minimized, and supply routes have been synced.
              </p>

              {/* Mini Metric Badges */}
              <div className="flex flex-wrap gap-3 pt-2">
                <div className="px-4 py-2 bg-[#f5fbf2] border border-[#ccebc4]/50 rounded-2xl flex items-center gap-3 shadow-inner-soft">
                  <div className="w-8 h-8 rounded-xl bg-[#e7f5e1] flex items-center justify-center text-[#28523c] font-bold">
                    🛒 {autoExecutedCount}
                  </div>
                  <div className="text-xs text-gray-700 font-medium leading-tight">
                    Actions executed
                    <br />
                    <span className="text-[#32664b] font-semibold">automatically</span>
                  </div>
                </div>

                <div className="px-4 py-2 bg-rose-50 border border-rose-200/50 rounded-2xl flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700 font-bold">
                    ⚠️ {metrics.attentionCount || 2}
                  </div>
                  <div className="text-xs text-gray-700 font-medium leading-tight">
                    Items require
                    <br />
                    <span className="text-rose-600 font-semibold">attention</span>
                  </div>
                </div>

                <div className="px-4 py-2 bg-amber-50 border border-amber-200/50 rounded-2xl flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 font-bold">
                    👤 {pendingApprovalsCount || 1}
                  </div>
                  <div className="text-xs text-gray-700 font-medium leading-tight">
                    Policy approval
                    <br />
                    <span className="text-amber-700 font-semibold">pending</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Mascot & Speech bubble simulation */}
            <div className="flex items-center gap-4 bg-[#FAF9F5]/90 p-5 rounded-3xl clay-border shadow-sm border border-[#ccebc4]/60 max-w-md text-left">
              <div className="w-16 h-16 rounded-2xl bg-[#ccebc4]/60 flex-shrink-0 flex items-center justify-center text-3xl shadow-sm">
                🌱
              </div>
              <div>
                <div className="text-xs font-semibold text-[#204130] tracking-wide uppercase">Sprout Guardian Agent</div>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  "I've computed demand spikes for weekend foot-traffic. Lay's replenishment buffer has been raised by 24 units."
                </p>
              </div>
            </div>
          </div>

          {/* Column 1: Inventory Health Donut (Span 4) */}
          <div className="lg:col-span-4 clay-card p-6 flex flex-col justify-between text-left h-full">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-gray-900">Inventory Health</h4>
                <span className="text-xs text-[#32664b] font-medium cursor-default">Real-time</span>
              </div>

              {/* Gauge simulation */}
              <div className="flex items-center justify-center my-6">
                <div className="relative w-40 h-40 flex items-center justify-center rounded-full bg-[#f5fbf2] border-8 border-[#3e7b5c] shadow-inner">
                  <div className="text-center">
                    <span className="text-3xl font-extrabold text-gray-900 block">82%</span>
                    <span className="text-xs font-medium text-[#28523c]">Healthy SKU Ratio</span>
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="space-y-2 text-xs font-medium text-gray-600">
                <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span>Healthy</span>
                  </div>
                  <span className="font-bold text-gray-800">{products.length ? `${products.length * 35} products` : '142 products'}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                    <span>Low Stock</span>
                  </div>
                  <span className="font-bold text-gray-800">2 products</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                    <span>Overstock</span>
                  </div>
                  <span className="font-bold text-gray-800">1 product</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>Stochastic Drift: 0.04%</span>
              <span className="text-[#32664b] font-semibold">Active Monitoring</span>
            </div>
          </div>

          {/* Column 2: Today's Key Decisions (Span 4) */}
          <div className="lg:col-span-4 clay-card p-6 flex flex-col justify-between text-left h-full">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-gray-900">Today's Key Decisions</h4>
                <span className="text-xs text-[#32664b] font-semibold cursor-default">Autonomous Feed</span>
              </div>

              <div className="space-y-3">
                {/* Item 1 */}
                <div
                  onClick={handleDiveIn}
                  className="p-3 bg-gray-50 hover:bg-[#f5fbf2]/60 rounded-2xl border border-gray-100 transition flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100/70 flex items-center justify-center text-lg">🥔</div>
                    <div>
                      <div className="font-bold text-sm text-gray-800">Lay's Classic</div>
                      <div className="text-xs text-emerald-700 font-semibold">BUY 24 units</div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-[#e7f5e1] text-[#204130] text-[10px] font-bold rounded-full uppercase">
                    Auto
                  </span>
                </div>

                {/* Item 2 */}
                <div
                  onClick={handleDiveIn}
                  className="p-3 bg-gray-50 hover:bg-[#f5fbf2]/60 rounded-2xl border border-gray-100 transition flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-100/70 flex items-center justify-center text-lg">🥫</div>
                    <div>
                      <div className="font-bold text-sm text-gray-800">Pringles Original</div>
                      <div className="text-xs text-gray-600 font-medium">HOLD policy</div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-gray-200 text-gray-700 text-[10px] font-bold rounded-full uppercase">
                    MDP π*
                  </span>
                </div>

                {/* Item 3 */}
                <div
                  onClick={handleDiveIn}
                  className="p-3 bg-amber-50/50 rounded-2xl border border-amber-200/50 transition flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-lg">🥨</div>
                    <div>
                      <div className="font-bold text-sm text-gray-800">Bingo Masala</div>
                      <div className="text-xs text-amber-800 font-semibold">BUY 8 units</div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-amber-200 text-amber-800 text-[10px] font-bold rounded-full uppercase">
                    Approval
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 text-xs text-gray-500 flex items-center justify-between">
              <span>Action space discrete: |A| = 12</span>
              <span className="font-mono text-[11px] text-gray-400">γ = 0.95</span>
            </div>
          </div>

          {/* Column 3: ShelfWatch Vision Snapshot (Span 4) */}
          <div className="lg:col-span-4 clay-card p-6 flex flex-col justify-between text-left h-full">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-gray-900">Store Snapshot</h4>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live Vision
                </span>
              </div>

              {/* Synthetic Vision Shelf Diagram with Bounding Boxes */}
              <div className="relative rounded-2xl overflow-hidden border border-[#ccebc4] bg-slate-900 h-36 flex items-center justify-center">
                <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#3e7b5c_1px,transparent_1px)] [background-size:16px_16px]"></div>
                <div className="absolute inset-3 border border-emerald-400/80 rounded-lg flex flex-col justify-between p-2">
                  <div className="flex justify-between items-start">
                    <span className="bg-emerald-500/90 text-white font-mono text-[9px] px-1.5 py-0.5 rounded">
                      SKU-492: 98% Conf
                    </span>
                    <span className="bg-blue-500/90 text-white font-mono text-[9px] px-1.5 py-0.5 rounded">
                      Facing: Correct
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-10 w-16 border-2 border-emerald-400 bg-emerald-400/20 rounded flex items-center justify-center text-[9px] text-white font-mono">
                      Full
                    </div>
                    <div className="h-10 w-16 border-2 border-rose-400 bg-rose-400/20 rounded flex items-center justify-center text-[9px] text-rose-200 font-mono">
                      Void
                    </div>
                    <div className="h-10 w-20 border-2 border-amber-400 bg-amber-400/20 rounded flex items-center justify-center text-[9px] text-amber-200 font-mono">
                      Misaligned
                    </div>
                  </div>
                </div>
              </div>

              {/* Snapshot Stats */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="p-2.5 rounded-xl bg-gray-50 text-center">
                  <div className="text-xl font-bold text-gray-900">92%</div>
                  <div className="text-[11px] text-gray-500">Shelf Compliance</div>
                </div>
                <div className="p-2.5 rounded-xl bg-gray-50 text-center">
                  <div className="text-xl font-bold text-rose-600">3</div>
                  <div className="text-[11px] text-gray-500">Items low on shelf</div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400 font-mono">
              <span>Model: Embedded ONNX</span>
              <span>FPS: 28.4</span>
            </div>
          </div>
        </div>
      </section>

      {/* Autonomy Loop */}
      <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-[#f5fbf2]/50 border-y border-[#ccebc4]/60" id="autonomy">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="px-3 py-1 bg-[#e7f5e1] text-[#204130] rounded-full text-xs font-bold uppercase tracking-wider">
              Zero-Intervention Loop
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mt-4 tracking-tight">
              How ShelfMind operates autonomously.
            </h2>
            <p className="text-gray-600 text-base sm:text-lg mt-3">
              From raw camera streams to supplier purchase orders in milliseconds, verified through mathematical Bellman
              optimality.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            {/* Step 1 */}
            <div className="clay-card p-8 hover:-translate-y-1 transition duration-200">
              <div className="w-14 h-14 rounded-2xl bg-[#e7f5e1] text-[#204130] flex items-center justify-center text-2xl font-bold mb-6 shadow-inner">
                👁️
              </div>
              <div className="text-xs font-mono text-[#32664b] font-bold uppercase mb-2">Step 01: Perception</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">ShelfWatch Vision</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Existing ceiling cameras and shelf sensors feed high-frame-rate visual tokens into our edge neural nets.
                Planograms, out-of-stocks, and blur quality are parsed live on-device.
              </p>
            </div>

            {/* Step 2 */}
            <div className="clay-card p-8 hover:-translate-y-1 transition duration-200">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-2xl font-bold mb-6 shadow-inner">
                🧠
              </div>
              <div className="text-xs font-mono text-[#32664b] font-bold uppercase mb-2">Step 02: Formulation</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Stochastic MDP Policy</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                State spaces map current inventory, lead times, and empirical demand. The reinforcement agent computes expected
                cumulative discounted reward, eliminating gut-feel reordering.
              </p>
            </div>

            {/* Step 3 */}
            <div className="clay-card p-8 hover:-translate-y-1 transition duration-200">
              <div className="w-14 h-14 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center text-2xl font-bold mb-6 shadow-inner">
                ⚡
              </div>
              <div className="text-xs font-mono text-[#32664b] font-bold uppercase mb-2">Step 03: Dispatch</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Verified Decisions</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Orders are evaluated against store thresholds and safety guardrails. Clear recommendations route to manager
                approval or execute safely within predefined budgets.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Mathematical Rigor */}
      <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" id="math">
        <div className="clay-card p-8 sm:p-12 bg-white border border-[#ccebc4]/80 text-left">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#f5fbf2] border border-[#ccebc4] text-[#28523c] text-xs font-bold rounded-full">
                <span>Rigorous Control Theory</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
                Not guesswork.
                <br />
                Provable Bellman Optimality.
              </h2>
              <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
                ShelfMind discards naive rule-based min-max reordering in favor of exact Dynamic Programming and Value Iteration.
                Every decision optimizes the balance between lost sales penalties and holding drag.
              </p>

              {/* Mathematical formula block */}
              <div className="p-5 rounded-2xl bg-[#f5fbf2]/70 border border-[#ccebc4] font-mono text-sm text-[#1a3528] space-y-2">
                <div className="text-xs text-[#28523c] uppercase font-semibold">The Core Optimality Equation</div>
                <div className="text-base sm:text-lg font-bold tracking-wide">
                  V*(s) = max<sub>a</sub> [ R(s, a) + γ ∑<sub>s'</sub> P(s' | s, a) V*(s') ]
                </div>
                <p className="text-xs text-gray-600 font-sans mt-2">
                  Where <span className="font-mono">R(s,a) = Margin(a) - HoldingCost(s) - StockoutPenalty(s)</span>.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs font-medium text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#3e7b5c]"></span>
                  <span>Guaranteed Convergence in Finite State MDP</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#3e7b5c]"></span>
                  <span>Non-Stationary Demand Adaptation</span>
                </div>
              </div>
            </div>

            {/* Technical telemetry readout side */}
            <div className="lg:col-span-5 bg-[#FAF9F5] p-6 rounded-3xl clay-border space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-[#ccebc4]/60 pb-3">
                <span className="text-gray-500 uppercase font-bold">Policy Evaluator</span>
                <span className="text-emerald-700 font-semibold">CONVERGED</span>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-gray-600 mb-1">
                    <span>Discount Factor (γ)</span>
                    <span className="font-bold text-gray-900">0.965</span>
                  </div>
                  <div className="w-full bg-[#ccebc4]/50 h-2 rounded-full overflow-hidden">
                    <div className="bg-[#32664b] h-full w-[96.5%]"></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-gray-600 mb-1">
                    <span>Exploration Entropy (ε-decay)</span>
                    <span className="font-bold text-gray-900">0.012 (Pure Exploit)</span>
                  </div>
                  <div className="w-full bg-[#ccebc4]/50 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-600 h-full w-[98.8%]"></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-gray-600 mb-1">
                    <span>Safety Guardrail Invariant</span>
                    <span className="font-bold text-gray-900">100% In-Bounds</span>
                  </div>
                  <div className="w-full bg-[#ccebc4]/50 h-2 rounded-full overflow-hidden">
                    <div className="bg-[#3e7b5c] h-full w-full"></div>
                  </div>
                </div>
              </div>
              <div className="pt-3 border-t border-[#ccebc4]/60 text-[11px] text-gray-500 leading-normal">
                Safe-RL constraints prevent high-leverage bulk runs without manager two-key quorum verification.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Impact Metrics */}
      <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" id="impact">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs uppercase font-bold tracking-widest text-[#32664b]">Enterprise Verified</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mt-2 tracking-tight">Tangible balance sheet impact.</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-center">
          <div className="clay-card p-6">
            <div className="text-4xl font-extrabold text-[#28523c] mb-2">98.4%</div>
            <div className="font-bold text-gray-800 text-base mb-1">Fill Rate Consistency</div>
            <p className="text-xs text-gray-500">Across high-velocity consumer packaged goods during seasonal spikes.</p>
          </div>
          <div className="clay-card p-6">
            <div className="text-4xl font-extrabold text-emerald-700 mb-2">-$4,210</div>
            <div className="font-bold text-gray-800 text-base mb-1">Monthly Holding Cost Drag</div>
            <p className="text-xs text-gray-500">Per aisle reduction by eradicating dead-stock and phantom inventory.</p>
          </div>
          <div className="clay-card p-6">
            <div className="text-4xl font-extrabold text-[#28523c] mb-2">0.18%</div>
            <div className="font-bold text-gray-800 text-base mb-1">Recorded Shrinkage</div>
            <p className="text-xs text-gray-500">Autonomous vision continuously flags misplacements and shrinkage instantly.</p>
          </div>
          <div className="clay-card p-6">
            <div className="text-4xl font-extrabold text-teal-700 mb-2">100%</div>
            <div className="font-bold text-gray-800 text-base mb-1">Cryptographic Auditability</div>
            <p className="text-xs text-gray-500">Immutable SOX-compliant ledger for every simulated and executed order.</p>
          </div>
        </div>
      </section>

      {/* Bottom Tagline Banner */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mb-12">
        <div className="clay-card p-8 sm:p-12 bg-gradient-to-r from-[#e7f5e1]/70 via-[#f5fbf2] to-emerald-100/60 border border-[#ccebc4]/80 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6 text-left">
            <div className="w-16 h-16 rounded-3xl bg-white shadow-sm flex items-center justify-center text-3xl shrink-0">
              🌿
            </div>
            <div>
              <h3 className="text-2xl font-extrabold text-gray-900 tracking-tight">Optimizing today for a fuller tomorrow.</h3>
              <p className="text-sm text-gray-600 mt-1">Autonomous decisions. Real impact. Calmer store operators.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 text-xs text-[#204130] font-semibold px-4 py-2 bg-white/80 rounded-full border border-[#ccebc4]">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Fleet Engine Operational</span>
            </div>

            <button
              onClick={handleDiveIn}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#32664b] hover:bg-[#204130] text-white text-sm font-semibold shadow-sm transition"
            >
              Enter Dashboard <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#e7f5e1] bg-white/70 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-[#3e7b5c] flex items-center justify-center text-white text-xs font-bold">
              S
            </div>
            <span className="font-bold text-gray-900 text-sm">ShelfMind Systems Inc.</span>
            <span className="text-gray-400 text-xs">© 2025. All rights reserved.</span>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-gray-500 font-medium">
            <span className="inline-flex items-center gap-1.5 text-gray-600">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              SOC2 Type II Certified
            </span>
            <a className="hover:text-[#28523c] transition" href="#hero">
              Privacy Architecture
            </a>
            <a className="hover:text-[#28523c] transition" href="#hero">
              Security Model
            </a>
            <a className="hover:text-[#28523c] transition" href="#hero">
              System Status
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
