import React, { createContext, useContext, useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  ActivityItem,
  AuditRecord,
  Decision,
  DemandDataPoint,
  NotificationItem,
  Product,
  ShelfAnalyzeResult,
  ShelfWatchData,
  SystemMetrics,
  RLSimulationParams,
  HistorySource,
} from '../types';
import { DashboardPayload, shelfmindApi } from '../lib/shelfmindApi';

export interface AppSettings {
  autonomyMode: 'RECOMMEND_ONLY' | 'HUMAN_APPROVAL' | 'AUTO_UNDER_THRESHOLD';
  maxAutoQuantity: number;
  maxAutoSpend: number;
  serviceLevelTarget: number;
  storeName: string;
  storeId: string;
  managerName: string;
  enableSound: boolean;
  mascotReactivity: 'calm' | 'balanced' | 'enthusiastic';
}

interface AppContextType {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedDecision: Decision | null;
  setSelectedDecision: (d: Decision | null) => void;
  isAssistantOpen: boolean;
  setIsAssistantOpen: (open: boolean) => void;
  assistantInitialPrompt: string;
  setAssistantInitialPrompt: (prompt: string) => void;
  mascotMood: 'calm' | 'thinking' | 'attention' | 'success' | 'critical';
  setMascotMood: (mood: 'calm' | 'thinking' | 'attention' | 'success' | 'critical') => void;

  products: Product[];
  decisions: Decision[];
  shelfWatch: ShelfWatchData;
  activity: ActivityItem[];
  metrics: SystemMetrics;
  auditLogs: AuditRecord[];
  notifications: NotificationItem[];
  demandSeries: DemandDataPoint[];
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  rlParams: RLSimulationParams;
  setRlParams: React.Dispatch<React.SetStateAction<RLSimulationParams>>;
  isDataLoading: boolean;
  dataError: string | null;
  dataSource: HistorySource | null;
  saveSettings: () => Promise<void>;
  refreshBackendState: () => Promise<void>;

  approveDecision: (decisionId: string) => Promise<void>;
  modifyDecision: (decisionId: string, quantity: number, reason: string) => Promise<void>;
  rejectDecision: (decisionId: string, reason: string) => Promise<void>;
  undoAutoBuy: (decisionId: string) => Promise<void>;
  restockShelfItem: (productName: string, count: number) => Promise<void>;
  markNotificationRead: (id: string) => void;
  reallocateShelf: (productId: string, deltaPositions: number) => Promise<void>;
  analyzeShelfImage: (file: File) => Promise<ShelfAnalyzeResult>;
  queryAssistant: (query: string) => Promise<string>;
  openAssistantWithQuestion: (question: string) => void;
}

const EMPTY_SHELF_WATCH: ShelfWatchData = {
  liveStatus: false,
  shelfCompliance: null,
  itemsLowOnShelf: null,
  lastUpdated: 'Not connected',
  cameraName: 'ShelfWatch Upload Feed',
  detectedItems: [],
};

const EMPTY_METRICS: SystemMetrics = {
  serviceLevel: 0,
  serviceLevelTrend: 0,
  stockoutRate: 0,
  unitsSold: 0,
  lostSales: 0,
  wasteUnits: 0,
  autoExecutedCount: 0,
  attentionCount: 0,
  approvalRequiredCount: 0,
  healthyCount: 0,
  lowStockCount: 0,
  overstockCount: 0,
  criticalCount: 0,
};

const DEFAULT_SETTINGS: AppSettings = {
  autonomyMode: 'HUMAN_APPROVAL',
  maxAutoQuantity: 24,
  maxAutoSpend: 500,
  serviceLevelTarget: 98,
  storeName: '',
  storeId: '',
  managerName: 'Zian',
  enableSound: true,
  mascotReactivity: 'balanced',
};

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : 'ShelfMind backend request failed.';
};

