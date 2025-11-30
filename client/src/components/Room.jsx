import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useSocket } from '../context/SocketContext';
import VideoPlayer from './VideoPlayer';
import ChatBox from './ChatBox';
import UserList from './UserList';
import { ToastContainer } from './Toast';
import Footer from './Footer';
import { LogOut, Copy, Wifi, WifiOff, Theater, X, MessageSquare, Play, Check, Lock, Eye, EyeOff } from 'lucide-react';

const Room = () => {
  const { roomId: urlRoomId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const { 
    roomId, username, userId, ping, resetRoom, clearAll, users, setRoomId,
    hasPassword, addRecentRoom
  } = useStore();
  
  const { isConnected, emit, on, off } = useSocket();
  
  const [toasts, setToasts] = useState([]);
  const [isJoining, setIsJoining] = useState(true);
  const [hasEmittedJoin, setHasEmittedJoin] = useState(false);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [copied, setCopied] = useState(false);
  
  // Password modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);

  // Mobile fullscreen for theater mode
  useEffect(() => {
    const isMobile = window.innerWidth < 1024;
    
    if (isTheaterMode && isMobile) {
      const enterFullscreen = async () => {
        try {
          const element = document.documentElement;
          if (element.requestFullscreen) await element.requestFullscreen();
          else if (element.webkitRequestFullscreen) await element.webkitRequestFullscreen();
          else if (element.mozRequestFullScreen) await element.mozRequestFullScreen();
          else if (element.msRequestFullscreen) await element.msRequestFullscreen();
        } catch (error) {
          console.log('Fullscreen error:', error);
        }
      };
      enterFullscreen();
    } else if (!isTheaterMode && isMobile) {
      try {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
        else if (document.msExitFullscreen) document.msExitFullscreen();
      } catch (error) {
        console.log('Exit fullscreen error:', error);
      }
    }
  }, [isTheaterMode]);

  const addToast = (message, type = 'info', duration = 3000) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  // Room connection
  useEffect(() => {
    if (!urlRoomId) {
      navigate('/');
      return;
    }

    if (!isConnected) return;

    if (username && userId) {
      if (roomId !== urlRoomId) setRoomId(urlRoomId);
      
      if (!hasEmittedJoin) {
        setHasEmittedJoin(true);
        
        // Check if creating with password
        const isCreating = searchParams.get('create') === 'true';
        const password = searchParams.get('password');
        
        setTimeout(() => {
          if (isCreating && password) {
            // Şifreli oda oluştur
            emit('create-room', { 
              roomId: urlRoomId, 
              username, 
              userId,
              password
            });
          } else {
            // Normal katılım
            emit('join-room', { 
              roomId: urlRoomId, 
              username, 
              userId,
              password: password || undefined
            });
          }
        }, 100);
      }
    } else {
      navigate('/');
    }
  }, [urlRoomId, isConnected, username, userId, searchParams]);

  useEffect(() => {
    setHasEmittedJoin(false);
  }, [urlRoomId]);

  // Socket event handlers
  useEffect(() => {
    const handleRoomJoined = (data) => {
      setIsJoining(false);
      setHasEmittedJoin(false);
      setShowPasswordModal(false);
      
      // Add to recent rooms
      addRecentRoom({
        roomId: urlRoomId,
        joinedAt: Date.now(),
        hasPassword: data.hasPassword
      });
    };

    const handleRoomCreated = (data) => {
      setIsJoining(false);
      setHasEmittedJoin(false);
      
      addRecentRoom({
        roomId: urlRoomId,
        joinedAt: Date.now(),
        hasPassword: data.hasPassword
      });
    };

    const handleRoomNotFound = () => {
      setIsJoining(false);
      addToast('Oda bulunamadı!', 'error', 3000);
      setTimeout(() => {
        resetRoom();
        clearAll();
        navigate('/');
      }, 2000);
    };

    const handlePasswordRequired = () => {
      setIsJoining(false);
      setShowPasswordModal(true);
    };

    const handleRoomAlreadyExists = (data) => {
      // Oda zaten var, normal join dene
      if (data.hasPassword) {
        setIsJoining(false);
        setShowPasswordModal(true);
      } else {
        emit('join-room', { roomId: urlRoomId, username, userId });
      }
    };

    const handlePasswordResult = (data) => {
      if (data.success) {
        // Try joining again with password
        emit('join-room', { 
          roomId: urlRoomId, 
          username, 
          userId,
          password: passwordInput
        });
      } else {
        setPasswordError('Yanlış şifre!');
      }
    };

    on('room-joined', handleRoomJoined);
    on('room-created', handleRoomCreated);
    on('room-not-found', handleRoomNotFound);
    on('password-required', handlePasswordRequired);
    on('password-result', handlePasswordResult);
    on('room-already-exists', handleRoomAlreadyExists);

    return () => {
      off('room-joined', handleRoomJoined);
      off('room-created', handleRoomCreated);
      off('room-not-found', handleRoomNotFound);
      off('password-required', handlePasswordRequired);
      off('password-result', handlePasswordResult);
      off('room-already-exists', handleRoomAlreadyExists);
    };
  }, [on, off, navigate, resetRoom, clearAll, urlRoomId, username, userId, passwordInput, emit, addRecentRoom]);

  // User join/leave notifications
  useEffect(() => {
    const handleUserJoined = (data) => {
      if (data.userId !== userId) addToast(`${data.username} katıldı 🎉`, 'user-joined');
    };

    const handleUserLeft = (data) => {
      if (data.userId !== userId) addToast(`${data.username} ayrıldı`, 'user-left');
    };

    const handleStreamStarted = () => addToast('Yayın başladı! 🎬', 'stream-started');
    const handleStreamStopped = () => addToast('Yayın durdu', 'stream-stopped');

    on('user-joined', handleUserJoined);
    on('user-left', handleUserLeft);
    on('stream-started', handleStreamStarted);
    on('stream-stopped', handleStreamStopped);

    return () => {
      off('user-joined', handleUserJoined);
      off('user-left', handleUserLeft);
      off('stream-started', handleStreamStarted);
      off('stream-stopped', handleStreamStopped);
    };
  }, [userId, on, off]);

  // Unread messages counter
  const { chatHistory } = useStore();
  const lastReadCountRef = useRef(0);
  
  useEffect(() => {
    if (isTheaterMode && !isMobileChatOpen) {
      const newMessages = chatHistory.length - lastReadCountRef.current;
      if (newMessages > 0) setUnreadCount(prev => prev + newMessages);
      lastReadCountRef.current = chatHistory.length;
    } else if (isMobileChatOpen) {
      setUnreadCount(0);
      lastReadCountRef.current = chatHistory.length;
    }
  }, [chatHistory.length, isTheaterMode, isMobileChatOpen]);

  // Ref'ler ile mevcut değerleri takip et (closure sorunu için)
  const roomDataRef = useRef({ roomId: null, userId: null, username: null });
  const hasLeftRoom = useRef(false);
  
  // Ref'leri güncelle
  useEffect(() => {
    roomDataRef.current = { 
      roomId: urlRoomId || roomId, 
      userId, 
      username 
    };
  }, [urlRoomId, roomId, userId, username]);

  const handleLeaveRoom = () => {
    if (confirm('Odadan ayrılmak istediğinize emin misiniz?')) {
      hasLeftRoom.current = true;
      const { roomId: currentRoomId, userId: currentUserId, username: currentUsername } = roomDataRef.current;
      
      if (currentRoomId && currentUserId && currentUsername) {
        emit('leave-room', { roomId: currentRoomId, userId: currentUserId, username: currentUsername });
      }
      resetRoom();
      clearAll();
      navigate('/');
    }
  };
  
  // Browser geri tuşu veya sayfa kapanınca leave-room gönder
  useEffect(() => {
    // Tab/pencere kapanınca
    const handleBeforeUnload = () => {
      const { roomId: currentRoomId, userId: currentUserId, username: currentUsername } = roomDataRef.current;
      
      if (currentRoomId && currentUserId && currentUsername && !hasLeftRoom.current) {
        // sendBeacon ile senkron gönder
        try {
          navigator.sendBeacon('/api/leave', JSON.stringify({
            roomId: currentRoomId, 
            userId: currentUserId, 
            username: currentUsername
          }));
        } catch (e) {
          console.log('sendBeacon error:', e);
        }
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Sadece component GERÇEKTEN unmount olduğunda leave-room gönder
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      const { roomId: currentRoomId, userId: currentUserId, username: currentUsername } = roomDataRef.current;
      
      // Sadece henüz ayrılmamışsak ve bilgiler varsa gönder
      if (!hasLeftRoom.current && currentRoomId && currentUserId && currentUsername) {
        console.log('[Room] Unmount - leaving room:', currentRoomId);
        emit('leave-room', { roomId: currentRoomId, userId: currentUserId, username: currentUsername });
      }
    };
  }, []); // Boş dependency - sadece mount/unmount'ta çalışır

  const copyRoomId = () => {
    navigator.clipboard.writeText(urlRoomId || roomId);
    setCopied(true);
    addToast('Oda ID kopyalandı! 📋', 'info', 2000);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePasswordSubmit = () => {
    if (!passwordInput.trim()) {
      setPasswordError('Şifre boş olamaz!');
      return;
    }
    setPasswordError('');
    emit('verify-password', { roomId: urlRoomId, password: passwordInput });
  };

  // Join timeout
  useEffect(() => {
    if (isJoining && isConnected && !showPasswordModal) {
      const timeout = setTimeout(() => {
        if (isJoining) {
          setIsJoining(false);
          addToast('Bağlantı zaman aşımı!', 'error', 4000);
          setTimeout(() => navigate('/'), 2000);
        }
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [isJoining, isConnected, navigate, showPasswordModal]);

  // Password Modal
  if (showPasswordModal) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-neon-purple/20 rounded-full blur-[120px] animate-float"></div>
          <div className="absolute bottom-1/4 -right-20 w-[500px] h-[500px] bg-neon-pink/15 rounded-full blur-[150px] animate-float"></div>
        </div>

        <div className="glass-card rounded-3xl p-8 max-w-md w-full animate-scale-in relative z-10">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-neon-pink/20 to-neon-purple/20 flex items-center justify-center border border-neon-pink/30">
              <Lock className="w-8 h-8 text-neon-pink" />
            </div>
            <h2 className="text-2xl font-bold text-white">Şifreli Oda</h2>
            <p className="text-dark-text2 mt-2">
              <span className="font-mono text-neon-purple">{urlRoomId}</span> odasına girmek için şifre gerekli
            </p>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <input
                type={showPasswordInput ? 'text' : 'password'}
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setPasswordError('');
                }}
                onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                placeholder="Oda şifresi"
                className="w-full px-5 py-4 bg-dark-surface2 border border-white/10 hover:border-neon-pink/40 focus:border-neon-pink rounded-xl text-white placeholder-dark-text2 focus:outline-none focus:ring-2 focus:ring-neon-pink/20 transition-all pr-12"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPasswordInput(!showPasswordInput)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-text2 hover:text-white transition-colors"
              >
                {showPasswordInput ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {passwordError && (
              <p className="text-red-400 text-sm text-center animate-fade-in">{passwordError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => navigate('/')}
                className="flex-1 px-6 py-3 bg-dark-surface2 hover:bg-dark-surface3 border border-white/10 text-white font-medium rounded-xl transition-all"
              >
                Geri Dön
              </button>
              <button
                onClick={handlePasswordSubmit}
                className="flex-1 btn-neon px-6 py-3 rounded-xl font-bold"
              >
                <span className="text-white">Giriş Yap</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading screen
  if (isJoining || !isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-neon-purple/30 rounded-full blur-[120px] animate-float"></div>
          <div className="absolute bottom-1/4 -right-20 w-[500px] h-[500px] bg-neon-pink/20 rounded-full blur-[150px] animate-float"></div>
        </div>
        
        <div className="text-center animate-fade-in relative z-10">
          <div className="relative mb-8 inline-block">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-neon-purple/70 via-neon-pink/70 to-neon-cyan/70 p-[2px]">
              <div className="w-full h-full rounded-2xl bg-dark-bg flex items-center justify-center">
                <Play className="w-10 h-10 text-white ml-1" />
              </div>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">
            {!isConnected ? 'Bağlanıyor...' : 'Odaya katılıyor...'}
          </h2>
          <p className="text-dark-text2 font-mono text-neon-purple">{urlRoomId}</p>
          <div className="mt-6 flex justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-3 h-3 rounded-full bg-gradient-to-r from-neon-purple to-neon-pink animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const displayRoomId = urlRoomId || roomId;

  return (
    <div className={`min-h-screen animate-fade-in ${isTheaterMode ? 'h-screen h-[100dvh] overflow-hidden p-0 fixed inset-0 w-full' : 'p-4'}`}>
      {/* Mobile Theater Controls */}
      {isTheaterMode && (
        <div className="lg:hidden fixed top-4 right-4 z-50 flex gap-2">
          <button
            onClick={() => setIsMobileChatOpen(!isMobileChatOpen)}
            className="relative p-3 bg-dark-surface/90 backdrop-blur-xl rounded-xl text-white shadow-lg border border-neon-purple/30 hover:border-neon-purple transition-all"
          >
            <MessageSquare className="w-5 h-5" />
            {unreadCount > 0 && !isMobileChatOpen && (
              <span className="absolute -top-1 -right-1 bg-gradient-to-r from-neon-pink to-neon-purple text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setIsTheaterMode(false)}
            className="p-3 bg-dark-surface/90 backdrop-blur-xl rounded-xl text-white shadow-lg border border-neon-purple/30 hover:border-neon-purple transition-all"
          >
            <Theater className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Header */}
      {!isTheaterMode && (
        <div className="max-w-7xl mx-auto mb-4">
          <div className="glass-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 animate-slide-down">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-neon-purple/70 via-neon-pink/70 to-neon-cyan/70 p-[2px]">
                <div className="w-full h-full rounded-xl bg-dark-bg flex items-center justify-center">
                  <Play className="w-5 h-5 text-white ml-0.5" fill="currentColor" />
                </div>
              </div>
              
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-dark-text2 text-sm">Oda:</span>
                  <span className="font-mono text-white font-bold gradient-text">{displayRoomId}</span>
                  {hasPassword && <Lock className="w-4 h-4 text-neon-pink" />}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                  <span className="text-dark-text2 text-sm">{username}</span>
                </div>
              </div>
              
              <button
                onClick={copyRoomId}
                className={`px-4 py-2 rounded-xl border transition-all flex items-center gap-2 text-sm font-medium ${
                  copied 
                    ? 'bg-green-500/20 border-green-500/50 text-green-400' 
                    : 'bg-dark-surface2/50 border-white/10 hover:border-neon-purple/50 text-white'
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Kopyalandı!' : 'Kopyala'}</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
                isConnected 
                  ? 'bg-green-500/20 border-green-500/30 text-green-400' 
                  : 'bg-red-500/20 border-red-500/30 text-red-400'
              }`}>
                {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                <span className="text-sm font-medium">
                  {isConnected ? (ping > 0 ? `${ping}ms` : 'Bağlı') : 'Bağlantı Yok'}
                </span>
              </div>

              <button
                onClick={handleLeaveRoom}
                className="px-4 py-2 bg-dark-surface2/50 hover:bg-red-500/20 border border-white/10 hover:border-red-500/50 text-white hover:text-red-400 rounded-xl transition-all flex items-center gap-2 font-medium"
              >
                <LogOut className="w-4 h-4" />
                <span>Çıkış</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={`transition-all duration-300 ${isTheaterMode ? 'h-screen w-full' : 'max-w-7xl mx-auto'}`}>
        <div className={`grid transition-all duration-300 ${
          isTheaterMode 
            ? `lg:grid-cols-[1fr_400px] h-screen gap-0 ${isMobileChatOpen ? 'grid-cols-[1fr_280px]' : 'grid-cols-1'}`
            : 'grid-cols-1 lg:grid-cols-3 gap-4 lg:h-[calc(100vh-140px)]'
        }`}>
          <div className={`${isTheaterMode ? 'h-screen w-full' : 'min-h-[400px] lg:min-h-0 lg:col-span-2'} animate-slide-up`}>
            <VideoPlayer isTheaterMode={isTheaterMode} onTheaterModeToggle={() => setIsTheaterMode(!isTheaterMode)} />
          </div>

          {!isTheaterMode && (
            <div className="flex flex-col gap-4 animate-slide-up lg:col-span-1 lg:h-[calc(100vh-140px)]" style={{ animationDelay: '0.1s' }}>
              <div className="flex-shrink-0">
                <UserList />
              </div>
              <div className="flex-1 min-h-[300px] lg:min-h-0">
                <ChatBox />
              </div>
            </div>
          )}

          {isTheaterMode && (
            <div className="hidden lg:flex h-screen bg-dark-surface/95 backdrop-blur-xl border-l border-neon-purple/20 animate-slide-in-right">
              <div className="w-full h-full">
                <ChatBox isTheaterMode={true} />
              </div>
            </div>
          )}

          {isTheaterMode && isMobileChatOpen && (
            <div className="lg:hidden h-screen bg-dark-surface/95 backdrop-blur-xl border-l border-neon-purple/20 animate-slide-in-right">
              <div className="w-full h-full flex flex-col">
                <div className="flex items-center justify-between p-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-neon-purple" />
                    <span className="text-white text-sm font-bold">Chat</span>
                  </div>
                  <button onClick={() => setIsMobileChatOpen(false)} className="p-1.5 hover:bg-dark-surface2 rounded-lg transition-all">
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <ChatBox isTheaterMode={true} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {!isTheaterMode && <Footer />}
    </div>
  );
};

export default Room;
