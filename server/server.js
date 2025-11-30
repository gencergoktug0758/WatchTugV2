import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL 
      ? process.env.CLIENT_URL.split(',')
      : [
          "http://localhost:5173",
          "http://127.0.0.1:5173",
          "https://watchtug.live",
          "https://www.watchtug.live"
        ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors({
  origin: process.env.CLIENT_URL 
    ? process.env.CLIENT_URL.split(',')
    : [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://watchtug.live",
        "https://www.watchtug.live"
      ],
  methods: ["GET", "POST"],
  credentials: true
}));
app.use(express.json());

// Oda yönetimi - Genişletilmiş yapı
const rooms = new Map(); 
// roomId -> { 
//   hostId, 
//   users: Map, 
//   streamActive: boolean, 
//   chatHistory: [],
//   password: string | null,
//   moderators: Set,
//   reactions: Map (messageId -> { emoji: count, users: [] })
// }

// Global stats
let totalRoomsCreated = 0;
let totalUsersJoined = 0;

// Tüm client'lara güncel stats ve popüler odaları broadcast et
function broadcastStats() {
  let totalActiveUsers = 0;
  const activeRoomsList = [];
  
  for (const [roomId, room] of rooms.entries()) {
    if (room.users.size > 0) {
      totalActiveUsers += room.users.size;
      activeRoomsList.push([roomId, room]);
    }
  }
  
  const stats = {
    totalRooms: activeRoomsList.length,
    totalActiveUsers
  };
  
  // Stats'ı broadcast et
  io.emit('stats-update', stats);
  
  // Popüler odaları da broadcast et (şifresiz ve aktif olanlar)
  const popularRooms = activeRoomsList
    .filter(([_, room]) => !room.password)
    .map(([roomId, room]) => ({
      roomId,
      userCount: room.users.size,
      hasStream: room.streamActive,
      hostName: Array.from(room.users.values()).find(u => u.userId === room.hostId)?.username || 'Unknown'
    }))
    .sort((a, b) => b.userCount - a.userCount)
    .slice(0, 10);
  
  io.emit('popular-rooms', { rooms: popularRooms, stats });
  
  console.log(`[BROADCAST] Active rooms: ${activeRoomsList.length}, Active users: ${totalActiveUsers}`);
}

// Periyodik temizlik - boş odaları ve hayalet kullanıcıları temizle
setInterval(() => {
  let cleanedRooms = 0;
  let cleanedUsers = 0;
  
  for (const [roomId, room] of rooms.entries()) {
    // Boş odaları sil
    if (room.users.size === 0) {
      rooms.delete(roomId);
      cleanedRooms++;
      continue;
    }
    
    // Geçersiz socketId'li kullanıcıları temizle
    for (const [oderId, user] of room.users.entries()) {
      const socket = io.sockets.sockets.get(user.socketId);
      if (!socket || !socket.connected) {
        room.users.delete(oderId);
        room.moderators.delete(oderId);
        cleanedUsers++;
      }
    }
    
    // Temizlik sonrası oda boşaldıysa sil
    if (room.users.size === 0) {
      rooms.delete(roomId);
      cleanedRooms++;
    }
  }
  
  if (cleanedRooms > 0 || cleanedUsers > 0) {
    console.log(`[CLEANUP] Removed ${cleanedRooms} empty rooms, ${cleanedUsers} ghost users`);
  }
}, 30000); // Her 30 saniyede bir (debug için uzatıldı)

// REST API - Popüler odalar
app.get('/api/popular-rooms', (req, res) => {
  let totalActiveUsers = 0;
  const activeRoomsList = [];
  
  for (const [roomId, room] of rooms.entries()) {
    if (room.users.size > 0) {
      totalActiveUsers += room.users.size;
      activeRoomsList.push([roomId, room]);
    }
  }
  
  const popularRooms = activeRoomsList
    .filter(([_, room]) => !room.password)
    .map(([roomId, room]) => ({
      roomId,
      userCount: room.users.size,
      hasStream: room.streamActive,
      hostName: Array.from(room.users.values()).find(u => u.userId === room.hostId)?.username || 'Unknown'
    }))
    .sort((a, b) => b.userCount - a.userCount)
    .slice(0, 10);

  res.json({ 
    rooms: popularRooms,
    stats: {
      totalRooms: activeRoomsList.length,
      totalActiveUsers: totalActiveUsers,
      totalRoomsCreated,
      totalUsersJoined
    }
  });
});

