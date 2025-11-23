import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors());
app.use(express.json());

// Oda yönetimi
const rooms = new Map(); // roomId -> { hostId, users: Set, streamActive: boolean }

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Oda oluştur
  socket.on('create-room', ({ roomId, username, userId }) => {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        hostId: userId,
        users: new Map(),
        streamActive: false,
        chatHistory: []
      });
    }
    
    const room = rooms.get(roomId);
    room.users.set(userId, {
      socketId: socket.id,
      username,
      userId,
      joinedAt: Date.now()
    });

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.userId = userId;
    socket.data.username = username;

    // Kullanıcıya oda bilgilerini gönder
    socket.emit('room-created', {
      roomId,
      isHost: userId === room.hostId,
      users: Array.from(room.users.values()),
      chatHistory: room.chatHistory
    });

    // Diğer kullanıcılara yeni kullanıcı bildirimi
    socket.to(roomId).emit('user-joined', {
      userId,
      username,
      users: Array.from(room.users.values())
    });

    console.log(`User ${username} (${userId}) joined room ${roomId}`);
  });

  // Odaya katıl
  socket.on('join-room', ({ roomId, username, userId }) => {
    if (!rooms.has(roomId)) {
      socket.emit('room-not-found', { roomId });
      return;
    }

    const room = rooms.get(roomId);
    room.users.set(userId, {
      socketId: socket.id,
      username,
      userId,
      joinedAt: Date.now()
    });

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.userId = userId;
    socket.data.username = username;

    socket.emit('room-joined', {
      roomId,
      isHost: userId === room.hostId,
      users: Array.from(room.users.values()),
      chatHistory: room.chatHistory,
      streamActive: room.streamActive
    });

    socket.to(roomId).emit('user-joined', {
      userId,
      username,
      users: Array.from(room.users.values())
    });

    // Eğer stream aktifse ve host varsa, host'a yeni kullanıcıya offer göndermesi için bildir
    if (room.streamActive && room.hostId) {
      const hostUser = Array.from(room.users.values()).find(u => u.userId === room.hostId);
      if (hostUser) {
        // Small delay to ensure user is fully joined
        setTimeout(() => {
          io.to(hostUser.socketId).emit('new-viewer-joined', {
            viewerUserId: userId,
            viewerUsername: username
          });
        }, 100);
      }
    }

    console.log(`User ${username} (${userId}) joined room ${roomId}`);
  });

  // WebRTC sinyalleri
  socket.on('webrtc-offer', ({ roomId, offer, targetUserId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const targetUser = Array.from(room.users.values()).find(u => u.userId === targetUserId);
    if (targetUser) {
      io.to(targetUser.socketId).emit('webrtc-offer', {
        offer,
        fromUserId: socket.data.userId,
        fromUsername: socket.data.username
      });
    }
  });

  socket.on('webrtc-answer', ({ roomId, answer, targetUserId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const targetUser = Array.from(room.users.values()).find(u => u.userId === targetUserId);
    if (targetUser) {
      io.to(targetUser.socketId).emit('webrtc-answer', {
        answer,
        fromUserId: socket.data.userId
      });
    }
  });

  socket.on('webrtc-ice-candidate', ({ roomId, candidate, targetUserId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const targetUser = Array.from(room.users.values()).find(u => u.userId === targetUserId);
    if (targetUser) {
      io.to(targetUser.socketId).emit('webrtc-ice-candidate', {
        candidate,
        fromUserId: socket.data.userId
      });
    }
  });

  // Stream durumu
  socket.on('stream-started', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.streamActive = true;
      socket.to(roomId).emit('stream-started');
    }
  });

  socket.on('stream-stopped', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.streamActive = false;
      socket.to(roomId).emit('stream-stopped');
    }
  });

  // Chat mesajları
  socket.on('chat-message', ({ roomId, message, username, userId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const chatMessage = {
      id: Date.now().toString(),
      message,
      username,
      userId,
      timestamp: Date.now()
    };

    room.chatHistory.push(chatMessage);
    // Son 100 mesajı tut
    if (room.chatHistory.length > 100) {
      room.chatHistory = room.chatHistory.slice(-100);
    }

    io.to(roomId).emit('chat-message', chatMessage);
  });

  // Bağlantı kopması
  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    const userId = socket.data.userId;
    const username = socket.data.username;

    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.users.delete(userId);

      // Eğer host ayrıldıysa ve başka kullanıcı varsa, yeni host seç
      if (room.hostId === userId && room.users.size > 0) {
        const newHost = Array.from(room.users.values())[0];
        room.hostId = newHost.userId;
        io.to(roomId).emit('host-changed', { newHostId: newHost.userId });
      }

      // Eğer oda boşaldıysa, odayı temizle
      if (room.users.size === 0) {
        rooms.delete(roomId);
        console.log(`Room ${roomId} deleted (empty)`);
      } else {
        socket.to(roomId).emit('user-left', {
          userId,
          username,
          users: Array.from(room.users.values())
        });
      }
    }

    console.log('User disconnected:', socket.id);
  });

  // Ping/Pong
  socket.on('ping', () => {
    socket.emit('pong');
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 WatchTug Server running on port ${PORT}`);
});

