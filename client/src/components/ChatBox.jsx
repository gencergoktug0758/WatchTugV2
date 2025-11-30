import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, MessageSquare, ChevronUp, AlertCircle, Smile, X, Reply, Heart, ThumbsUp, Laugh, Flame, PartyPopper } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useSocket } from '../context/SocketContext';

const MESSAGES_PER_PAGE = 20;
const SPAM_COOLDOWN_MS = 15000;
const SPAM_MESSAGE_LIMIT = 3;
const SPAM_TIME_WINDOW = 3000;

// Emoji kategorileri
const EMOJI_CATEGORIES = {
  smileys: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😍', '🥰', '😘', '😋', '😛', '😜', '🤪', '😎', '🤩'],
  gestures: ['👍', '👎', '👏', '🙌', '🤝', '👊', '✌️', '🤟', '🤘', '👌', '🤙', '💪', '🙏', '✋', '🖐️', '👋'],
  hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💕', '💞', '💓', '💗', '💖', '💘', '💝'],
  objects: ['🎬', '🎥', '📺', '🎮', '🎧', '🎵', '🎶', '🔥', '⭐', '✨', '💫', '🌟', '🎉', '🎊', '🏆', '🍿']
};

// Hızlı tepki emojileri
const QUICK_REACTIONS = ['❤️', '👍', '😂', '🔥', '🎉'];

