import { storage } from '../db/storage.js';
import { rpcService } from './rpc.js';
import { mcpClient } from './mcpClient.js';
import { GasAnalytics, GasObservation } from '../types.js';

export class GasMonitorService {
  private isPolling = false;
  private lastFetchTime = 0;
  private readonly STALE_THRESHOLD_MS = 30000;

  public async recordObservation(): Promise<GasObservation> {
    let gasPriceGwei = 0;
    let gasPriceWei = '0';
    let blockNumber = 0;
    let baseFeePerGasGwei: number | undefined;
    let baseFeePerGasWei: string | undefined;
    let source: 'RPC' | 'MCP' = 'RPC';

    try {
      // First attempt live RPC read
      const rpcResult = await rpcService.getCurrentGasPrice();
      gasPriceGwei = rpcResult.gasPriceGwei;
      gasPriceWei = rpcResult.gasPriceWei.toString();
      blockNumber = rpcResult.blockNumber;
      baseFeePerGasGwei = rpcResult.baseFeePerGasGwei;
      baseFeePerGasWei = rpcResult.baseFeePerGasWei?.toString();
      source = 'RPC';
    } catch (err) {
      // Fallback attempt via MCP
      const mcpGas = await mcpClient.getGasPrice();
      if (mcpGas !== null) {
        gasPriceGwei = mcpGas;
        gasPriceWei = BigInt(Math.round(mcpGas * 1e9)).toString();
        source = 'MCP';
      } else {
        throw new Error(`Failed to observe gas from both RPC and MCP: ${err}`);
      }
    }

    const obs: GasObservation = {
      id: `gas-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      blockNumber,
      gasPriceWei,
      gasPriceGwei,
      baseFeePerGasWei,
      baseFeePerGasGwei,
      source,
    };

    storage.addObservation(obs);
    this.lastFetchTime = Date.now();
    return obs;
  }

  public async getAnalytics(): Promise<GasAnalytics> {
    const now = Date.now();
    let observations = storage.getObservations(60);

    // If no observations exist, perform an immediate observation
    if (observations.length === 0) {
      try {
        await this.recordObservation();
        observations = storage.getObservations(60);
      } catch (err) {
        console.warn('Live gas observation failed:', err);
      }
    }

    if (observations.length === 0) {
      return {
        currentGasPriceGwei: 10.0,
        currentBaseFeeGwei: 1.0,
        minObservedGwei: 10.0,
        maxObservedGwei: 10.0,
        avgObservedGwei: 10.0,
        observationCount: 0,
        lastObservationTime: new Date().toISOString(),
        isStale: true,
        history: [],
        source: 'NONE',
      };
    }

    const latest = observations[observations.length - 1];
    const prices = observations.map((o) => o.gasPriceGwei);
    const minObserved = Math.min(...prices);
    const maxObserved = Math.max(...prices);
    const avgObserved = prices.reduce((acc, p) => acc + p, 0) / prices.length;
    const isStale = now - new Date(latest.timestamp).getTime() > this.STALE_THRESHOLD_MS;

    return {
      currentGasPriceGwei: latest.gasPriceGwei,
      currentBaseFeeGwei: latest.baseFeePerGasGwei ?? 1.0,
      minObservedGwei: parseFloat(minObserved.toFixed(2)),
      maxObservedGwei: parseFloat(maxObserved.toFixed(2)),
      avgObservedGwei: parseFloat(avgObserved.toFixed(2)),
      observationCount: observations.length,
      lastObservationTime: latest.timestamp,
      isStale,
      history: observations,
      source: latest.source,
    };
  }
}

export const gasMonitor = new GasMonitorService();
