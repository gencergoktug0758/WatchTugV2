import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useSocket } from '../context/SocketContext';
import { ToastContainer } from './Toast';
import Footer from './Footer';
import { 
  Play, Sparkles, ArrowRight, Users, Monitor, Zap, 
  TrendingUp, Clock, Shuffle, Lock, Unlock, Tv, 
  Eye, X, ChevronRight, Star
} from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [toasts, setToasts] = useState([]);
  const navigate = useNavigate();
  
  const { 
    setUsername: setStoreUsername, 
    setUserId, 
    setRoomId, 
    username: storedUsername,
    resetRoom,
    popularRooms,
    globalStats,
    recentRooms,
    addRecentRoom,
    removeRecentRoom
  } = useStore();
  
  const { isConnected, refreshPopularRooms } = useSocket();

  useEffect(() => {
    if (storedUsername) setUsername(storedUsername);
  }, [storedUsername]);
  
  useEffect(() => {
    // Sadece local state'i resetle, socket'e bir şey gönderme
    resetRoom();
  }, []);
  
  useEffect(() => {
    // Bağlantı kurulduğunda hemen popüler odaları getir
    if (isConnected) {
      refreshPopularRooms();
    }
    
    // Popüler odaları her 10 saniyede yenile
    const interval = setInterval(() => {
      if (isConnected) refreshPopularRooms();
    }, 10000);
    return () => clearInterval(interval);
  }, [isConnected]);

  const addToast = (message, type = 'error', duration = 4000) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const generateUserId = () => {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const generateRandomRoomId = () => {
    const adjectives = ['cool', 'epic', 'mega', 'super', 'turbo', 'ultra', 'hyper'];
    const nouns = ['party', 'room', 'zone', 'hub', 'lounge', 'cinema', 'stream'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 999);
    return `${adj}-${noun}-${num}`;
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
      addToast('Sunucuya bağlanılıyor...', 'error');
      return;
    }

    const oderId = generateUserId();
    const sanitizedRoomId = sanitizeRoomId(roomIdInput);

    setStoreUsername(username.trim());
    setUserId(oderId);
    setRoomId(sanitizedRoomId);
    
    // Son odalara ekle
    addRecentRoom({
      roomId: sanitizedRoomId,
      joinedAt: Date.now(),
      hasPassword: showPassword && password.length > 0
    });

    // Şifreli oda ise query param ile gönder
    if (showPassword && password) {
      navigate(`/room/${sanitizedRoomId}?create=true&password=${encodeURIComponent(password)}`);
    } else {
      navigate(`/room/${sanitizedRoomId}`);
    }
  };

  const handleJoinPopularRoom = (roomId) => {
    if (!username.trim()) {
      addToast('Önce kullanıcı adı girin!', 'error');
      return;
    }
    setRoomIdInput(roomId);
    
    const oderId = generateUserId();
    setStoreUsername(username.trim());
    setUserId(oderId);
    setRoomId(roomId);
    
    addRecentRoom({ roomId, joinedAt: Date.now(), hasPassword: false });
    navigate(`/room/${roomId}`);
  };

  const handleJoinRecentRoom = (room) => {
    if (!username.trim()) {
      addToast('Önce kullanıcı adı girin!', 'error');
      return;
    }
    
    const oderId = generateUserId();
    setStoreUsername(username.trim());
    setUserId(oderId);
    setRoomId(room.roomId);
    navigate(`/room/${room.roomId}`);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-[500px] h-[500px] bg-neon-purple/20 rounded-full blur-[150px] animate-float"></div>
        <div className="absolute bottom-1/4 -right-20 w-[600px] h-[600px] bg-neon-pink/15 rounded-full blur-[180px] animate-float" style={{ animationDelay: '-3s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-neon-cyan/10 rounded-full blur-[200px] animate-pulse"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(168,85,247,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(168,85,247,0.02)_1px,transparent_1px)] bg-[size:60px_60px]"></div>
      </div>

      {/* Left Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative z-10">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8 animate-fade-in">
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-neon-purple via-neon-pink to-neon-cyan p-[2px] animate-pulse-glow">
                  <div className="w-full h-full rounded-2xl bg-dark-bg flex items-center justify-center">
                    <Play className="w-8 h-8 text-white ml-1" fill="currentColor" />
                  </div>
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-neon-cyan rounded-full animate-bounce-slow"></div>
              </div>
              <div>
                <h1 className="text-4xl sm:text-5xl font-bold">
                  <span className="text-white">Watch</span>
                  <span className="gradient-text">Tug</span>
                </h1>
                <div className="flex items-center gap-1.5 justify-center mt-1">
                  <Zap className="w-3.5 h-3.5 text-neon-cyan" />
                  <p className="text-dark-text2 text-sm">Premium Watch Party</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center justify-center gap-8 mb-8 animate-fade-in-delay">
            <div className="text-center">
              <div className="text-2xl font-bold gradient-text">{globalStats.totalActiveUsers || 0}</div>
              <div className="text-dark-text2 text-xs">Aktif Kullanıcı</div>
            </div>
            <div className="w-px h-8 bg-white/10"></div>
            <div className="text-center">
              <div className="text-2xl font-bold gradient-text">{globalStats.totalRooms || 0}</div>
              <div className="text-dark-text2 text-xs">Aktif Oda</div>
            </div>
          </div>

          {/* Main Card */}
          <div className="glass-card rounded-3xl p-6 sm:p-8 animate-slide-up">
            <div className="space-y-5">
              {/* Username */}
              <div className="space-y-2 relative z-10">
                <label className="block text-dark-text2 text-sm font-medium ml-1">👤 Kullanıcı Adı</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && roomIdInput.trim() && handleSubmit()}
                  placeholder="İsminizi girin"
                  className="w-full px-5 py-3.5 bg-dark-surface2 border border-white/10 hover:border-neon-purple/40 focus:border-neon-purple rounded-xl text-white placeholder-dark-text2 focus:outline-none focus:ring-2 focus:ring-neon-purple/20 transition-all"
                  autoFocus
                />
              </div>

              {/* Room ID with Random Button */}
              <div className="space-y-2 relative z-10">
                <label className="block text-dark-text2 text-sm font-medium ml-1">🚀 Oda ID</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={roomIdInput}
                    onChange={(e) => setRoomIdInput(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    onKeyPress={(e) => e.key === 'Enter' && username.trim() && handleSubmit()}
                    placeholder="örn: film-gecesi"
                    className="flex-1 px-5 py-3.5 bg-dark-surface2 border border-white/10 hover:border-neon-purple/40 focus:border-neon-purple rounded-xl text-white placeholder-dark-text2 focus:outline-none focus:ring-2 focus:ring-neon-purple/20 transition-all font-mono"
                    maxLength={30}
                  />
                  <button
                    onClick={() => setRoomIdInput(generateRandomRoomId())}
                    className="px-4 bg-dark-surface2 border border-white/10 hover:border-neon-cyan/50 rounded-xl text-neon-cyan transition-all hover:bg-neon-cyan/10"
                    title="Rastgele Oda ID"
                  >
                    <Shuffle className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Password Toggle */}
              <div className="relative z-10">
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className={`flex items-center gap-2 text-sm font-medium transition-all ${
                    showPassword ? 'text-neon-pink' : 'text-dark-text2 hover:text-white'
                  }`}
                >
                  {showPassword ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  <span>{showPassword ? 'Şifreli Oda (Aktif)' : 'Şifreli Oda Oluştur'}</span>
                </button>
                
                {showPassword && (
                  <div className="mt-3 animate-fade-in">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Oda şifresi belirle"
                      className="w-full px-5 py-3.5 bg-dark-surface2 border border-neon-pink/30 hover:border-neon-pink/50 focus:border-neon-pink rounded-xl text-white placeholder-dark-text2 focus:outline-none focus:ring-2 focus:ring-neon-pink/20 transition-all"
                    />
                    <p className="text-xs text-dark-text2 mt-2 ml-1">
                      🔐 Bu şifreyi arkadaşlarınla paylaş
                    </p>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={!username.trim() || !roomIdInput.trim() || !isConnected}
                className="btn-neon w-full px-6 py-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg font-bold relative z-10"
              >
                <span className="text-white">Odaya Gir</span>
                <ArrowRight className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {/* Recent Rooms */}
          {recentRooms.length > 0 && (
            <div className="mt-6 animate-fade-in-delay-2">
              <h3 className="text-dark-text2 text-sm font-medium mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Son Odalar
              </h3>
              <div className="flex flex-wrap gap-2">
                {recentRooms.map((room) => (
                  <button
                    key={room.roomId}
                    onClick={() => handleJoinRecentRoom(room)}
                    className="group flex items-center gap-2 px-3 py-2 bg-dark-surface2/50 hover:bg-dark-surface2 border border-white/10 hover:border-neon-purple/30 rounded-lg text-sm transition-all"
                  >
                    {room.hasPassword && <Lock className="w-3 h-3 text-neon-pink" />}
                    <span className="text-white font-mono">{room.roomId}</span>
                    <X
                      className="w-3 h-3 text-dark-text2 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRecentRoom(room.roomId);
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Connection Status */}
          <div className="mt-6 text-center animate-fade-in-delay-3">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium ${
              isConnected 
                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                : 'bg-neon-purple/20 text-neon-purple border border-neon-purple/30'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-neon-purple'} animate-pulse`}></span>
              {isConnected ? '✓ Bağlandı' : 'Bağlanıyor...'}
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Popular Rooms */}
      <div className="lg:w-[420px] bg-dark-surface/50 backdrop-blur-xl border-l border-white/5 p-6 lg:p-8 relative z-10">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-neon-pink" />
              Popüler Odalar
            </h2>
            <p className="text-dark-text2 text-sm mt-1">En aktif watch party'ler</p>
          </div>

          {/* Popular Rooms List */}
          <div className="flex-1 space-y-3 overflow-y-auto">
            {popularRooms.length === 0 ? (
              <div className="text-center py-12">
                <Tv className="w-12 h-12 text-dark-text2/30 mx-auto mb-3" />
                <p className="text-dark-text2">Henüz aktif oda yok</p>
                <p className="text-dark-text2/60 text-sm mt-1">İlk odayı sen oluştur! 🚀</p>
              </div>
            ) : (
              popularRooms.map((room, index) => (
                <button
                  key={room.roomId}
                  onClick={() => handleJoinPopularRoom(room.roomId)}
                  className="w-full glass-card rounded-xl p-4 text-left transition-all hover:border-neon-purple/40 group animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Rank Badge */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                        index === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-dark-bg' :
                        index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-dark-bg' :
                        index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-dark-bg' :
                        'bg-dark-surface3 text-dark-text2'
                      }`}>
                        {index + 1}
                      </div>
                      
                      <div>
                        <div className="font-mono text-white font-medium group-hover:text-neon-purple transition-colors">
                          {room.roomId}
                        </div>
                        <div className="text-dark-text2 text-xs flex items-center gap-2 mt-0.5">
                          <span>Host: {room.hostName}</span>
                          {room.hasStream && (
                            <span className="flex items-center gap-1 text-neon-pink">
                              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                              CANLI
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-neon-cyan">
                        <Users className="w-4 h-4" />
                        <span className="font-bold">{room.userCount}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-dark-text2 group-hover:text-neon-purple group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Features Grid */}
          <div className="mt-6 pt-6 border-t border-white/5">
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-card rounded-xl p-3 text-center">
                <Monitor className="w-5 h-5 text-neon-purple mx-auto mb-1.5" />
                <p className="text-white text-xs font-medium">HD Yayın</p>
              </div>
              <div className="glass-card rounded-xl p-3 text-center">
                <Users className="w-5 h-5 text-neon-cyan mx-auto mb-1.5" />
                <p className="text-white text-xs font-medium">Sınırsız</p>
              </div>
              <div className="glass-card rounded-xl p-3 text-center">
                <Lock className="w-5 h-5 text-neon-pink mx-auto mb-1.5" />
                <p className="text-white text-xs font-medium">Şifreli Oda</p>
              </div>
              <div className="glass-card rounded-xl p-3 text-center">
                <Zap className="w-5 h-5 text-yellow-400 mx-auto mb-1.5" />
                <p className="text-white text-xs font-medium">Düşük Gecikme</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <Footer />
    </div>
  );
};

export default Login;
