import { Users, Crown } from 'lucide-react';
import { useStore } from '../store/useStore';

const UserList = () => {
  const { users, userId, isHost } = useStore();

  return (
    <div className="bg-gradient-to-br from-dark-surface/95 to-dark-surface/90 backdrop-blur-xl rounded-2xl p-5 border border-red-500/20 shadow-2xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center shadow-lg shadow-red-500/30">
          <Users className="w-5 h-5 text-white" />
        </div>
        <h3 className="text-white font-bold text-lg">Kullanıcılar ({users.length})</h3>
      </div>
      <div className="space-y-2.5 max-h-48 overflow-y-auto">
        {users.map((user, index) => (
          <div
            key={user.userId}
            className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 transform hover:scale-[1.02] border ${
              user.userId === userId
                ? 'bg-gradient-to-r from-red-600/20 to-red-700/20 border-red-500/50 shadow-lg backdrop-blur-sm'
                : 'bg-dark-surface2/60 backdrop-blur-sm border-dark-surface2/50 hover:border-red-500/30 hover:bg-dark-surface2/80'
            }`}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50"></div>
            <span className="text-white text-sm font-medium flex-1 truncate">
              {user.username}
            </span>
            {user.userId === userId && (
              <span className="text-xs text-white/80 bg-red-600/30 px-2.5 py-1 rounded-lg font-medium border border-red-500/30">Sen</span>
            )}
            {isHost && user.userId === userId && (
              <Crown className="w-5 h-5 text-yellow-400 animate-bounce-slow drop-shadow-lg" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserList;

