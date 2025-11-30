import { useState } from 'react';
import { Users, Crown, User, Shield, ShieldCheck, MoreVertical, UserMinus } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useSocket } from '../context/SocketContext';

const UserList = () => {
  const { users, userId, isHost, moderators, roomId } = useStore();
  const { emit } = useSocket();
  const [activeMenu, setActiveMenu] = useState(null);

  const handleToggleModerator = (targetUserId) => {
    emit('toggle-moderator', { roomId, targetUserId });
    setActiveMenu(null);
  };

  const isModerator = (oderId) => moderators.includes(oderId);

  return (
    <div className="glass-card rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-cyan to-neon-blue flex items-center justify-center shadow-neon-cyan">
          <Users className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-white font-bold">Kullanıcılar</h3>
          <p className="text-dark-text2 text-xs">{users.length} kişi online</p>
        </div>
      </div>

      {/* User List */}
      <div className="space-y-2 max-h-48 overflow-y-auto overflow-x-visible">
        {users.length === 0 ? (
          <div className="text-center py-6">
            <User className="w-8 h-8 text-dark-text2/50 mx-auto mb-2" />
            <p className="text-dark-text2 text-sm">Henüz kimse yok</p>
          </div>
        ) : (
          users.map((user, index) => {
            const isCurrentUser = user.userId === userId;
            const isUserHost = user.userId === users.find(u => isHost && u.userId === userId)?.userId && isCurrentUser;
            const actualHost = users[0]; // First user is usually host
            const isThisUserHost = index === 0 || (isHost && isCurrentUser);
            const isUserModerator = isModerator(user.userId);
            
            return (
              <div
                key={user.userId}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 animate-fade-in relative group ${
                  isCurrentUser
                    ? 'bg-gradient-to-r from-neon-purple/20 to-neon-pink/10 border border-neon-purple/30'
                    : 'bg-dark-surface2/50 border border-transparent hover:border-white/10'
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Avatar */}
                <div className="relative">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white ${
                    isCurrentUser 
                      ? 'bg-gradient-to-br from-neon-purple to-neon-pink' 
                      : isUserModerator
                      ? 'bg-gradient-to-br from-neon-cyan to-neon-blue'
                      : 'bg-dark-surface3'
                  }`}>
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-dark-surface animate-pulse"></span>
                </div>

                {/* Username */}
                <div className="flex-1 min-w-0">
                  <span className="text-white text-sm font-medium truncate block">
                    {user.username}
                  </span>
                  {isUserModerator && !isThisUserHost && (
                    <span className="text-neon-cyan text-[10px] flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Moderatör
                    </span>
                  )}
                </div>

                {/* Badges */}
                <div className="flex items-center gap-1.5">
                  {isCurrentUser && (
                    <span className="text-[10px] bg-gradient-to-r from-neon-purple to-neon-pink text-white px-2 py-0.5 rounded-md font-bold">
                      Sen
                    </span>
                  )}
                  {isThisUserHost && (
                    <Crown className="w-4 h-4 text-yellow-400 animate-bounce-slow" title="Host" />
                  )}
                  {isUserModerator && !isThisUserHost && (
                    <ShieldCheck className="w-4 h-4 text-neon-cyan" title="Moderatör" />
                  )}
                </div>

                {/* Context Menu Button (only for host) */}
                {isHost && !isCurrentUser && (
                  <div className="relative">
                    <button
                      onClick={() => setActiveMenu(activeMenu === user.userId ? null : user.userId)}
                      className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-dark-surface3 rounded-lg transition-all"
                    >
                      <MoreVertical className="w-4 h-4 text-dark-text2" />
                    </button>

                    {/* Dropdown Menu - Yukarı açılır */}
                    {activeMenu === user.userId && (
                      <div className="absolute right-0 bottom-full mb-1 w-48 bg-dark-surface border border-white/10 rounded-xl shadow-xl z-[100] animate-scale-in overflow-hidden">
                        <button
                          onClick={() => handleToggleModerator(user.userId)}
                          className="w-full px-4 py-3 text-left text-sm hover:bg-dark-surface2 transition-colors flex items-center gap-3"
                        >
                          {isUserModerator ? (
                            <>
                              <Shield className="w-4 h-4 text-red-400" />
                              <span className="text-white">Moderatörlüğü Kaldır</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="w-4 h-4 text-neon-cyan" />
                              <span className="text-white">Moderatör Yap</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Legend */}
      {users.length > 0 && (
        <div className="mt-4 pt-3 border-t border-white/5">
          <div className="flex flex-wrap gap-3 text-[10px] text-dark-text2">
            <div className="flex items-center gap-1">
              <Crown className="w-3 h-3 text-yellow-400" />
              <span>Host</span>
            </div>
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-neon-cyan" />
              <span>Moderatör</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserList;
