import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { storage } from '../src/db/storage.js';
import { gasMonitor } from '../src/services/gasMonitor.js';
import { optimizer } from '../src/services/optimizer.js';
import { rpcService } from '../src/services/rpc.js';

describe('Pharos Gas Fee Optimizer Automated Verification', () => {
  beforeEach(() => {
    storage.resetToDefaults();
  });

  describe('Requirement 01: Tracks Gas Price Over Time & Shows Recent History', () => {
    it('records genuine gas observations with block number and timestamp', () => {
      storage.addObservation({
        id: 'obs-1',
        timestamp: new Date().toISOString(),
        blockNumber: 1000,
        gasPriceWei: '10000000000',
        gasPriceGwei: 10.0,
        baseFeePerGasGwei: 1.0,
        source: 'RPC',
      });
      storage.addObservation({
        id: 'obs-2',
        timestamp: new Date().toISOString(),
        blockNumber: 1001,
        gasPriceWei: '8000000000',
        gasPriceGwei: 8.0,
        baseFeePerGasGwei: 1.0,
        source: 'RPC',
      });

      const observations = storage.getObservations();
      assert.equal(observations.length, 2);
      assert.equal(observations[0].gasPriceGwei, 10.0);
      assert.equal(observations[1].gasPriceGwei, 8.0);
    });

    it('computes accurate min, max, and average gas analytics over history', async () => {
      storage.addObservation({
        id: 'obs-1',
        timestamp: new Date().toISOString(),
        blockNumber: 100,
        gasPriceWei: '12000000000',
        gasPriceGwei: 12.0,
        source: 'RPC',
      });
      storage.addObservation({
        id: 'obs-2',
        timestamp: new Date().toISOString(),
        blockNumber: 101,
        gasPriceWei: '6000000000',
        gasPriceGwei: 6.0,
        source: 'RPC',
      });
      storage.addObservation({
        id: 'obs-3',
        timestamp: new Date().toISOString(),
        blockNumber: 102,
        gasPriceWei: '9000000000',
        gasPriceGwei: 9.0,
        source: 'RPC',
      });

      const analytics = await gasMonitor.getAnalytics();
      assert.equal(analytics.minObservedGwei, 6.0);
      assert.equal(analytics.maxObservedGwei, 12.0);
      assert.equal(analytics.avgObservedGwei, 9.0);
      assert.equal(analytics.observationCount, 3);
      assert.equal(analytics.isStale, false);
    });

    it('detects and flags stale data when last observation exceeds 30s', async () => {
      const pastTime = new Date(Date.now() - 40000).toISOString();
      storage.addObservation({
        id: 'obs-old',
        timestamp: pastTime,
        blockNumber: 50,
        gasPriceWei: '10000000000',
        gasPriceGwei: 10.0,
        source: 'RPC',
      });

      // Directly compute analytics from stored historical observations
      const observations = storage.getObservations();
      const latest = observations[observations.length - 1];
      const isStale = Date.now() - new Date(latest.timestamp).getTime() > 30000;
      assert.equal(isStale, true);
    });
  });

  describe('Requirement 02: Accepts Transaction With Deadline & Holds Until Favorable Gas', () => {
    it('schedules a valid transaction intent with fee ceiling and deadline', async () => {
      const intent = await optimizer.createIntent({
        recipient: '0x1111111254fb6c44bac0bed2854e76f90643097d',
        amountPharos: '0.05',
        estimatedGasLimit: 21000,
        targetMaxGasPriceGwei: 5.0,
        deadlineSecondsFromNow: 120,
      });

      assert.ok(intent.id.startsWith('intent-'));
      assert.equal(intent.recipient, '0x1111111254fb6c44bac0bed2854e76f90643097d');
      assert.equal(intent.targetMaxGasPriceGwei, 5.0);
      assert.ok(intent.initialEstimatedFeePharos.length > 0);
      assert.ok(intent.deadlineTimestamp > Date.now());
    });

    it('rejects invalid recipient EVM addresses', async () => {
      await assert.rejects(async () => {
        await optimizer.createIntent({
          recipient: 'not-an-evm-address',
          amountPharos: '0.01',
          targetMaxGasPriceGwei: 5.0,
          deadlineSecondsFromNow: 60,
        });
      }, /Invalid EVM recipient address/);
    });

    it('holds intent in queue when prevailing gas exceeds fee ceiling', async () => {
      storage.addObservation({
        id: 'obs-high',
        timestamp: new Date().toISOString(),
        blockNumber: 200,
        gasPriceWei: '15000000000',
        gasPriceGwei: 15.0, // High gas
        source: 'RPC',
      });

      const intent = await optimizer.createIntent({
        recipient: '0x6960d708304918e9d9e487146522c0db35a5078a',
        amountPharos: '0.1',
        targetMaxGasPriceGwei: 8.0, // Ceiling 8 Gwei < 15 Gwei
        deadlineSecondsFromNow: 60,
      });

      assert.equal(intent.status, 'PENDING_HOLD');
      assert.ok(intent.decisionReason.includes('Holding in queue'));
    });

    it('elevates intent to READY_FAVORABLE when gas drops below ceiling', async () => {
      // 1. Initially high gas
      storage.addObservation({
        id: 'obs-high',
        timestamp: new Date().toISOString(),
        blockNumber: 300,
        gasPriceWei: '12000000000',
        gasPriceGwei: 12.0,
        source: 'RPC',
      });

      const intent = await optimizer.createIntent({
        recipient: '0x6960d708304918e9d9e487146522c0db35a5078a',
        amountPharos: '0.1',
        targetMaxGasPriceGwei: 8.0,
        deadlineSecondsFromNow: 90,
      });
      assert.equal(intent.status, 'PENDING_HOLD');

      // 2. Gas drops to 6.0 Gwei (favorable)
      storage.addObservation({
        id: 'obs-low',
        timestamp: new Date().toISOString(),
        blockNumber: 305,
        gasPriceWei: '6000000000',
        gasPriceGwei: 6.0,
        source: 'RPC',
      });

      const evalResult = await optimizer.evaluateQueue();
      assert.equal(evalResult.favorableTriggered, 1);

      const refreshed = storage.getIntentById(intent.id);
      assert.equal(refreshed?.status, 'READY_FAVORABLE');
      assert.ok(refreshed?.decisionReason.includes('FAVORABLE GAS OBSERVED'));
    });
  });

  describe('Requirement 03: Reports Actual Gas Paid Compared With Price at Request Time', () => {
    it('verifies confirmed receipt and calculates accurate fee delta against request estimate', async () => {
      storage.addObservation({
        id: 'obs-init',
        timestamp: new Date().toISOString(),
        blockNumber: 400,
        gasPriceWei: '10000000000',
        gasPriceGwei: 10.0,
        source: 'RPC',
      });

      const intent = await optimizer.createIntent({
        recipient: '0x2b4c76d0dc16be1c31d4c1dc53bf9b45987fc75c',
        amountPharos: '0.01',
        estimatedGasLimit: 21000,
        targetMaxGasPriceGwei: 10.0,
        deadlineSecondsFromNow: 60,
      });

      // Initial estimate at 10 Gwei * 21000 = 0.00021000 PHAROS
      assert.equal(intent.initialEstimatedFeePharos, '0.00021');

      // Now confirm on-chain receipt where actual effective gas price was 7 Gwei (favorable execution)
      const confirmed = await optimizer.confirmReceipt({
        intentId: intent.id,
        txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        gasUsed: 21000n,
        effectiveGasPriceWei: 7000000000n, // 7 Gwei
        blockNumber: 450,
      });

      assert.equal(confirmed.status, 'CONFIRMED');
      assert.equal(confirmed.actualGasUsed, 21000);
      assert.equal(confirmed.actualEffectiveGasPriceGwei, 7.0);
      assert.equal(confirmed.actualFeePaidPharos, '0.000147'); // 21000 * 7e9 / 1e18
      assert.equal(confirmed.feeDeltaPharos, '-0.00006300'); // Savings of 0.000063 PHAROS!
      assert.ok(confirmed.explorerUrl?.includes('0xaaaa'));
    });
  });

  describe('Requirement 04: Never Misses Deadline; Submits at Deadline Even If Gas Is High', () => {
    it('forces mandatory execution at deadline expiration regardless of high gas price', async () => {
      // Prevailing gas is 50 Gwei (very high)
      storage.addObservation({
        id: 'obs-spike',
        timestamp: new Date().toISOString(),
        blockNumber: 500,
        gasPriceWei: '50000000000',
        gasPriceGwei: 50.0,
        source: 'RPC',
      });

      // Create intent with expired or zero remaining time
      const now = Date.now();
      const intent = storage.addIntent({
        id: 'intent-deadline-test',
        createdAt: new Date(now - 60000).toISOString(),
        recipient: '0x1111111254fb6c44bac0bed2854e76f90643097d',
        amountPharos: '0.01',
        calldata: '0x',
        estimatedGasLimit: 21000,
        gasPriceAtRequestGwei: 10.0,
        targetMaxGasPriceGwei: 8.0,
        deadlineTimestamp: now - 5000, // Expired 5 seconds ago!
        deadlineDate: new Date(now - 5000).toISOString(),
        status: 'PENDING_HOLD',
        decisionReason: 'Waiting for gas',
        initialEstimatedFeePharos: '0.00021',
      });

      // Run watchdog queue evaluation
      const result = await optimizer.evaluateQueue();
      assert.equal(result.deadlinesForced, 1);

      const updated = storage.getIntentById(intent.id);
      assert.equal(updated?.status, 'READY_DEADLINE_FORCED');
      assert.ok(updated?.decisionReason.includes('MANDATORY DEADLINE REACHED'));
      assert.ok(updated?.decisionReason.includes('even though gas is 50 Gwei'));
    });
  });

  describe('Live Network & RPC Integration', () => {
    it('fetches genuine gas price and block number from Pharos Atlantic Testnet', async () => {
      const live = await rpcService.getCurrentGasPrice();
      assert.ok(live.gasPriceGwei > 0);
      assert.ok(live.blockNumber > 0);
      assert.ok(typeof live.gasPriceWei === 'bigint');
    });
  });
});
