const express = require('express');
const path = require('path');
const cors = require('cors');
const { AccessToken } = require('livekit-server-sdk');

const app = express();
const port = process.env.PORT || 3000;

// LiveKit Ayarları (Docker komutundaki ile aynı olmalı)
const LIVEKIT_API_KEY = "api_key";
const LIVEKIT_API_SECRET = "api_secret";
const LIVEKIT_URL = "wss://watchtug.live"; // Nginx ile bunu yönlendireceğiz

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Token Oluşturma Endpoint'i
app.post('/get-token', async (req, res) => {
    const { roomName, participantName } = req.body;

    if (!roomName || !participantName) {
        return res.status(400).json({ error: 'Oda adı ve kullanıcı adı gerekli' });
    }

    try {
        const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
            identity: participantName,
            ttl: '10m', // Token ömrü
        });

        at.addGrant({ 
            roomJoin: true, 
            room: roomName, 
            canPublish: true, 
            canSubscribe: true 
        });

        const token = await at.toJwt();
        res.json({ token });
    } catch (error) {
        console.error('Token hatası:', error);
        res.status(500).json({ error: 'Token oluşturulamadı' });
    }
});

// SPA (Single Page Application) yönlendirmesi
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Token sunucusu ${port} portunda çalışıyor`);
});
