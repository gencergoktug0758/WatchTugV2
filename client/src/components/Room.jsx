import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useSocket } from '../context/SocketContext';
import VideoPlayer from './VideoPlayer';
import ChatBox from './ChatBox';
import UserList from './UserList';
import { ToastContainer } from './Toast';
import { LogOut, Copy, Wifi, WifiOff, Loader2, CheckCircle2 } from 'lucide-react';

const Room = () => {
  const { roomId: urlRoomId } = useParams();
  const navigate = useNavigate();
  const { roomId, username, userId, ping, connectionStatus, resetRoom, clearAll, users, setRoomId } = useStore();
  const { isConnected, emit, on, off } = useSocket();
  const [toasts, setToasts] = useState([]);
  const [isJoining, setIsJoining] = useState(true);
  const [hasEmittedJoin, setHasEmittedJoin] = useState(false);

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
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="relative mb-6">
            <Loader2 className="w-16 h-16 text-dark-accent mx-auto animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-dark-accent/20 border-t-dark-accent rounded-full animate-spin"></div>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-dark-text mb-2 animate-pulse">
            {!isConnected ? 'Bağlanıyor...' : 'Odaya katılıyor...'}
          </h2>
          <p className="text-dark-text2">
            {urlRoomId && `Oda: ${urlRoomId}`}
          </p>
        </div>
      </div>
    );
  }

  const displayRoomId = urlRoomId || roomId;

  return (
    <div className="min-h-screen bg-dark-bg p-4 animate-fade-in">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-4">
        <div className="bg-dark-surface/90 backdrop-blur-sm rounded-xl p-4 border border-dark-surface2 flex flex-wrap items-center justify-between gap-4 shadow-lg animate-slide-down">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-dark-text font-bold text-lg flex items-center gap-2">
                <span className="text-dark-accent">Oda:</span>
                <span className="font-mono">{displayRoomId}</span>
              </h2>
              <p className="text-dark-text2 text-sm flex items-center gap-2 mt-1">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                {username}
              </p>
            </div>
            <button
              onClick={copyRoomId}
              className="px-3 py-2 bg-dark-surface2 hover:bg-dark-accent/20 rounded-lg transition-all duration-200 flex items-center gap-2 text-dark-text text-sm transform hover:scale-105 active:scale-95 border border-dark-surface2 hover:border-dark-accent/50"
              title="Oda ID'sini Kopyala"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-2 bg-dark-surface2 rounded-lg">
              {isConnected ? (
                <>
                  <Wifi className="w-5 h-5 text-green-500 animate-pulse" />
                  <span className="text-dark-text text-sm font-medium">
                    {ping > 0 ? `${ping}ms` : 'Bağlı'}
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="w-5 h-5 text-red-500" />
                  <span className="text-dark-text text-sm text-red-500">Bağlantı Yok</span>
                </>
              )}
            </div>

            <button
              onClick={handleLeaveRoom}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all duration-200 flex items-center gap-2 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
            >
              <LogOut className="w-4 h-4" />
              Çıkış
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:h-[calc(100vh-180px)]">
          {/* Video Player - Takes 2 columns on desktop, full width on mobile */}
          <div className="lg:col-span-2 order-1 lg:order-1 min-h-[400px] lg:min-h-0 animate-slide-up">
            <VideoPlayer />
          </div>

          {/* Sidebar - Chat and Users */}
          <div className="lg:col-span-1 flex flex-col gap-4 order-2 lg:order-2 lg:h-[calc(100vh-180px)] animate-slide-up delay-100">
            {/* User List */}
            <div className="flex-shrink-0">
              <UserList />
            </div>

            {/* Chat Box */}
            <div className="flex-1 min-h-[300px] lg:min-h-0">
              <ChatBox />
            </div>
          </div>
        </div>
      </div>

      {/* Toast Container */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
};

export default Room;