// REST API - Oda bilgisi (şifre var mı kontrol)
app.get('/api/room/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  
  if (!room) {
    return res.json({ exists: false });
  }

  res.json({
    exists: true,
    hasPassword: !!room.password,
    userCount: room.users.size,
    hasStream: room.streamActive
  });
});

// REST API - Odadan ayrılma (sendBeacon için)
app.post('/api/leave', express.json(), (req, res) => {
  const { roomId, userId, username } = req.body;
  
  if (!roomId || !userId) {
    return res.status(400).json({ error: 'Missing roomId or userId' });
  }
  
  const room = rooms.get(roomId);
  if (!room) {
    return res.json({ success: true, message: 'Room not found' });
  }
  
  if (room.users.has(userId)) {
    room.users.delete(userId);
    room.moderators.delete(userId);
    
    // Host ayrıldıysa yeni host seç
    if (room.hostId === userId && room.users.size > 0) {
      const newHost = Array.from(room.users.values())[0];
      room.hostId = newHost.userId;
      room.moderators.add(newHost.userId);
      io.to(roomId).emit('host-changed', { 
        newHostId: newHost.userId,
        moderators: Array.from(room.moderators)
      });
    }
    
    // Oda boşaldıysa sil
    if (room.users.size === 0) {
      rooms.delete(roomId);
      console.log(`[API] Room ${roomId} deleted (empty)`);
    } else {
      io.to(roomId).emit('user-left', {
        userId,
        username: username || 'Unknown',
        users: Array.from(room.users.values())
      });
    }
    
    console.log(`[API] User ${username} left room ${roomId}`);
    broadcastStats();
  }
  
  res.json({ success: true });
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Popüler odaları getir (socket üzerinden de)
  socket.on('get-popular-rooms', () => {
    // Önce tüm odaları ve kullanıcıları say
    let totalActiveUsers = 0;
    const activeRoomsList = [];
    
    for (const [roomId, room] of rooms.entries()) {
      if (room.users.size > 0) {
        totalActiveUsers += room.users.size;
        activeRoomsList.push([roomId, room]);
      }
    }
    
    // Şifresiz ve aktif odalar (popüler odalar listesi için)
    const popularRooms = activeRoomsList
      .filter(([_, room]) => !room.password)
      .map(([roomId, room]) => ({
        roomId,
        userCount: room.users.size,
        hasStream: room.streamActive,
        hostName: Array.from(room.users.values()).find(u => u.userId === room.hostId)?.username || 'Unknown'
      }))
      .sort((a, b) => b.userCount - a.userCount)
      .slice(0, 10);

    const stats = {
      totalRooms: activeRoomsList.length,
      totalActiveUsers: totalActiveUsers,
      totalRoomsCreated,
      totalUsersJoined
    };

    console.log(`[STATS] Rooms: ${stats.totalRooms}, Users: ${stats.totalActiveUsers}, Popular: ${popularRooms.length}`);

    socket.emit('popular-rooms', { rooms: popularRooms, stats });
  });

  // Oda oluştur (şifreli olabilir)
  socket.on('create-room', ({ roomId, username, userId, password }) => {
    if (rooms.has(roomId)) {
      const existingRoom = rooms.get(roomId);
      if (existingRoom.users.size > 0) {
        socket.emit('room-already-exists', { roomId, hasPassword: !!existingRoom.password });
        return;
      }
    }

    totalRoomsCreated++;
    totalUsersJoined++;

    rooms.set(roomId, {
      hostId: userId,
      users: new Map(),
      streamActive: false,
      chatHistory: [],
      password: password || null,
      moderators: new Set([userId]), // Host otomatik moderatör
      reactions: new Map()
    });
    
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

    socket.emit('room-created', {
      roomId,
      isHost: true,
      isModerator: true,
      users: Array.from(room.users.values()),
      chatHistory: room.chatHistory,
      hasPassword: !!password,
      moderators: Array.from(room.moderators)
    });

    console.log(`User ${username} created room ${roomId}${password ? ' (password protected)' : ''}`);
    broadcastStats();
  });

  // Odaya katıl
  socket.on('join-room', ({ roomId, username, userId, password }) => {
    const roomExists = rooms.has(roomId);
    console.log(`[JOIN-ROOM] User ${username} (${userId}) joining room ${roomId}`);
    console.log(`[JOIN-ROOM] Room exists: ${roomExists}, Total rooms: ${rooms.size}`);
    
    if (roomExists) {
      const existingRoom = rooms.get(roomId);
      console.log(`[JOIN-ROOM] Existing room has ${existingRoom.users.size} users, host: ${existingRoom.hostId}`);
    }
    
    // Oda yoksa oluştur
    if (!roomExists) {
      totalRoomsCreated++;
      rooms.set(roomId, {
        hostId: userId,
        users: new Map(),
        streamActive: false,
        chatHistory: [],
        password: null,
        moderators: new Set([userId]),
        reactions: new Map()
      });
      console.log(`[JOIN-ROOM] Room ${roomId} CREATED for ${username} (first user = HOST)`);
    }

    const room = rooms.get(roomId);
    
    // Şifre kontrolü
    if (room.password && room.password !== password) {
      socket.emit('password-required', { roomId });
      return;
    }

    const wasExistingUser = room.users.has(userId);
    
    if (!wasExistingUser) {
      totalUsersJoined++;
    }

    if (wasExistingUser) {
      const existingUser = room.users.get(userId);
      existingUser.socketId = socket.id;
    } else {
      room.users.set(userId, {
        socketId: socket.id,
        username,
        userId,
        joinedAt: Date.now()
      });
    }

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.userId = userId;
    socket.data.username = username;

    const isHost = userId === room.hostId;
    const isModerator = room.moderators.has(userId);

    console.log(`[JOIN-ROOM] Sending room-joined to ${username}: isHost=${isHost}, users=${room.users.size}, hostId=${room.hostId}`);

    socket.emit('room-joined', {
      roomId,
      isHost,
      isModerator,
      users: Array.from(room.users.values()),
      chatHistory: room.chatHistory,
      streamActive: room.streamActive,
      hasPassword: !!room.password,
      moderators: Array.from(room.moderators)
    });

    if (!wasExistingUser && room.users.size > 1) {
      socket.to(roomId).emit('user-joined', {
        userId,
        username,
        users: Array.from(room.users.values())
      });
    }

    // Stream aktifse host'a bildir
    if (room.streamActive && room.hostId !== userId) {
      const hostUser = Array.from(room.users.values()).find(u => u.userId === room.hostId);
      if (hostUser) {
        setTimeout(() => {
          io.to(hostUser.socketId).emit('new-viewer-joined', {
            viewerUserId: userId,
            viewerUsername: username
          });
        }, 100);
      }
    }

    console.log(`User ${username} joined room ${roomId}`);
    broadcastStats();
  });

  // Manuel odadan ayrılma (browser geri butonu, sayfa değişikliği vs.)
  socket.on('leave-room', ({ roomId, userId, username }) => {
    console.log(`[LEAVE-ROOM] User ${username} (${userId}) leaving room ${roomId}`);
    
    const room = rooms.get(roomId);
    if (!room) {
      console.log(`[LEAVE-ROOM] Room ${roomId} not found, nothing to do`);
      return;
    }
    
    console.log(`[LEAVE-ROOM] Room ${roomId} has ${room.users.size} users before removal`);

    // Socket'i odadan çıkar
    socket.leave(roomId);
    
    // Kullanıcıyı odadan sil
    if (room.users.has(userId)) {
      room.users.delete(userId);
      room.moderators.delete(userId);

      // Host ayrıldıysa yeni host seç
      if (room.hostId === userId && room.users.size > 0) {
        const newHost = Array.from(room.users.values())[0];
        room.hostId = newHost.userId;
        room.moderators.add(newHost.userId);
        io.to(roomId).emit('host-changed', { 
          newHostId: newHost.userId,
          moderators: Array.from(room.moderators)
        });
        console.log(`Host changed to ${newHost.userId} in room ${roomId}`);
      }

      // Oda boşaldıysa sil
      if (room.users.size === 0) {
        rooms.delete(roomId);
        console.log(`Room ${roomId} deleted (empty)`);
      } else {
        // Diğer kullanıcılara bildir
        io.to(roomId).emit('user-left', {
          userId,
          username: username || 'Unknown',
          users: Array.from(room.users.values())
        });
        console.log(`User ${username} left room ${roomId}`);
      }
    }

    // Socket data temizle
    socket.data.roomId = null;
    socket.data.userId = null;
    socket.data.username = null;
    
    broadcastStats();
  });

  // Şifre doğrulama
  socket.on('verify-password', ({ roomId, password }) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('password-result', { success: false, error: 'Room not found' });
      return;
    }

    if (room.password === password) {
      socket.emit('password-result', { success: true });
    } else {
      socket.emit('password-result', { success: false, error: 'Wrong password' });
    }
  });

  // Moderatör ekle/çıkar
  socket.on('toggle-moderator', ({ roomId, targetUserId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    // Sadece host moderatör atayabilir
    if (socket.data.userId !== room.hostId) {
      socket.emit('error', { message: 'Only host can manage moderators' });
      return;
    }

    if (room.moderators.has(targetUserId)) {
      room.moderators.delete(targetUserId);
    } else {
      room.moderators.add(targetUserId);
    }

    io.to(roomId).emit('moderators-updated', {
      moderators: Array.from(room.moderators)
    });
  });

  // Chat mesajları (yanıt desteği ile)
  socket.on('chat-message', ({ roomId, message, username, userId, replyTo }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const chatMessage = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      message,
      username,
      userId,
      timestamp: Date.now(),
      replyTo: replyTo || null, // { id, username, message }
      reactions: {}
    };

    room.chatHistory.push(chatMessage);
    if (room.chatHistory.length > 100) {
      room.chatHistory = room.chatHistory.slice(-100);
    }

    io.to(roomId).emit('chat-message', chatMessage);
  });

  // Mesaja tepki ekle/çıkar
  socket.on('toggle-reaction', ({ roomId, messageId, emoji, userId, username }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const message = room.chatHistory.find(m => m.id === messageId);
    if (!message) return;

    if (!message.reactions) {
      message.reactions = {};
    }

    if (!message.reactions[emoji]) {
      message.reactions[emoji] = [];
    }

    const userIndex = message.reactions[emoji].findIndex(u => u.userId === userId);
    if (userIndex > -1) {
      // Kaldır
      message.reactions[emoji].splice(userIndex, 1);
      if (message.reactions[emoji].length === 0) {
        delete message.reactions[emoji];
      }
    } else {
      // Ekle
      message.reactions[emoji].push({ userId, username });
    }

    io.to(roomId).emit('reaction-updated', {
      messageId,
      reactions: message.reactions
    });
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

  // Bağlantı kopması
  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    const userId = socket.data.userId;
    const username = socket.data.username;

    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      
      if (room.users.has(userId)) {
        room.users.delete(userId);
        room.moderators.delete(userId);

        if (room.hostId === userId && room.users.size > 0) {
          const newHost = Array.from(room.users.values())[0];
          room.hostId = newHost.userId;
          room.moderators.add(newHost.userId);
          io.to(roomId).emit('host-changed', { 
            newHostId: newHost.userId,
            moderators: Array.from(room.moderators)
          });
        }

        if (room.users.size === 0) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} deleted`);
        } else {
          io.to(roomId).emit('user-left', {
            userId,
            username: username || 'Unknown',
            users: Array.from(room.users.values())
          });
        }
      }
    }

    console.log('User disconnected:', socket.id);
    broadcastStats();
  });

  socket.on('ping', () => {
    socket.emit('pong');
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 WatchTug Server running on port ${PORT}`);
});
