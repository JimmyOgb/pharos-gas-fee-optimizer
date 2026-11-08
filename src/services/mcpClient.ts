export class PharosMcpClient {
  private endpoint: string;
  private isInitialized = false;
  private reqId = 1;
  private isAvailable = false;
  private lastCheckTimestamp = '';

  constructor(endpoint = 'https://mcp.pharos.xyz/mcp') {
    this.endpoint = endpoint;
  }

  private parseMcpResponse(rawText: string): any {
    if (rawText.includes('event:') || rawText.includes('data:')) {
      const lines = rawText.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
          const jsonStr = trimmed.slice(5).trim();
          try {
            return JSON.parse(jsonStr);
          } catch {
            // continue
          }
        }
      }
    }
    return JSON.parse(rawText);
  }

  public async initialize(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: this.reqId++,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'pharos-gas-optimizer', version: '1.0.0' },
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);
      if (!res.ok) {
        this.isAvailable = false;
        return false;
      }

      const text = await res.text();
      const data = this.parseMcpResponse(text);
      if (data?.result) {
        this.isInitialized = true;
        this.isAvailable = true;
        this.lastCheckTimestamp = new Date().toISOString();
        return true;
      }
      return false;
    } catch {
      this.isAvailable = false;
      return false;
    }
  }

  public async getGasPrice(): Promise<number | null> {
    if (!this.isInitialized) {
      const ok = await this.initialize();
      if (!ok) return null;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: this.reqId++,
          method: 'tools/call',
          params: { name: 'get_gas_price', arguments: {} },
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);
      if (!res.ok) return null;

      const text = await res.text();
      const data = this.parseMcpResponse(text);
      const contentList = data?.result?.content;
      if (Array.isArray(contentList) && contentList[0]?.text) {
        const val = contentList[0].text;
        const hexOrDec = typeof val === 'string' && val.startsWith('0x') ? parseInt(val, 16) : Number(val);
        if (!isNaN(hexOrDec)) {
          return hexOrDec / 1e9; // convert wei to Gwei
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  public getStatus() {
    return {
      connected: this.isAvailable,
      lastChecked: this.lastCheckTimestamp || new Date().toISOString(),
      endpoint: this.endpoint,
    };
  }
}

export const mcpClient = new PharosMcpClient();
