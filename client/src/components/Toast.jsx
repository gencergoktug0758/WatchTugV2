import { useEffect, useState } from 'react';
import { X, UserPlus, UserMinus, Video, VideoOff } from 'lucide-react';

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
      case 'user-joined':
        return <UserPlus className="w-5 h-5" />;
      case 'user-left':
        return <UserMinus className="w-5 h-5" />;
      case 'stream-started':
        return <Video className="w-5 h-5" />;
      case 'stream-stopped':
        return <VideoOff className="w-5 h-5" />;
      default:
        return null;
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'user-joined':
        return 'bg-green-600';
      case 'user-left':
        return 'bg-orange-600';
      case 'stream-started':
        return 'bg-blue-600';
      case 'stream-stopped':
        return 'bg-red-600';
      default:
        return 'bg-dark-surface2';
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className={`${getBgColor()} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 w-full lg:min-w-[300px] lg:max-w-md toast-enter`}
    >
      {getIcon()}
      <span className="flex-1">{message}</span>
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(() => onClose(), 300);
        }}
        className="hover:bg-white/20 rounded p-1 transition"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const ToastContainer = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-4 right-4 left-4 lg:left-auto z-50 flex flex-col gap-2 max-w-md lg:max-w-none">
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

