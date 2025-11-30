import { useEffect, useState } from 'react';
import { X, UserPlus, UserMinus, Video, VideoOff, AlertCircle, Info, CheckCircle } from 'lucide-react';

const Toast = ({ message, type = 'info', onClose, duration = 3000 }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onClose(), 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'user-joined': return <UserPlus className="w-5 h-5" />;
      case 'user-left': return <UserMinus className="w-5 h-5" />;
      case 'stream-started': return <Video className="w-5 h-5" />;
      case 'stream-stopped': return <VideoOff className="w-5 h-5" />;
      case 'error': return <AlertCircle className="w-5 h-5" />;
      case 'success': return <CheckCircle className="w-5 h-5" />;
      default: return <Info className="w-5 h-5" />;
    }
  };

  const getStyles = () => {
    switch (type) {
      case 'user-joined':
        return 'bg-gradient-to-r from-green-500/20 to-green-600/10 border-green-500/30 text-green-400';
      case 'user-left':
        return 'bg-gradient-to-r from-orange-500/20 to-orange-600/10 border-orange-500/30 text-orange-400';
      case 'stream-started':
        return 'bg-gradient-to-r from-neon-purple/20 to-neon-pink/10 border-neon-purple/30 text-neon-purple';
      case 'stream-stopped':
        return 'bg-gradient-to-r from-red-500/20 to-red-600/10 border-red-500/30 text-red-400';
      case 'error':
        return 'bg-gradient-to-r from-red-500/20 to-red-600/10 border-red-500/30 text-red-400';
      case 'success':
        return 'bg-gradient-to-r from-green-500/20 to-green-600/10 border-green-500/30 text-green-400';
      default:
        return 'bg-gradient-to-r from-neon-cyan/20 to-neon-blue/10 border-neon-cyan/30 text-neon-cyan';
    }
  };

  if (!isVisible) return null;

  return (
    <div className={`backdrop-blur-xl border rounded-xl shadow-2xl overflow-hidden toast-enter flex items-center gap-3 px-4 py-3 ${getStyles()}`}>
      <div className="flex-shrink-0">{getIcon()}</div>
      <span className="flex-1 text-white text-sm font-medium">{message}</span>
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(() => onClose(), 300);
        }}
        className="p-1 hover:bg-white/10 rounded-lg transition-all text-white/70 hover:text-white"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const ToastContainer = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-4 right-4 left-4 lg:left-auto z-50 flex flex-col gap-2 lg:min-w-[320px] lg:max-w-md">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
          duration={toast.duration}
        />
      ))}
    </div>
  );
};
