const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const mediasoup = require('mediasoup');
const { v4: uuidv4 } = require('uuid');
const os = require('os');

// Express uygulamasını oluştur
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: false,
    transports: ['polling', 'websocket'],
    upgrade: true
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Konsola renkli loglar
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m%s\x1b[0m',    // Cyan
    success: '\x1b[32m%s\x1b[0m',  // Green
    warning: '\x1b[33m%s\x1b[0m',  // Yellow
    error: '\x1b[31m%s\x1b[0m'     // Red
  };
  
  const timestamp = new Date().toLocaleTimeString();
  console.log(colors[type], `[${timestamp}] ${message}`);
}

// Mediasoup Worker Settings
const WORKER_SETTINGS = {
  logLevel: 'warn',
  logTags: [
    'info',
    'ice',
    'dtls',
    'rtp',
    'srtp',
    'rtcp',
    'rtx',
    'bwe',
    'score',
    'simulcast',
    'svc',
    'sctp'
  ],
  rtcMinPort: 40000,
  rtcMaxPort: 49999
};

// Mediasoup Router Codec Preferences
const ROUTER_CODECS = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000
  },
  {
    kind: 'video',
    mimeType: 'video/VP9',
    clockRate: 90000
  },
  {
    kind: 'video',
    mimeType: 'video/H264',
    clockRate: 90000,
    parameters: {
      'packetization-mode': 1,
      'profile-level-id': '4d0032',
      'level-asymmetry-allowed': 1
    }
  }
];

// Mediasoup Workers pool
let workers = [];
let nextWorkerIndex = 0;

// Oda bilgilerini tutacak nesne - Mediasoup Router ve Producer/Consumer bilgileriyle
const rooms = {};

// Kullanıcı IP'lerini ve bilgilerini tutacak nesne
const userSessions = {};

// Kullanıcı WebRTC Transport bilgilerini tutacak nesne
const peers = {};

// IP ve kullanıcı eşleştirme fonksiyonu
function getUserByIp(ip) {
    return userSessions[ip];
}

// Yerel ağ IP adresini otomatik tespit et
function getLocalNetworkIp() {
    const interfaces = os.networkInterfaces();
    
    // Öncelik sırası: IPv4, loopback olmayan, internet bağlantısı olan
    for (const interfaceName in interfaces) {
        const addresses = interfaces[interfaceName];
        for (const addr of addresses) {
            // IPv4 ve loopback olmayan adresleri tercih et
            if (addr.family === 'IPv4' && !addr.internal) {
                log(`Yerel ağ IP adresi tespit edildi: ${addr.address} (${interfaceName})`, 'success');
                return addr.address;
            }
        }
    }
    
    // Eğer bulunamazsa, loopback olmayan ilk IPv4 adresini al
    for (const interfaceName in interfaces) {
        const addresses = interfaces[interfaceName];
        for (const addr of addresses) {
            if (addr.family === 'IPv4') {
                log(`Yerel ağ IP adresi (fallback): ${addr.address} (${interfaceName})`, 'warning');
                return addr.address;
            }
        }
    }
    
    // Son çare: localhost
    log('Yerel ağ IP adresi bulunamadı, localhost kullanılıyor', 'warning');
    return '127.0.0.1';
}

// Sunucu IP adresi (Production VPS IP)
const SERVER_IP = '2.59.119.179';

// Mediasoup Worker oluştur
async function createWorker() {
    const worker = await mediasoup.createWorker(WORKER_SETTINGS);
    
    worker.on('died', () => {
        log(`Worker ${worker.pid} öldü, yenisini oluşturuyorum...`, 'error');
        
        // Worker'ı listeden kaldır
        const workerIndex = workers.findIndex(w => w.pid === worker.pid);
        if (workerIndex !== -1) {
            workers.splice(workerIndex, 1);
        }
        
        // Yeni worker oluştur
        createWorker().catch(err => {
            log(`Yeni worker oluşturulamadı: ${err.message}`, 'error');
        });
    });
    
    log(`Worker oluşturuldu: ${worker.pid}`, 'success');
    workers.push(worker);
    
    return worker;
}

// Worker pool'unu başlat
async function initializeWorkers() {
    const numWorkers = Math.min(require('os').cpus().length, 4);
    
    log(`${numWorkers} adet Mediasoup Worker oluşturuluyor...`, 'info');
    
    for (let i = 0; i < numWorkers; i++) {
        try {
            await createWorker();
        } catch (error) {
            log(`Worker ${i + 1} oluşturulurken hata: ${error.message}`, 'error');
        }
    }
    
    log(`${workers.length} adet Worker başarıyla oluşturuldu`, 'success');
}

