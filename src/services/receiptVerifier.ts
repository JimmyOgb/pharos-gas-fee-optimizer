import { rpcService } from './rpc.js';
import { optimizer } from './optimizer.js';
import { TransactionIntent } from '../types.js';

export class ReceiptVerifierService {
  /**
   * Queries genuine on-chain receipt from Atlantic Testnet and calculates fee comparison.
   */
  public async verifyAndConfirmReceipt(intentId: string, txHash: `0x${string}`): Promise<TransactionIntent> {
    const receipt = await rpcService.getTransactionReceipt(txHash);
    if (!receipt) {
      throw new Error(`Transaction receipt for ${txHash} not yet available on Pharos Atlantic`);
    }

    const effectivePrice = receipt.effectiveGasPrice ?? 10000000000n; // fallback to 10 Gwei if not present

    return await optimizer.confirmReceipt({
      intentId,
      txHash,
      gasUsed: receipt.gasUsed,
      effectiveGasPriceWei: effectivePrice,
      blockNumber: Number(receipt.blockNumber),
    });
  }
}

export const receiptVerifier = new ReceiptVerifierService();
