// DOM Elementleri
const screenDisplay = document.getElementById('screenDisplay');
const roomIdDisplay = document.getElementById('roomIdDisplay');
const waitingScreen = document.getElementById('waitingScreen');
const sharingControls = document.getElementById('sharingControls');
const stopSharingBtn = document.getElementById('stopSharingBtn');
const shareScreenBtn = document.getElementById('shareScreenBtn');
const userListContainer = document.getElementById('usersContainer'); // HTML'deki id'ye dikkat et

// Değişkenler
let room;
let roomId = new URLSearchParams(window.location.search).get('room');
let username = localStorage.getItem('watchtug_username') || 'Misafir';
const LIVEKIT_URL = 'wss://watchtug.live'; // Domain adresin

// Başlat
async function init() {
    roomIdDisplay.innerText = roomId;
    
    // Token al
    const response = await fetch('/get-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: roomId, participantName: username })
    });
    const data = await response.json();

    // Odaya Bağlan
    room = new LiveKitClient.Room({
        adaptiveStream: true, // Kaliteyi otomatik ayarla (Discord gibi)
        dynacast: true,
        videoCaptureDefaults: {
            resolution: LiveKitClient.VideoPresets.h1080.resolution
        }
    });

    // Diğer kullanıcıların yayınlarını izle
    room.on(LiveKitClient.RoomEvent.TrackSubscribed, handleTrackSubscribed);
    room.on(LiveKitClient.RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
    room.on(LiveKitClient.RoomEvent.ParticipantConnected, updateParticipants);
    room.on(LiveKitClient.RoomEvent.ParticipantDisconnected, updateParticipants);
    
    await room.connect(LIVEKIT_URL, data.token);
    console.log('Odaya bağlanıldı:', room.name);
    updateParticipants();

    // Butonları ayarla
    shareScreenBtn.onclick = startScreenShare;
    stopSharingBtn.onclick = stopScreenShare;
}

// Ekran Paylaşımını Başlat
async function startScreenShare() {
    try {
        // Discord Nitro Kalitesi Ayarları (H.264 + 30FPS)
        await room.localParticipant.setScreenShareEnabled(true, {
            audio: true,
            video: {
                resolution: { width: 1920, height: 1080 },
                frameRate: 30
            }
        });
        
        waitingScreen.classList.add('hidden');
        sharingControls.classList.remove('hidden');
        
        // Kendi ekranını önizle (Sesi kapat ki yankı yapmasın)
        const tracks = Array.from(room.localParticipant.videoTracks.values());
        if (tracks.length > 0) {
            tracks[0].track.attach(screenDisplay);
            screenDisplay.muted = true;
            screenDisplay.volume = 0;
        }
        
    } catch (e) {
        console.error('Ekran paylaşım hatası:', e);
        alert('Ekran paylaşılamadı: ' + e.message);
    }
}

// Ekran Paylaşımını Durdur
async function stopScreenShare() {
    await room.localParticipant.setScreenShareEnabled(false);
    waitingScreen.classList.remove('hidden');
    sharingControls.classList.add('hidden');
    screenDisplay.srcObject = null;
}

// Başkası yayın açınca
function handleTrackSubscribed(track, publication, participant) {
    if (track.kind === 'video') {
        track.attach(screenDisplay);
        waitingScreen.classList.add('hidden');
    } else if (track.kind === 'audio') {
        // Ses elementini oluştur ve ekle
        const audioEl = track.attach();
        document.body.appendChild(audioEl);
    }
}

// Yayın kapanınca
function handleTrackUnsubscribed(track, publication, participant) {
    track.detach();
    if (track.kind === 'video') {
        waitingScreen.classList.remove('hidden');
    }
}

// Katılımcı listesini güncelle
function updateParticipants() {
    if(!userListContainer) return;
    userListContainer.innerHTML = '';
    
    const participants = Array.from(room.remoteParticipants.values());
    // Kendimizi ekle
    addParticipantToUI({ identity: username + " (Ben)" });
    
    participants.forEach(p => {
        addParticipantToUI(p);
    });
}

function addParticipantToUI(p) {
    const div = document.createElement('div');
    div.className = 'user-item';
    div.innerHTML = `
        <div class="user-avatar">${p.identity.substring(0,2).toUpperCase()}</div>
        <div>${p.identity}</div>
    `;
    userListContainer.appendChild(div);
}

// Sayfa yüklenince başlat
document.addEventListener('DOMContentLoaded', init);
