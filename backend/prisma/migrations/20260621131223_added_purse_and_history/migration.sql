-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "finalPrice" DOUBLE PRECISION,
ADD COLUMN     "winnerName" TEXT;

-- AlterTable
ALTER TABLE "RoomParticipant" ADD COLUMN     "purse" DOUBLE PRECISION NOT NULL DEFAULT 0;
