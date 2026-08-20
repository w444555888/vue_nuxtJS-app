-- CreateIndex
CREATE INDEX "ChatRoomMember_roomId_userId_idx" ON "ChatRoomMember"("roomId", "userId");

-- CreateIndex
CREATE INDEX "Friend_userId2_userId1_idx" ON "Friend"("userId2", "userId1");
