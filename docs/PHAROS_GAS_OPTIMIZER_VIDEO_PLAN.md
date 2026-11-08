# PHAROS GAS FEE OPTIMIZER — VIDEO DEMONSTRATION PLAN

## Overview
This video demonstration captures the genuine deployed production application of the **Pharos Gas Fee Optimizer** running on Pharos Atlantic Testnet (`chain id 688689`) without simulation, mock data, or synthetic video loops.

- **Production App**: [https://pharos-gas-fee-optimizer.vercel.app](https://pharos-gas-fee-optimizer.vercel.app)
- **GitHub Repository**: [https://github.com/JimmyOgb/pharos-gas-fee-optimizer](https://github.com/JimmyOgb/pharos-gas-fee-optimizer)
- **Recorded Format**: 1920x1080 @ 30 FPS, H.264, AAC Audio with burned-in subtitles and clean variant.
- **Narration Engine**: `edge-tts` (`en-US-ChristopherNeural`).
- **Cursor Animation**: Dynamic amber cursor orb with click ripples and smooth cubic-bezier transitions.

---

## Storyboard & Requirement Mapping

| Scene | Timestamp | UI Action & Focus | Requirement Verified |
|---|---|---|---|
| **Scene 1: Introduction & Connection** | 00:00 - 00:06 | Hover status header displaying **Pharos Atlantic (688689)** and synced **Pharos MCP Protocol**. | System identity & live network synchronization |
| **Scene 2: Live Gas History & Metrics** | 00:06 - 00:13 | Focus on live gas metrics strip: 10.0 Gwei current price, 1.0 Gwei EIP-1559 base fee, min/max/average stats, and history table. | **Req 01**: Tracks gas price over time and shows recent history |
| **Scene 3: Intent Scheduling & Fee Ceiling** | 00:13 - 00:20 | Form input: Recipient (`0x6960d708304918e9d9e487146522c0db35a5078a`), Amount (0.05 PHAROS), Target Ceiling (7.0 Gwei), and 18s deadline. | **Req 02**: Accepts transaction with deadline & holds intent |
| **Scene 4: Deterministic Hold Queue** | 00:20 - 00:27 | Submit intent and observe active queue card in `HELD_WAITING_GAS` state because network gas (10.0 Gwei) > target (7.0 Gwei). | **Req 02**: Gas favorable evaluation check |
| **Scene 5: Deadline Watchdog Trigger** | 00:27 - 00:35 | Live watchdog triggers or manual force evaluation at deadline expiration; status flips to `TRIGGERED_DEADLINE_REACHED`. | **Req 04**: Never misses deadline; submits at deadline even if gas is high |
| **Scene 6: Fee Comparison & Verification** | 00:35 - 00:43 | Card displays fee delta comparison (gas at request vs gas at execution) and verified on-chain PharosScan explorer link. | **Req 03**: Reports actual gas paid compared with price at request time |
| **Scene 7: Deployment & Wrap-up** | 00:43 - 00:47 | Inspect genuine Atlantic gas history log stream and live Vercel production footer. | Production readiness & verification |

---

## Generation & Verification Artifacts
- Script: `demo/record_demo.py`
- Subtitles: `demo/narration.srt`
- Clean Video: `demo/pharos-gas-fee-optimizer-demo-clean.mp4`
- Subtitled Video: `demo/pharos-gas-fee-optimizer-demo.mp4`
