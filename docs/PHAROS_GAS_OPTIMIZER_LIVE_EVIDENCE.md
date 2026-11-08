# PHAROS GAS FEE OPTIMIZER — LIVE PRODUCTION EVIDENCE

## Production Endpoints Tested & Verified

- **Base URL**: `https://pharos-gas-fee-optimizer.vercel.app`
- **Network**: Pharos Atlantic Testnet
- **Chain ID**: `688689`
- **Date Tested**: 2026-11-09

---

## 1. Automated Production API Verification

All 7 production endpoints were verified with HTTP 200 responses:

```
[TEST 1] GET / -> HTTP 200 (Dashboard HTML, 7927 bytes)
[TEST 2] GET /api/health -> HTTP 200:
  {
    "status": "healthy",
    "network": "Pharos Atlantic Testnet",
    "chainId": 688689,
    "version": "1.0.0",
    "mcp": {
      "endpoint": "https://mcp.pharos.xyz/mcp",
      "status": "synced"
    }
  }

[TEST 3] GET /api/gas -> HTTP 200 (Req 01):
  {
    "currentGasPriceGwei": 10,
    "baseFeeGwei": 1,
    "minGasPriceGwei": 10,
    "maxGasPriceGwei": 10,
    "avgGasPriceGwei": 10,
    "observations": [
      {
        "timestamp": 1794183618306,
        "blockNumber": 3280801,
        "gasPriceGwei": 10,
        "baseFeeGwei": 1,
        "source": "pharos-mcp"
      }
    ],
    "isStale": false
  }

[TEST 4] GET /api/telemetry -> HTTP 200:
  {
    "version": "1.0.0",
    "chainId": 688689,
    "mcpAvailable": true,
    "totalObservations": 4,
    "totalIntents": 1,
    "activeIntents": 1,
    "completedIntents": 0
  }

[TEST 5] POST /api/intents -> HTTP 201 (Req 02 & 04):
  Payload:
  {
    "recipient": "0x6960d708304918e9d9e487146522c0db35a5078a",
    "amount": "0.01",
    "targetGasPriceGwei": 7.0,
    "deadlineSeconds": 15
  }
  Response:
  {
    "intent": {
      "id": "intent_1794183619582_a2k3e0618",
      "recipient": "0x6960d708304918e9d9e487146522c0db35a5078a",
      "amount": "0.01",
      "gasLimit": 21000,
      "targetGasPriceGwei": 7,
      "gasPriceAtRequestGwei": 10,
      "status": "HELD_WAITING_GAS"
    }
  }

[TEST 6] POST /api/evaluate -> HTTP 200:
  Response:
  {
    "evaluatedCount": 1,
    "currentGasGwei": 10,
    "triggeredIntents": []
  }

[TEST 7] POST /api/intents/:id/receipt -> HTTP 200 (Req 03):
  Payload:
  {
    "txHash": "0xd32490ecdf5f7390f779782522c6769911e9aeb24e41ee047466847ba4943fcf"
  }
  Response:
  {
    "intent": {
      "id": "intent_1794183619582_a2k3e0618",
      "status": "CONFIRMED_ON_CHAIN",
      "txHash": "0xd32490ecdf5f7390f779782522c6769911e9aeb24e41ee047466847ba4943fcf",
      "actualFeeGwei": 10,
      "feeDeltaGwei": 0,
      "savingsPercentage": 0,
      "explorerUrl": "https://atlantic.pharosscan.xyz/tx/0xd32490ecdf5f7390f779782522c6769911e9aeb24e41ee047466847ba4943fcf"
    }
  }
```

---

## 2. Automated Test Suite Results
10 of 10 tests passed in `tests/optimizer.test.ts`:
- Gas Monitor (Req 01):
  - `should record gas observations with block and timestamp`: PASSED
  - `should compute correct min, max, and avg gas prices`: PASSED
  - `should flag stale observations when older than threshold`: PASSED
- Transaction Intent Scheduler (Req 02 & Req 04):
  - `should create and persist a new intent with valid parameters`: PASSED
  - `should reject scheduling with invalid recipient address`: PASSED
  - `should hold intent when current gas is above target ceiling`: PASSED
  - `should trigger intent when gas drops below target ceiling`: PASSED
  - `should trigger intent at deadline even if gas is above ceiling (Req 04)`: PASSED
- Receipt Verification & Delta (Req 03):
  - `should calculate actual fee vs request fee delta and savings`: PASSED
- Live Network Smoke:
  - `should query live Pharos Atlantic block number and gas price`: PASSED
