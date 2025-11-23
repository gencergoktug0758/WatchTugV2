// DOM Elementleri
const screenDisplay = document.getElementById('screenDisplay');
const roomIdDisplay = document.getElementById('roomIdDisplay');
const waitingScreen = document.getElementById('waitingScreen');
const sharingControls = document.getElementById('sharingControls');
const stopSharingBtn = document.getElementById('stopSharingBtn');
const shareScreenBtn = document.getElementById('shareScreenBtn');
const userListContainer = document.getElementById('usersContainer');

// Değişkenler
let socket;
let peerConnection;
let localStream;
let remoteStream;
let roomId = new URLSearchParams(window.location.search).get('room');
let userId = localStorage.getItem('watchtug_userId') || `user_${Date.now()}`;
let username = localStorage.getItem('watchtug_username') || 'Misafir';
let isPolite = false; // Perfect Negotiation: Odaya katılan "Polite"
let isMakingOffer = false; // Perfect Negotiation: Offer yapma durumu
let isSettingRemoteAnswerPending = false; // Perfect Negotiation: Remote answer bekleme

// WebRTC Ayarları (H.264 tercih, VP8 fallback)
const rtcConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ],
    sdpSemantics: 'unified-plan'
};

// Başlat
async function init() {
    // localStorage'dan userId'yi kaydet
    if (!localStorage.getItem('watchtug_userId')) {
        localStorage.setItem('watchtug_userId', userId);
    }

    roomIdDisplay.innerText = roomId;

    // Socket.io bağlantısı
    socket = io(window.location.origin);

    // Socket event handlers
    socket.on('connect', () => {
        console.log('Socket bağlandı:', socket.id);
        joinRoom();
    });

    socket.on('joined-room', handleJoinedRoom);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('user-disconnected', handleUserDisconnected);
    socket.on('room-full', handleRoomFull);
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('remote-screen-sharing-started', handleRemoteScreenSharingStarted);
    socket.on('remote-screen-sharing-stopped', handleRemoteScreenSharingStopped);
    socket.on('error', handleError);

    // Butonları ayarla
    if (shareScreenBtn) shareScreenBtn.onclick = startScreenShare;
    if (stopSharingBtn) stopSharingBtn.onclick = stopScreenShare;
}

// Odaya katıl
function joinRoom() {
    socket.emit('join-room', { roomId, userId });
}

// Odaya katıldı
function handleJoinedRoom(data) {
    console.log('Odaya katıldı:', data);
    
    // Perfect Negotiation: Eğer odada başka biri varsa "Polite" ol
    if (data.participantCount > 1) {
        isPolite = true;
        console.log('Polite peer olarak ayarlandı (odada başka biri var)');
    } else {
        isPolite = false;
        console.log('Impolite peer olarak ayarlandı (oda kurucusu)');
    }

    updateParticipants(data.otherParticipants || []);
}

// Kullanıcı katıldı
function handleUserJoined(data) {
    console.log('Kullanıcı katıldı:', data);
    createPeerConnection(data.socketId);
    updateParticipants();
}

// Kullanıcı ayrıldı
function handleUserLeft(data) {
    console.log('Kullanıcı ayrıldı:', data);
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (screenDisplay && screenDisplay.srcObject) {
        screenDisplay.srcObject = null;
    }
    waitingScreen.classList.remove('hidden');
    updateParticipants();
}

// Kullanıcı geçici olarak bağlantısını kesti
function handleUserDisconnected(data) {
    console.log('Kullanıcı bağlantısını kesti (grace period):', data);
    // Grace period sırasında bağlantıyı koru, sadece bilgilendir
}

// Oda dolu
function handleRoomFull(data) {
    alert('Oda dolu! Maksimum 2 kişi olabilir.');
    window.location.href = '/';
}

// Peer Connection oluştur
function createPeerConnection(remoteSocketId) {
    if (peerConnection) {
        peerConnection.close();
    }

    peerConnection = new RTCPeerConnection(rtcConfiguration);

    // ICE Candidate handler
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', {
                roomId,
                candidate: event.candidate,
                socketId: remoteSocketId
            });
        }
    };

    // Remote stream handler
    peerConnection.ontrack = (event) => {
        console.log('Remote track alındı:', event.track.kind);
        if (event.track.kind === 'video') {
            if (screenDisplay) {
                screenDisplay.srcObject = event.streams[0];
                screenDisplay.play().catch(e => console.error('Video oynatma hatası:', e));
                waitingScreen.classList.add('hidden');
            }
        } else if (event.track.kind === 'audio') {
            // Audio için ayrı element oluştur
            const audioEl = document.createElement('audio');
            audioEl.srcObject = event.streams[0];
            audioEl.autoplay = true;
            audioEl.volume = 1.0;
            document.body.appendChild(audioEl);
        }
    };

    // Connection state handler
    peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
            // Bağlantı koptu, yeniden dene
            console.log('Bağlantı koptu, yeniden deneniyor...');
        }
    };

    // Perfect Negotiation: Negotiation needed
    peerConnection.onnegotiationneeded = async () => {
        console.log('Negotiation needed');
        await handleNegotiationNeeded(remoteSocketId);
    };
}

// Perfect Negotiation: Negotiation işlemi
async function handleNegotiationNeeded(remoteSocketId) {
    if (isMakingOffer) {
        console.log('Zaten offer yapılıyor, bekleniyor...');
        return;
    }

    isMakingOffer = true;

    try {
        // Impolite peer offer yapar
        if (!isPolite) {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            socket.emit('offer', { roomId, offer, socketId: remoteSocketId });
            console.log('Offer gönderildi (Impolite)');
        }
    } catch (error) {
        console.error('Negotiation hatası:', error);
    } finally {
        isMakingOffer = false;
    }
}

