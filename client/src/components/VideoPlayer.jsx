import { useRef, useEffect, useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { useSocket } from '../context/SocketContext';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Share2, Square, Theater } from 'lucide-react';

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

  const { roomId, userId, isHost, users, streamActive } = useStore();
  const { emit, on, off } = useSocket();

  // Debug: Log streamActive changes
  useEffect(() => {
    console.log('VideoPlayer - streamActive changed:', streamActive, 'isHost:', isHost, 'hasVideoStream:', hasVideoStream);
  }, [streamActive, isHost, hasVideoStream]);

  // WebRTC Configuration with STUN servers
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ]
  };

  // Start screen sharing (Host only)
  const startSharing = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
          suppressLocalAudioPlayback: false
        }
      });

      localStreamRef.current = stream;
      videoRef.current.srcObject = stream;
      setIsSharing(true);
      setIsPlaying(true);
      setHasVideoStream(true);

      // Stream başladığını bildir
      emit('stream-started', { roomId });

      // Diğer kullanıcılara WebRTC offer gönder
      const otherUsers = users.filter(u => u.userId !== userId);
      otherUsers.forEach(user => {
        createPeerConnection(user.userId, true);
      });

      // Stream sonlandığında temizlik yap
      stream.getVideoTracks()[0].onended = () => {
        stopSharing();
      };
    } catch (error) {
      console.error('Error starting screen share:', error);
      alert('Ekran paylaşımı başlatılamadı. Lütfen izin verin.');
    }
  };

  // Stop screen sharing
  const stopSharing = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Tüm peer connection'ları kapat
    peerConnectionsRef.current.forEach((pc, targetUserId) => {
      pc.close();
      peerConnectionsRef.current.delete(targetUserId);
    });

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsSharing(false);
    setIsPlaying(false);
    setHasVideoStream(false);
    emit('stream-stopped', { roomId });
  };

  // Create peer connection
  const createPeerConnection = useCallback((targetUserId, isInitiator) => {
    if (peerConnectionsRef.current.has(targetUserId)) {
      return peerConnectionsRef.current.get(targetUserId);
    }

    const pc = new RTCPeerConnection(rtcConfig);
    peerConnectionsRef.current.set(targetUserId, pc);

    // Add local stream tracks
    if (localStreamRef.current && isInitiator) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      if (videoRef.current && event.streams[0]) {
        console.log('Remote stream received from:', targetUserId);
        const stream = event.streams[0];
        videoRef.current.srcObject = stream;
        setIsPlaying(true);
        setConnectionStatus('connected');
        setHasVideoStream(true);
        
        // Force video to play
        videoRef.current.play().catch(err => {
          console.error('Error playing video:', err);
        });
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        emit('webrtc-ice-candidate', {
          roomId,
          candidate: event.candidate,
          targetUserId
        });
      }
    };

    // Handle connection state
    pc.onconnectionstatechange = () => {
      setConnectionStatus(pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        // Reconnection attempt
        setTimeout(() => {
          const currentIsHost = useStore.getState().isHost;
          if (currentIsHost && localStreamRef.current) {
            createPeerConnection(targetUserId, true);
          }
        }, 3000);
      }
    };

    // Create offer if initiator
    if (isInitiator) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          emit('webrtc-offer', {
            roomId,
            offer: pc.localDescription,
            targetUserId
          });
        })
        .catch(error => console.error('Error creating offer:', error));
    }

    return pc;
  }, [roomId, emit, isHost]);

  // Handle WebRTC signals
  useEffect(() => {
    if (!roomId) return;

    const handleOffer = ({ offer, fromUserId, fromUsername }) => {
      const pc = createPeerConnection(fromUserId, false);
      pc.setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => pc.createAnswer())
        .then(answer => pc.setLocalDescription(answer))
        .then(() => {
          emit('webrtc-answer', {
            roomId,
            answer: pc.localDescription,
            targetUserId: fromUserId
          });
        })
        .catch(error => console.error('Error handling offer:', error));
    };

    const handleAnswer = ({ answer, fromUserId }) => {
      const pc = peerConnectionsRef.current.get(fromUserId);
      if (pc) {
        pc.setRemoteDescription(new RTCSessionDescription(answer))
          .catch(error => console.error('Error handling answer:', error));
      }
    };

    const handleIceCandidate = ({ candidate, fromUserId }) => {
      const pc = peerConnectionsRef.current.get(fromUserId);
      if (pc) {
        pc.addIceCandidate(new RTCIceCandidate(candidate))
          .catch(error => console.error('Error adding ICE candidate:', error));
      }
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

  // Handle new user joining (if host is sharing)
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

  // Handle new viewer joined - if we're host and sharing, send offer
  useEffect(() => {
    if (!roomId) return;

    const handleNewViewer = ({ viewerUserId, viewerUsername }) => {
      console.log('New viewer joined event received:', viewerUserId, 'isHost:', isHost, 'isSharing:', isSharing);
      if (isHost && isSharing && localStreamRef.current) {
        console.log('New viewer joined, sending offer to:', viewerUserId);
        // Create peer connection and send offer
        if (!peerConnectionsRef.current.has(viewerUserId)) {
          // Small delay to ensure everything is ready
          setTimeout(() => {
            createPeerConnection(viewerUserId, true);
          }, 200);
        }
      } else if (isHost && !isSharing && localStreamRef.current) {
        // Host has stream but isSharing state might not be updated yet
        console.log('Host has stream but isSharing is false, checking...');
        if (localStreamRef.current.getVideoTracks().length > 0) {
          setIsSharing(true);
          setTimeout(() => {
            createPeerConnection(viewerUserId, true);
          }, 200);
        }
      }
    };

    on('new-viewer-joined', handleNewViewer);

    return () => {
      off('new-viewer-joined', handleNewViewer);
    };
  }, [roomId, isHost, isSharing, on, off, createPeerConnection]);

  // Reconnect WebRTC when room is rejoined and stream is active
  useEffect(() => {
    if (streamActive && !isHost && !isSharing && users.length > 0 && !hasVideoStream) {
      // Find host user - host is the one who created the room
      const hasActiveConnection = Array.from(peerConnectionsRef.current.values()).some(
        pc => pc.connectionState === 'connected' || pc.connectionState === 'connecting'
      );

      if (!hasActiveConnection) {
        console.log('Stream is active but no connection, waiting for offer from host...');
        // Host should send offer automatically when we join via 'new-viewer-joined' event
        // But if it doesn't come within 2 seconds, we can try to request it
        const timeout = setTimeout(() => {
          const stillNoConnection = !Array.from(peerConnectionsRef.current.values()).some(
            pc => pc.connectionState === 'connected' || pc.connectionState === 'connecting'
          );
          if (stillNoConnection && streamActive) {
            console.log('Still no connection after 2s, host might need to resend offer');
            // The host should have received new-viewer-joined event, but if not, 
            // we can emit a request (optional - for now just log)
          }
        }, 2000);
        
        return () => clearTimeout(timeout);
      }
    }
  }, [streamActive, isHost, isSharing, users, hasVideoStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSharing();
    };
  }, []);

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
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
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      videoRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  return (
    <div className={`overflow-hidden flex flex-col h-full ${
      isTheaterMode 
        ? 'bg-black rounded-none border-none' 
        : 'bg-dark-surface rounded-lg border border-dark-surface2'
    }`}>
      <div className="relative flex-1 bg-black group">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`w-full h-full ${
            isTheaterMode ? 'object-cover' : 'object-contain'
          }`}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        {/* Show waiting message only if stream is NOT active and user is NOT sharing and has no video */}
        {!streamActive && !isSharing && !hasVideoStream && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-surface/80">
            <div className="text-center">
              <Share2 className="w-16 h-16 text-dark-text2 mx-auto mb-4 opacity-50" />
              <p className="text-dark-text2 text-lg">
                {isHost ? 'Ekran paylaşımını başlat' : 'Yayın bekleniyor...'}
              </p>
            </div>
          </div>
        )}

        {/* Show connecting message if stream is active but no video yet (for viewers) - This is the key fix */}
        {streamActive && !isHost && !hasVideoStream && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-surface/80">
            <div className="text-center">
              <Share2 className="w-16 h-16 text-dark-text2 mx-auto mb-4 opacity-50 animate-pulse" />
              <p className="text-dark-text2 text-lg">
                Yayın bağlanıyor...
              </p>
            </div>
          </div>
        )}

        {/* Show message if host reconnected but stream was active */}
        {streamActive && isHost && !isSharing && !localStreamRef.current && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-surface/80">
            <div className="text-center">
              <Share2 className="w-16 h-16 text-dark-text2 mx-auto mb-4 opacity-50" />
              <p className="text-dark-text2 text-lg mb-4">
                Yayın durduruldu. Yeniden başlatmak için:
              </p>
              <button
                onClick={startSharing}
                className="px-6 py-3 bg-dark-accent hover:bg-red-600 text-white font-semibold rounded-lg transition"
              >
                Ekran Paylaşımını Yeniden Başlat
              </button>
            </div>
          </div>
        )}

        {/* Controls overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-4">
            <button
              onClick={togglePlayPause}
              className="p-2 bg-dark-surface/80 rounded-lg hover:bg-dark-surface transition"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 text-white" />
              ) : (
                <Play className="w-5 h-5 text-white" />
              )}
            </button>

            <button
              onClick={toggleMute}
              className="p-2 bg-dark-surface/80 rounded-lg hover:bg-dark-surface transition"
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5 text-white" />
              ) : (
                <Volume2 className="w-5 h-5 text-white" />
              )}
            </button>

            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={handleVolumeChange}
              className="flex-1 h-2 bg-dark-surface2 rounded-lg appearance-none cursor-pointer"
            />

            {/* Theater Mode Toggle Button */}
            {onTheaterModeToggle && (
              <button
                onClick={onTheaterModeToggle}
                className={`p-2 rounded-lg transition ${
                  isTheaterMode
                    ? 'bg-dark-accent/80 hover:bg-dark-accent text-white'
                    : 'bg-dark-surface/80 hover:bg-dark-surface text-white'
                }`}
                title={isTheaterMode ? 'Tiyatro Modunu Kapat' : 'Tiyatro Modunu Aç'}
              >
                <Theater className="w-5 h-5" />
              </button>
            )}

            <button
              onClick={toggleFullscreen}
              className="p-2 bg-dark-surface/80 rounded-lg hover:bg-dark-surface transition"
            >
              {isFullscreen ? (
                <Minimize className="w-5 h-5 text-white" />
              ) : (
                <Maximize className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
        </div>

        {/* Connection status */}
        <div className="absolute top-4 left-4">
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            connectionStatus === 'connected' ? 'bg-green-500/80' :
            connectionStatus === 'connecting' ? 'bg-yellow-500/80' :
            'bg-red-500/80'
          } text-white`}>
            {connectionStatus === 'connected' ? 'Bağlı' :
             connectionStatus === 'connecting' ? 'Bağlanıyor...' :
             'Bağlantı Yok'}
          </div>
        </div>
      </div>

      {/* Share button (Host only) - Gizle tiyatro modunda */}
      {isHost && !isTheaterMode && (
        <div className="p-4 border-t border-dark-surface2">
          {!isSharing ? (
            <button
              onClick={startSharing}
              className="w-full px-4 py-3 bg-dark-accent hover:bg-red-600 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2"
            >
              <Share2 className="w-5 h-5" />
              Ekran Paylaşımını Başlat
            </button>
          ) : (
            <button
              onClick={stopSharing}
              className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2"
            >
              <Square className="w-5 h-5" />
              Paylaşımı Durdur
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;

