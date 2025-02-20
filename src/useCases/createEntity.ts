import { v4 as uuid } from 'uuid';
import { z } from 'zod';

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

  await prisma.phoneNumber.create({
    data: {
      id: uuid(),
      number: data.phoneNumber,
      entityId: entity.id,
    },
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