// En uygun Worker'ı seç (round-robin)
function getNextWorker() {
    if (workers.length === 0) {
        throw new Error('Hiç Worker yok!');
    }
    
    const worker = workers[nextWorkerIndex];
    nextWorkerIndex = (nextWorkerIndex + 1) % workers.length;
    
    return worker;
}

// Oda için Router oluştur veya mevcut olanı döndür
async function getOrCreateRouter(roomId) {
    if (rooms[roomId] && rooms[roomId].router) {
        return rooms[roomId].router;
    }
    
    const worker = getNextWorker();
    
    try {
        const router = await worker.createRouter({
            mediaCodecs: ROUTER_CODECS
        });
        
        log(`Router oluşturuldu: ${router.id} (Oda: ${roomId})`, 'success');
        
        if (!rooms[roomId]) {
            rooms[roomId] = {
                creator: null,
                users: [],
                messages: [],
                createdAt: new Date(),
                initialJoins: new Set(),
                router: router,
                producers: new Map(),
                consumers: new Map(),
                sharer: null,
                mediaState: { hasAudio: true, hasVideo: true }
            };
        } else {
            rooms[roomId].router = router;
            rooms[roomId].producers = new Map();
            rooms[roomId].consumers = new Map();
        }
        
        return router;
    } catch (error) {
        log(`Router oluşturulamadı (Oda: ${roomId}): ${error.message}`, 'error');
        throw error;
    }
}

// Debug bilgisi için tüm odaları listele
function logRooms() {
    console.log('Mevcut odalar:', Object.keys(rooms));
    Object.keys(rooms).forEach(room => {
        const roomData = rooms[room];
        console.log(`-- Oda: ${room}, Kullanıcı sayısı: ${roomData.users.length}, Router: ${roomData.router ? roomData.router.id : 'Yok'}`);
    });
}

// Kullanıcı adını doğrula
function validateUsername(username) {
    // Boş veya çok kısa kullanıcı adlarını reddet
    if (!username || typeof username !== 'string' || username.trim().length < 2) {
        return {
            isValid: false,
            message: 'Kullanıcı adı en az 2 karakter olmalıdır'
        };
    }
    
    // Kullanıcı adını temizle
    const sanitizedUsername = username.trim();
    
    // Küfür ve uygunsuz kelime kontrolü
    const blockedWords = [
        'amk', 'aq', 'sg', 'oç', 'piç', 'yavşak', 'amına', 'sikerim', 'sikim', 'amcık', 'amcik',
        'ananısikim', 'ananisikim', 'anan', 'sikeyim', 'sikik', 'amq', 'amcık', 'amcik', 'amına koyayım',
        'amina koyayim', 'amına koyim', 'amina koyim', 'mk', 'aq', 'sg', 'oc', 'pic', 'yavşak'
    ];
    
    const lowerUsername = sanitizedUsername.toLowerCase();
    for (const word of blockedWords) {
        if (lowerUsername.includes(word)) {
            return {
                isValid: false,
                message: 'Kullanıcı adında uygunsuz kelimeler bulunamaz'
            };
        }
    }
    
    // Maksimum uzunluk kontrolü
    if (sanitizedUsername.length > 20) {
        return {
            isValid: false,
            message: 'Kullanıcı adı en fazla 20 karakter olabilir'
        };
    }
    
    return {
        isValid: true,
        sanitizedValue: sanitizedUsername
    };
}

// WebRTC Transport oluştur (Producer için)
async function createWebRtcTransport(socket, roomId, direction = 'send') {
    try {
        const router = await getOrCreateRouter(roomId);
        
        if (!peers[socket.id]) {
            peers[socket.id] = {
                socketId: socket.id,
                roomId: roomId,
                sendTransport: null,
                recvTransport: null,
                producers: new Map(),
                consumers: new Map()
            };
        }
        
        const transport = await router.createWebRtcTransport({
            listenIps: [
                {
                    ip: '0.0.0.0',
                    // KRİTİK: Production sunucu IP adresi
                    // Client'lara bu IP adresinden bağlanmaları gerektiğini bildirir
                    announcedIp: SERVER_IP
                }
            ],
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
            initialAvailableOutgoingBitrate: 1000000
        });
        
        transport.on('dtlsstatechange', (dtlsState) => {
            if (dtlsState === 'closed') {
                log(`Transport DTLS durumu: ${dtlsState} (Socket: ${socket.id})`, 'warning');
            }
        });
        
        transport.on('close', () => {
            log(`Transport kapatıldı: ${socket.id}`, 'warning');
        });
        
        if (direction === 'send') {
            peers[socket.id].sendTransport = transport;
        } else {
            peers[socket.id].recvTransport = transport;
        }
        
        return {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters
        };
    } catch (error) {
        log(`WebRTC Transport oluşturulamadı: ${error.message}`, 'error');
        throw error;
    }
}

