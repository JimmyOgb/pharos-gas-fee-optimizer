# PHAROS GAS FEE OPTIMIZER — PRODUCTION ARCHITECTURE & RELIABILITY REVIEW

## System Architecture Summary

The Pharos Gas Fee Optimizer is designed as a resilient, non-custodial decentralized automation sentinel running on top of **Pharos Atlantic Testnet** (`Chain ID: 688689`).

```
[ Pharos Atlantic Testnet ] <--------------------+
       ^ (Chain ID: 688689)                      |
       | RPC & Events                            | Direct Failover
       v                                         v
[ Pharos MCP Protocol Server ] <-----> [ Dual-Channel Viem RPC Client ]
  (https://mcp.pharos.xyz/mcp)                   |
                                                 v
                                   [ Gas Price Telemetry Sentinel ]
                                     - Rolling Observation Window
                                     - Min / Max / Average Calculation
                                     - Stale Detection (<30s)
                                                 |
                                                 v
                                   [ Deterministic Intent Scheduler ]
                                     - Non-custodial Intent Queue
                                     - Gas Ceiling Comparator
                                     - Mandatory Deadline Watchdog
                                                 |
                                                 v
                                   [ On-Chain Receipt Verifier ]
                                     - Actual Gas Paid Audit
                                     - Fee Delta Calculation
                                     - Direct PharosScan Links
```

---

## Reliability & Fault Tolerance

1. **Dual RPC Ingress with Transparent Fallback**:
   - The primary gateway communicates over JSON-RPC to `https://mcp.pharos.xyz/mcp`.
   - If network latency or timeout occurs, the client automatically falls back to `https://atlantic.dplabs-internal.com`.
2. **Serverless-Immune Storage Architecture**:
   - On local development, intents and gas observations persist to `data/optimizer_state.json`.
   - In AWS Lambda / Vercel Serverless environments, state dynamically falls back to `/tmp/optimizer_state.json`, preventing runtime crashes and filesystem errors.
3. **Deadlock & Stale Observation Prevention**:
   - Any observation older than 30 seconds triggers an immediate background refresh before evaluating intent conditions.
4. **Deadline Invariance (Req 04)**:
   - The queue evaluation algorithm guarantees that `now >= deadlineTimestamp` immediately elevates the intent status to `TRIGGERED_DEADLINE_REACHED` regardless of whether current gas is 10 Gwei, 100 Gwei, or higher.
