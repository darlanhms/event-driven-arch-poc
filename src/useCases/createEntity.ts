import { v4 as uuid } from 'uuid';
import { z } from 'zod';

import { amqpClient } from '../amqp';
import { prisma } from '../prisma';

const createEntitySchema = z.object({
  name: z.string(),
  phoneNumber: z.string(),
});

export default async function createEntity(rawData: z.infer<typeof createEntitySchema>) {
  const data = createEntitySchema.parse(rawData);

  const entity = await prisma.entity.create({
    data: {
      id: uuid(),
      name: data.name,
    },
  });

  const phoneNumber = await prisma.phoneNumber.create({
    data: {
      id: uuid(),
      number: data.phoneNumber,
      entityId: entity.id,
    },
  });

  await amqpClient.sendEvent({
    data: entity,
    type: 'insert',
    timestamp: new Date().getTime(),
  });

  await amqpClient.sendEvent({
    data: phoneNumber,
    type: 'insert',
    timestamp: new Date().getTime(),
  });

  const persisted = await prisma.entity.findUnique({
    where: {
      id: entity.id,
    },
    include: {
      phoneNumbers: true,
    },
  });

  return persisted;
}
