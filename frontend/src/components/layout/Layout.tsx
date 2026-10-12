import React from 'react';
import { Sidebar, NAV_ITEMS, ADVANCED_NAV_ITEMS } from './Sidebar';
import { Header } from './Header';
import { DecisionDetailDrawer } from '../decisions/DecisionDetailDrawer';
import { AssistantPanel } from '../mascot/AssistantPanel';
import { InteractiveMascotCompanion } from '../mascot/InteractiveMascotCompanion';
import { useApp } from '../../store/appStore';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const {
    selectedDecision,
    setSelectedDecision,
    currentTab,
    setCurrentTab,
    dataSource,
    dataError,
    isDataLoading,
    refreshBackendState,
  } = useApp();

  if (currentTab === 'landing') {
    return (
      <div className="min-h-screen bg-[#F6F5F0] text-[#19211D]">
        {children}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F6F5F0] text-[#19211D]">
      {/* Fixed Left Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <nav className="md:hidden flex gap-1 overflow-x-auto px-3 py-2 border-b" aria-label="Main navigation">
          {NAV_ITEMS.map(item => <button key={item.id} onClick={() => setCurrentTab(item.id)} title={item.label} aria-label={item.label}
            className={`flex-shrink-0 p-2 rounded-md ${currentTab === item.id ? 'bg-[#D2E8D4]' : ''}`}><item.icon size={20} /></button>)}
        </nav>
        <details className="md:hidden border-b px-4 py-2 text-xs text-[#68756D]">
          <summary className="cursor-pointer">Advanced</summary>
          <nav className="mt-2 flex flex-wrap gap-2" aria-label="Advanced navigation">{ADVANCED_NAV_ITEMS.map(item => <button key={item.id} onClick={() => setCurrentTab(item.id)} className="inline-flex items-center gap-1.5 p-2"><item.icon size={15} />{item.label}</button>)}</nav>
        </details>
        <Header />

        <main className="flex-1 px-4 sm:px-8 py-6 max-w-7xl w-full mx-auto">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-[#526057]" role="status">
            <span>{dataError ? 'Connection unavailable. Displaying last loaded data.' : isDataLoading ? 'Refreshing...' : 'Database connected'}
              {dataSource?.lastDate && ` | ${dataSource.generated ? 'Simulated history' : 'Imported retail history'} | ${dataSource.rows.toLocaleString()} records | As of ${dataSource.lastDate}`}
            </span>
            <button onClick={() => void refreshBackendState()} disabled={isDataLoading} className="font-semibold underline disabled:opacity-50">Refresh</button>
          </div>
          {children}
        </main>
      </div>

      {/* Global Decision Detail Drawer */}
      <DecisionDetailDrawer
        decision={selectedDecision}
        onClose={() => setSelectedDecision(null)}
      />

      {/* Global ShelfMind Mascot Assistant Panel */}
      <AssistantPanel />

      {/* Persistent Draggable, Selectable Mascot Companion across the whole site */}
      {currentTab !== 'shelfwatch' && <InteractiveMascotCompanion />}
    </div>
  );
};
