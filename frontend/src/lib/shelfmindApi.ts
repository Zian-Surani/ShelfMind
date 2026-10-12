import {
  ActivityItem,
  AuditRecord,
  Decision,
  Product,
  DemandDataPoint,
  NotificationItem,
  RLExperiment,
  ShelfAnalyzeResult,
  ShelfWatchData,
  SystemMetrics,
  HistorySource,
  HistoryAnalytics,
  ProductReviewHistory,
} from '../types';

import laysImg from '../assets/lays.png';
import pringlesImg from '../assets/pringles.png';
import bingoImg from '../assets/bingo.png';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8001').replace(/\/$/, '');

export interface DashboardPayload {
  store?: {
    id: string;
    name: string;
    managerName: string;
  };
  settings?: {
    autonomyMode: 'RECOMMEND_ONLY' | 'HUMAN_APPROVAL' | 'AUTO_UNDER_THRESHOLD';
    maxAutoQuantity: number;
    maxAutoSpend: number;
    serviceLevelTarget: number;
    storeName: string;
    storeId: string;
    managerName: string;
    enableSound: boolean;
    mascotReactivity: 'calm' | 'balanced' | 'enthusiastic';
  };
  products: Product[];
  decisions: Decision[];
  shelfWatch: ShelfWatchData;
  activity: ActivityItem[];
  metrics: SystemMetrics;
  auditLogs: AuditRecord[];
  notifications?: NotificationItem[];
  demandSeries?: DemandDataPoint[];
  serverTime?: string;
  dataSource?: HistorySource;
}

const productAsset = (idOrName: string) => {
  const value = idOrName.toLowerCase();
  if (value.includes('pringles') || value.includes('kellanova')) return pringlesImg;
  if (value.includes('bingo') || value.includes('doritos')) return bingoImg;
  if (value.includes('lays') || value.includes("lay's")) return laysImg;
  return '';
};

const normalizeDashboard = (payload: DashboardPayload): DashboardPayload => ({
  ...payload,
  products: (payload.products || []).map((product) => ({
    ...product,
    image: productAsset(`${product.id} ${product.name}`),
  })),
  decisions: (payload.decisions || []).map((decision) => ({
    ...decision,
    productImage: productAsset(`${decision.productId} ${decision.productName}`),
  })),
});

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`ShelfMind API ${response.status}: ${message}`);
  }

  return response.json() as Promise<T>;
}

export const shelfmindApi = {
  shelfImages() {
    return request<ShelfAnalyzeResult[]>('/api/shelfwatch/images');
  },
  reviewProduct(productId: string, imageIds: string[], confirmedQuantity: number, requestId: string) {
    return request<Decision>('/api/shelfwatch/review', { method: 'POST', body: JSON.stringify({
      product_id: productId, image_ids: imageIds, confirmed_quantity: confirmedQuantity,
      quantity_verified: true, request_id: requestId,
    }) });
  },
  productReviewHistory(productId: string) {
    return request<ProductReviewHistory>(`/api/products/${encodeURIComponent(productId)}/review-history`);
  },
  generateDecisions() {
    return request<Decision[]>('/api/decisions/generate', { method: 'POST' });
  },
  saveSettings(settings: NonNullable<DashboardPayload['settings']>) {
    return request<NonNullable<DashboardPayload['settings']>>('/api/settings', { method: 'PUT', body: JSON.stringify(settings) });
  },
  analytics(days: number) {
    return request<HistoryAnalytics>(`/api/analytics?days=${days}`);
  },
  importHistory(file: File, provenance: 'simulated' | 'operational') {
    const form = new FormData();
    form.append('file', file);
    form.append('provenance', provenance);
    return request<{ inserted: number; skipped: number; lastDate: string }>('/api/history/import', { method: 'POST', body: form });
  },
  async dashboard(): Promise<DashboardPayload> {
    return normalizeDashboard(await request<DashboardPayload>('/api/dashboard'));
  },

  async approveDecision(decisionId: string): Promise<Decision> {
    const decision = await request<Decision>(`/api/decisions/${decisionId}/approve`, { method: 'POST' });
    return { ...decision, productImage: productAsset(`${decision.productId} ${decision.productName}`) };
  },

  async modifyDecision(decisionId: string, quantity: number, reason: string): Promise<Decision> {
    const decision = await request<Decision>(`/api/decisions/${decisionId}/modify`, {
      method: 'POST',
      body: JSON.stringify({ quantity, reason }),
    });
    return { ...decision, productImage: productAsset(`${decision.productId} ${decision.productName}`) };
  },

  async rejectDecision(decisionId: string, reason: string): Promise<Decision> {
    const decision = await request<Decision>(`/api/decisions/${decisionId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    return { ...decision, productImage: productAsset(`${decision.productId} ${decision.productName}`) };
  },

  async restockShelf(productName: string, count: number): Promise<void> {
    await request('/api/shelfwatch/restock', {
      method: 'POST',
      body: JSON.stringify({ product_name: productName, count }),
    });
  },

  async reallocateShelf(productId: string, deltaPositions: number): Promise<void> {
    await request('/api/inventory/reallocate-shelf', {
      method: 'POST',
      body: JSON.stringify({ product_id: productId, delta_positions: deltaPositions }),
    });
  },

  async analyzeShelfImage(file: File): Promise<ShelfAnalyzeResult> {
    const form = new FormData();
    form.append('file', file);
    return request<ShelfAnalyzeResult>('/api/shelfwatch/analyze', {
      method: 'POST',
      body: form,
    });
  },

  async queryAgent(query: string): Promise<{ answer: string; sources: unknown }> {
    return request('/api/agent/query', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  },

  async rlExperiments(): Promise<RLExperiment[]> {
    return request<RLExperiment[]>('/api/rl/experiments');
  },

  async runValueIteration(iterations = 100, seed = 20260914): Promise<RLExperiment> {
    return request<RLExperiment>('/api/rl/value-iteration/run', {
      method: 'POST',
      body: JSON.stringify({ algorithm: 'VALUE_ITERATION', iterations, seed }),
    });
  },

  async runQLearning(episodes = 400, seed = 20260914): Promise<RLExperiment> {
    return request<RLExperiment>('/api/rl/q-learning/train', {
      method: 'POST',
      body: JSON.stringify({ algorithm: 'Q_LEARNING', episodes, seed }),
    });
  },

  async runDqn(episodes = 120, seed = 20260914): Promise<RLExperiment> {
    return request<RLExperiment>('/api/rl/dqn/train', {
      method: 'POST',
      body: JSON.stringify({ algorithm: 'DQN', episodes, seed }),
    });
  },
};
