import { storage } from '../db/storage.js';
import { rpcService } from './rpc.js';
import { gasMonitor } from './gasMonitor.js';
import { TransactionIntent, IntentStatus } from '../types.js';

export class GasOptimizerService {
  /**
   * Accepts and schedules a new transaction intent (Requirement 02).
   */
  public async createIntent(params: {
    recipient: string;
    amountPharos: string;
    calldata?: string;
    estimatedGasLimit?: number;
    targetMaxGasPriceGwei: number;
    deadlineSecondsFromNow: number;
  }): Promise<TransactionIntent> {
    if (!/^0x[a-fA-F0-9]{40}$/.test(params.recipient)) {
      throw new Error(`Invalid EVM recipient address: ${params.recipient}`);
    }

    if (params.targetMaxGasPriceGwei <= 0) {
      throw new Error('Target maximum gas price must be greater than 0 Gwei');
    }

    if (params.deadlineSecondsFromNow < 5) {
      throw new Error('Deadline must be at least 5 seconds into the future');
    }

    const gasAnalytics = await gasMonitor.getAnalytics();
    const gasPriceAtRequest = gasAnalytics.currentGasPriceGwei;
    const gasLimit = params.estimatedGasLimit || 21000;
    const initialEstimate = rpcService.calculateFee(gasLimit, gasPriceAtRequest);

    const now = Date.now();
    const deadlineTimestamp = now + params.deadlineSecondsFromNow * 1000;

    const isInitiallyFavorable = gasPriceAtRequest <= params.targetMaxGasPriceGwei;
    const initialStatus: IntentStatus = isInitiallyFavorable ? 'READY_FAVORABLE' : 'PENDING_HOLD';

    const decisionReason = isInitiallyFavorable
      ? `Favorable gas: Prevailing gas (${gasPriceAtRequest} Gwei) meets your ceiling (${params.targetMaxGasPriceGwei} Gwei). Ready for execution.`
      : `Holding in queue: Prevailing gas (${gasPriceAtRequest} Gwei) exceeds ceiling (${params.targetMaxGasPriceGwei} Gwei). Holding until gas drops or deadline expires.`;

    const intent: TransactionIntent = {
      id: `intent-${now}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date(now).toISOString(),
      recipient: params.recipient.toLowerCase(),
      amountPharos: params.amountPharos || '0.0',
      calldata: params.calldata || '0x',
      estimatedGasLimit: gasLimit,
      gasPriceAtRequestGwei: gasPriceAtRequest,
      targetMaxGasPriceGwei: params.targetMaxGasPriceGwei,
      deadlineTimestamp,
      deadlineDate: new Date(deadlineTimestamp).toISOString(),
      status: initialStatus,
      decisionReason,
      initialEstimatedFeePharos: initialEstimate,
    };

    return storage.addIntent(intent);
  }

  /**
   * Deterministic Evaluation Engine & Deadline Watchdog (Requirements 02 & 04).
   * Evaluates active intents against live gas and forced deadlines.
   */
  public async evaluateQueue(): Promise<{
    evaluatedCount: number;
    favorableTriggered: number;
    deadlinesForced: number;
  }> {
    const intents = storage.getIntents();
    const gasAnalytics = await gasMonitor.getAnalytics();
    const currentGas = gasAnalytics.currentGasPriceGwei;
    const now = Date.now();

    let favorableTriggered = 0;
    let deadlinesForced = 0;
    let evaluatedCount = 0;

    for (const intent of intents) {
      if (intent.status !== 'PENDING_HOLD') continue;
      evaluatedCount++;

      const timeRemainingMs = intent.deadlineTimestamp - now;

      // Requirement 04: Never misses deadline; forced submission trigger
      if (timeRemainingMs <= 0) {
        storage.updateIntent(intent.id, {
          status: 'READY_DEADLINE_FORCED',
          decisionReason: `MANDATORY DEADLINE REACHED: Submitting at deadline even though gas is ${currentGas} Gwei (ceiling was ${intent.targetMaxGasPriceGwei} Gwei).`,
        });
        deadlinesForced++;
      } else if (currentGas <= intent.targetMaxGasPriceGwei) {
        // Requirement 02: Favorable gas reached
        storage.updateIntent(intent.id, {
          status: 'READY_FAVORABLE',
          decisionReason: `FAVORABLE GAS OBSERVED: Network gas dropped to ${currentGas} Gwei (below ceiling of ${intent.targetMaxGasPriceGwei} Gwei). Ready for execution.`,
        });
        favorableTriggered++;
      } else {
        // Continue holding
        const secRemaining = Math.ceil(timeRemainingMs / 1000);
        storage.updateIntent(intent.id, {
          decisionReason: `HOLDING FOR LOWER GAS: Current gas (${currentGas} Gwei) > ceiling (${intent.targetMaxGasPriceGwei} Gwei). ${secRemaining}s remaining until deadline.`,
        });
      }
    }

    return { evaluatedCount, favorableTriggered, deadlinesForced };
  }

  /**
   * Marks intent as broadcasted to mempool.
   */
  public markBroadcasted(intentId: string, txHash: string): TransactionIntent {
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      throw new Error(`Invalid transaction hash format: ${txHash}`);
    }

    return storage.updateIntent(intentId, {
      status: 'BROADCASTED',
      txHash,
      explorerUrl: rpcService.buildExplorerTxUrl(txHash),
      decisionReason: `Transaction broadcasted to Pharos Atlantic mempool (Hash: ${txHash}). Awaiting block confirmation.`,
    });
  }

  /**
   * Verifies confirmed transaction receipt and calculates actual fee comparison (Requirement 03).
   */
  public async confirmReceipt(params: {
    intentId: string;
    txHash: `0x${string}`;
    gasUsed: bigint;
    effectiveGasPriceWei: bigint;
    blockNumber: number;
  }): Promise<TransactionIntent> {
    const intent = storage.getIntentById(params.intentId);
    if (!intent) {
      throw new Error(`Intent ${params.intentId} not found`);
    }

    const effectiveGasPriceGwei = Number(params.effectiveGasPriceWei) / 1e9;
    const actualFeePharos = rpcService.calculateFee(Number(params.gasUsed), effectiveGasPriceGwei);

    const initialEstimateNum = parseFloat(intent.initialEstimatedFeePharos);
    const actualFeeNum = parseFloat(actualFeePharos);
    const deltaNum = actualFeeNum - initialEstimateNum;
    const deltaStr = (deltaNum >= 0 ? '+' : '') + deltaNum.toFixed(8);

    return storage.updateIntent(params.intentId, {
      status: 'CONFIRMED',
      txHash: params.txHash,
      blockNumber: params.blockNumber,
      actualGasUsed: Number(params.gasUsed),
      actualEffectiveGasPriceGwei: effectiveGasPriceGwei,
      actualFeePaidPharos: actualFeePharos,
      feeDeltaPharos: deltaStr,
      explorerUrl: rpcService.buildExplorerTxUrl(params.txHash),
      decisionReason: `Transaction confirmed in Block #${params.blockNumber}. Actual fee paid: ${actualFeePharos} PHAROS (${deltaStr} vs initial estimate).`,
    });
  }
}

export const optimizer = new GasOptimizerService();
