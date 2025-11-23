import { Users, Crown } from 'lucide-react';
import { useStore } from '../store/useStore';

const UserList = () => {
  const { users, userId, isHost } = useStore();

  return (
    <div className="bg-dark-surface rounded-lg p-4 border border-dark-surface2">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-5 h-5 text-dark-text2" />
        <h3 className="text-dark-text font-semibold">Kullanıcılar ({users.length})</h3>
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {users.map((user) => (
          <div
            key={user.userId}
            className={`flex items-center gap-2 p-2 rounded ${
              user.userId === userId
                ? 'bg-dark-accent/20 border border-dark-accent/50'
                : 'bg-dark-surface2'
            }`}
          >
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-dark-text text-sm flex-1 truncate">
              {user.username}
            </span>
            {user.userId === userId && (
              <span className="text-xs text-dark-text2">(Sen)</span>
            )}
            {isHost && user.userId === userId && (
              <Crown className="w-4 h-4 text-yellow-500" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserList;

