import { useState } from 'react';
import { useStore } from '../store/useStore';
import { useSocket } from '../context/SocketContext';
import { Video, Users, LogIn } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const { setUsername: setStoreUsername, setUserId, setRoomId } = useStore();
  const { emit } = useSocket();

  const generateUserId = () => {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const generateRoomId = () => {
    return `room_${Math.random().toString(36).substr(2, 9)}`;
  };

  const handleCreateRoom = () => {
    if (!username.trim()) {
      alert('Lütfen bir kullanıcı adı girin!');
      return;
    }

    const userId = generateUserId();
    const roomId = generateRoomId();

    setStoreUsername(username.trim());
    setUserId(userId);
    setRoomId(roomId);

    emit('create-room', { roomId, username: username.trim(), userId });
  };

  const handleJoinRoom = () => {
    if (!username.trim()) {
      alert('Lütfen bir kullanıcı adı girin!');
      return;
    }

    if (!roomIdInput.trim()) {
      alert('Lütfen bir oda ID girin!');
      return;
    }

    setIsJoining(true);
    const userId = generateUserId();

    setStoreUsername(username.trim());
    setUserId(userId);
    setRoomId(roomIdInput.trim());

    emit('join-room', { roomId: roomIdInput.trim(), username: username.trim(), userId });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-bg via-dark-surface to-dark-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Video className="w-12 h-12 text-dark-accent" />
            <h1 className="text-4xl font-bold text-dark-text">WatchTug</h1>
          </div>
          <p className="text-dark-text2 text-lg">Birlikte film izle, ekran paylaş</p>
        </div>

        <div className="bg-dark-surface rounded-lg p-8 shadow-2xl border border-dark-surface2">
          <div className="space-y-6">
            <div>
              <label className="block text-dark-text2 text-sm font-medium mb-2">
                Kullanıcı Adı
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !roomIdInput) {
                    handleCreateRoom();
                  } else if (e.key === 'Enter' && roomIdInput) {
                    handleJoinRoom();
                  }
                }}
                placeholder="Adınızı girin"
                className="w-full px-4 py-3 bg-dark-surface2 border border-dark-surface2 rounded-lg text-dark-text placeholder-dark-text2 focus:outline-none focus:ring-2 focus:ring-dark-accent focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-dark-text2 text-sm font-medium mb-2">
                Oda ID (Katılmak için)
              </label>
              <input
                type="text"
                value={roomIdInput}
                onChange={(e) => setRoomIdInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleJoinRoom();
                  }
                }}
                placeholder="Oda ID'sini girin"
                className="w-full px-4 py-3 bg-dark-surface2 border border-dark-surface2 rounded-lg text-dark-text placeholder-dark-text2 focus:outline-none focus:ring-2 focus:ring-dark-accent focus:border-transparent transition"
              />
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleCreateRoom}
                disabled={!username.trim()}
                className="w-full px-6 py-3 bg-dark-accent hover:bg-red-600 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Video className="w-5 h-5" />
                Oda Oluştur
              </button>

              <button
                onClick={handleJoinRoom}
                disabled={!username.trim() || !roomIdInput.trim() || isJoining}
                className="w-full px-6 py-3 bg-dark-surface2 hover:bg-dark-surface2/80 text-dark-text font-semibold rounded-lg border border-dark-surface2 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogIn className="w-5 h-5" />
                {isJoining ? 'Katılıyor...' : 'Odaya Katıl'}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-dark-text2 text-sm">
          <p>Oda oluşturduğunuzda size özel bir oda ID'si verilecektir.</p>
          <p className="mt-2">Bu ID'yi arkadaşlarınızla paylaşarak birlikte izleyebilirsiniz.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;