// Offer alındı
async function handleOffer(data) {
    console.log('Offer alındı');
    
    if (!peerConnection) {
        // İlk bağlantı, peer connection oluştur
        const remoteSocketId = data.socketId;
        createPeerConnection(remoteSocketId);
    }

    try {
        // Perfect Negotiation: Polite peer önce remote description'ı set eder
        if (isPolite) {
            isSettingRemoteAnswerPending = true;
            await peerConnection.setRemoteDescription(data.offer);
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            socket.emit('answer', { roomId, answer, socketId: data.socketId });
            console.log('Answer gönderildi (Polite)');
            isSettingRemoteAnswerPending = false;
        }
    } catch (error) {
        console.error('Offer işleme hatası:', error);
    }
}

// Answer alındı
async function handleAnswer(data) {
    console.log('Answer alındı');
    
    try {
        // Perfect Negotiation: Impolite peer answer'ı set eder
        if (!isPolite) {
            await peerConnection.setRemoteDescription(data.answer);
            console.log('Answer set edildi (Impolite)');
        }
    } catch (error) {
        console.error('Answer işleme hatası:', error);
    }
}

// ICE Candidate alındı
async function handleIceCandidate(data) {
    if (peerConnection && data.candidate) {
        try {
            await peerConnection.addIceCandidate(data.candidate);
            console.log('ICE candidate eklendi');
        } catch (error) {
            console.error('ICE candidate ekleme hatası:', error);
        }
    }
}

// Ekran paylaşımını başlat
async function startScreenShare() {
    try {
        // Ekran paylaşımı iste
        localStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: 30
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: false
            }
        });

        // Video track'i optimize et
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.contentHint = 'motion'; // Akıcılık için
            await videoTrack.applyConstraints({
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 30 }
            });
        }

        // Local stream'i ekrana göster (Sesi kapat - yankı önleme)
        if (screenDisplay) {
            screenDisplay.srcObject = localStream;
            screenDisplay.muted = true;
            screenDisplay.volume = 0;
            screenDisplay.play().catch(e => console.error('Video oynatma hatası:', e));
        }

        // Peer connection'a track'leri ekle
        if (peerConnection) {
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });
        }

        // Diğer kullanıcılara bildir
        socket.emit('screen-sharing-started', { roomId });

        // UI güncelle
        waitingScreen.classList.add('hidden');
        if (sharingControls) sharingControls.classList.remove('hidden');

        // Stream durduğunda
        localStream.getVideoTracks()[0].onended = () => {
            stopScreenShare();
        };

        console.log('Ekran paylaşımı başlatıldı');
    } catch (error) {
        console.error('Ekran paylaşım hatası:', error);
        alert('Ekran paylaşılamadı: ' + error.message);
    }
}

// Ekran paylaşımını durdur
async function stopScreenShare() {
    try {
        // Local stream'i durdur
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }

        // Peer connection'dan track'leri kaldır
        if (peerConnection) {
            peerConnection.getSenders().forEach(sender => {
                peerConnection.removeTrack(sender);
            });
        }

        // Diğer kullanıcılara bildir
        socket.emit('screen-sharing-stopped', { roomId });

        // UI güncelle
        if (screenDisplay) {
            screenDisplay.srcObject = null;
        }
        waitingScreen.classList.remove('hidden');
        if (sharingControls) sharingControls.classList.add('hidden');

        console.log('Ekran paylaşımı durduruldu');
    } catch (error) {
        console.error('Ekran paylaşım durdurma hatası:', error);
    }
}

// Remote ekran paylaşımı başladı
function handleRemoteScreenSharingStarted(data) {
    console.log('Remote ekran paylaşımı başladı:', data);
    // Track'ler otomatik olarak ontrack event'inde işlenecek
}

// Remote ekran paylaşımı durdu
function handleRemoteScreenSharingStopped(data) {
    console.log('Remote ekran paylaşımı durdu:', data);
    if (screenDisplay && screenDisplay.srcObject) {
        screenDisplay.srcObject = null;
    }
    waitingScreen.classList.remove('hidden');
}

// Hata handler
function handleError(data) {
    console.error('Hata:', data);
    alert(data.message || 'Bir hata oluştu');
}

// Katılımcı listesini güncelle
function updateParticipants(otherParticipants = []) {
    if (!userListContainer) return;

    userListContainer.innerHTML = '';

    // Kendimizi ekle
    const selfDiv = document.createElement('div');
    selfDiv.className = 'user-item';
    selfDiv.innerHTML = `
        <div class="user-avatar">${username.substring(0, 2).toUpperCase()}</div>
        <div>${username} (Ben)</div>
    `;
    userListContainer.appendChild(selfDiv);

    // Diğer katılımcıları ekle
    otherParticipants.forEach(p => {
        const div = document.createElement('div');
        div.className = 'user-item';
        div.innerHTML = `
            <div class="user-avatar">${(p.userId || 'User').substring(0, 2).toUpperCase()}</div>
            <div>${p.userId || 'User'}</div>
        `;
        userListContainer.appendChild(div);
    });
}

// Sayfa yüklenince başlat
document.addEventListener('DOMContentLoaded', init);

// Sayfa kapanırken temizlik
window.addEventListener('beforeunload', () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnection) {
        peerConnection.close();
    }
    if (socket) {
        socket.disconnect();
    }
});

