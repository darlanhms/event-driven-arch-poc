/*
  Warnings:

  - Added the required column `entity` to the `event` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "event" ADD COLUMN     "entity" TEXT NOT NULL;
