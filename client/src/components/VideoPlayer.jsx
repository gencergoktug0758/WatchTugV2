import { useRef, useEffect, useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { useSocket } from '../context/SocketContext';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Share2, Square, Theater, Monitor, Tv } from 'lucide-react';

const VideoPlayer = ({ isTheaterMode, onTheaterModeToggle }) => {
  const videoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [hasVideoStream, setHasVideoStream] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef(null);

  const { roomId, userId, isHost, users, streamActive } = useStore();
  const { emit, on, off } = useSocket();

  useEffect(() => {
    console.log('VideoPlayer - streamActive changed:', streamActive, 'isHost:', isHost, 'hasVideoStream:', hasVideoStream);
  }, [streamActive, isHost, hasVideoStream]);

  const handleShowControls = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ]
  };

  const startSharing = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always', displaySurface: 'monitor', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100, suppressLocalAudioPlayback: false }
      });

      localStreamRef.current = stream;
      videoRef.current.srcObject = stream;
      setIsSharing(true);
      setIsPlaying(true);
      setHasVideoStream(true);

      emit('stream-started', { roomId });

      const otherUsers = users.filter(u => u.userId !== userId);
      otherUsers.forEach(user => createPeerConnection(user.userId, true));

      stream.getVideoTracks()[0].onended = () => stopSharing();
    } catch (error) {
      console.error('Error starting screen share:', error);
      alert('Ekran paylaşımı başlatılamadı. Lütfen izin verin.');
    }
  };

  const stopSharing = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    peerConnectionsRef.current.forEach((pc, targetUserId) => {
      pc.close();
      peerConnectionsRef.current.delete(targetUserId);
    });

    if (videoRef.current) videoRef.current.srcObject = null;

    setIsSharing(false);
    setIsPlaying(false);
    setHasVideoStream(false);
    emit('stream-stopped', { roomId });
  };

  const createPeerConnection = useCallback((targetUserId, isInitiator) => {
    if (peerConnectionsRef.current.has(targetUserId)) {
      return peerConnectionsRef.current.get(targetUserId);
    }

    const pc = new RTCPeerConnection(rtcConfig);
    peerConnectionsRef.current.set(targetUserId, pc);

    if (localStreamRef.current && isInitiator) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.ontrack = (event) => {
      if (videoRef.current && event.streams[0]) {
        console.log('Remote stream received from:', targetUserId);
        videoRef.current.srcObject = event.streams[0];
        setIsPlaying(true);
        setConnectionStatus('connected');
        setHasVideoStream(true);
        videoRef.current.play().catch(err => console.error('Error playing video:', err));
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        emit('webrtc-ice-candidate', { roomId, candidate: event.candidate, targetUserId });
      }
    };

    pc.onconnectionstatechange = () => {
      setConnectionStatus(pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setTimeout(() => {
          const currentIsHost = useStore.getState().isHost;
          if (currentIsHost && localStreamRef.current) {
            createPeerConnection(targetUserId, true);
          }
        }, 3000);
      }
    };

    if (isInitiator) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          emit('webrtc-offer', { roomId, offer: pc.localDescription, targetUserId });
        })
        .catch(error => console.error('Error creating offer:', error));
    }

    return pc;
  }, [roomId, emit, isHost]);

  useEffect(() => {
    if (!roomId) return;

    const handleOffer = ({ offer, fromUserId }) => {
      const pc = createPeerConnection(fromUserId, false);
      pc.setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => pc.createAnswer())
        .then(answer => pc.setLocalDescription(answer))
        .then(() => {
          emit('webrtc-answer', { roomId, answer: pc.localDescription, targetUserId: fromUserId });
        })
        .catch(error => console.error('Error handling offer:', error));
    };

    const handleAnswer = ({ answer, fromUserId }) => {
      const pc = peerConnectionsRef.current.get(fromUserId);
      if (pc) pc.setRemoteDescription(new RTCSessionDescription(answer)).catch(error => console.error('Error handling answer:', error));
    };

    const handleIceCandidate = ({ candidate, fromUserId }) => {
      const pc = peerConnectionsRef.current.get(fromUserId);
      if (pc) pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(error => console.error('Error adding ICE candidate:', error));
    };

    on('webrtc-offer', handleOffer);
    on('webrtc-answer', handleAnswer);
    on('webrtc-ice-candidate', handleIceCandidate);

    return () => {
      off('webrtc-offer', handleOffer);
      off('webrtc-answer', handleAnswer);
      off('webrtc-ice-candidate', handleIceCandidate);
    };
  }, [roomId, emit, on, off, createPeerConnection]);

  useEffect(() => {
    if (isHost && isSharing && users.length > 1) {
      const otherUsers = users.filter(u => u.userId !== userId);
      otherUsers.forEach(user => {
        if (!peerConnectionsRef.current.has(user.userId)) {
          createPeerConnection(user.userId, true);
        }
      });
    }
  }, [users, isHost, isSharing, userId, createPeerConnection]);

  useEffect(() => {
    if (!roomId) return;

    const handleNewViewer = ({ viewerUserId }) => {
      console.log('New viewer joined:', viewerUserId, 'isHost:', isHost, 'isSharing:', isSharing);
      if (isHost && isSharing && localStreamRef.current) {
        if (!peerConnectionsRef.current.has(viewerUserId)) {
          setTimeout(() => createPeerConnection(viewerUserId, true), 200);
        }
      } else if (isHost && !isSharing && localStreamRef.current) {
        if (localStreamRef.current.getVideoTracks().length > 0) {
          setIsSharing(true);
          setTimeout(() => createPeerConnection(viewerUserId, true), 200);
        }
      }
    };

    on('new-viewer-joined', handleNewViewer);
    return () => off('new-viewer-joined', handleNewViewer);
  }, [roomId, isHost, isSharing, on, off, createPeerConnection]);

  useEffect(() => {
    if (streamActive && !isHost && !isSharing && users.length > 0 && !hasVideoStream) {
      const hasActiveConnection = Array.from(peerConnectionsRef.current.values()).some(
        pc => pc.connectionState === 'connected' || pc.connectionState === 'connecting'
      );

      if (!hasActiveConnection) {
        console.log('Stream is active but no connection, waiting for offer from host...');
      }
    }
  }, [streamActive, isHost, isSharing, users, hasVideoStream]);

  useEffect(() => {
    return () => stopSharing();
  }, []);

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) videoRef.current.volume = newVolume;
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) videoRef.current?.requestFullscreen();
    else document.exitFullscreen();
  };

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div className={`overflow-hidden flex flex-col h-full ${
      isTheaterMode ? 'bg-black rounded-none border-none' : 'glass-card rounded-2xl'
    }`}>
      <div 
        className="relative flex-1 bg-black group flex items-center justify-center min-h-0"
        onTouchStart={handleShowControls}
        onMouseMove={handleShowControls}
        onMouseLeave={() => setShowControls(false)}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-contain"
          style={{ objectPosition: 'center', display: 'block' }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        {/* Waiting for stream */}
        {!streamActive && !isSharing && !hasVideoStream && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-bg/95 backdrop-blur-sm">
            <div className="text-center animate-fade-in">
              <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-neon-purple/20 to-neon-pink/20 flex items-center justify-center border border-neon-purple/30">
                <Tv className="w-12 h-12 text-neon-purple/70" />
              </div>
              <p className="text-white text-xl font-bold mb-2">
                {isHost ? 'Ekran Paylaşımını Başlat' : 'Yayın Bekleniyor'}
              </p>
              <p className="text-dark-text2">
                {isHost ? 'Aşağıdaki butona tıkla 👇' : 'Host yayını başlatınca görüntü gelecek'}
              </p>
            </div>
          </div>
        )}

        {/* Connecting to stream */}
        {streamActive && !isHost && !hasVideoStream && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-bg/95 backdrop-blur-sm">
            <div className="text-center animate-fade-in">
              <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-neon-purple/20 to-neon-pink/20 flex items-center justify-center border border-neon-purple/30">
                <Tv className="w-12 h-12 text-neon-purple animate-pulse" />
              </div>
              <p className="text-white text-xl font-bold mb-2">Bağlanılıyor...</p>
              <div className="flex justify-center gap-1.5 mt-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-3 h-3 rounded-full bg-gradient-to-r from-neon-purple to-neon-pink animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}></div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Host reconnect prompt */}
        {streamActive && isHost && !isSharing && !localStreamRef.current && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-bg/95 backdrop-blur-sm">
            <div className="text-center animate-fade-in">
              <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-dark-surface2/50 flex items-center justify-center border border-white/10">
                <Monitor className="w-12 h-12 text-dark-text2" />
              </div>
              <p className="text-white text-xl font-bold mb-2">Yayın Durduruldu</p>
              <p className="text-dark-text2 mb-6">Tekrar başlatmak için butona tıkla</p>
              <button
                onClick={startSharing}
                className="btn-neon px-6 py-3 rounded-xl text-white font-bold"
              >
                🚀 Yeniden Başlat
              </button>
            </div>
          </div>
        )}

        {/* Video Controls */}
        <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={togglePlayPause}
              className="p-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl transition-all hover:scale-110 active:scale-95 border border-white/10"
            >
              {isPlaying ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white ml-0.5" />}
            </button>

            <button
              onClick={toggleMute}
              className="p-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl transition-all hover:scale-110 active:scale-95 border border-white/10"
            >
              {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
            </button>

            <div className="flex-1 min-w-[80px] max-w-[150px]">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                className="w-full"
                style={{
                  background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${volume * 100}%, rgba(255,255,255,0.1) ${volume * 100}%, rgba(255,255,255,0.1) 100%)`
                }}
              />
            </div>

            <div className="flex-1"></div>

            {onTheaterModeToggle && (
              <button
                onClick={onTheaterModeToggle}
                className={`p-2.5 rounded-xl transition-all hover:scale-110 active:scale-95 border ${
                  isTheaterMode
                    ? 'bg-gradient-to-r from-neon-purple to-neon-pink text-white border-neon-purple/50'
                    : 'bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border-white/10'
                }`}
              >
                <Theater className="w-5 h-5" />
              </button>
            )}

            <button
              onClick={toggleFullscreen}
              className="p-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl transition-all hover:scale-110 active:scale-95 border border-white/10"
            >
              {isFullscreen ? <Minimize className="w-5 h-5 text-white" /> : <Maximize className="w-5 h-5 text-white" />}
            </button>
          </div>
        </div>

        {/* Connection Status Badge */}
        <div className="absolute top-4 left-4">
          <div className={`px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-md border flex items-center gap-1.5 ${
            connectionStatus === 'connected' 
              ? 'bg-green-500/20 border-green-500/30 text-green-400' :
            connectionStatus === 'connecting' 
              ? 'bg-neon-purple/20 border-neon-purple/30 text-neon-purple' :
              'bg-dark-surface2/80 border-white/10 text-dark-text2'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-400 animate-pulse' :
              connectionStatus === 'connecting' ? 'bg-neon-purple animate-pulse' :
              'bg-dark-text2'
            }`}></span>
            {connectionStatus === 'connected' ? 'Bağlı' :
             connectionStatus === 'connecting' ? 'Bağlanıyor...' :
             'Bekleniyor'}
          </div>
        </div>
      </div>

      {/* Host Share Button */}
      {isHost && !isTheaterMode && (
        <div className="p-4 border-t border-white/10">
          {!isSharing ? (
            <button
              onClick={startSharing}
              className="btn-neon w-full px-6 py-4 rounded-xl flex items-center justify-center gap-3 text-lg font-bold"
            >
              <Share2 className="w-6 h-6 text-white" />
              <span className="text-white">Ekran Paylaşımını Başlat</span>
            </button>
          ) : (
            <button
              onClick={stopSharing}
              className="w-full px-6 py-4 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 font-bold rounded-xl transition-all flex items-center justify-center gap-3"
            >
              <Square className="w-5 h-5" />
              <span>Paylaşımı Durdur</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
