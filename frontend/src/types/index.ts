export type ProductStatus = 'healthy' | 'low' | 'overstock' | 'critical';

export interface Product {
  id: string;
  name: string;
  variant: string;
  category: string;
  currentStock: number;
  shelfStock: number;
  backroomStock: number;
  shelfCapacity: number;
  shelfPositions: number;
  demandRate: number; // units/day
  demandTrend: 'up' | 'down' | 'stable';
  demandTrendPercent: number;
  status: ProductStatus;
  recommendation: string;
  supplierLeadTime: number; // days
  unitPrice: number;
  image: string;
}

export type DecisionStatus =
  | 'AUTO_EXECUTED'
  | 'APPROVAL_REQUIRED'
  | 'APPROVED'
  | 'MODIFIED'
  | 'REJECTED'
  | 'SUPERSEDED'
  | 'HOLD';

export type RLEngine = 'VALUE_ITERATION' | 'MDP' | 'Q_LEARNING' | 'DQN';

export interface EvaluatedAction {
  action: string;
  quantity: number;
  value: number;
  isOptimal?: boolean;
}

export interface TechnicalReasoning {
  state: {
    inventory: number;
    demand: 'LOW' | 'NORMAL' | 'HIGH' | 'SPIKE';
    leadTimeDays: number;
    shelfCapacity: number;
  };
  actionsEvaluated: EvaluatedAction[];
  optimalAction: string;
  algorithm: string;
  bellmanDetails: string;
  expectedReward: number;
  stockoutProbability: number;
}

export interface Decision {
  imageReview?: ImageReview | null;
  id: string;
  productId: string;
  productName: string;
  productVariant?: string;
  productCategory: string;
  productImage: string;
  action: 'BUY' | 'HOLD' | 'REDUCE' | 'EXPEDITE';
  quantity: number;
  status: DecisionStatus;
  engine: RLEngine;
  timestamp: string;
  timeAgo: string;
  currentStock: number;
  expectedDemand: number;
  supplierLeadTime: number;
  stockoutRisk: number; // percentage e.g. 3
  reason: string;
  technicalReasoning: TechnicalReasoning;
  humanModifiedQuantity?: number;
  humanReason?: string;
  executionNote?: string;
  dateGroup: 'TODAY' | 'YESTERDAY' | 'THIS_WEEK';
}

export interface DetectedShelfItem {
  id: string;
  name: string;
  confidence: number;
  shelfQuantity: number;
  box: {
    x: number; // percentage 0-100
    y: number; // percentage 0-100
    w: number;
    h: number;
    color: string;
  };
  status: 'healthy' | 'low' | 'misplaced' | 'unknown';
}

export interface ShelfWatchData {
  liveStatus: boolean;
  shelfCompliance: number | null;
  itemsLowOnShelf: number | null;
  latestAnalysis?: ShelfAnalyzeResult | null;
  lastUpdated: string;
  cameraName: string;
  detectedItems: DetectedShelfItem[];
}

export type AuditCategory = 'AI' | 'MDP' | 'RL' | 'HUMAN' | 'SYSTEM';

export interface AuditRecord {
  id: string;
  timestamp: string;
  timeAgo: string;
  category: AuditCategory;
  observation: string;
  state: string;
  action: string;
  execution: string;
  outcome: 'SUCCESS' | 'NEEDS_REVIEW' | 'IN_PROGRESS';
  outcomeLabel: string;
  details: string;
}

export interface ActivityItem {
  id: string;
  type: 'auto_order' | 'shelfwatch' | 'approval_pending' | 'delivery' | 'human_action';
  title: string;
  subtitle: string;
  timestamp: string;
  iconBg: string;
  iconColor: string;
}

export interface SystemMetrics {
  serviceLevel: number; // e.g. 98
  serviceLevelTrend: number; // e.g. +1.4
  stockoutRate: number;
  unitsSold: number;
  lostSales: number;
  wasteUnits: number;
  autoExecutedCount: number; // 7
  attentionCount: number; // 2
  approvalRequiredCount: number; // 1
  healthyCount?: number;
  lowStockCount?: number;
  overstockCount?: number;
  criticalCount?: number;
}

