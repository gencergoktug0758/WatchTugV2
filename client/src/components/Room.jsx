import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useSocket } from '../context/SocketContext';
import VideoPlayer from './VideoPlayer';
import ChatBox from './ChatBox';
import UserList from './UserList';
import { ToastContainer } from './Toast';
import { LogOut, Copy, Wifi, WifiOff } from 'lucide-react';

const Room = () => {
  const { roomId, username, userId, ping, connectionStatus, resetRoom, clearAll } = useStore();
  const { isConnected } = useSocket();
  const [toasts, setToasts] = useState([]);
  const { on, off } = useSocket();

  const addToast = (message, type = 'info', duration = 3000) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

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
  }, [userId, on, off]);

  const handleLeaveRoom = () => {
    if (confirm('Odadan ayrılmak istediğinize emin misiniz?')) {
      resetRoom();
      clearAll();
      window.location.reload();
    }
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    addToast('Oda ID kopyalandı!', 'info', 2000);
  };

  return (
    <div className="min-h-screen bg-dark-bg p-4">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-4">
        <div className="bg-dark-surface rounded-lg p-4 border border-dark-surface2 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-dark-text font-bold text-lg">Oda: {roomId}</h2>
              <p className="text-dark-text2 text-sm">Kullanıcı: {username}</p>
            </div>
            <button
              onClick={copyRoomId}
              className="px-3 py-2 bg-dark-surface2 hover:bg-dark-surface2/80 rounded-lg transition flex items-center gap-2 text-dark-text text-sm"
              title="Oda ID'sini Kopyala"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <Wifi className="w-5 h-5 text-green-500" />
                  <span className="text-dark-text text-sm">
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
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition flex items-center gap-2"
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
          <div className="lg:col-span-2 order-1 lg:order-1 min-h-[400px] lg:min-h-0">
            <VideoPlayer />
          </div>

          {/* Sidebar - Chat and Users */}
          <div className="lg:col-span-1 flex flex-col gap-4 order-2 lg:order-2 lg:h-[calc(100vh-180px)]">
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

