'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const mongoose = require('mongoose');
const cors = require('cors');
const Message = require('./models/Message');
const Room = require('./models/Room');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatdb';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());

// MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('[Chat] MongoDB connected'))
  .catch(err => console.error('[Chat] MongoDB error:', err.message));

// Redis Adapter for Socket.io scaling
const pubClient = createClient({ url: REDIS_URL });
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()])
  .then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    console.log('[Chat] Redis adapter connected');
  })
  .catch(err => console.warn('[Chat] Redis adapter failed (single-node mode):', err.message));

// Socket.io
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:3000', methods: ['GET', 'POST'], credentials: true },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// In-memory presence store (use Redis in production)
const onlineUsers = new Map(); // socketId -> { userId, username, rooms }

// Auth middleware
io.use((socket, next) => {
  const { userId, username } = socket.handshake.auth;
  if (!userId || !username) return next(new Error('Authentication required'));
  socket.userId   = userId;
  socket.username = username;
  next();
});

io.on('connection', (socket) => {
  console.log(`[Chat] Connected: ${socket.username} (${socket.id})`);

  onlineUsers.set(socket.id, { userId: socket.userId, username: socket.username, rooms: new Set() });

  // Broadcast updated online list
  io.emit('online-users', [...new Set([...onlineUsers.values()].map(u => u.userId))]);

  // ─── Join Room ──────────────────────────────────────────────────────────────
  socket.on('join-room', async ({ roomId }) => {
    if (!roomId) return;
    socket.join(roomId);
    const user = onlineUsers.get(socket.id);
    if (user) user.rooms.add(roomId);

    // Load recent messages
    try {
      const messages = await Message.find({ room: roomId })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate('sender', 'username avatar')
        .lean();
      socket.emit('message-history', { roomId, messages: messages.reverse() });
    } catch (err) {
      console.error('[Chat] Load history error:', err.message);
    }

    socket.to(roomId).emit('user-joined', {
      userId: socket.userId,
      username: socket.username,
      roomId,
      timestamp: new Date().toISOString(),
    });

    await Room.updateOne({ _id: roomId }, { $addToSet: { members: socket.userId } }).catch(() => {});
    console.log(`[Chat] ${socket.username} joined room ${roomId}`);
  });

  // ─── Leave Room ─────────────────────────────────────────────────────────────
  socket.on('leave-room', ({ roomId }) => {
    socket.leave(roomId);
    const user = onlineUsers.get(socket.id);
    if (user) user.rooms.delete(roomId);

    socket.to(roomId).emit('user-left', {
      userId: socket.userId,
      username: socket.username,
      roomId,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── Room Message ────────────────────────────────────────────────────────────
  socket.on('message', async ({ roomId, content, type = 'text', fileUrl }) => {
    if (!roomId || (!content && !fileUrl)) return;

    try {
      const message = await Message.create({
        room: roomId,
        sender: socket.userId,
        senderName: socket.username,
        content: content || '',
        type,
        fileUrl,
        readBy: [socket.userId],
      });

      const messageData = {
        _id: message._id,
        room: roomId,
        sender: { _id: socket.userId, username: socket.username },
        content: message.content,
        type: message.type,
        fileUrl: message.fileUrl,
        readBy: message.readBy,
        createdAt: message.createdAt,
      };

      io.to(roomId).emit('message', messageData);

      // Update room's lastMessage
      await Room.updateOne({ _id: roomId }, {
        lastMessage: { content: message.content || '[file]', sender: socket.username, timestamp: message.createdAt },
      }).catch(() => {});
    } catch (err) {
      console.error('[Chat] Message error:', err.message);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // ─── Private Message ─────────────────────────────────────────────────────────
  socket.on('private-message', async ({ recipientId, content, type = 'text' }) => {
    if (!recipientId || !content) return;

    const dmRoomId = [socket.userId, recipientId].sort().join(':');

    try {
      const message = await Message.create({
        room: dmRoomId,
        sender: socket.userId,
        senderName: socket.username,
        content,
        type,
        isDM: true,
        readBy: [socket.userId],
      });

      const messageData = {
        _id: message._id,
        room: dmRoomId,
        sender: { _id: socket.userId, username: socket.username },
        recipientId,
        content: message.content,
        type: message.type,
        isDM: true,
        createdAt: message.createdAt,
      };

      // Send to recipient sockets
      const recipientSockets = [...onlineUsers.entries()]
        .filter(([, u]) => u.userId === recipientId)
        .map(([sid]) => sid);

      recipientSockets.forEach(sid => io.to(sid).emit('private-message', messageData));
      socket.emit('private-message', messageData); // echo to sender
    } catch (err) {
      console.error('[Chat] DM error:', err.message);
    }
  });

  // ─── Typing Indicators ────────────────────────────────────────────────────────
  socket.on('typing', ({ roomId }) => {
    socket.to(roomId).emit('typing', { userId: socket.userId, username: socket.username, roomId });
  });

  socket.on('stop-typing', ({ roomId }) => {
    socket.to(roomId).emit('stop-typing', { userId: socket.userId, username: socket.username, roomId });
  });

  // ─── Disconnect ───────────────────────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    onlineUsers.delete(socket.id);
    console.log(`[Chat] Disconnected: ${socket.username} (${reason})`);
    io.emit('online-users', [...new Set([...onlineUsers.values()].map(u => u.userId))]);
  });
});

// ─── HTTP Routes ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'healthy', connections: io.engine.clientsCount }));

app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await Room.find({ type: 'public' }).sort({ createdAt: -1 }).limit(50);
    res.json(rooms);
  } catch {
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

app.post('/api/rooms', async (req, res) => {
  try {
    const { name, type = 'public', createdBy } = req.body;
    if (!name || !createdBy) return res.status(400).json({ error: 'name and createdBy required' });
    const room = await Room.create({ name, type, createdBy, members: [createdBy] });
    res.status(201).json(room);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Room name already exists' });
    res.status(500).json({ error: 'Failed to create room' });
  }
});

server.listen(PORT, () => console.log(`[Chat Server] Running on port ${PORT}`));
module.exports = { app, server, io };
