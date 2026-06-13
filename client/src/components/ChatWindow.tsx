import React, { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';

interface Message {
  _id: string;
  room: string;
  sender: { _id: string; username: string };
  content: string;
  type: string;
  fileUrl?: string;
  readBy: string[];
  createdAt: string;
  isDM?: boolean;
}

interface TypingUser {
  userId: string;
  username: string;
}

interface Props {
  messages: Message[];
  currentUserId: string;
  socket: Socket | null;
  roomId: string;
}

export default function ChatWindow({ messages, currentUserId, socket, roomId }: Props) {
  const bottomRef   = useRef<HTMLDivElement>(null);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Typing indicators
  useEffect(() => {
    if (!socket) return;

    const handleTyping = ({ userId, username, roomId: r }: TypingUser & { roomId: string }) => {
      if (r !== roomId || userId === currentUserId) return;
      setTypingUsers(prev => prev.find(u => u.userId === userId) ? prev : [...prev, { userId, username }]);
    };

    const handleStopTyping = ({ userId, roomId: r }: { userId: string; roomId: string }) => {
      if (r !== roomId) return;
      setTypingUsers(prev => prev.filter(u => u.userId !== userId));
    };

    socket.on('typing', handleTyping);
    socket.on('stop-typing', handleStopTyping);
    return () => { socket.off('typing', handleTyping); socket.off('stop-typing', handleStopTyping); };
  }, [socket, roomId, currentUserId]);

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  }

  // Group messages by date
  const grouped: { date: string; messages: Message[] }[] = [];
  let currentDate = '';
  for (const msg of messages) {
    const date = formatDate(msg.createdAt);
    if (date !== currentDate) {
      grouped.push({ date, messages: [msg] });
      currentDate = date;
    } else {
      grouped[grouped.length - 1].messages.push(msg);
    }
  }

  return (
    <div className="chat-window">
      {messages.length === 0 && (
        <div className="empty-chat">
          <p>No messages yet. Be the first to say something!</p>
        </div>
      )}

      {grouped.map(group => (
        <div key={group.date}>
          <div className="date-divider"><span>{group.date}</span></div>
          {group.messages.map((msg, idx) => {
            const isOwn = msg.sender._id === currentUserId;
            const showAvatar = idx === 0 || group.messages[idx - 1].sender._id !== msg.sender._id;

            return (
              <div key={msg._id} className={`message-row ${isOwn ? 'own' : 'other'}`}>
                {!isOwn && showAvatar && (
                  <div className="avatar-sm">{msg.sender.username[0].toUpperCase()}</div>
                )}
                {!isOwn && !showAvatar && <div className="avatar-placeholder" />}
                <div className={`message-bubble ${isOwn ? 'own' : 'other'}`}>
                  {!isOwn && showAvatar && <span className="sender-name">{msg.sender.username}</span>}
                  {msg.type === 'text' && <p className="message-content">{msg.content}</p>}
                  {msg.type === 'image' && msg.fileUrl && (
                    <img src={msg.fileUrl} alt="shared" className="message-image" />
                  )}
                  {msg.type === 'file' && msg.fileUrl && (
                    <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="file-link">
                      Attachment
                    </a>
                  )}
                  <div className="message-meta">
                    <span className="message-time">{formatTime(msg.createdAt)}</span>
                    {isOwn && <span className="read-receipt">{msg.readBy.length > 1 ? 'Read' : 'Sent'}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {typingUsers.length > 0 && (
        <div className="typing-indicator">
          <div className="typing-dots"><span /><span /><span /></div>
          <span className="typing-text">
            {typingUsers.map(u => u.username).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
