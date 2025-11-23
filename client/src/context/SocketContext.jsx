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
    username,
    userId,
    roomId,
    setConnected,
    setConnectionStatus,
    setPing,
    setUsers,
    addChatMessage,
    setChatHistory,
    setStreamActive,
    setIsHost
  } = useStore();

  useEffect(() => {
    // Socket bağlantısını oluştur
    const socket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:3000', {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;
    let pingInterval = null;

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      setIsConnected(true);
      setConnected(true);
      setConnectionStatus('connected');

      // Eğer daha önce bir odaya bağlıysak, yeniden bağlan
      const currentRoomId = useStore.getState().roomId;
      const currentUserId = useStore.getState().userId;
      const currentUsername = useStore.getState().username;
      
      if (currentRoomId && currentUserId && currentUsername) {
        console.log('Reconnecting to room:', currentRoomId);
        socket.emit('join-room', { roomId: currentRoomId, username: currentUsername, userId: currentUserId });
      }

      // Ping başlat
      pingInterval = setInterval(() => {
        const start = Date.now();
        socket.emit('ping');
        socket.once('pong', () => {
          const latency = Date.now() - start;
          setPing(latency);
        });
      }, 5000);
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

    socket.on('room-created', (data) => {
      console.log('Room created:', data);
      setUsers(data.users);
      setIsHost(data.isHost);
      setChatHistory(data.chatHistory || []);
    });

    socket.on('room-joined', (data) => {
      console.log('Room joined:', data);
      setUsers(data.users);
      setIsHost(data.isHost);
      setChatHistory(data.chatHistory || []);
      setStreamActive(data.streamActive);
    });

    socket.on('room-not-found', () => {
      alert('Oda bulunamadı!');
    });

    socket.on('user-joined', (data) => {
      console.log('User joined:', data);
      setUsers(data.users);
    });

    socket.on('user-left', (data) => {
      console.log('User left:', data);
      setUsers(data.users);
    });

    socket.on('chat-message', (message) => {
      addChatMessage(message);
    });

    socket.on('stream-started', () => {
      setStreamActive(true);
    });

    socket.on('stream-stopped', () => {
      setStreamActive(false);
    });

    socket.on('host-changed', (data) => {
      const currentUserId = useStore.getState().userId;
      setIsHost(data.newHostId === currentUserId);
    });

    return () => {
      if (pingInterval) {
        clearInterval(pingInterval);
      }
      socket.disconnect();
    };
  }, []);

  const emit = (event, data) => {
    if (socketRef.current) {
      // Bağlantı kurulana kadar bekle
      if (socketRef.current.connected) {
        socketRef.current.emit(event, data);
      } else {
        // Bağlantı kurulunca gönder
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

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected, emit, on, off }}>
      {children}
    </SocketContext.Provider>
  );
};

