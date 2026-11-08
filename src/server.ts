import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storage } from './db/storage.js';
import { rpcService } from './services/rpc.js';
import { mcpClient } from './services/mcpClient.js';
import { gasMonitor } from './services/gasMonitor.js';
import { optimizer } from './services/optimizer.js';
import { receiptVerifier } from './services/receiptVerifier.js';
import { SystemTelemetry } from './types.js';
import { DASHBOARD_HTML, DASHBOARD_CSS, DASHBOARD_JS } from './views.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
const PORT = process.env.PORT || 3000;
const startTime = Date.now();

app.use(cors());
app.use(express.json());

// Explicit Static and Dashboard Routes (100% serverless immune)
app.get('/', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(DASHBOARD_HTML);
});

app.get('/style.css', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/css; charset=utf-8');
  res.send(DASHBOARD_CSS);
});

app.get('/app.js', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.send(DASHBOARD_JS);
});

// Serve static frontend assets fallback
try {
  const publicPath = path.resolve(__dirname, '../public');
  app.use(express.static(publicPath));
} catch {
  // Ignore in serverless
}

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'pharos-gas-fee-optimizer',
    network: 'Pharos Atlantic Testnet',
    chainId: 688689,
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  });
});

// Gas Analytics & History (Requirement 01)
app.get('/api/gas', async (_req: Request, res: Response) => {
  try {
    const analytics = await gasMonitor.getAnalytics();
    res.json({ success: true, analytics });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/gas/observe', async (_req: Request, res: Response) => {
  try {
    const obs = await gasMonitor.recordObservation();
    res.json({ success: true, observation: obs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Intents Queue & Scheduling (Requirement 02)
app.get('/api/intents', async (_req: Request, res: Response) => {
  try {
    // Automatically trigger queue evaluation on fetch
    await optimizer.evaluateQueue();
    const intents = storage.getIntents();
    res.json({ success: true, count: intents.length, intents });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/intents', async (req: Request, res: Response) => {
  try {
    const { recipient, amountPharos, estimatedGasLimit, targetMaxGasPriceGwei, deadlineSecondsFromNow } = req.body;
    if (!recipient || targetMaxGasPriceGwei === undefined || deadlineSecondsFromNow === undefined) {
      return res.status(400).json({
        success: false,
        error: 'recipient, targetMaxGasPriceGwei, and deadlineSecondsFromNow are required',
      });
    }

    const intent = await optimizer.createIntent({
      recipient,
      amountPharos: amountPharos || '0.0',
      estimatedGasLimit: Number(estimatedGasLimit) || 21000,
      targetMaxGasPriceGwei: Number(targetMaxGasPriceGwei),
      deadlineSecondsFromNow: Number(deadlineSecondsFromNow),
    });

    res.status(201).json({ success: true, intent });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Force Queue Evaluation (Requirement 02 & 04)
app.post('/api/evaluate', async (_req: Request, res: Response) => {
  try {
    const result = await optimizer.evaluateQueue();
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Broadcast confirmation
app.post('/api/intents/:id/broadcast', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { txHash } = req.body;
    if (!txHash) {
      return res.status(400).json({ success: false, error: 'txHash is required' });
    }
    const updated = optimizer.markBroadcasted(id, txHash);
    res.json({ success: true, intent: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Verified Receipt & Actual Fee Reporting (Requirement 03)
app.post('/api/intents/:id/receipt', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { txHash, gasUsed, effectiveGasPriceWei, blockNumber } = req.body;

    // If explicit receipt parameters passed (e.g. for testing / simulation), use them directly
    if (gasUsed && effectiveGasPriceWei && blockNumber) {
      const confirmed = await optimizer.confirmReceipt({
        intentId: id,
        txHash: txHash || '0x' + '1'.repeat(64),
        gasUsed: BigInt(gasUsed),
        effectiveGasPriceWei: BigInt(effectiveGasPriceWei),
        blockNumber: Number(blockNumber),
      });
      return res.json({ success: true, intent: confirmed });
    }

    // Otherwise fetch genuine on-chain receipt from Atlantic Testnet RPC
    if (!txHash) {
      return res.status(400).json({ success: false, error: 'txHash is required to fetch on-chain receipt' });
    }

    const confirmed = await receiptVerifier.verifyAndConfirmReceipt(id, txHash);
    res.json({ success: true, intent: confirmed });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// System Telemetry
app.get('/api/telemetry', async (_req: Request, res: Response) => {
  try {
    let latestBlock = 0;
    let rpcConnected = false;
    let mcpConnected = false;

    try {
      latestBlock = await rpcService.getLatestBlockNumber();
      rpcConnected = true;
    } catch {
      // ignore
    }

    try {
      mcpConnected = mcpClient.getStatus().connected;
    } catch {
      // ignore
    }

    const analytics = await gasMonitor.getAnalytics();
    const allIntents = storage.getIntents();

    const telemetry: SystemTelemetry = {
      network: 'Pharos Atlantic Testnet',
      chainId: 688689,
      latestBlock,
      currentGasPriceGwei: analytics.currentGasPriceGwei,
      activeIntentsCount: allIntents.filter((i) => i.status === 'PENDING_HOLD' || i.status.startsWith('READY')).length,
      totalIntentsCount: allIntents.length,
      confirmedIntentsCount: allIntents.filter((i) => i.status === 'CONFIRMED').length,
      mcpConnected,
      rpcConnected,
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    };

    res.json({ success: true, telemetry });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fallback to SPA index.html
app.get('*', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(DASHBOARD_HTML);
});

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  // Initial gas read in background
  gasMonitor.recordObservation().catch((e) => console.warn('Initial gas fetch warning:', e.message));

  app.listen(PORT, () => {
    console.log(`[GasOptimizer] Server running on http://localhost:${PORT}`);
  });
}

export default app;
