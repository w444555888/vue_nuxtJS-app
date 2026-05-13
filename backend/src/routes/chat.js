const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const pg = require("pg");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// Prisma v7 PostgreSQL 连接
const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// 获取所有聊天室
router.get("/rooms", verifyToken, async (req, res) => {
  try {
    const rooms = await prisma.chatRoom.findMany({
      include: {
        _count: {
          select: { messages: true, users: true },
        },
      },
    });

    res.json(rooms);
  } catch (error) {
    console.error("获取聊天室失败:", error);
    res.status(500).json({ error: "获取聊天室失败" });
  }
});

// 创建聊天室
router.post("/rooms", verifyToken, async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: "聊天室名称不能为空" });
  }

  try {
    const room = await prisma.chatRoom.create({
      data: {
        name,
        description,
      },
    });

    res.status(201).json(room);
  } catch (error) {
    console.error("创建聊天室失败:", error);
    res.status(500).json({ error: "创建聊天室失败" });
  }
});

// 获取聊天室的消息
router.get("/rooms/:roomId/messages", verifyToken, async (req, res) => {
  const { roomId } = req.params;

  try {
    const messages = await prisma.message.findMany({
      where: { roomId: parseInt(roomId) },
      include: {
        user: {
          select: { id: true, username: true, avatar: true },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 50, // 获取最近50条消息
    });

    res.json(messages);
  } catch (error) {
    console.error("获取消息失败:", error);
    res.status(500).json({ error: "获取消息失败" });
  }
});

module.exports = router;
