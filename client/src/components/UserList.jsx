import { Users, Crown } from 'lucide-react';
import { useStore } from '../store/useStore';

const UserList = () => {
  const { users, userId, isHost } = useStore();

  return (
    <div className="bg-dark-surface/90 backdrop-blur-sm rounded-xl p-4 border border-dark-surface2 shadow-lg">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-5 h-5 text-dark-accent" />
        <h3 className="text-dark-text font-semibold">Kullanıcılar ({users.length})</h3>
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {users.map((user, index) => (
          <div
            key={user.userId}
            className={`flex items-center gap-2 p-2 rounded transition-all duration-200 transform hover:scale-105 ${
              user.userId === userId
                ? 'bg-dark-accent/20 border border-dark-accent/50 shadow-md'
                : 'bg-dark-surface2 hover:bg-dark-surface2/80'
            }`}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-dark-text text-sm flex-1 truncate">
              {user.username}
            </span>
            {user.userId === userId && (
              <span className="text-xs text-dark-text2 bg-dark-accent/30 px-2 py-0.5 rounded">(Sen)</span>
            )}
            {isHost && user.userId === userId && (
              <Crown className="w-4 h-4 text-yellow-500 animate-bounce-slow" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserList;

