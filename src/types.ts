export interface GasObservation {
  id: string;
  timestamp: string;
  blockNumber: number;
  gasPriceWei: string;
  gasPriceGwei: number;
  baseFeePerGasWei?: string;
  baseFeePerGasGwei?: number;
  source: 'RPC' | 'MCP';
}

export interface GasAnalytics {
  currentGasPriceGwei: number;
  currentBaseFeeGwei: number;
  minObservedGwei: number;
  maxObservedGwei: number;
  avgObservedGwei: number;
  observationCount: number;
  lastObservationTime: string;
  isStale: boolean;
  history: GasObservation[];
  source: string;
}

export type IntentStatus =
  | 'PENDING_HOLD'
  | 'READY_FAVORABLE'
  | 'READY_DEADLINE_FORCED'
  | 'BROADCASTED'
  | 'CONFIRMED'
  | 'FAILED_OR_CANCELLED';

export interface TransactionIntent {
  id: string;
  createdAt: string;
  recipient: string;
  amountPharos: string;
  calldata: string;
  estimatedGasLimit: number;
  gasPriceAtRequestGwei: number;
  targetMaxGasPriceGwei: number;
  deadlineTimestamp: number;
  deadlineDate: string;
  status: IntentStatus;
  decisionReason: string;
  initialEstimatedFeePharos: string;
  txHash?: string;
  blockNumber?: number;
  actualGasUsed?: number;
  actualEffectiveGasPriceGwei?: number;
  actualFeePaidPharos?: string;
  feeDeltaPharos?: string;
  explorerUrl?: string;
}

export interface SystemTelemetry {
  network: string;
  chainId: number;
  latestBlock: number;
  currentGasPriceGwei: number;
  activeIntentsCount: number;
  totalIntentsCount: number;
  confirmedIntentsCount: number;
  mcpConnected: boolean;
  rpcConnected: boolean;
  uptimeSeconds: number;
}
