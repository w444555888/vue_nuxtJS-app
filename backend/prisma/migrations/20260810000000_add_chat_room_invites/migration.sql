-- CreateTable
CREATE TABLE "ChatRoomInvite" (
    "id" SERIAL NOT NULL,
    "roomId" INTEGER NOT NULL,
    "inviterId" INTEGER NOT NULL,
    "inviteeId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatRoomInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatRoomInvite_roomId_inviteeId_key" ON "ChatRoomInvite"("roomId", "inviteeId");

-- CreateIndex
CREATE INDEX "ChatRoomInvite_inviteeId_status_idx" ON "ChatRoomInvite"("inviteeId", "status");

-- CreateIndex
CREATE INDEX "ChatRoomInvite_roomId_status_idx" ON "ChatRoomInvite"("roomId", "status");

-- AddForeignKey
ALTER TABLE "ChatRoomInvite" ADD CONSTRAINT "ChatRoomInvite_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRoomInvite" ADD CONSTRAINT "ChatRoomInvite_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRoomInvite" ADD CONSTRAINT "ChatRoomInvite_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