// Socket.io bağlantı işlemleri
io.on('connection', async (socket) => {
    // Kullanıcının IP adresini al
    const clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
    log(`Yeni bağlantı: ${socket.id} from IP: ${clientIp}`, 'info');
    
    // IP'ye göre önceki oturum kontrolü
    const existingSession = getUserByIp(clientIp);
    if (existingSession) {
        log(`Mevcut oturum bulundu: ${existingSession.username}`, 'info');
        socket.username = existingSession.username;
        socket.previousRoom = existingSession.room;
        socket.emit('restore-session', {
            username: existingSession.username,
            room: existingSession.room
        });
    }

    // Kullanıcı adını ayarla
    socket.on('set-username', (username) => {
        try {
            // Kullanıcı adını doğrula
            const validation = validateUsername(username);
            
            if (!validation.isValid) {
                log(`Geçersiz kullanıcı adı: ${username} - ${validation.message}`, 'warning');
                socket.emit('username-error', { message: validation.message });
                return;
            }
            
            const validatedUsername = validation.sanitizedValue;
            log(`Kullanıcı adı ayarlandı: ${socket.id} -> ${validatedUsername}`, 'info');
            socket.username = validatedUsername;
            
            // IP ile kullanıcı bilgilerini eşleştir
            userSessions[clientIp] = {
                socketId: socket.id,
                username: validatedUsername,
                room: socket.room
            };
            
            // Kullanıcıya başarılı doğrulama bilgisi gönder
            socket.emit('username-validated', { username: validatedUsername });
        } catch (error) {
            log(`Kullanıcı adı ayarlama hatası: ${error.message}`, 'error');
            socket.emit('username-error', { message: 'Kullanıcı adı ayarlanırken bir hata oluştu' });
        }
    });
    
    // Check active streams in a room
    socket.on('check-active-streams', (data, callback) => {
        try {
            const roomId = data.roomId;
            
            if (!roomId || !rooms[roomId]) {
                callback({ error: 'Oda bulunamadı' });
                return;
            }
            
            // Return the active sharer in the room if there is one
            if (rooms[roomId].sharer) {
                callback({ 
                    sharer: rooms[roomId].sharer,
                    mediaState: rooms[roomId].mediaState || { hasAudio: true, hasVideo: true }
                });
            } else {
                callback({ sharer: null });
            }
        } catch (error) {
            log(`Aktif yayın kontrolü hatası: ${error.message}`, 'error');
            callback({ error: 'Aktif yayın kontrol edilemedi' });
        }
    });
    
    // Oda oluşturma
    socket.on('create-room', async (roomId) => {
        try {
            // Oda ID'sindeki boşlukları temizle
            let cleanRoomId = roomId.trim();
            
            log(`Oda oluşturma isteği: ${cleanRoomId} (isteyen: ${socket.id})`, 'info');
            
            if (rooms[cleanRoomId]) {
                // Eğer oda var ama silinme zamanlayıcısı varsa iptal et ve odaya katıl
                if (rooms[cleanRoomId].deleteTimer) {
                    cancelRoomDeletion(cleanRoomId);
                    
                    // Kullanıcıyı odaya ekle
                    const username = socket.username || `Misafir-${socket.id.substr(0, 6)}`;
                    const userInfo = { id: socket.id, username };
                    rooms[cleanRoomId].users.push(userInfo);
                    socket.join(cleanRoomId);
                    socket.room = cleanRoomId;
                    
                    // Kullanıcıya bilgi gönder
                    socket.emit('room-joined', { 
                        roomId: cleanRoomId,
                        users: rooms[cleanRoomId].users
                    });
                    
                    log(`Oda silme iptal edildi ve kullanıcı katıldı: ${cleanRoomId}`, 'info');
                    return;
                }
                
                log(`Hata: ${cleanRoomId} odası zaten mevcut`, 'warning');
                socket.emit('room-error', { message: 'Bu oda ID zaten kullanılıyor.' });
                return;
            }
            
            // Odayı oluştur ve Router'ı başlat
            await getOrCreateRouter(cleanRoomId);
            
            rooms[cleanRoomId].creator = socket.id;
            rooms[cleanRoomId].users = [{ id: socket.id, username: socket.username || `Misafir-${socket.id.substr(0, 6)}` }];
            rooms[cleanRoomId].messages = [];
            rooms[cleanRoomId].createdAt = new Date();
            rooms[cleanRoomId].initialJoins = new Set();
            
            socket.join(cleanRoomId);
            socket.room = cleanRoomId;
            
            // Oturum bilgilerini güncelle
            if (userSessions[clientIp]) {
                userSessions[clientIp].room = cleanRoomId;
            }
            
            socket.emit('room-created', { roomId: cleanRoomId });
            log(`Oda başarıyla oluşturuldu: ${cleanRoomId}`, 'success');
            logRooms();
        } catch (error) {
            log(`Oda oluşturma hatası: ${error.message}`, 'error');
            socket.emit('room-error', { message: 'Oda oluşturulurken bir hata oluştu' });
        }
    });
    
    // Odaya katılma
    socket.on('join-room', async (roomId) => {
        try {
            let cleanRoomId = roomId.trim();
            
            // Oturum bilgilerini güncelle
            if (userSessions[clientIp]) {
                userSessions[clientIp].room = cleanRoomId;
            }
            
            log(`Odaya katılma isteği: ${cleanRoomId} (isteyen: ${socket.id})`, 'info');
            
            if (!rooms[cleanRoomId]) {
                log(`Hata: ${cleanRoomId} odası bulunamadı`, 'warning');
                socket.emit('room-error', { message: 'Oda bulunamadı.' });
                return;
            }
            
            // Router'ı oluştur (eğer yoksa)
            await getOrCreateRouter(cleanRoomId);
            
            // Oda silme zamanlayıcısı varsa iptal et
            cancelRoomDeletion(cleanRoomId);
            
            // Kullanıcı zaten bu odada mı?
            const existingUser = rooms[cleanRoomId].users.find(user => 
                user.username === socket.username || user.id === socket.id
            );
            
            if (existingUser) {
                log(`Bilgi: Kullanıcı zaten ${cleanRoomId} odasında - Yeniden bağlanıyor`, 'info');
                
                // Kullanıcının socket ID'sini güncelle
                existingUser.id = socket.id;
                
                // Kullanıcı listesi için sharing bilgisini ekle
                const roomUsers = rooms[cleanRoomId].users.map(user => ({
                    id: user.id,
                    username: user.username,
                    isSharing: user.id === rooms[cleanRoomId].sharer
                }));
                
                socket.join(cleanRoomId);
                socket.room = cleanRoomId;
                
                socket.emit('room-joined', { 
                    roomId: cleanRoomId,
                    users: roomUsers
                });
                
                // Geçmiş mesajları gönder
                if (rooms[cleanRoomId].messages && rooms[cleanRoomId].messages.length > 0) {
                    socket.emit('chat-history', rooms[cleanRoomId].messages);
                }
                
                // Diğer kullanıcılara socket ID güncellemesini bildir
                socket.to(cleanRoomId).emit('user-reconnected', {
                    oldId: existingUser.id,
                    newId: socket.id,
                    username: existingUser.username
                });
                
                return;
            }
            
            // Odada zaten 6 kişi var mı kontrolü
            if (rooms[cleanRoomId].users.length >= 6) {
                log(`Hata: ${cleanRoomId} odası dolu`, 'warning');
                socket.emit('room-error', { message: 'Oda dolu (Maksimum 6 kişi).' });
                return;
            }
            
            // Kullanıcı bilgilerini hazırla
            const username = socket.username || `Misafir-${socket.id.substr(0, 6)}`;
            const userInfo = { id: socket.id, username };
            
            // Kullanıcıyı odaya ekle
            rooms[cleanRoomId].users.push(userInfo);
            socket.join(cleanRoomId);
            socket.room = cleanRoomId;
            
            // Kullanıcı listesi için sharing bilgisini ekle
            const roomUsers = rooms[cleanRoomId].users.map(user => ({
                id: user.id,
                username: user.username,
                isSharing: user.id === rooms[cleanRoomId].sharer
            }));
            
            // Kullanıcıya oda bilgilerini gönder
            socket.emit('room-joined', { 
                roomId: cleanRoomId,
                users: roomUsers,
                currentSharer: rooms[cleanRoomId].sharer || null
            });
            
            // Geçmiş mesajları gönder
            if (rooms[cleanRoomId].messages && rooms[cleanRoomId].messages.length > 0) {
                socket.emit('chat-history', rooms[cleanRoomId].messages);
            }
            
            log(`Kullanıcı odaya katıldı: ${socket.id} -> ${cleanRoomId}`, 'success');
            
            // İlk kez katılım kontrolü
            const isFirstJoin = !rooms[cleanRoomId].initialJoins.has(socket.id);
            if (isFirstJoin) {
                rooms[cleanRoomId].initialJoins.add(socket.id);
                
                // Odadaki kullanıcılara katılım mesajı gönder
                const systemMessage = {
                    id: Date.now(),
                    user: 'Sistem',
                    message: `${username} odaya katıldı`,
                    timestamp: new Date(),
                    isSystem: true
                };
                
                io.to(cleanRoomId).emit('chat-message', systemMessage);
                
                // Kullanıcı katılım mesajını mesaj geçmişine ekle
                if (rooms[cleanRoomId]) {
                    rooms[cleanRoomId].messages.push(systemMessage);
                    
                    // Odadaki diğer kullanıcılara yeni kullanıcı bilgisini gönder
                    socket.to(cleanRoomId).emit('user-joined', {...userInfo, isSharing: false});
                    
                    // Eğer odada aktif bir ekran paylaşımı varsa, kullanıcıya bildir
                    if (rooms[cleanRoomId].sharer) {
                        socket.emit('user-sharing', { userId: rooms[cleanRoomId].sharer });
                    }
                }
            }
            
            logRooms();
        } catch (error) {
            log(`Odaya katılma hatası: ${error.message}`, 'error');
            socket.emit('room-error', { message: 'Odaya katılırken bir hata oluştu' });
        }
    });

    // Mediasoup: Connect WebRTC Transport
    socket.on('connect-transport', async (data, callback) => {
        try {
            const { transportId, dtlsParameters } = data;
            const peer = peers[socket.id];
            
            if (!peer) {
                callback({ error: 'Peer bulunamadı' });
                return;
            }
            
            const transport = peer.sendTransport?.id === transportId 
                ? peer.sendTransport 
                : peer.recvTransport;
            
            if (!transport) {
                callback({ error: 'Transport bulunamadı' });
                return;
            }
            
            await transport.connect({ dtlsParameters });
            
            log(`Transport bağlandı: ${transportId} (Socket: ${socket.id})`, 'success');
            callback({ success: true });
        } catch (error) {
            log(`Transport bağlantı hatası: ${error.message}`, 'error');
            callback({ error: error.message });
        }
    });

    // Mediasoup: Create Producer Transport
    socket.on('create-producer-transport', async (data, callback) => {
        try {
            const { roomId } = data;
            
            if (!roomId || !rooms[roomId]) {
                callback({ error: 'Oda bulunamadı' });
                return;
            }
            
            const transportParams = await createWebRtcTransport(socket, roomId, 'send');
            
            log(`Producer transport oluşturuldu: ${transportParams.id} (Socket: ${socket.id})`, 'success');
            callback({ transportParams });
        } catch (error) {
            log(`Producer transport oluşturma hatası: ${error.message}`, 'error');
            callback({ error: error.message });
        }
    });

    // Mediasoup: Create Consumer Transport
    socket.on('create-consumer-transport', async (data, callback) => {
        try {
            const { roomId } = data;
            
            if (!roomId || !rooms[roomId]) {
                callback({ error: 'Oda bulunamadı' });
                return;
            }
            
            const transportParams = await createWebRtcTransport(socket, roomId, 'recv');
            
            log(`Consumer transport oluşturuldu: ${transportParams.id} (Socket: ${socket.id})`, 'success');
            callback({ transportParams });
        } catch (error) {
            log(`Consumer transport oluşturma hatası: ${error.message}`, 'error');
            callback({ error: error.message });
        }
    });

    // Mediasoup: Produce (Ekran paylaşımı başlat)
    socket.on('produce', async (data, callback) => {
        try {
            const { roomId, kind, rtpParameters } = data;
            
            if (!roomId || !rooms[roomId]) {
                callback({ error: 'Oda bulunamadı' });
                return;
            }
            
            const peer = peers[socket.id];
            if (!peer || !peer.sendTransport) {
                callback({ error: 'Send transport bulunamadı' });
                return;
            }
            
            const producer = await peer.sendTransport.produce({
                kind,
                rtpParameters,
                appData: {
                    socketId: socket.id,
                    roomId: roomId
                }
            });
            
            peer.producers.set(producer.id, producer);
            rooms[roomId].producers.set(producer.id, producer);
            
            // İlk producer ise (ekran paylaşımı başladı)
            if (rooms[roomId].producers.size === 1) {
                rooms[roomId].sharer = socket.id;
            }
            
            log(`Producer oluşturuldu: ${producer.id} (Kind: ${kind}, Socket: ${socket.id})`, 'success');
            
            // Diğer kullanıcılara bildir
            socket.to(roomId).emit('user-sharing', { 
                userId: socket.id,
                hasAudio: kind === 'audio' || rooms[roomId].producers.has(producer.id),
                hasVideo: kind === 'video' || rooms[roomId].producers.has(producer.id)
            });
            
            callback({ producerId: producer.id });
        } catch (error) {
            log(`Producer oluşturma hatası: ${error.message}`, 'error');
            callback({ error: error.message });
        }
    });

    // Mediasoup: Consume (Ekran paylaşımını izle)
    socket.on('consume', async (data, callback) => {
        try {
            const { roomId, producerId, rtpCapabilities } = data;
            
            if (!roomId || !rooms[roomId]) {
                callback({ error: 'Oda bulunamadı' });
                return;
            }
            
            const peer = peers[socket.id];
            if (!peer || !peer.recvTransport) {
                callback({ error: 'Recv transport bulunamadı' });
                return;
            }
            
            const router = rooms[roomId].router;
            if (!router) {
                callback({ error: 'Router bulunamadı' });
                return;
            }
            
            // RTP Capabilities kontrolü
            if (!router.canConsume({ producerId, rtpCapabilities })) {
                callback({ error: 'RTP Capabilities uyumsuz' });
                return;
            }
            
            const producer = rooms[roomId].producers.get(producerId);
            if (!producer) {
                callback({ error: 'Producer bulunamadı' });
                return;
            }
            
            const consumer = await peer.recvTransport.consume({
                producerId,
                rtpCapabilities,
                paused: false
            });
            
            peer.consumers.set(consumer.id, consumer);
            rooms[roomId].consumers.set(consumer.id, consumer);
            
            log(`Consumer oluşturuldu: ${consumer.id} (Producer: ${producerId}, Socket: ${socket.id})`, 'success');
            
            callback({
                consumerId: consumer.id,
                producerId: producer.id,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters
            });
        } catch (error) {
            log(`Consumer oluşturma hatası: ${error.message}`, 'error');
            callback({ error: error.message });
        }
    });

    // Mediasoup: Consumer Resume
    socket.on('consumer-resume', async (data, callback) => {
        try {
            const { consumerId } = data;
            const peer = peers[socket.id];
            
            if (!peer) {
                callback({ error: 'Peer bulunamadı' });
                return;
            }
            
            const consumer = peer.consumers.get(consumerId);
            if (!consumer) {
                callback({ error: 'Consumer bulunamadı' });
                return;
            }
            
            await consumer.resume();
            
            log(`Consumer resume edildi: ${consumerId}`, 'success');
            callback({ success: true });
        } catch (error) {
            log(`Consumer resume hatası: ${error.message}`, 'error');
            callback({ error: error.message });
        }
    });

    // Mediasoup: Get Router RTP Capabilities
    socket.on('get-router-rtp-capabilities', async (data, callback) => {
        try {
            const { roomId } = data;
            
            if (!roomId || !rooms[roomId]) {
                callback({ error: 'Oda bulunamadı' });
                return;
            }
            
            const router = await getOrCreateRouter(roomId);
            const rtpCapabilities = router.rtpCapabilities;
            
            callback({ rtpCapabilities });
        } catch (error) {
            log(`Router RTP Capabilities hatası: ${error.message}`, 'error');
            callback({ error: error.message });
        }
    });

    // Mediasoup: Get Producer List (for consumers)
    socket.on('get-producers', async (data, callback) => {
        try {
            const { roomId } = data;
            
            if (!roomId || !rooms[roomId]) {
                callback({ error: 'Oda bulunamadı' });
                return;
            }
            
            const producerList = [];
            rooms[roomId].producers.forEach((producer, producerId) => {
                producerList.push({
                    producerId: producerId,
                    kind: producer.kind,
                    socketId: producer.appData?.socketId || null
                });
            });
            
            callback({ producers: producerList });
        } catch (error) {
            log(`Producer listesi hatası: ${error.message}`, 'error');
            callback({ error: error.message });
        }
    });

    // Ekran paylaşımını durdur
    socket.on('stop-sharing', (roomId) => {
        try {
            if (!roomId || !rooms[roomId]) {
                log(`Ekran paylaşımı durdurma için geçerli bir oda ID'si belirtilmedi`, 'warning');
                return;
            }
            
            log(`Ekran paylaşımı durduruldu: ${socket.id} (Oda: ${roomId})`, 'info');
            
            // Producer'ları kapat
            const peer = peers[socket.id];
            if (peer) {
                peer.producers.forEach(producer => {
                    producer.close();
                    rooms[roomId].producers.delete(producer.id);
                });
                peer.producers.clear();
            }
            
            // Ekran paylaşımı yapan kullanıcıyı temizle
            if (rooms[roomId].sharer === socket.id) {
                rooms[roomId].sharer = null;
            }
            
            // Diğer kullanıcılara bildirim gönder
            socket.to(roomId).emit('user-stopped-sharing', { userId: socket.id });
        } catch (error) {
            log(`Ekran paylaşımı durdurma hatası: ${error.message}`, 'error');
        }
    });
    
    // Chat mesajları
    socket.on('chat-message', (data) => {
        try {
            const username = socket.username || `Misafir-${socket.id.substr(0, 6)}`;
            
            // Mesaj nesnesini oluştur
            const messageObj = {
                id: Date.now(),
                user: username,
                message: data.message,
                timestamp: new Date(),
                isSystem: false
            };
            
            // Mesajı diğer kullanıcılara gönder
            socket.broadcast.to(data.roomId).emit('chat-message', messageObj);
            
            // Mesajı odanın mesaj geçmişine ekle
            if (rooms[data.roomId]) {
                rooms[data.roomId].messages = rooms[data.roomId].messages || [];
                rooms[data.roomId].messages.push(messageObj);
                
                // Mesaj geçmişini belirli bir sayıda tutmak için
                const MAX_MESSAGES = 100;
                if (rooms[data.roomId].messages.length > MAX_MESSAGES) {
                    rooms[data.roomId].messages = rooms[data.roomId].messages.slice(-MAX_MESSAGES);
                }
            }
            
            log(`Chat mesajı: ${username} -> "${data.message}" (Oda: ${data.roomId})`, 'info');
        } catch (error) {
            log(`Chat mesajı gönderme hatası: ${error.message}`, 'error');
        }
    });
    
    // Bağlantı kesildiğinde
    socket.on('disconnect', () => {
        log(`Kullanıcı ayrıldı: ${socket.id}`, 'info');
        
        try {
            // Peer'ı temizle
            const peer = peers[socket.id];
            if (peer) {
                // Tüm Producer'ları kapat
                peer.producers.forEach(producer => {
                    producer.close();
                    if (rooms[peer.roomId] && rooms[peer.roomId].producers) {
                        rooms[peer.roomId].producers.delete(producer.id);
                    }
                });
                
                // Tüm Consumer'ları kapat
                peer.consumers.forEach(consumer => {
                    consumer.close();
                    if (rooms[peer.roomId] && rooms[peer.roomId].consumers) {
                        rooms[peer.roomId].consumers.delete(consumer.id);
                    }
                });
                
                // Transport'ları kapat
                if (peer.sendTransport) {
                    peer.sendTransport.close();
                }
                if (peer.recvTransport) {
                    peer.recvTransport.close();
                }
                
                // Sharer durumunu güncelle
                if (rooms[peer.roomId] && rooms[peer.roomId].sharer === socket.id) {
                    rooms[peer.roomId].sharer = null;
                }
                
                delete peers[socket.id];
            }
            
            // Oturumu hemen silme, yenileme durumu olabilir
            setTimeout(() => {
                const isReconnected = Array.from(io.sockets.sockets.values())
                    .some(s => s.handshake.headers['x-forwarded-for'] === clientIp);
                
                if (!isReconnected) {
                    delete userSessions[clientIp];
                    log(`Oturum silindi: ${clientIp}`, 'info');
                }
            }, 5000);
            
            // Kullanıcının olduğu odaları temizle
            for (const roomId in rooms) {
                const userIndex = rooms[roomId].users.findIndex(user => user.id === socket.id);
                if (userIndex !== -1) {
                    const username = rooms[roomId].users[userIndex].username;
                    
                    // Kullanıcıyı odadan çıkar
                    rooms[roomId].users.splice(userIndex, 1);
                    
                    // Odada başka kullanıcı kalmadıysa odayı hemen silme - 30 saniye bekle
                    if (rooms[roomId].users.length === 0) {
                        log(`Boş oda için silme zamanlayıcısı başlatılıyor: ${roomId}`, 'info');
                        
                        rooms[roomId].deleteTimer = setTimeout(() => {
                            if (rooms[roomId] && rooms[roomId].users.length === 0) {
                                // Router'ı kapat
                                if (rooms[roomId].router) {
                                    rooms[roomId].router.close();
                                }
                                delete rooms[roomId];
                                log(`Oda silindi (zamanlayıcı): ${roomId}`, 'info');
                                logRooms();
                            } else if (rooms[roomId]) {
                                log(`Oda silinmedi, kullanıcı var: ${roomId}`, 'info');
                            }
                        }, 30000);
                    } else {
                        // Kullanıcı ayrıldı sistem mesajı
                        const systemMessage = {
                            id: Date.now(),
                            user: 'Sistem',
                            message: `${username} odadan ayrıldı`,
                            timestamp: new Date(),
                            isSystem: true
                        };
                        
                        io.to(roomId).emit('chat-message', systemMessage);
                        
                        if (rooms[roomId]) {
                            rooms[roomId].messages = rooms[roomId].messages || [];
                            rooms[roomId].messages.push(systemMessage);
                        }
                        
                        io.to(roomId).emit('user-disconnected', socket.id);
                    }
                }
            }
            
            logRooms();
        } catch (error) {
            log(`Disconnect işlemi hatası: ${error.message}`, 'error');
        }
    });
});

