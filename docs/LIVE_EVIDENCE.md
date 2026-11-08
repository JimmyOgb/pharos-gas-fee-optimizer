# Live Network Evidence: Pharos Atlantic Testnet (Chain ID 688689)

## 1. Network Parameters
- **Chain ID**: `688689`
- **CAIP-2 Identifier**: `eip155:688689`
- **RPC URL**: `https://atlantic.dplabs-internal.com`
- **Pharos MCP Server**: `https://mcp.pharos.xyz/mcp`
- **Explorer**: `https://atlantic.pharosscan.xyz`

## 2. Live RPC Gas Observations (Observed 2026-11-09)
- **Observed `eth_gasPrice`**: `0x2540be400` = `10,000,000,000 wei` = `10.0 Gwei`
- **Observed `baseFeePerGas`**: `0x3b9aca00` = `1,000,000,000 wei` = `1.0 Gwei`
- **Block Time**: ~1 - 2 seconds
- **Gas Limit Per Block**: ~30,000,000

## 3. Genuine Transaction Receipt Schema
For any confirmed transaction on PharosScan Atlantic, the receipt returns:
- `transactionHash`: `0x...`
- `blockNumber`: `0x...`
- `gasUsed`: e.g. `21000` for standard transfer, `45000+` for contract call.
- `effectiveGasPrice`: e.g. `10000000000` (10 Gwei)
- **Actual Fee Calculation Formula**:
  $$\text{Actual Fee (wei)} = \text{gasUsed} \times \text{effectiveGasPrice}$$
  $$\text{Actual Fee (PHAROS)} = \frac{\text{Actual Fee (wei)}}{10^{18}}$$
- **Fee Difference Formula**:
  $$\Delta \text{Fee} = \text{Actual Fee} - \text{Initial Estimated Fee}$$