const ChatBox = ({ isTheaterMode = false }) => {
  const [message, setMessage] = useState('');
  const [displayCount, setDisplayCount] = useState(MESSAGES_PER_PAGE);
  const [spamCooldown, setSpamCooldown] = useState(0);
  const [messageTimes, setMessageTimes] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [activeReactionMessage, setActiveReactionMessage] = useState(null);
  
  const chatEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const cooldownRef = useRef(null);
  const inputRef = useRef(null);
  
  const { chatHistory, roomId, username } = useStore();
  const { emit } = useSocket();

  // Scroll
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);

  // Spam cooldown
  useEffect(() => {
    if (spamCooldown > 0) {
      cooldownRef.current = setInterval(() => {
        setSpamCooldown(prev => {
          if (prev <= 1000) {
            clearInterval(cooldownRef.current);
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);
      return () => clearInterval(cooldownRef.current);
    }
  }, [spamCooldown]);

  const totalMessages = chatHistory.length;
  const startIndex = Math.max(0, totalMessages - displayCount);
  const visibleMessages = chatHistory.slice(startIndex);
  const hasMoreMessages = totalMessages > displayCount;

  const loadMoreMessages = () => setDisplayCount(prev => prev + MESSAGES_PER_PAGE);

  const handleSendMessage = useCallback(() => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || !roomId || spamCooldown > 0) return;

    const now = Date.now();
    const recentMessages = messageTimes.filter(t => now - t < SPAM_TIME_WINDOW);
    
    if (recentMessages.length >= SPAM_MESSAGE_LIMIT) {
      setSpamCooldown(SPAM_COOLDOWN_MS);
      setMessageTimes([]);
      return;
    }

    setMessageTimes(prev => [...prev.filter(t => now - t < SPAM_TIME_WINDOW), now]);

    const userId = useStore.getState().userId;

    emit('chat-message', {
      roomId,
      message: trimmedMessage,
      username,
      userId,
      replyTo: replyingTo ? {
        id: replyingTo.id,
        username: replyingTo.username,
        message: replyingTo.message.substring(0, 50) + (replyingTo.message.length > 50 ? '...' : '')
      } : null
    });

    setMessage('');
    setReplyingTo(null);
    setShowEmojiPicker(false);
  }, [message, roomId, username, emit, spamCooldown, messageTimes, replyingTo]);

  const handleReaction = (messageId, emoji) => {
    const userId = useStore.getState().userId;
    emit('toggle-reaction', { roomId, messageId, emoji, userId, username });
    setActiveReactionMessage(null);
  };

  const addEmoji = (emoji) => {
    setMessage(prev => prev + emoji);
    inputRef.current?.focus();
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };

  const cooldownSeconds = Math.ceil(spamCooldown / 1000);
  const userId = useStore.getState().userId;

  return (
    <div className={`flex flex-col h-full ${
      isTheaterMode ? 'bg-dark-surface/95 backdrop-blur-xl border-l border-neon-purple/20' : 'glass-card rounded-2xl'
    }`}>
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-white/10">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-purple to-neon-pink flex items-center justify-center shadow-neon-purple">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-white font-bold">Sohbet</h3>
          <p className="text-dark-text2 text-xs">{totalMessages} mesaj</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {hasMoreMessages && (
          <button
            onClick={loadMoreMessages}
            className="w-full py-2 px-4 rounded-xl bg-dark-surface2/50 hover:bg-dark-surface2 border border-neon-purple/20 hover:border-neon-purple/40 text-white text-xs font-medium transition-all flex items-center justify-center gap-2"
          >
            <ChevronUp className="w-4 h-4" />
            Önceki mesajları göster
          </button>
        )}

        {totalMessages === 0 ? (
          <div className="text-center py-12 animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-neon-purple/20 to-neon-pink/20 flex items-center justify-center border border-neon-purple/30">
              <MessageSquare className="w-8 h-8 text-neon-purple" />
            </div>
            <p className="text-white font-medium">Henüz mesaj yok</p>
            <p className="text-dark-text2 text-sm mt-1">İlk mesajı sen gönder! 🚀</p>
          </div>
        ) : (
          visibleMessages.map((msg) => {
            const isOwn = msg.userId === userId;
            const reactionCount = msg.reactions ? Object.values(msg.reactions).flat().length : 0;
            
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} animate-fade-in group`}
              >
                {/* Reply Preview */}
                {msg.replyTo && (
                  <div className={`flex items-center gap-2 mb-1 px-3 py-1.5 rounded-lg bg-dark-surface2/50 border-l-2 border-neon-purple/50 max-w-[80%] ${isOwn ? 'mr-2' : 'ml-2'}`}>
                    <Reply className="w-3 h-3 text-neon-purple" />
                    <span className="text-neon-cyan text-xs font-medium">{msg.replyTo.username}</span>
                    <span className="text-dark-text2 text-xs truncate">{msg.replyTo.message}</span>
                  </div>
                )}

                <div className="relative max-w-[85%]">
                  {/* Message Bubble */}
                  <div
                    className={`rounded-2xl px-4 py-3 transition-all ${
                      isOwn
                        ? 'bg-gradient-to-r from-neon-purple to-neon-pink text-white shadow-neon-purple'
                        : 'bg-dark-surface2/80 text-white border border-white/10'
                    }`}
                  >
                    {!isOwn && (
                      <div className="text-xs font-bold text-neon-cyan mb-1">{msg.username}</div>
                    )}
                    <div className="text-sm leading-relaxed break-words">{msg.message}</div>
                    <div className={`text-[10px] mt-1.5 flex items-center gap-2 ${isOwn ? 'text-white/60' : 'text-dark-text2'}`}>
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>

                  {/* Reactions Display */}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      {Object.entries(msg.reactions).map(([emoji, users]) => (
                        <button
                          key={emoji}
                          onClick={() => handleReaction(msg.id, emoji)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all ${
                            users.some(u => u.userId === userId)
                              ? 'bg-neon-purple/30 border border-neon-purple/50'
                              : 'bg-dark-surface2/80 border border-white/10 hover:border-neon-purple/30'
                          }`}
                        >
                          <span>{emoji}</span>
                          <span className="text-white/80">{users.length}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Action Buttons (show on hover) */}
                  <div className={`absolute top-0 ${isOwn ? 'left-0 -translate-x-full pr-2' : 'right-0 translate-x-full pl-2'} opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1`}>
                    {/* Reply Button */}
                    <button
                      onClick={() => {
                        setReplyingTo(msg);
                        inputRef.current?.focus();
                      }}
                      className="p-1.5 bg-dark-surface2/80 hover:bg-dark-surface2 rounded-lg text-dark-text2 hover:text-white transition-all"
                      title="Yanıtla"
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>

                    {/* Reaction Button */}
                    <button
                      onClick={() => setActiveReactionMessage(activeReactionMessage === msg.id ? null : msg.id)}
                      className="p-1.5 bg-dark-surface2/80 hover:bg-dark-surface2 rounded-lg text-dark-text2 hover:text-white transition-all"
                      title="Tepki"
                    >
                      <Smile className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Quick Reaction Picker */}
                  {activeReactionMessage === msg.id && (
                    <div className={`absolute ${isOwn ? 'right-0' : 'left-0'} -top-10 flex items-center gap-1 p-1.5 bg-dark-surface rounded-xl border border-white/10 shadow-lg animate-scale-in z-10`}>
                      {QUICK_REACTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleReaction(msg.id, emoji)}
                          className="w-8 h-8 flex items-center justify-center hover:bg-dark-surface2 rounded-lg text-lg transition-all hover:scale-125"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Reply Preview */}
      {replyingTo && (
        <div className="mx-4 mb-2 px-4 py-2 rounded-xl bg-dark-surface2/50 border border-neon-purple/30 flex items-center gap-3 animate-fade-in">
          <Reply className="w-4 h-4 text-neon-purple flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-neon-cyan text-xs font-medium">{replyingTo.username}</span>
            <p className="text-dark-text2 text-xs truncate">{replyingTo.message}</p>
          </div>
          <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-dark-surface2 rounded-lg transition-all">
            <X className="w-4 h-4 text-dark-text2" />
          </button>
        </div>
      )}

      {/* Spam Warning */}
      {spamCooldown > 0 && (
        <div className="mx-4 mb-2 px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span className="text-red-400 text-sm font-medium">Spam! {cooldownSeconds}s bekle</span>
        </div>
      )}

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div className="mx-4 mb-2 p-3 rounded-xl bg-dark-surface border border-white/10 animate-fade-in">
          <div className="max-h-48 overflow-y-auto space-y-3">
            {Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
              <div key={category}>
                <p className="text-dark-text2 text-xs font-medium mb-2 capitalize">{category}</p>
                <div className="flex flex-wrap gap-1">
                  {emojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => addEmoji(emoji)}
                      className="w-8 h-8 flex items-center justify-center hover:bg-dark-surface2 rounded-lg text-lg transition-all hover:scale-110"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t border-white/10">
        <div className="flex gap-2">
          {/* Emoji Button */}
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className={`px-3 rounded-xl border transition-all ${
              showEmojiPicker 
                ? 'bg-neon-purple/20 border-neon-purple/50 text-neon-purple' 
                : 'bg-dark-surface2/60 border-white/10 text-dark-text2 hover:text-white hover:border-neon-purple/30'
            }`}
          >
            <Smile className="w-5 h-5" />
          </button>

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={spamCooldown > 0 ? `${cooldownSeconds}s bekle...` : replyingTo ? `${replyingTo.username}'a yanıt...` : "Mesajını yaz..."}
            disabled={spamCooldown > 0}
            className="flex-1 px-4 py-3 bg-dark-surface2/60 border border-white/10 hover:border-neon-purple/30 focus:border-neon-purple/50 rounded-xl text-white placeholder-dark-text2 focus:outline-none focus:ring-2 focus:ring-neon-purple/20 transition-all disabled:opacity-50"
          />

          {/* Send Button */}
          <button
            onClick={handleSendMessage}
            disabled={!message.trim() || spamCooldown > 0}
            className="btn-neon px-4 py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatBox;
