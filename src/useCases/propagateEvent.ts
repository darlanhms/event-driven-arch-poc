import { v4 as uuid } from 'uuid';

import { amqpClient, EventQueuePayload } from '../amqp';
import { prisma } from '../prisma';

export default async function propagateEvent(event: Omit<EventQueuePayload, 'eventId' | 'timestamp'>) {
  const eventId = uuid();
  const timestamp = new Date();

  await prisma.$transaction(async (manager) => {
    await manager.event.create({
      data: { ...event, id: eventId, timestamp },
    });

    await amqpClient.sendEvent({
      eventId,
      timestamp: timestamp.getTime(),
      ...event,
    });
  });
}
