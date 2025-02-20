-- CreateTable
CREATE TABLE "entity" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_number" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,

    CONSTRAINT "phone_number_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "phone_number" ADD CONSTRAINT "phone_number_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
