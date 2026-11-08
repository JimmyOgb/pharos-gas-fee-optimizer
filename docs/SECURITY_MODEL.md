# Security Model & Wallet Authorization: Pharos Gas Fee Optimizer

## 1. Zero Custody Security Principle
- **No Private Keys**: The application neither requests, collects, stores, nor logs private keys, mnemonic seeds, or signer credentials.
- **No Autonomous Signing**: The agent NEVER signs transactions on behalf of users in the background.
- **Client-Side Wallet Signature**: When an intent reaches `READY_FOR_EXECUTION` (either via favorable gas or forced deadline), execution triggers standard browser wallet approval (e.g. MetaMask / injected EIP-1193 provider).

## 2. Nonce Risk & Deadline Scheduling Disclosures
- **Why Pre-Signed Custody Is Rejected**:
  Storing pre-signed raw transactions on a server is hazardous:
  1. If the user executes any other transaction while waiting for gas to drop, the account's on-chain nonce increments, instantly invalidating the pre-signed transaction.
  2. If network gas spikes dramatically, a fixed-gas pre-signed transaction could remain stuck in mempool indefinitely.
- **Honest Deadline Execution Model**:
  The optimizer persistently tracks the scheduled intent on the server. When the deadline expires, the watchdog transitions the intent to `READY_FOR_EXECUTION (DEADLINE_FORCED)`. The user is prompted to sign and broadcast the transaction at the prevailing market gas rate.
  If the operator is offline or closes their browser session at the exact moment of the deadline, the system flags the state honestly as `MISSED_DEADLINE (OPERATOR_UNAVAILABLE)` rather than claiming a false success.

## 3. Serverless State Safety
- On Vercel Lambda, durable state automatically resolves to `os.tmpdir()` fallback paths to guarantee zero read-only filesystem faults (`EROFS`).
- Rate limiting and caching prevents RPC connection exhaustion and browser timeouts.
