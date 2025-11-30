import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useStore } from '../store/useStore';

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const {
    setConnected,
    setConnectionStatus,
    setPing,
    setUsers,
    addChatMessage,
    setChatHistory,
    setStreamActive,
    setIsHost,
    setIsModerator,
    setModerators,
    setHasPassword,
    setPopularRooms,
    setGlobalStats,
    updateMessageReactions
  } = useStore();

  useEffect(() => {
    const SOCKET_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? (import.meta.env.VITE_SERVER_URL || 'http://localhost:3000')
      : (import.meta.env.VITE_SERVER_URL || 'https://watchtug.live');

    const socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      transports: ['websocket', 'polling'],
      withCredentials: true
    });

    socketRef.current = socket;
    let pingInterval = null;

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      setIsConnected(true);
      setConnected(true);
      setConnectionStatus('connected');

      // Ping
      pingInterval = setInterval(() => {
        const start = Date.now();
        socket.emit('ping');
        socket.once('pong', () => {
          setPing(Date.now() - start);
        });
      }, 5000);

      // Popüler odaları getir
      socket.emit('get-popular-rooms');
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
      setConnected(false);
      setConnectionStatus('disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setConnectionStatus('disconnected');
    });

    // Popüler odalar
    socket.on('popular-rooms', (data) => {
      setPopularRooms(data.rooms);
      setGlobalStats(data.stats);
    });

    // Stats güncellendi (real-time)
    socket.on('stats-update', (stats) => {
      setGlobalStats(stats);
    });

    // Oda oluşturuldu
    socket.on('room-created', (data) => {
      console.log('Room created:', data);
      setUsers(data.users);
      setIsHost(data.isHost);
      setIsModerator(data.isModerator);
      setChatHistory(data.chatHistory || []);
      setHasPassword(data.hasPassword);
      setModerators(data.moderators || []);
    });

    // Odaya katıldı
    socket.on('room-joined', (data) => {
      console.log('Room joined:', data);
      setUsers(data.users);
      setIsHost(data.isHost);
      setIsModerator(data.isModerator);
      setChatHistory(data.chatHistory || []);
      setStreamActive(data.streamActive);
      setHasPassword(data.hasPassword);
      setModerators(data.moderators || []);
    });

    socket.on('room-not-found', () => {
      console.log('Room not found');
    });

    // Şifre gerekli
    socket.on('password-required', (data) => {
      console.log('Password required for room:', data.roomId);
    });

    // Şifre sonucu
    socket.on('password-result', (data) => {
      console.log('Password result:', data);
    });

    // Kullanıcı katıldı/ayrıldı
    socket.on('user-joined', (data) => {
      console.log('User joined:', data);
      setUsers(data.users);
    });

    socket.on('user-left', (data) => {
      console.log('User left:', data);
      setUsers(data.users);
    });

    // Chat mesajı
    socket.on('chat-message', (message) => {
      addChatMessage(message);
    });

    // Mesaj tepkisi güncellendi
    socket.on('reaction-updated', ({ messageId, reactions }) => {
      updateMessageReactions(messageId, reactions);
    });

    // Moderatörler güncellendi
    socket.on('moderators-updated', ({ moderators }) => {
      setModerators(moderators);
      const currentUserId = useStore.getState().userId;
      setIsModerator(moderators.includes(currentUserId));
    });

    // Stream durumu
    socket.on('stream-started', () => {
      setStreamActive(true);
    });

    socket.on('stream-stopped', () => {
      setStreamActive(false);
    });

    // Host değişti
    socket.on('host-changed', (data) => {
      const currentUserId = useStore.getState().userId;
      setIsHost(data.newHostId === currentUserId);
      if (data.moderators) {
        setModerators(data.moderators);
        setIsModerator(data.moderators.includes(currentUserId));
      }
    });

    return () => {
      if (pingInterval) clearInterval(pingInterval);
      socket.disconnect();
    };
  }, []);

  const emit = (event, data) => {
    if (socketRef.current) {
      if (socketRef.current.connected) {
        socketRef.current.emit(event, data);
      } else {
        socketRef.current.once('connect', () => {
          socketRef.current.emit(event, data);
        });
      }
    }
  };

  const on = (event, callback) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  };

  const off = (event, callback) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback);
    }
  };

  // Popüler odaları yenile
  const refreshPopularRooms = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('get-popular-rooms');
    }
  };

  return (
    <SocketContext.Provider value={{ 
      socket: socketRef.current, 
      isConnected, 
      emit, 
      on, 
      off,
      refreshPopularRooms 
    }}>
      {children}
    </SocketContext.Provider>
  );
};
