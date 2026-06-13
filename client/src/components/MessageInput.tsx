import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';

interface Props {
  onSend: (content: string, type?: string) => void;
  socket: Socket | null;
  roomId: string;
}

const BASIC_EMOJIS = ['😀','😂','😍','🤔','👍','❤️','🎉','🔥','💯','😢','😮','🙏','👋','✅','❌'];

export default function MessageInput({ onSend, socket, roomId }: Props) {
  const [text, setText]               = useState('');
  const [isTyping, setIsTyping]       = useState(false);
  const [showEmoji, setShowEmoji]     = useState(false);
  const typingTimerRef                = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef                  = useRef<HTMLInputElement>(null);
  const textareaRef                   = useRef<HTMLTextAreaElement>(null);

  const emitTyping = useCallback(() => {
    if (!socket || !roomId) return;
    if (!isTyping) {
      socket.emit('typing', { roomId });
      setIsTyping(true);
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socket.emit('stop-typing', { roomId });
      setIsTyping(false);
    }, 2000);
  }, [socket, roomId, isTyping]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (socket && isTyping) socket.emit('stop-typing', { roomId });
    };
  }, [socket, roomId, isTyping]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; }
  }, [text]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    emitTyping();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed, 'text');
    setText('');
    if (socket && isTyping) {
      socket.emit('stop-typing', { roomId });
      setIsTyping(false);
    }
  };

  const handleEmojiClick = (emoji: string) => {
    setText(prev => prev + emoji);
    setShowEmoji(false);
    textareaRef.current?.focus();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // In a real app: upload to S3/Cloudinary, then emit with fileUrl
    const isImage = file.type.startsWith('image/');
    const reader = new FileReader();
    reader.onload = () => {
      onSend(`[${isImage ? 'Image' : 'File'}: ${file.name}]`, isImage ? 'image' : 'file');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="message-input-container">
      {showEmoji && (
        <div className="emoji-picker">
          {BASIC_EMOJIS.map(emoji => (
            <button key={emoji} className="emoji-btn" onClick={() => handleEmojiClick(emoji)}>
              {emoji}
            </button>
          ))}
        </div>
      )}
      <div className="input-row">
        <button
          className="icon-btn"
          onClick={() => setShowEmoji(!showEmoji)}
          title="Emoji"
        >
          😊
        </button>
        <button
          className="icon-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Attach file"
        >
          📎
        </button>
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          accept="image/*,.pdf,.doc,.docx,.txt"
          onChange={handleFileChange}
        />
        <textarea
          ref={textareaRef}
          className="message-textarea"
          placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={10000}
        />
        <button
          className={`send-btn ${text.trim() ? 'active' : ''}`}
          onClick={handleSend}
          disabled={!text.trim()}
          title="Send message"
        >
          Send
        </button>
      </div>
    </div>
  );
}