const metricsWithHealthCounts = (metrics: SystemMetrics, products: Product[]): SystemMetrics => ({
  ...metrics,
  healthyCount: products.filter((product) => product.status === 'healthy').length,
  lowStockCount: products.filter((product) => product.status === 'low').length,
  overstockCount: products.filter((product) => product.status === 'overstock').length,
  criticalCount: products.filter((product) => product.status === 'critical').length,
});

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTab, setCurrentTab] = useState<string>('landing');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null);
  const [isAssistantOpen, setIsAssistantOpen] = useState<boolean>(false);
  const [assistantInitialPrompt, setAssistantInitialPrompt] = useState<string>('');
  const [mascotMood, setMascotMood] = useState<'calm' | 'thinking' | 'attention' | 'success' | 'critical'>('calm');

  const [products, setProducts] = useState<Product[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [shelfWatch, setShelfWatch] = useState<ShelfWatchData>(EMPTY_SHELF_WATCH);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics>(EMPTY_METRICS);
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [demandSeries, setDemandSeries] = useState<DemandDataPoint[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isDataLoading, setIsDataLoading] = useState<boolean>(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<HistorySource | null>(null);

  const [rlParams, setRlParams] = useState<RLSimulationParams>({
    demandRegime: 'NORMAL',
    leadTimeDays: 2,
    perishabilityDays: 3,
    holdingCostPerUnit: 0.5,
    stockoutPenalty: 8.0,
    orderSetupCost: 2.0,
    algorithm: 'VALUE_ITERATION',
  });

  const applyDashboard = (payload: DashboardPayload) => {
    setDataSource(payload.dataSource || null);
    const nextProducts = payload.products || [];
    setProducts(nextProducts);
    setDecisions(payload.decisions || []);
    setSelectedDecision(current => current ? payload.decisions.find(item => item.id === current.id) || null : null);
    setShelfWatch(payload.shelfWatch || EMPTY_SHELF_WATCH);
    setActivity(payload.activity || []);
    setMetrics(metricsWithHealthCounts(payload.metrics || EMPTY_METRICS, nextProducts));
    setAuditLogs(payload.auditLogs || []);
    setNotifications(payload.notifications || []);
    setDemandSeries(payload.demandSeries || []);
    setSettings((prev) => ({
      ...prev,
      ...(payload.settings || {}),
      storeName: payload.store?.name || payload.settings?.storeName || prev.storeName,
      storeId: payload.store?.id || payload.settings?.storeId || prev.storeId,
      managerName: payload.store?.managerName || payload.settings?.managerName || prev.managerName,
    }));
  };

  const refreshBackendState = async () => {
    setIsDataLoading(true);
    try {
      const payload = await shelfmindApi.dashboard();
      applyDashboard(payload);
      setDataError(null);
    } catch (error) {
      setDataError(getErrorMessage(error));
      console.warn('ShelfMind backend unavailable. No bundled data fallback is used.', error);
    } finally {
      setIsDataLoading(false);
    }
  };

  useEffect(() => {
    void refreshBackendState();
  }, []);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const saveSettings = async () => {
    const saved = await shelfmindApi.saveSettings(settings);
    setSettings(saved);
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const openAssistantWithQuestion = (question: string) => {
    setAssistantInitialPrompt(question);
    setIsAssistantOpen(true);
    setMascotMood('thinking');
  };

  const resetMoodSoon = (mood: AppContextType['mascotMood'] = 'calm') => {
    window.setTimeout(() => setMascotMood(mood), 3500);
  };

  const approveDecision = async (decisionId: string) => {
    setMascotMood('thinking');
    try {
      const updated = await shelfmindApi.approveDecision(decisionId);
      setDecisions((prev) => prev.map((d) => (d.id === decisionId ? updated : d)));
      await refreshBackendState();
      setMascotMood('success');
      confetti({
        particleCount: 65,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#375B42', '#D2E8D4', '#E3EBDD', '#FEE8D6'],
      });
      resetMoodSoon();
    } catch (error) {
      setDataError(getErrorMessage(error));
      setMascotMood('attention');
      resetMoodSoon();
    }
  };

  const modifyDecision = async (decisionId: string, quantity: number, reason: string) => {
    setMascotMood('thinking');
    try {
      const updated = await shelfmindApi.modifyDecision(decisionId, quantity, reason);
      setDecisions((prev) => prev.map((d) => (d.id === decisionId ? updated : d)));
      await refreshBackendState();
      setMascotMood('success');
      resetMoodSoon();
    } catch (error) {
      setDataError(getErrorMessage(error));
      setMascotMood('attention');
      resetMoodSoon();
    }
  };

  const rejectDecision = async (decisionId: string, reason: string) => {
    setMascotMood('thinking');
    try {
      const updated = await shelfmindApi.rejectDecision(decisionId, reason);
      setDecisions((prev) => prev.map((d) => (d.id === decisionId ? updated : d)));
      await refreshBackendState();
      setMascotMood('attention');
      resetMoodSoon();
    } catch (error) {
      setDataError(getErrorMessage(error));
      setMascotMood('attention');
      resetMoodSoon();
    }
  };

  const undoAutoBuy = async (decisionId: string) => {
    setDataError(`Decision ${decisionId} is already recorded in Supabase. Purchase-order cancellation is not enabled yet.`);
    setMascotMood('attention');
    resetMoodSoon();
  };

  const restockShelfItem = async (productName: string, count: number) => {
    setMascotMood('thinking');
    try {
      await shelfmindApi.restockShelf(productName, count);
      await refreshBackendState();
      setMascotMood('success');
      resetMoodSoon();
    } catch (error) {
      setDataError(getErrorMessage(error));
      setMascotMood('attention');
      resetMoodSoon();
    }
  };

  const reallocateShelf = async (productId: string, deltaPositions: number) => {
    setMascotMood('thinking');
    try {
      await shelfmindApi.reallocateShelf(productId, deltaPositions);
      await refreshBackendState();
      setMascotMood('success');
      resetMoodSoon();
    } catch (error) {
      setDataError(getErrorMessage(error));
      setMascotMood('attention');
      resetMoodSoon();
    }
  };

  const analyzeShelfImage = async (file: File) => {
    setMascotMood('thinking');
    try {
      const result = await shelfmindApi.analyzeShelfImage(file);
      await refreshBackendState();
      setMascotMood(result.needs_reinspection ? 'attention' : 'success');
      resetMoodSoon();
      return result;
    } catch (error) {
      setDataError(getErrorMessage(error));
      setMascotMood('attention');
      resetMoodSoon();
      throw error;
    }
  };

  const queryAssistant = async (query: string) => {
    try {
      const response = await shelfmindApi.queryAgent(query);
      await refreshBackendState();
      return response.answer;
    } catch (error) {
      setDataError(getErrorMessage(error));
      throw error;
    }
  };

  return (
    <AppContext.Provider
      value={{
        currentTab,
        setCurrentTab,
        searchQuery,
        setSearchQuery,
        selectedDecision,
        setSelectedDecision,
        isAssistantOpen,
        setIsAssistantOpen,
        assistantInitialPrompt,
        setAssistantInitialPrompt,
        mascotMood,
        setMascotMood,
        products,
        decisions,
        shelfWatch,
        activity,
        metrics,
        auditLogs,
        notifications,
        demandSeries,
        settings,
        updateSettings,
        rlParams,
        setRlParams,
        isDataLoading,
        dataError,
        dataSource,
        saveSettings,
        refreshBackendState,
        approveDecision,
        modifyDecision,
        rejectDecision,
        undoAutoBuy,
        restockShelfItem,
        markNotificationRead,
        reallocateShelf,
        analyzeShelfImage,
        queryAssistant,
        openAssistantWithQuestion,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
