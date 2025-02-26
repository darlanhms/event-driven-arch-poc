import { Channel, connect, Connection, Options } from 'amqplib';

import { prisma } from './prisma';

const RECONNECT_TIMEOUT = 1000 * 5;

type QueuePayloadType = number | string | Record<any, any>;

interface RabbitMQConsumer<T> {
  queue: string;
  handle(data: T): Promise<void> | void;
}

type EventType = 'insert';

type EventEntity = 'entity' | 'phoneNumber';

export interface EventQueuePayload {
  eventId: string;
  type: EventType;
  data: Record<any, any>;
  timestamp: number;
  entity: EventEntity;
}

interface EventAckPayload {
  eventId: string;
}

class AMQPClient {
  private _channel: Channel | undefined;

  private connection: Connection | undefined;

  constructor() {}

  private get vhost(): string {
    return '/dev';
  }

  private get channel(): Channel {
    if (!this._channel) {
      throw new Error('[RabbitMQ] Channel is not open for sending/receiving messages in queues');
    }

    return this._channel;
  }

  public async connect(): Promise<void> {
    const connPayload: Options.Connect = {
      vhost: this.vhost,
      hostname: process.env.AWS_MQ_HOST,
      port: Number(process.env.AWS_MQ_PORT) || 5671,
      username: process.env.AWS_MQ_USERNAME,
      password: process.env.AWS_MQ_PASSWORD,
      protocol: process.env.AWS_MQ_PROTOCOL || 'amqps',
    };

    const hostDesc = `${connPayload.protocol}://${process.env.AWS_MQ_HOST}:${connPayload.port} - vhost: ${this.vhost}`;

    try {
      this.connection = await connect(connPayload);

      this._channel = await this.connection.createChannel();
      this._channel.prefetch(Number(process.env.AMQP_PREFETCH) || 1);

      this.startListeners();

      if (process.env.DEDICATED_ENV) {
        const eventConsumer: RabbitMQConsumer<EventQueuePayload> = {
          queue: 'event',
          handle: async (data) => {
            await this.handleEvent(data);
          },
        };

        this.consume(eventConsumer);
      } else {
        const ackConsumer: RabbitMQConsumer<EventAckPayload> = {
          queue: 'event_acknowledgment',
          handle: async (data) => {
            await this.handleEventAck(data);
          },
        };

        this.consume(ackConsumer);
      }

      console.info(`[RabbitMQ] Connected to AMQP (${hostDesc})`);
    } catch (error) {
      console.error(`[RabbitMQ] Connection error to AMQP (${hostDesc}): ${error}`);

      setTimeout(() => this.connect(), RECONNECT_TIMEOUT);
    }
  }

  private startListeners(): void {
    if (!this.connection) return;

    this.connection.on('error', (error) => {
      console.error(`[RabbitMQ] Connection error: ${error}`);
    });

    this.connection.on('close', () => {
      console.error('[RabbitMQ] Connection to RabbitMQ closed');
      setTimeout(() => this.connect(), RECONNECT_TIMEOUT);
    });
  }

  async consume(consumer: RabbitMQConsumer<any>): Promise<void> {
    if (!consumer.queue) {
      return;
    }

    try {
      /**
       * Queue assertion
       */
      await this.channel.assertQueue(consumer.queue, {
        durable: true,
        // messageTtl: 1000 * 60 * 5 // 5min
      });

      /**
       * Queue consumption
       */
      await this.channel.consume(consumer.queue, async (msg) => {
        if (msg) {
          try {
            const payload = JSON.parse(msg.content.toString());

            await consumer.handle(payload);

            this.channel.ack(msg);
          } catch (error) {
            this.channel.nack(msg, false, false);
          }
        }
      });

      console.info('[RabbitMQ] Consuming queue', consumer.queue);
    } catch (error) {
      console.info('[RabbitMQ] Error consuming queue', error);
    }
  }

  public async send(queue: string, payload: QueuePayloadType): Promise<void> {
    try {
      this.channel.sendToQueue(queue, this.sanitizePayload(payload));
    } catch (error) {
      console.error(`[RabbitMQ] Error when publishing message to queue "${queue}": ${error}`);
    }
  }

  private sanitizePayload(payload: QueuePayloadType): Buffer {
    if (Buffer.isBuffer(payload)) {
      return payload;
    }

    if (['string', 'number'].includes(typeof payload)) {
      return Buffer.from(String(payload));
    }

    if (typeof payload === 'object') {
      return Buffer.from(JSON.stringify(payload));
    }

    throw new Error('[RabbitMQ] Payload type is not from pre-defined types (string | number | object)');
  }

  async sendEvent(payload: EventQueuePayload): Promise<void> {
    return this.send('event', payload);
  }

  private async handleEvent(payload: EventQueuePayload) {
    console.info('Event received', payload);

    switch (payload.type) {
      case `insert`:
        (prisma[payload.entity].create as any)({
          data: payload.data,
        }).catch((error: unknown) => console.error('Error while inserting entity', error));
        break;
      default:
        console.info('Event with invalid type was not processed', payload);
        break;
    }

    await this.send('event_acknowledgment', {
      eventId: payload.eventId,
    });

    console.info('Event processed', payload.eventId);
  }

  private async handleEventAck(payload: EventAckPayload) {
    await prisma.event.update({
      where: {
        id: payload.eventId,
      },
      data: {
        synced: true,
      },
    });

    console.info('Acknowledged event', payload.eventId);
  }
}

const amqpClient = new AMQPClient();

export { amqpClient };
