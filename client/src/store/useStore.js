import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useStore = create(
  persist(
    (set, get) => ({
      // User data
      username: '',
      userId: '',
      roomId: '',
      isHost: false,
      
      // Room data
      users: [],
      chatHistory: [],
      streamActive: false,
      
      // Connection state
      connected: false,
      connectionStatus: 'disconnected', // disconnected, connecting, connected
      ping: 0,
      
      // Actions
      setUsername: (username) => set({ username }),
      setUserId: (userId) => set({ userId }),
      setRoomId: (roomId) => set({ roomId }),
      setIsHost: (isHost) => set({ isHost }),
      setUsers: (users) => set({ users }),
      addChatMessage: (message) => set((state) => ({
        chatHistory: [...state.chatHistory, message]
      })),
      setChatHistory: (chatHistory) => set({ chatHistory }),
      setStreamActive: (streamActive) => set({ streamActive }),
      setConnected: (connected) => set({ connected }),
      setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
      setPing: (ping) => set({ ping }),
      
      // Reset room data (but keep user info)
      resetRoom: () => set({
        roomId: '',
        isHost: false,
        users: [],
        chatHistory: [],
        streamActive: false
      }),
      
      // Clear all
      clearAll: () => set({
        username: '',
        userId: '',
        roomId: '',
        isHost: false,
        users: [],
        chatHistory: [],
        streamActive: false,
        connected: false,
        connectionStatus: 'disconnected',
        ping: 0
      })
    }),
    {
      name: 'watchtug-storage',
      partialize: (state) => ({
        username: state.username,
        userId: state.userId,
        roomId: state.roomId,
        isHost: state.isHost,
        chatHistory: state.chatHistory
      })
    }
  )
);

