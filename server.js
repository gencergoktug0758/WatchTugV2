const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const port = process.env.PORT || 3000;

// Oda yönetimi
const rooms = {}; // { roomId: { sockets: Set, userIds: Map<socketId, userId>, timers: Map<socketId, timeout> } }
const GRACE_PERIOD = 30000; // 30 saniye
const MAX_PARTICIPANTS = 2; // Maksimum 2 kişi

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Oda oluştur
io.on('connection', (socket) => {
    console.log(`Yeni bağlantı: ${socket.id}`);

    // Odaya katıl
    socket.on('join-room', ({ roomId, userId }) => {
        try {
            // Oda yoksa oluştur
        if (!rooms[roomId]) {
            rooms[roomId] = {
                    sockets: new Set(),
                    userIds: new Map(),
                    timers: new Map()
                };
            }

            const room = rooms[roomId];

            // Oda dolu mu kontrol et
            if (room.sockets.size >= MAX_PARTICIPANTS) {
                socket.emit('room-full', { roomId });
                console.log(`Oda dolu: ${roomId} (${room.sockets.size}/${MAX_PARTICIPANTS})`);
                return;
            }
            
            // Reconnection kontrolü: Aynı userId ile tekrar bağlanıyorsa
            let isReconnection = false;
            for (const [existingSocketId, existingUserId] of room.userIds.entries()) {
                if (existingUserId === userId && !room.sockets.has(existingSocketId)) {
                    // Eski socket'i temizle
                    room.sockets.delete(existingSocketId);
                    room.userIds.delete(existingSocketId);
                    if (room.timers.has(existingSocketId)) {
                        clearTimeout(room.timers.get(existingSocketId));
                        room.timers.delete(existingSocketId);
                    }
                    isReconnection = true;
                    console.log(`Reconnection: ${userId} tekrar bağlandı (${roomId})`);
                    break;
                }
            }

            // Yeni katılım
            room.sockets.add(socket.id);
            room.userIds.set(socket.id, userId);
            socket.join(roomId);
            
            // Diğer kullanıcılara bildir
            const otherSockets = Array.from(room.sockets).filter(id => id !== socket.id);
            socket.emit('joined-room', { 
                roomId, 
                isReconnection,
                participantCount: room.sockets.size,
                otherParticipants: otherSockets.map(id => ({ socketId: id, userId: room.userIds.get(id) }))
            });

            // Diğer kullanıcılara yeni katılımcıyı bildir
            socket.to(roomId).emit('user-joined', { 
                socketId: socket.id, 
                userId,
                isReconnection 
            });

            console.log(`Kullanıcı odaya katıldı: ${userId} (${socket.id}) - Oda: ${roomId} (${room.sockets.size}/${MAX_PARTICIPANTS})`);
        } catch (error) {
            console.error('Odaya katılma hatası:', error);
            socket.emit('error', { message: 'Odaya katılamadı' });
        }
    });

    // WebRTC Sinyalleşme: Offer
    socket.on('offer', ({ roomId, offer, socketId }) => {
        socket.to(roomId).emit('offer', { offer, socketId: socket.id });
    });

    // WebRTC Sinyalleşme: Answer
    socket.on('answer', ({ roomId, answer, socketId }) => {
        socket.to(roomId).emit('answer', { answer, socketId: socket.id });
    });

    // WebRTC Sinyalleşme: ICE Candidate
    socket.on('ice-candidate', ({ roomId, candidate, socketId }) => {
        socket.to(roomId).emit('ice-candidate', { candidate, socketId: socket.id });
    });

    // Ekran paylaşımı başlatıldı
    socket.on('screen-sharing-started', ({ roomId }) => {
        socket.to(roomId).emit('remote-screen-sharing-started', { socketId: socket.id });
    });

    // Ekran paylaşımı durduruldu
    socket.on('screen-sharing-stopped', ({ roomId }) => {
        socket.to(roomId).emit('remote-screen-sharing-stopped', { socketId: socket.id });
    });

    // Bağlantı kesildi
    socket.on('disconnect', () => {
        console.log(`Bağlantı kesildi: ${socket.id}`);

        // Tüm odalardan kullanıcıyı bul ve grace period başlat
        for (const [roomId, room] of Object.entries(rooms)) {
            if (room.sockets.has(socket.id)) {
                const userId = room.userIds.get(socket.id);
                
                // Grace period başlat
                const timer = setTimeout(() => {
                    // 30 saniye sonra kullanıcıyı tamamen kaldır
                    room.sockets.delete(socket.id);
                    room.userIds.delete(socket.id);
                    room.timers.delete(socket.id);

                    // Diğer kullanıcılara bildir
                    io.to(roomId).emit('user-left', { socketId, userId });

                    // Oda boşsa sil
                    if (room.sockets.size === 0) {
                                delete rooms[roomId];
                        console.log(`Oda silindi: ${roomId}`);
                    } else {
                        console.log(`Kullanıcı odadan kaldırıldı: ${userId} (${socket.id}) - Oda: ${roomId}`);
                    }
                }, GRACE_PERIOD);

                room.timers.set(socket.id, timer);
                socket.leave(roomId);

                // Diğer kullanıcılara geçici ayrılma bildir
                socket.to(roomId).emit('user-disconnected', { socketId, userId, gracePeriod: GRACE_PERIOD });

                console.log(`Grace period başlatıldı: ${userId} (${socket.id}) - Oda: ${roomId}`);
                break;
            }
        }
    });
});

// SPA yönlendirmesi
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(port, '0.0.0.0', () => {
    console.log(`P2P Sinyalleşme sunucusu ${port} portunda çalışıyor`);
});
