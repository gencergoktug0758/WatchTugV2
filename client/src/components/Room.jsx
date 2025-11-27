import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useSocket } from '../context/SocketContext';
import VideoPlayer from './VideoPlayer';
import ChatBox from './ChatBox';
import UserList from './UserList';
import { ToastContainer } from './Toast';
import Footer from './Footer';
import { LogOut, Copy, Wifi, WifiOff, Loader2, CheckCircle2, Theater, X, MessageSquare } from 'lucide-react';

const Room = () => {
  const { roomId: urlRoomId } = useParams();
  const navigate = useNavigate();
  const { roomId, username, userId, ping, connectionStatus, resetRoom, clearAll, users, setRoomId } = useStore();
  const { isConnected, emit, on, off } = useSocket();
  const [toasts, setToasts] = useState([]);
  const [isJoining, setIsJoining] = useState(true);
  const [hasEmittedJoin, setHasEmittedJoin] = useState(false);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const addToast = (message, type = 'info', duration = 3000) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  // Initialize room connection from URL - only run once when URL changes
  useEffect(() => {
    if (!urlRoomId) {
      navigate('/');
      return;
    }

    // Wait for socket connection
    if (!isConnected) {
      console.log('Waiting for socket connection...');
      return;
    }

    // If we have username and userId, join the room
    if (username && userId) {
      // Only set roomId if it's different (prevent infinite loop)
      if (roomId !== urlRoomId) {
        setRoomId(urlRoomId);
      }
      
      // Only emit once per URL change
      if (!hasEmittedJoin && username && userId) {
        setHasEmittedJoin(true);
        console.log('Joining room:', urlRoomId, 'as', username, 'userId:', userId);
        // Small delay to ensure event listeners are set up
        const timeoutId = setTimeout(() => {
          emit('join-room', { roomId: urlRoomId, username, userId });
        }, 100);
        
        return () => clearTimeout(timeoutId);
      }
    } else {
      // No user data, redirect to login
      console.log('No user data, redirecting to login');
      navigate('/');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlRoomId, isConnected, username, userId]); // Depend on URL, connection, and user data

  // Reset hasEmittedJoin when URL changes
  useEffect(() => {
    setHasEmittedJoin(false);
  }, [urlRoomId]);

  // Handle room joined/created events - ALWAYS listen, not just when connected
  useEffect(() => {
    const handleRoomJoined = (data) => {
      console.log('Room joined event received:', data);
      setIsJoining(false);
      setHasEmittedJoin(false); // Reset so we can rejoin if needed
    };

    const handleRoomCreated = (data) => {
      console.log('Room created event received:', data);
      setIsJoining(false);
      setHasEmittedJoin(false); // Reset so we can rejoin if needed
    };

    const handleRoomNotFound = () => {
      console.log('Room not found event received');
      setIsJoining(false);
      addToast('Oda bulunamadı! Ana sayfaya yönlendiriliyorsunuz...', 'error', 3000);
      setTimeout(() => {
        resetRoom();
        clearAll();
        navigate('/');
      }, 2000);
    };

    // Always listen to events, not just when connected
    on('room-joined', handleRoomJoined);
    on('room-created', handleRoomCreated);
    on('room-not-found', handleRoomNotFound);

    return () => {
      off('room-joined', handleRoomJoined);
      off('room-created', handleRoomCreated);
      off('room-not-found', handleRoomNotFound);
    };
  }, [on, off, navigate, resetRoom, clearAll, addToast]);

  // Handle room joined - hide loading after connection and users loaded
  useEffect(() => {
    if (isConnected && users.length > 0 && !isJoining) {
      // Already joined, no need to show loading
      return;
    }
    
    // If connected but no users yet, wait a bit
    if (isConnected && users.length === 0) {
      const timer = setTimeout(() => {
        if (users.length === 0) {
          // Still no users after 2 seconds, might be an issue
          console.log('No users after timeout, checking connection...');
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, users, isJoining]);

  // Handle socket events for toasts
  useEffect(() => {
    const handleUserJoined = (data) => {
      if (data.userId !== userId) {
        addToast(`${data.username} odaya katıldı`, 'user-joined');
      }
    };

    const handleUserLeft = (data) => {
      if (data.userId !== userId) {
        addToast(`${data.username} odadan ayrıldı`, 'user-left');
      }
    };

    const handleStreamStarted = () => {
      addToast('Yayın başladı', 'stream-started');
    };

    const handleStreamStopped = () => {
      addToast('Yayın durdu', 'stream-stopped');
    };

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
  }, [userId, on, off, addToast]);

  // Track unread messages for mobile chat button
  const { chatHistory } = useStore();
  const lastReadCountRef = useRef(0);
  
  useEffect(() => {
    if (isTheaterMode && !isMobileChatOpen) {
      // Chat kapalıyken yeni mesajlar geldiğinde unread count hesapla
      const newMessages = chatHistory.length - lastReadCountRef.current;
      if (newMessages > 0) {
        setUnreadCount(prev => prev + newMessages);
      }
      lastReadCountRef.current = chatHistory.length;
    } else if (isMobileChatOpen) {
      // Chat açıldığında unread count'u sıfırla ve lastReadCount'u güncelle
      setUnreadCount(0);
      lastReadCountRef.current = chatHistory.length;
    }
  }, [chatHistory.length, isTheaterMode, isMobileChatOpen]);

  const handleLeaveRoom = () => {
    if (confirm('Odadan ayrılmak istediğinize emin misiniz?')) {
      resetRoom();
      clearAll();
      navigate('/');
    }
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(urlRoomId || roomId);
    addToast('Oda ID kopyalandı!', 'info', 2000);
  };

  // Timeout for joining - if no response in 5 seconds, show error
  useEffect(() => {
    if (isJoining && isConnected) {
      const timeout = setTimeout(() => {
        if (isJoining) {
          console.error('Room join timeout');
          setIsJoining(false);
          addToast('Odaya bağlanılamadı. Lütfen tekrar deneyin.', 'error', 4000);
          setTimeout(() => {
            navigate('/');
          }, 2000);
        }
      }, 5000);

      return () => clearTimeout(timeout);
    }
  }, [isJoining, isConnected, addToast, navigate]);

  // Loading overlay
  if (isJoining || !isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-bg via-dark-surface to-dark-bg flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-red-600/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
        <div className="text-center animate-fade-in relative z-10">
          <div className="relative mb-8 inline-block">
            <div className="w-20 h-20 border-4 border-red-500/20 border-t-red-600 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 bg-red-600/20 rounded-full animate-pulse"></div>
            </div>
          </div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent mb-3 animate-pulse">
            {!isConnected ? 'Bağlanıyor...' : 'Odaya katılıyor...'}
          </h2>
          <p className="text-dark-text2 text-lg">
            {urlRoomId && `Oda: ${urlRoomId}`}
          </p>
        </div>
      </div>
    );
  }

  const displayRoomId = urlRoomId || roomId;

  return (
    <div className={`min-h-screen bg-dark-bg animate-fade-in ${isTheaterMode ? 'h-screen overflow-hidden p-0' : 'p-4'}`}>
      {/* Mobile Theater Mode Controls - Sadece mobilde ve tiyatro modunda */}
      {isTheaterMode && (
        <div className="lg:hidden fixed top-4 right-4 z-50 flex gap-2">
          {/* Chat Toggle Button with Notification */}
          <button
            onClick={() => setIsMobileChatOpen(!isMobileChatOpen)}
            className="relative p-3 bg-gradient-to-br from-red-600/90 to-red-700/90 backdrop-blur-md rounded-xl text-white shadow-2xl border border-red-500/50 transition-all duration-200 transform hover:scale-110 active:scale-95"
          >
            <MessageSquare className="w-5 h-5" />
            {unreadCount > 0 && !isMobileChatOpen && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {/* Theater Mode Toggle Button */}
          <button
            onClick={() => setIsTheaterMode(false)}
            className="p-3 bg-gradient-to-br from-red-600/90 to-red-700/90 backdrop-blur-md rounded-xl text-white shadow-2xl border border-red-500/50 transition-all duration-200 transform hover:scale-110 active:scale-95"
            title="Tiyatro Modunu Kapat"
          >
            <Theater className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Header - Gizle tiyatro modunda */}
      {!isTheaterMode && (
        <div className="max-w-7xl mx-auto mb-6">
          <div className="bg-gradient-to-r from-dark-surface/95 via-dark-surface/90 to-dark-surface/95 backdrop-blur-xl rounded-2xl p-5 border border-red-500/20 flex flex-wrap items-center justify-between gap-4 shadow-2xl shadow-red-500/10 animate-slide-down hover:border-red-500/30 transition-all duration-300">
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center shadow-lg shadow-red-500/30">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-dark-text font-bold text-lg flex items-center gap-2">
                    <span className="text-red-500">Oda:</span>
                    <span className="font-mono text-white">{displayRoomId}</span>
                  </h2>
                  <p className="text-dark-text2 text-sm flex items-center gap-2 mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                    <span className="text-white/80">{username}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={copyRoomId}
                className="px-4 py-2.5 bg-dark-surface2/80 hover:bg-dark-surface2 border border-dark-surface2 hover:border-red-500/50 rounded-xl transition-all duration-200 flex items-center gap-2 text-dark-text text-sm font-medium transform hover:scale-105 active:scale-95 shadow-md hover:shadow-lg"
                title="Oda ID'sini Kopyala"
              >
                <Copy className="w-4 h-4" />
                <span>Kopyala</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all duration-200 ${
                isConnected 
                  ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}>
                {isConnected ? (
                  <>
                    <Wifi className="w-5 h-5 animate-pulse" />
                    <span className="text-sm font-medium">
                      {ping > 0 ? `${ping}ms` : 'Bağlı'}
                    </span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-5 h-5" />
                    <span className="text-sm font-medium">Bağlantı Yok</span>
                  </>
                )}
              </div>

              <button
                onClick={handleLeaveRoom}
                className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl transition-all duration-200 flex items-center gap-2 font-medium transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl hover:shadow-red-500/30"
              >
                <LogOut className="w-4 h-4" />
                <span>Çıkış</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={`transition-all duration-300 ${
        isTheaterMode 
          ? 'h-screen w-full' 
          : 'max-w-7xl mx-auto px-4'
      }`}>
        <div className={`grid transition-all duration-300 ${
          isTheaterMode 
            ? `lg:grid-cols-[1fr_400px] h-screen gap-0 ${
                isMobileChatOpen 
                  ? 'grid-cols-[1fr_280px]' // Mobilde chat açıkken: video solda, chat sağda
                  : 'grid-cols-1' // Mobilde chat kapalıyken: video tam ekran ortada
              }`
            : 'grid-cols-1 lg:grid-cols-3 gap-4 lg:h-[calc(100vh-180px)]'
        }`}>
          {/* Video Player */}
          <div className={`${
            isTheaterMode 
              ? `h-screen ${
                  isMobileChatOpen 
                    ? 'w-full' // Chat açıkken video solda
                    : 'w-full' // Chat kapalıyken video tam ekran
                }`
              : 'min-h-[400px] lg:min-h-0 lg:col-span-2'
          } animate-slide-up`}>
            <VideoPlayer 
              isTheaterMode={isTheaterMode}
              onTheaterModeToggle={() => setIsTheaterMode(!isTheaterMode)}
            />
          </div>

          {/* Sidebar - Normal modda Chat ve Users */}
          {!isTheaterMode && (
            <div className="flex flex-col gap-4 animate-slide-up delay-100 lg:col-span-1 lg:h-[calc(100vh-180px)]">
              {/* User List */}
              <div className="flex-shrink-0">
                <UserList />
              </div>

              {/* Chat Box */}
              <div className="flex-1 min-h-[300px] lg:min-h-0">
                <ChatBox />
              </div>
            </div>
          )}

          {/* Theater Mode - Desktop Chat (Sadece lg+) */}
          {isTheaterMode && (
            <div className="hidden lg:flex h-screen bg-gradient-to-b from-dark-surface/95 to-dark-surface/90 backdrop-blur-xl border-l border-red-500/20 animate-slide-in-right shadow-2xl">
              <div className="w-full h-full flex flex-col">
                {/* Chat Box - Tam yükseklik */}
                <div className="flex-1 h-full overflow-hidden">
                  <ChatBox isTheaterMode={true} />
                </div>
              </div>
            </div>
          )}

          {/* Theater Mode - Mobile Chat (Kick style: Video solda, Chat sağda) */}
          {isTheaterMode && isMobileChatOpen && (
            <div className="lg:hidden h-screen bg-gradient-to-b from-dark-surface/95 to-dark-surface/90 backdrop-blur-xl border-l border-red-500/20 shadow-2xl animate-slide-in-right">
              <div className="w-full h-full flex flex-col">
                {/* Header with close button - Sadece chat'i kapatır */}
                <div className="flex items-center justify-between p-3 border-b border-red-500/20">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-red-500" />
                    <span className="text-white text-sm font-semibold">Chat</span>
                  </div>
                  <button
                    onClick={() => setIsMobileChatOpen(false)}
                    className="p-1.5 hover:bg-dark-surface2 rounded-lg transition-all duration-200 hover:scale-110"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>

                {/* Chat Box - Scrollable */}
                <div className="flex-1 overflow-hidden min-h-0">
                  <ChatBox isTheaterMode={true} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast Container */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      {/* Footer - Gizle tiyatro modunda */}
      {!isTheaterMode && <Footer />}
    </div>
  );
};

export default Room;
