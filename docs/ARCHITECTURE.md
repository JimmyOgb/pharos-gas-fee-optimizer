# Architecture: Pharos Gas Fee Optimizer

```mermaid
flowchart TD
    subgraph NetworkLayer ["Pharos Atlantic Testnet (Chain ID 688689)"]
        RPC["Viem Public Client: atlantic.dplabs-internal.com"]
        MCP["Pharos MCP Server: mcp.pharos.xyz/mcp"]
        Scan["PharosScan Explorer: atlantic.pharosscan.xyz"]
    end

    subgraph GasEngine ["Gas Observation & Analytics Engine"]
        Poller["Dual Ingestion Gas Poller (RPC eth_gasPrice + MCP)"]
        History["Durable Gas History Buffer (Min, Max, Avg, Freshness)"]
    end

    subgraph OptimizationEngine ["Gas Optimization & Deadline Queue"]
        IntentStore["Durable Intent Queue (Local / os.tmpdir())"]
        DecisionEngine["Deterministic Fee & Deadline Evaluator"]
        Watchdog["Deadline Sentinel (Triggers Submission at Deadline)"]
    end

    subgraph AccountingEngine ["Receipt Accounting & Verification Engine"]
        ReceiptFetcher["Viem eth_getTransactionReceipt"]
        DiffCalculator["Fee Delta Calculator (Actual vs Estimated)"]
    end

    subgraph UserInterface ["Presentation & API Layer (Serverless Safe)"]
        API["REST API: /api/gas, /api/intents, /api/execute, /api/telemetry"]
        Dashboard["Responsive Cyberpunk/Fintech UI Dashboard"]
    end

    RPC --> Poller
    MCP --> Poller
    Poller --> History
    History --> DecisionEngine
    IntentStore --> DecisionEngine
    DecisionEngine --> Watchdog
    Watchdog --> API
    ReceiptFetcher --> DiffCalculator
    DiffCalculator --> API
    API --> Dashboard
    Dashboard -. Verified Tx Links .-> Scan
```

## System Workflow States
1. `PREPARED`: Transaction intent configured by operator with recipient, value, gas limit, fee ceiling, and deadline.
2. `HOLDING_FOR_FAVORABLE_GAS`: Current network gas price exceeds fee ceiling, and deadline has not expired.
3. `READY_FOR_EXECUTION (FAVORABLE_GAS)`: Gas dropped below fee ceiling.
4. `READY_FOR_EXECUTION (DEADLINE_FORCED)`: Deadline reached. Mandatory submission trigger activated regardless of gas price.
5. `BROADCASTED`: Transaction signed by user wallet and submitted to Atlantic Testnet mempool.
6. `CONFIRMED`: Receipt fetched from Atlantic RPC; actual gas used, effective price, fee delta, and PharosScan link recorded.
7. `FAILED_OR_EXPIRED`: Intent canceled or wallet signature rejected.