export interface DemandDataPoint {
  day: string;
  lays: number;
  pringles: number;
  bingo: number;
  tooYumm: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'order' | 'alert' | 'approval';
}

export interface ShelfAnalyzeDetection {
  name: string;
  confidence: number;
  class_id: number;
  bbox: number[];
  box: DetectedShelfItem['box'];
}

export interface ShelfAnalyzeResult {
  observation_id: string;
  filename?: string;
  image_sha256?: string;
  quality?: {
    sharpness: number;
    blur_threshold: number;
    brightness: number;
    width: number;
    height: number;
    image_coverage_percent: number;
    status: 'CLEAR' | 'REVIEW_REQUIRED';
    reasons: string[];
    method: string;
  };
  source: string;
  model_path: string;
  product_count: number;
  detections: ShelfAnalyzeDetection[];
  average_confidence: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  needs_reinspection: boolean;
  source_image_path: string;
  processing_time: number;
  annotated_image?: string;
  original_image?: string;
  observed_at: string;
}

export interface ImageReview {
  imageIds: string[];
  verifiedBy: string;
  quantityScope: string;
  historyGenerated: boolean;
  imageQualityPassed: boolean;
  historySources: string[];
  estimatedSpend: number;
  autoChecks: { label: string; passed: boolean }[];
  assessment: {
    direction: 'MORE' | 'LESS' | 'ENOUGH';
    orderQuantity: number;
    targetQuantity: number;
    excessQuantity: number;
    verifiedQuantity: number;
    dailyDemand: number;
    leadTimeDays: number;
    capacity: number;
    minimumOrderQuantity: number;
    historySamples: number;
    lastHistoryDate: string;
    stockoutProbability: number;
    actions: { quantity: number; value: number; immediateReward: number }[];
    iterations: number;
    discount: number;
    converged: boolean;
    residual: number;
    algorithm: string;
    assumptions: { holdingCostPerUnitDay: number; lostSalePenaltyPerUnit: number; orderSetupCost: number; periodDays: number; orderArrival: string; costBasis: string };
  };
}

export interface ProductReviewHistory {
  productId: string;
  name: string;
  capacity: number;
  historyGenerated: boolean;
  history: { date: string; demand: number; sold: number }[];
  reviews: Decision[];
}

export interface RLExperiment {
  id: string;
  algorithm: string;
  seed: number;
  numberOfStates: number;
  numberOfActions: number;
  iterations: number;
  converged: boolean;
  runtimeMs: number;
  status: string;
  hyperparameters: Record<string, unknown>;
  environmentConfig: Record<string, unknown>;
  metrics: Record<string, number>;
}

export interface HistorySource {
  rows: number;
  firstDate: string | null;
  lastDate: string | null;
  generated: boolean;
  sources: string[];
  daysSinceLastRecord: number | null;
}

export interface HistoryAnalytics {
  period: { firstDate: string | null; lastDate: string | null; days: number };
  totals: { unitsSold: number; demand: number; lostSales: number; wasteUnits: number; revenue: number; costOfGoods: number; grossMargin: number; serviceLevel: number | null };
  byProduct: { productId: string; name: string; unitsSold: number; demand: number; lostSales: number; wasteUnits: number; revenue: number; costOfGoods: number }[];
  dataSource: HistorySource;
}

export interface RLSimulationParams {
  demandRegime: 'NORMAL' | 'WEEKEND' | 'FESTIVAL' | 'PROMOTION' | 'SPIKE';
  leadTimeDays: number;
  perishabilityDays: number;
  holdingCostPerUnit: number;
  stockoutPenalty: number;
  orderSetupCost: number;
  algorithm: 'VALUE_ITERATION' | 'Q_LEARNING' | 'DQN';
}
