import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { GasObservation, TransactionIntent } from '../types.js';

interface StorageState {
  observations: GasObservation[];
  intents: TransactionIntent[];
}

export class StorageService {
  private filePath: string;
  private state: StorageState;

  constructor() {
    let baseDir: string;
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      baseDir = path.join(os.tmpdir(), 'pharos-gas-optimizer');
    } else {
      baseDir = path.resolve(process.cwd(), 'data');
    }

    try {
      if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
      }
    } catch {
      baseDir = path.join(os.tmpdir(), 'pharos-gas-optimizer');
      if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
      }
    }

    this.filePath = path.join(baseDir, 'storage.json');
    this.state = this.loadState();
  }

  private loadState(): StorageState {
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.observations) && Array.isArray(parsed.intents)) {
          return parsed;
        }
      } catch (err) {
        console.warn('Failed to parse existing gas optimizer storage:', err);
      }
    }

    const initial: StorageState = {
      observations: [],
      intents: [],
    };
    this.persist(initial);
    return initial;
  }

  private persist(state: StorageState): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist storage to disk:', err);
    }
  }

  public addObservation(obs: GasObservation): void {
    this.state.observations.push(obs);
    if (this.state.observations.length > 200) {
      this.state.observations = this.state.observations.slice(-200);
    }
    this.persist(this.state);
  }

  public getObservations(limit = 60): GasObservation[] {
    return this.state.observations.slice(-limit);
  }

  public getLatestObservation(): GasObservation | undefined {
    return this.state.observations[this.state.observations.length - 1];
  }

  public addIntent(intent: TransactionIntent): TransactionIntent {
    this.state.intents.unshift(intent);
    if (this.state.intents.length > 100) {
      this.state.intents = this.state.intents.slice(0, 100);
    }
    this.persist(this.state);
    return intent;
  }

  public getIntents(): TransactionIntent[] {
    return [...this.state.intents];
  }

  public getIntentById(id: string): TransactionIntent | undefined {
    return this.state.intents.find((i) => i.id === id);
  }

  public updateIntent(id: string, updates: Partial<TransactionIntent>): TransactionIntent {
    const idx = this.state.intents.findIndex((i) => i.id === id);
    if (idx === -1) {
      throw new Error(`Intent with ID ${id} not found`);
    }
    const updated = { ...this.state.intents[idx], ...updates };
    this.state.intents[idx] = updated;
    this.persist(this.state);
    return updated;
  }

  public deleteIntent(id: string): boolean {
    const idx = this.state.intents.findIndex((i) => i.id === id);
    if (idx === -1) return false;
    this.state.intents.splice(idx, 1);
    this.persist(this.state);
    return true;
  }

  public resetToDefaults(): void {
    this.state = {
      observations: [],
      intents: [],
    };
    this.persist(this.state);
  }
}

export const storage = new StorageService();
