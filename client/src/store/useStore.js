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
      isModerator: false,
      
      // Room data
      users: [],
      chatHistory: [],
      streamActive: false,
      hasPassword: false,
      moderators: [],
      
      // Popular rooms
      popularRooms: [],
      globalStats: {
        totalRooms: 0,
        totalActiveUsers: 0,
        totalRoomsCreated: 0,
        totalUsersJoined: 0
      },
      
      // Recent rooms (localStorage)
      recentRooms: [],
      
      // Connection state
      connected: false,
      connectionStatus: 'disconnected',
      ping: 0,
      
      // Actions
      setUsername: (username) => set({ username }),
      setUserId: (userId) => set({ userId }),
      setRoomId: (roomId) => set({ roomId }),
      setIsHost: (isHost) => set({ isHost }),
      setIsModerator: (isModerator) => set({ isModerator }),
      setUsers: (users) => set({ users }),
      setModerators: (moderators) => set({ moderators }),
      setHasPassword: (hasPassword) => set({ hasPassword }),
      
      addChatMessage: (message) => set((state) => ({
        chatHistory: [...state.chatHistory, message]
      })),
      
      updateMessageReactions: (messageId, reactions) => set((state) => ({
        chatHistory: state.chatHistory.map(msg => 
          msg.id === messageId ? { ...msg, reactions } : msg
        )
      })),
      
      setChatHistory: (chatHistory) => set({ chatHistory }),
      setStreamActive: (streamActive) => set({ streamActive }),
      setConnected: (connected) => set({ connected }),
      setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
      setPing: (ping) => set({ ping }),
      
      // Popular rooms
      setPopularRooms: (popularRooms) => set({ popularRooms }),
      setGlobalStats: (globalStats) => set({ globalStats }),
      
      // Recent rooms
      addRecentRoom: (room) => set((state) => {
        const filtered = state.recentRooms.filter(r => r.roomId !== room.roomId);
        const updated = [room, ...filtered].slice(0, 5);
        return { recentRooms: updated };
      }),
      
      removeRecentRoom: (roomId) => set((state) => ({
        recentRooms: state.recentRooms.filter(r => r.roomId !== roomId)
      })),
      
      // Reset room data
      resetRoom: () => set({
        roomId: '',
        isHost: false,
        isModerator: false,
        users: [],
        chatHistory: [],
        streamActive: false,
        hasPassword: false,
        moderators: []
      }),
      
      // Clear all
      clearAll: () => set({
        username: '',
        userId: '',
        roomId: '',
        isHost: false,
        isModerator: false,
        users: [],
        chatHistory: [],
        streamActive: false,
        hasPassword: false,
        moderators: [],
        connected: false,
        connectionStatus: 'disconnected',
        ping: 0
      })
    }),
    {
      name: 'watchtug-storage',
      partialize: (state) => ({
        username: state.username,
        recentRooms: state.recentRooms
      }),
      version: 2 // Eski cache'i temizle
    }
  )
);
