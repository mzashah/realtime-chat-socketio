import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface User {
  id: string;
  username: string;
}

interface UseSocketReturn {
  socket: Socket | null;
  connected: boolean;
  error: string | null;
}

export function useSocket(serverUrl: string, user: User | null): UseSocketReturn {
  const socketRef    = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    // Clean up existing connection
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const socket = io(serverUrl, {
      auth: { userId: user.id, username: user.username },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
      setConnected(true);
      setError(null);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setConnected(false);
      if (reason === 'io server disconnect') {
        setError('Disconnected by server. Please refresh.');
      }
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
      setConnected(false);
      setError(`Connection failed: ${err.message}`);
    });

    socket.on('reconnect', (attempt) => {
      console.log('[Socket] Reconnected after', attempt, 'attempts');
      setConnected(true);
      setError(null);
    });

    socket.on('reconnect_failed', () => {
      setError('Failed to reconnect. Please refresh the page.');
    });

    socket.on('error', (err: { message: string }) => {
      console.error('[Socket] Server error:', err.message);
      setError(err.message);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('reconnect');
      socket.off('reconnect_failed');
      socket.off('error');
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [serverUrl, user?.id, user?.username]);

  return { socket: socketRef.current, connected, error };
}
