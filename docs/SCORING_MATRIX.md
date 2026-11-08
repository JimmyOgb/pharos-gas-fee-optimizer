# Scoring Matrix & Traceability Report: Gas Fee Optimizer

## Target Score: 150 / 150 (100 Base + 50 Video Bonus)

| Criteria Code | Official Requirement | Weight | Implementation Details | Evidence File / Route |
| :--- | :--- | :--- | :--- | :--- |
| **REQ-01** | Tracks gas price over time and shows recent history | 25 pts | Live polling engine records genuine gas prices every 6s. Computes min, max, average, and trend trajectory. Persisted durably. | `src/services/gasMonitor.ts`, `GET /api/gas`, UI Gas Chart |
| **REQ-02** | Accepts a transaction with a deadline and holds it until gas is favorable or deadline reached | 25 pts | Intent creation API and UI modal. Stores intent with `targetGasGwei` and `deadline`. Evaluates every tick whether gas <= ceiling. | `src/services/optimizer.ts`, `POST /api/intents`, `GET /api/intents` |
| **REQ-03** | Reports actual gas paid compared with price at request time | 25 pts | Verified receipt accounting. Calculates `actualFee = gasUsed * effectiveGasPrice`. Compares with `initialEstimatedFee` and initial price. Direct PharosScan link. | `src/services/receiptVerifier.ts`, `GET /api/intents/:id/receipt` |
| **REQ-04** | Never misses the deadline; submits at deadline even if gas is high | 25 pts | Deadline watchdog evaluates queue continuously. When `timeRemaining <= 0`, forces `READY_FOR_EXECUTION (DEADLINE_FORCED)` state immediately. | `src/services/optimizer.ts`, `POST /api/intents/:id/execute` |
| **BONUS** | Demonstration Video Walkthrough | +50 pts | 1080p continuous live recording of deployed app, demonstrating live gas feed, intent scheduling, gas threshold check, deadline trigger, and fee report. | `demo/pharos-gas-optimizer-demo.mp4`, `demo/narration.srt` |
