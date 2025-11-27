import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useSocket } from '../context/SocketContext';
import { ToastContainer } from './Toast';
import Footer from './Footer';

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
        <div className="absolute top-20 left-10 w-72 h-72 bg-red-600/15 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-700/5 rounded-full blur-3xl animate-pulse delay-2000"></div>
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4 animate-slide-down">
            {/* Modern Logo SVG */}
            <div className="relative logo-glow">
              <svg 
                width="64" 
                height="64" 
                viewBox="0 0 64 64" 
                className="transition-transform duration-300 hover:scale-110"
              >
                <defs>
                  <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#e50914" stopOpacity="1" />
                    <stop offset="100%" stopColor="#f40612" stopOpacity="1" />
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                
                {/* Play Button Circle */}
                <circle 
                  cx="32" 
                  cy="32" 
                  r="28" 
                  fill="url(#logoGradient)" 
                  filter="url(#glow)"
                />
                
                {/* Play Triangle */}
                <path 
                  d="M 24 20 L 24 44 L 44 32 Z" 
                  fill="white" 
                  opacity="0.95"
                />
              </svg>
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-red-500 via-red-600 to-red-700 bg-clip-text text-transparent tracking-tight">
              WatchTug
            </h1>
          </div>
          <p className="text-dark-text2 text-lg animate-fade-in-delay">Birlikte film izle, ekran paylaş</p>
        </div>

        <div className="bg-dark-surface/95 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-red-500/20 animate-slide-up hover:border-red-500/30 transition-all duration-300">
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
                className="w-full px-4 py-3 bg-dark-surface2 border border-dark-surface2 rounded-lg text-dark-text placeholder-dark-text2 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all duration-200 hover:border-red-500/30"
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
                className="w-full px-4 py-3 bg-dark-surface2 border border-dark-surface2 rounded-lg text-dark-text placeholder-dark-text2 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all duration-200 hover:border-red-500/30"
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
                className="w-full px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl hover:shadow-red-500/50"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
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
      
      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Login;
