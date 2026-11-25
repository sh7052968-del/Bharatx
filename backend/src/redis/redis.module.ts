import { Global, Injectable, Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { loadConfig } from '../config/env.config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private readonly memoryFallback = new Map<string, { value: string; expiresAt?: number }>();

  async onModuleInit(): Promise<void> {
    const url = loadConfig().redisUrl;
    if (!url || process.env.SKIP_INFRA_CONNECT === 'true') {
      this.logger.warn('Redis connection skipped or URL unset; using process-local ephemeral store.');
      return;
    }
    try {
      this.client = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
      await this.client.connect();
      this.logger.log('Connected to Redis');
    } catch (err) {
      this.logger.warn(`Redis unavailable (${(err as Error).message}); falling back cleanly.`);
      this.client = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }

  async ping(): Promise<'CONNECTED' | 'UNCONFIGURED'> {
    if (!this.client) return 'UNCONFIGURED';
    try {
      const res = await this.client.ping();
      return res === 'PONG' ? 'CONNECTED' : 'UNCONFIGURED';
    } catch {
      return 'UNCONFIGURED';
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.client) {
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
      return;
    }
    this.memoryFallback.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  }

  async get(key: string): Promise<string | null> {
    if (this.client) {
      return this.client.get(key);
    }
    const entry = this.memoryFallback.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.memoryFallback.delete(key);
      return null;
    }
    return entry.value;
  }

  async del(key: string): Promise<void> {
    if (this.client) {
      await this.client.del(key);
      return;
    }
    this.memoryFallback.delete(key);
  }
}

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
