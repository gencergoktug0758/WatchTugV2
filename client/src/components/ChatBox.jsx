import { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useSocket } from '../context/SocketContext';

const ChatBox = ({ isTheaterMode = false }) => {
  const [message, setMessage] = useState('');
  const chatEndRef = useRef(null);
  const { chatHistory, roomId, username } = useStore();
  const { emit } = useSocket();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleSendMessage = () => {
    if (!message.trim() || !roomId) return;

    emit('chat-message', {
      roomId,
      message: message.trim(),
      username,
      userId: useStore.getState().userId
    });

    setMessage('');
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`flex flex-col ${isTheaterMode ? 'h-full' : 'h-full'} ${
      isTheaterMode 
        ? 'bg-gradient-to-b from-dark-surface/95 to-dark-surface/90 backdrop-blur-xl border-l border-red-500/20 rounded-none' 
        : 'bg-gradient-to-br from-dark-surface/95 to-dark-surface/90 backdrop-blur-xl rounded-2xl border border-red-500/20 shadow-2xl'
    }`}>
      <div className="flex items-center gap-3 p-5 border-b border-red-500/20">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center shadow-lg shadow-red-500/30">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        <h3 className="text-white font-bold text-lg">Sohbet</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {chatHistory.length === 0 ? (
          <div className="text-center text-dark-text2 py-12 animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-600/10 flex items-center justify-center border border-red-500/20">
              <MessageSquare className="w-8 h-8 text-red-500/50" />
            </div>
            <p className="text-white/60 text-base">Henüz mesaj yok. İlk mesajı sen gönder!</p>
          </div>
        ) : (
          chatHistory.map((msg, index) => (
            <div
              key={msg.id}
              className={`flex flex-col animate-fade-in ${
                msg.userId === useStore.getState().userId ? 'items-end' : 'items-start'
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 transition-all duration-200 transform hover:scale-[1.02] shadow-lg ${
                  msg.userId === useStore.getState().userId
                    ? 'bg-gradient-to-r from-red-600 to-red-700 text-white border border-red-500/30'
                    : 'bg-dark-surface2/80 backdrop-blur-sm text-white border border-dark-surface2/50 hover:border-red-500/30'
                }`}
              >
                <div className="text-xs opacity-90 mb-1.5 font-semibold">{msg.username}</div>
                <div className="text-sm leading-relaxed">{msg.message}</div>
                <div className="text-xs opacity-60 mt-1.5">{formatTime(msg.timestamp)}</div>
              </div>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="p-5 border-t border-red-500/20">
        <div className="flex gap-3">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Mesaj yazın..."
            className="flex-1 px-4 py-3 bg-dark-surface2/80 backdrop-blur-sm border border-dark-surface2/50 hover:border-red-500/30 focus:border-red-500/50 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-all duration-200"
          />
          <button
            onClick={handleSendMessage}
            disabled={!message.trim()}
            className="px-5 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transform hover:scale-110 active:scale-95 shadow-lg hover:shadow-xl hover:shadow-red-500/30"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatBox;

