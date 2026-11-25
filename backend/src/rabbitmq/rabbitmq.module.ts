import { Global, Injectable, Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import { loadConfig } from '../config/env.config';

export const QUEUE_MESSAGE_DELIVERY = 'connectx.message.delivery';
export const QUEUE_MESSAGE_RETRY = 'connectx.message.delivery.retry';
export const QUEUE_NOTIFICATIONS = 'connectx.notifications';

@Injectable()
export class RabbitMqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqService.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;

  async onModuleInit(): Promise<void> {
    const url = loadConfig().rabbitmqUrl;
    if (!url || process.env.SKIP_INFRA_CONNECT === 'true') {
      this.logger.warn('RabbitMQ connection skipped or URL unset.');
      return;
    }
    try {
      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();
      await this.channel.assertQueue(QUEUE_MESSAGE_RETRY, {
        durable: true,
        arguments: {
          'x-message-ttl': 5000,
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': QUEUE_MESSAGE_DELIVERY,
        },
      });
      await this.channel.assertQueue(QUEUE_MESSAGE_DELIVERY, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': QUEUE_MESSAGE_RETRY,
        },
      });
      await this.channel.assertQueue(QUEUE_NOTIFICATIONS, { durable: true });
      this.logger.log('Connected to RabbitMQ and asserted delivery/retry/notification queues');
    } catch (err) {
      this.logger.warn(`RabbitMQ unavailable (${(err as Error).message})`);
      this.channel = null;
      this.connection = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch {
      // ignore teardown errors
    }
  }

  status(): 'CONNECTED' | 'UNCONFIGURED' {
    return this.channel ? 'CONNECTED' : 'UNCONFIGURED';
  }

  async publish(queue: string, payload: Record<string, unknown>): Promise<boolean> {
    if (!this.channel) return false;
    return this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(payload)), {
      persistent: true,
      contentType: 'application/json',
    });
  }

  async consume(
    queue: string,
    handler: (payload: Record<string, unknown>, attempts: number) => Promise<void>,
  ): Promise<void> {
    if (!this.channel) return;
    await this.channel.consume(queue, async (msg) => {
      if (!msg || !this.channel) return;
      const attempts = Number(msg.properties.headers?.['x-retry-count'] ?? 0);
      try {
        const parsed = JSON.parse(msg.content.toString('utf8')) as Record<string, unknown>;
        await handler(parsed, attempts);
        this.channel.ack(msg);
      } catch (err) {
        this.logger.error(`Worker failed processing ${queue} (attempt ${attempts + 1}): ${(err as Error).message}`);
        if (attempts < 3 && queue === QUEUE_MESSAGE_DELIVERY) {
          this.channel.sendToQueue(QUEUE_MESSAGE_RETRY, msg.content, {
            persistent: true,
            headers: { 'x-retry-count': attempts + 1 },
          });
          this.channel.ack(msg);
        } else {
          this.channel.nack(msg, false, false);
        }
      }
    });
  }
}

@Global()
@Module({
  providers: [RabbitMqService],
  exports: [RabbitMqService],
})
export class RabbitMqModule {}
