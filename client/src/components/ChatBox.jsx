import { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useSocket } from '../context/SocketContext';

const ChatBox = () => {
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
    <div className="bg-dark-surface rounded-lg border border-dark-surface2 flex flex-col h-full">
      <div className="flex items-center gap-2 p-4 border-b border-dark-surface2">
        <MessageSquare className="w-5 h-5 text-dark-text2" />
        <h3 className="text-dark-text font-semibold">Sohbet</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {chatHistory.length === 0 ? (
          <div className="text-center text-dark-text2 py-8">
            <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Henüz mesaj yok. İlk mesajı sen gönder!</p>
          </div>
        ) : (
          chatHistory.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.userId === useStore.getState().userId ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 ${
                  msg.userId === useStore.getState().userId
                    ? 'bg-dark-accent text-white'
                    : 'bg-dark-surface2 text-dark-text'
                }`}
              >
                <div className="text-xs opacity-75 mb-1">{msg.username}</div>
                <div className="text-sm">{msg.message}</div>
                <div className="text-xs opacity-50 mt-1">{formatTime(msg.timestamp)}</div>
              </div>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="p-4 border-t border-dark-surface2">
        <div className="flex gap-2">
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
            className="flex-1 px-4 py-2 bg-dark-surface2 border border-dark-surface2 rounded-lg text-dark-text placeholder-dark-text2 focus:outline-none focus:ring-2 focus:ring-dark-accent focus:border-transparent transition"
          />
          <button
            onClick={handleSendMessage}
            disabled={!message.trim()}
            className="px-4 py-2 bg-dark-accent hover:bg-red-600 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatBox;

