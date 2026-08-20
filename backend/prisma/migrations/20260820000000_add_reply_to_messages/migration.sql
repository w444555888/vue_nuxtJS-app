-- AlterTable
ALTER TABLE "Message" ADD COLUMN "replyToMessageId" INTEGER;

-- AlterTable
ALTER TABLE "PrivateMessage" ADD COLUMN "replyToMessageId" INTEGER;

-- CreateIndex
CREATE INDEX "Message_replyToMessageId_idx" ON "Message"("replyToMessageId");

-- CreateIndex
CREATE INDEX "PrivateMessage_replyToMessageId_idx" ON "PrivateMessage"("replyToMessageId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_replyToMessageId_fkey" FOREIGN KEY ("replyToMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateMessage" ADD CONSTRAINT "PrivateMessage_replyToMessageId_fkey" FOREIGN KEY ("replyToMessageId") REFERENCES "PrivateMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