// Yeni bir katılımda, varsa odanın silme zamanlayıcısını iptal et
function cancelRoomDeletion(roomId) {
    if (rooms[roomId] && rooms[roomId].deleteTimer) {
        log(`Oda silme zamanlayıcısı iptal edildi: ${roomId}`, 'info');
        clearTimeout(rooms[roomId].deleteTimer);
        delete rooms[roomId].deleteTimer;
    }
}

// Otomatik oda temizleme (24 saat boyunca kullanılmayan odaları temizle)
setInterval(() => {
    try {
        const now = new Date();
        let cleaned = 0;
        
        for (const roomId in rooms) {
            let lastActivity = rooms[roomId].createdAt;
            
            if (rooms[roomId].messages.length > 0) {
                const lastMessage = rooms[roomId].messages[rooms[roomId].messages.length - 1];
                if (lastMessage.timestamp > lastActivity) {
                    lastActivity = lastMessage.timestamp;
                }
            }
            
            const hoursDiff = Math.abs(now - lastActivity) / 36e5;
            
            if (hoursDiff > 24) {
                // Router'ı kapat
                if (rooms[roomId].router) {
                    rooms[roomId].router.close();
                }
                delete rooms[roomId];
                cleaned++;
                log(`Eski oda temizlendi: ${roomId} (${hoursDiff.toFixed(1)} saat)`, 'info');
            }
        }
        
        if (cleaned > 0) {
            log(`${cleaned} adet boş oda temizlendi.`, 'success');
            logRooms();
        }
    } catch (error) {
        log(`Oda temizleme hatası: ${error.message}`, 'error');
    }
}, 3600000);

// Hataları Dinleme
app.on('error', (error) => {
    log(`HTTP Server Hatası: ${error.message}`, 'error');
});

server.on('error', (error) => {
    log(`Server Hatası: ${error.message}`, 'error');
});

// Sunucuyu başlat
const PORT = process.env.PORT || 3000;

// Worker'ları başlat ve sunucuyu başlat
async function startServer() {
    try {
        // Worker'ları başlat
        await initializeWorkers();
        
        // Sunucuyu başlat (0.0.0.0 = tüm ağ arayüzlerini dinle)
        server.listen(PORT, '0.0.0.0', () => {
            log(`WTUG sunucusu ${PORT} portunda çalışıyor`, 'success');
            log(`Sunucu tüm ağ arayüzlerinde dinleniyor (0.0.0.0:${PORT})`, 'success');
            log(`Yerel erişim: http://localhost:${PORT}`, 'info');
            log(`Dış erişim: http://${SERVER_IP}:${PORT}`, 'info');
        });
    } catch (error) {
        log(`Sunucu başlatma hatası: ${error.message}`, 'error');
        process.exit(1);
    }
}

startServer();
