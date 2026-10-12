import React, { Suspense, lazy } from 'react';
import { AppProvider, useApp } from './store/appStore';
import { Layout } from './components/layout/Layout';

// Lazy loading pages for high performance and lightweight local bundle
const Landing = lazy(() => import('./pages/Landing').then((m) => ({ default: m.Landing })));
const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })));
const Inventory = lazy(() => import('./pages/Inventory').then((m) => ({ default: m.Inventory })));
const Decisions = lazy(() => import('./pages/Decisions').then((m) => ({ default: m.Decisions })));
const ShelfWatch = lazy(() => import('./pages/ShelfWatch').then((m) => ({ default: m.ShelfWatch })));
const Audit = lazy(() => import('./pages/Audit').then((m) => ({ default: m.Audit })));
const Analytics = lazy(() => import('./pages/Analytics').then((m) => ({ default: m.Analytics })));
const RLResearch = lazy(() => import('./pages/RLResearch').then((m) => ({ default: m.RLResearch })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));

const PageRouter: React.FC = () => {
  const { currentTab } = useApp();

  const renderPage = () => {
    switch (currentTab) {
      case 'landing':
        return <Landing />;
      case 'home':
        return <Home />;
      case 'inventory':
        return <Inventory />;
      case 'decisions':
        return <Decisions />;
      case 'shelfwatch':
        return <ShelfWatch />;
      case 'audit':
        return <Audit />;
      case 'analytics':
        return <Analytics />;
      case 'rl':
        return <RLResearch />;
      case 'settings':
        return <Settings />;
      default:
        return <Home />;
    }
  };

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-3 border-[#E3EBDD] border-t-[#375B42] rounded-full animate-spin" />
            <p className="text-xs font-bold text-[#68756D]">Loading ShelfMind...</p>
          </div>
        </div>
      }
    >
      {renderPage()}
    </Suspense>
  );
};

export const App: React.FC = () => {
  return (
    <AppProvider>
      <Layout>
        <PageRouter />
      </Layout>
    </AppProvider>
  );
};

export default App;
