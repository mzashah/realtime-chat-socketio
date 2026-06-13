import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import ChatWindow from './components/ChatWindow';
import MessageInput from './components/MessageInput';
import { useSocket } from './hooks/useSocket';

interface User {
  id: string;
  username: string;
}

interface Room {
  _id: string;
  name: string;
  type: string;
  description?: string;
}

const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:4000';

export default function App() {
  const [user, setUser]           = useState<User | null>(null);
  const [username, setUsername]   = useState('');
  const [rooms, setRooms]         = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [messages, setMessages]   = useState<Record<string, Message[]>>({});

  const { socket, connected } = useSocket(SERVER_URL, user);

  // Load rooms
  useEffect(() => {
    fetch(`${SERVER_URL}/api/rooms`)
      .then(r => r.json())
      .then(setRooms)
      .catch(console.error);
  }, []);

  // Socket events
  useEffect(() => {
    if (!socket) return;

    socket.on('message', (msg: Message) => {
      setMessages(prev => ({
        ...prev,
        [msg.room]: [...(prev[msg.room] || []), msg],
      }));
    });

    socket.on('message-history', ({ roomId, messages: history }: { roomId: string; messages: Message[] }) => {
      setMessages(prev => ({ ...prev, [roomId]: history }));
    });

    socket.on('online-users', (users: string[]) => setOnlineUsers(users));

    return () => {
      socket.off('message');
      socket.off('message-history');
      socket.off('online-users');
    };
  }, [socket]);

  // Join room
  useEffect(() => {
    if (!socket || !activeRoom) return;
    socket.emit('join-room', { roomId: activeRoom });
    return () => { socket.emit('leave-room', { roomId: activeRoom }); };
  }, [socket, activeRoom]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setUser({ id: `user-${Date.now()}`, username: username.trim() });
  };

  const sendMessage = (content: string, type = 'text') => {
    if (!socket || !activeRoom || !content.trim()) return;
    socket.emit('message', { roomId: activeRoom, content, type });
  };

  if (!user) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <h1>Chat App</h1>
          <p>Real-time messaging powered by Socket.io</p>
          <form onSubmit={handleLogin}>
            <input
              type="text"
              placeholder="Enter your username..."
              value={username}
              onChange={e => setUsername(e.target.value)}
              maxLength={30}
              autoFocus
            />
            <button type="submit" disabled={!username.trim()}>Join Chat</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Chat</h2>
          <span className={`status-dot ${connected ? 'online' : 'offline'}`} />
        </div>
        <div className="user-info">
          <div className="avatar">{user.username[0].toUpperCase()}</div>
          <span>{user.username}</span>
        </div>
        <div className="rooms-list">
          <h3>Rooms ({rooms.length})</h3>
          {rooms.map(room => (
            <button
              key={room._id}
              className={`room-item ${activeRoom === room._id ? 'active' : ''}`}
              onClick={() => setActiveRoom(room._id)}
            >
              <span className="room-icon">#</span>
              <span className="room-name">{room.name}</span>
            </button>
          ))}
        </div>
        <div className="online-panel">
          <h3>Online ({onlineUsers.length})</h3>
          {onlineUsers.map(uid => (
            <div key={uid} className="online-user">
              <span className="online-dot" />
              <span>{uid === user.id ? user.username + ' (you)' : uid}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* Main */}
      <main className="chat-main">
        {activeRoom ? (
          <>
            <div className="chat-header">
              <h2># {rooms.find(r => r._id === activeRoom)?.name || activeRoom}</h2>
            </div>
            <ChatWindow
              messages={messages[activeRoom] || []}
              currentUserId={user.id}
              socket={socket}
              roomId={activeRoom}
            />
            <MessageInput onSend={sendMessage} socket={socket} roomId={activeRoom} />
          </>
        ) : (
          <div className="no-room">
            <h2>Select a room to start chatting</h2>
            <p>Choose a room from the sidebar or create a new one.</p>
          </div>
        )}
      </main>
    </div>
  );
}
