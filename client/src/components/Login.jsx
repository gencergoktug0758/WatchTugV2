import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useSocket } from '../context/SocketContext';
import { Video, Sparkles } from 'lucide-react';
import { ToastContainer } from './Toast';

const Login = () => {
  const [username, setUsername] = useState('');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [toasts, setToasts] = useState([]);
  const navigate = useNavigate();
  const { setUsername: setStoreUsername, setUserId, setRoomId, username: storedUsername, resetRoom } = useStore();
  const { isConnected } = useSocket();

  // Load saved username on mount
  useEffect(() => {
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, [storedUsername]);
  
  // Clear room data when component mounts (only once)
  useEffect(() => {
    resetRoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Sadece mount'ta çalışsın

  const addToast = (message, type = 'error', duration = 4000) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  // No need for socket event handlers here - Room component will handle them

  const generateUserId = () => {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const sanitizeRoomId = (id) => {
    return id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  };

  const handleSubmit = async () => {
    if (!username.trim()) {
      addToast('Lütfen bir kullanıcı adı girin!', 'error');
      return;
    }

    if (!roomIdInput.trim()) {
      addToast('Lütfen bir oda ID girin!', 'error');
      return;
    }

    if (!isConnected) {
      addToast('Sunucuya bağlanılıyor, lütfen bekleyin...', 'error');
      return;
    }

    const userId = generateUserId();
    const sanitizedRoomId = sanitizeRoomId(roomIdInput);

    // Save username and user data
    setStoreUsername(username.trim());
    setUserId(userId);
    setRoomId(sanitizedRoomId);

    // Navigate to room - Room component will handle joining
    navigate(`/room/${sanitizedRoomId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-bg via-dark-surface to-dark-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-dark-accent/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4 animate-slide-down">
            <div className="relative">
              <Video className="w-12 h-12 text-dark-accent animate-bounce-slow" />
              <Sparkles className="w-6 h-6 text-yellow-400 absolute -top-1 -right-1 animate-spin-slow" />
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-dark-accent to-red-400 bg-clip-text text-transparent">
              WatchTug
            </h1>
          </div>
          <p className="text-dark-text2 text-lg animate-fade-in-delay">Birlikte film izle, ekran paylaş</p>
        </div>

        <div className="bg-dark-surface/90 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-dark-surface2 animate-slide-up">
          <div className="space-y-6">
            <div className="animate-fade-in">
              <label className="block text-dark-text2 text-sm font-medium mb-2">
                Kullanıcı Adı
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && username.trim() && roomIdInput.trim()) {
                    handleSubmit();
                  }
                }}
                placeholder="Adınızı girin"
                className="w-full px-4 py-3 bg-dark-surface2 border border-dark-surface2 rounded-lg text-dark-text placeholder-dark-text2 focus:outline-none focus:ring-2 focus:ring-dark-accent focus:border-transparent transition-all duration-200 hover:border-dark-accent/50"
                autoFocus
disabled={false}
              />
            </div>

            <div className="animate-fade-in-delay">
              <label className="block text-dark-text2 text-sm font-medium mb-2">
                Oda ID
              </label>
              <input
                type="text"
                value={roomIdInput}
                onChange={(e) => {
                  const value = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
                  setRoomIdInput(value);
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && username.trim() && roomIdInput.trim()) {
                    handleSubmit();
                  }
                }}
                placeholder="Oda ID girin (varsa katılır, yoksa oluşturur)"
                className="w-full px-4 py-3 bg-dark-surface2 border border-dark-surface2 rounded-lg text-dark-text placeholder-dark-text2 focus:outline-none focus:ring-2 focus:ring-dark-accent focus:border-transparent transition-all duration-200 hover:border-dark-accent/50"
                maxLength={30}
              />
              <p className="text-xs text-dark-text2 mt-2">
                💡 Oda varsa katılır, yoksa yeni oda oluşturur
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={handleSubmit}
                disabled={!username.trim() || !roomIdInput.trim() || !isConnected}
                className="w-full px-6 py-3 bg-gradient-to-r from-dark-accent to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
              >
                <Video className="w-5 h-5" />
                Odaya Gir / Oluştur
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-dark-text2 text-sm animate-fade-in-delay-3">
          <p className="mb-2">✨ Özel oda ID'si belirleyebilir veya mevcut odaya katılabilirsiniz</p>
          <p>Oda ID'sini arkadaşlarınızla paylaşarak birlikte izleyebilirsiniz</p>
        </div>
      </div>

      {/* Toast Container */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
};

export default Login;
