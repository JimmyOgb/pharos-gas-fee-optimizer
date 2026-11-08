import { createPublicClient, http, formatEther, parseEther, formatGwei, parseGwei } from 'viem';

export const ATLANTIC_TESTNET = {
  id: 688689,
  name: 'Pharos Atlantic Testnet',
  network: 'pharos-atlantic',
  nativeCurrency: {
    decimals: 18,
    name: 'Pharos',
    symbol: 'PHAROS',
  },
  rpcUrls: {
    default: { http: ['https://atlantic.dplabs-internal.com'] },
    public: { http: ['https://atlantic.dplabs-internal.com'] },
  },
  blockExplorers: {
    default: {
      name: 'PharosScan',
      url: 'https://atlantic.pharosscan.xyz',
    },
  },
} as const;

export class PharosRpcService {
  private client: ReturnType<typeof createPublicClient>;

  constructor(rpcUrl = 'https://atlantic.dplabs-internal.com') {
    this.client = createPublicClient({
      chain: ATLANTIC_TESTNET,
      transport: http(rpcUrl, {
        timeout: 4500,
        retryCount: 1,
      }),
    });
  }

  public async getLatestBlockNumber(): Promise<number> {
    const block = await this.client.getBlockNumber();
    return Number(block);
  }

  public async getCurrentGasPrice(): Promise<{
    gasPriceWei: bigint;
    gasPriceGwei: number;
    blockNumber: number;
    baseFeePerGasWei?: bigint;
    baseFeePerGasGwei?: number;
  }> {
    const [gasPrice, block] = await Promise.all([
      this.client.getGasPrice(),
      this.client.getBlock({ blockTag: 'latest' }),
    ]);

    const gasPriceGwei = parseFloat(formatGwei(gasPrice));
    const baseFeePerGasWei = block.baseFeePerGas ?? undefined;
    const baseFeePerGasGwei = baseFeePerGasWei ? parseFloat(formatGwei(baseFeePerGasWei)) : undefined;

    return {
      gasPriceWei: gasPrice,
      gasPriceGwei,
      blockNumber: Number(block.number),
      baseFeePerGasWei,
      baseFeePerGasGwei,
    };
  }

  public async getTransactionReceipt(hash: `0x${string}`) {
    return await this.client.getTransactionReceipt({ hash });
  }

  public calculateFee(gasUsed: bigint | number, gasPriceGwei: number): string {
    const gasUsedBig = BigInt(gasUsed);
    const gasPriceWei = parseGwei(gasPriceGwei.toString());
    const totalWei = gasUsedBig * gasPriceWei;
    return formatEther(totalWei);
  }

  public buildExplorerTxUrl(txHash: string): string {
    return `https://atlantic.pharosscan.xyz/tx/${txHash}`;
  }
}

export const rpcService = new PharosRpcService();
