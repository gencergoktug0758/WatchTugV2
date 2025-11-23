# WatchTug 🎬

WebRTC tabanlı, 1-e-1 (P2P) film izleme ve ekran paylaşımı platformu. Kullanıcılar oda kurup, yüksek kalitede ve düşük gecikmeyle ekran paylaşarak birlikte film izleyebilirler.

## ✨ Özellikler

- 🎥 **Ekran Paylaşımı**: Sistem sesi dahil yüksek kaliteli ekran paylaşımı
- 💬 **Gerçek Zamanlı Chat**: Socket.io ile anlık mesajlaşma
- 👥 **Kullanıcı Yönetimi**: Online kullanıcı listesi ve durum takibi
- 🔄 **Yeniden Bağlanma**: Sayfa yenilendiğinde veya bağlantı koptuğunda otomatik yeniden bağlanma
- 📱 **Mobil Uyumlu**: Responsive tasarım, mobil ve masaüstü desteği
- 🌙 **Karanlık Tema**: Modern, Netflix benzeri karanlık arayüz
- ⚡ **Düşük Gecikme**: WebRTC ile P2P bağlantı, minimum gecikme
- 🔔 **Bildirimler**: Kullanıcı giriş/çıkış ve yayın durumu bildirimleri

## 🛠️ Teknoloji Yığını

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **Zustand** - State management
- **Socket.io Client** - Real-time communication

### Backend
- **Node.js** - Runtime
- **Express** - Web server
- **Socket.io** - WebSocket server
- **CORS** - Cross-origin resource sharing

### WebRTC
- **Native WebRTC API** - P2P connections
- **STUN Servers** - NAT traversal (Google & Twilio)

## 📦 Kurulum

### Gereksinimler
- Node.js 18+ 
- npm veya yarn

### Adımlar

1. **Repository'yi klonlayın**
```bash
git clone <repository-url>
cd WatchTug-main
```

2. **Backend'i kurun ve çalıştırın**
```bash
cd server
npm install
npm start
```

Backend varsayılan olarak `http://localhost:3000` portunda çalışacaktır.

3. **Frontend'i kurun ve çalıştırın**
```bash
cd ../client
npm install
npm run dev
```

Frontend varsayılan olarak `http://localhost:5173` portunda çalışacaktır.

4. **Tarayıcıda açın**
```
http://localhost:5173
```

## 🚀 Kullanım

1. **Oda Oluşturma**
   - Kullanıcı adınızı girin
   - "Oda Oluştur" butonuna tıklayın
   - Size verilen Oda ID'sini arkadaşınızla paylaşın

2. **Odaya Katılma**
   - Kullanıcı adınızı girin
   - Oda ID'sini girin
   - "Odaya Katıl" butonuna tıklayın

3. **Ekran Paylaşımı (Host)**
   - Host kullanıcı "Ekran Paylaşımını Başlat" butonuna tıklar
   - Tarayıcı ekran paylaşımı izni ister
   - Sistem sesi dahil paylaşım başlar
   - Diğer kullanıcılar otomatik olarak yayını görür

4. **Chat**
   - Sağ paneldeki chat kutusuna mesaj yazın
   - Enter tuşu ile gönderin
   - Chat geçmişi sayfa yenilendiğinde korunur

## 🔧 Yapılandırma

### Environment Variables

**Backend (.env)**
```env
PORT=3000
CLIENT_URL=http://localhost:5173
```

**Frontend (.env)**
```env
VITE_SERVER_URL=http://localhost:3000
```

### STUN/TURN Sunucuları

Proje Google ve Twilio'nun ücretsiz STUN sunucularını kullanır. Farklı ağlardaki kullanıcılar için TURN sunucusu gerekebilir. TURN sunucusu eklemek için `client/src/components/VideoPlayer.jsx` dosyasındaki `rtcConfig` objesini düzenleyin:

```javascript
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    // TURN sunucusu ekleyin
    {
      urls: 'turn:your-turn-server.com:3478',
      username: 'your-username',
      credential: 'your-password'
    }
  ]
};
```

## 📁 Proje Yapısı

```
WatchTug-main/
├── server/
│   ├── server.js          # Express & Socket.io server
│   └── package.json
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Login.jsx      # Giriş ekranı
│   │   │   ├── Room.jsx       # Ana oda arayüzü
│   │   │   ├── VideoPlayer.jsx # Video player & WebRTC
│   │   │   ├── ChatBox.jsx    # Chat bileşeni
│   │   │   ├── UserList.jsx   # Kullanıcı listesi
│   │   │   └── Toast.jsx      # Bildirimler
│   │   ├── context/
│   │   │   └── SocketContext.jsx # Socket.io context
│   │   ├── store/
│   │   │   └── useStore.js    # Zustand store
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## 🔄 Yeniden Bağlanma Mantığı

WatchTug, kullanıcı deneyimini korumak için gelişmiş bir yeniden bağlanma sistemi içerir:

1. **LocalStorage Persistence**: Kullanıcı bilgileri, oda ID'si ve chat geçmişi localStorage'da saklanır
2. **Otomatik Yeniden Bağlanma**: Sayfa yenilendiğinde veya bağlantı koptuğunda otomatik olarak odaya yeniden bağlanır
3. **Socket ID Değişimi**: Socket ID değişse bile kullanıcı kimliği (userId) korunur
4. **Stream Senkronizasyonu**: Yayın durumu ve chat geçmişi otomatik olarak senkronize edilir

## 🐛 Bilinen Sorunlar

- Host kullanıcı sayfayı yenilediğinde yayın durur (beklenen davranış)
- İzleyici kullanıcı sayfayı yenilediğinde yayın devam eder
- Bazı tarayıcılarda sistem sesi paylaşımı sınırlı olabilir

## 🔒 Güvenlik Notları

- Bu proje eğitim amaçlıdır
- Production kullanımı için ek güvenlik önlemleri alınmalıdır
- TURN sunucuları için kimlik doğrulama eklenmelidir
- Rate limiting ve DDoS koruması eklenmelidir

## 📝 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## 🤝 Katkıda Bulunma

Katkılarınızı bekliyoruz! Lütfen pull request göndermeden önce:
1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/AmazingFeature`)
3. Commit edin (`git commit -m 'Add some AmazingFeature'`)
4. Push edin (`git push origin feature/AmazingFeature`)
5. Pull Request açın

## 📧 İletişim

Sorularınız veya önerileriniz için issue açabilirsiniz.

---

**Not**: Bu proje WebRTC teknolojisini kullanır. Farklı ağlardaki kullanıcılar için TURN sunucusu gerekebilir. Ücretsiz TURN sunucuları sınırlıdır, production kullanımı için kendi TURN sunucunuzu kurmanız önerilir.

