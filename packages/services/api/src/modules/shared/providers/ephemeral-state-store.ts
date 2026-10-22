import { randomBytes } from 'node:crypto';
import type { z } from 'zod';
import { sha256 } from '../../auth/lib/supertokens-at-home/crypto';
import type { Redis } from './redis';

export abstract class EphemeralStateStore<TModel extends z.ZodType> {
  protected abstract readonly model: TModel;
  protected abstract readonly keyPrefix: string;

  constructor(private redis: Redis) {}

  async put(data: z.input<TModel>) {
    const state = randomBytes(32).toString('hex');
    const key = `${this.keyPrefix}:${sha256(state)}`;
    await this.redis.set(key, JSON.stringify(this.model.parse(data)), 'EX', 60 * 5);

    return state;
  }

  async get(state: string): Promise<z.output<TModel> | null> {
    const key = `${this.keyPrefix}:${sha256(state)}`;
    const encodedData = await this.redis.getdel(key);
    if (!encodedData) {
      return null;
    }

    return this.model.parse(JSON.parse(encodedData));
  }
}
