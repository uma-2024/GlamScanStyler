import { AppState } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config/api';
import { getLoginSession } from '../utils/authStorage';
import { notifyBookingRefresh } from '../utils/bookingRefresh';

export type SocketBookingUpdateListener = (payload: any) => void;
const listeners = new Set<SocketBookingUpdateListener>();
const connections = new Map<string, { socket: Socket; users: number; removeAppState: () => void }>();
const dispatch = (payload: any) => {
  for (const listener of Array.from(listeners)) {
    try { listener(payload); } catch (error) { console.warn('Booking update listener failed', error); }
  }
};
export const subscribeToSocketBookingUpdates = (listener: SocketBookingUpdateListener) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

/** Shared ownership keeps Home cleanup from leaving the room used by Bookings. */
export const connectStylistRealtimeSocket = (stylistId: string) => {
  let connection = connections.get(stylistId);
  if (!connection) {
    const socket = io(API_BASE_URL, {
      path: '/socket.io', transports: ['polling', 'websocket'],
      reconnection: true, reconnectionAttempts: Infinity,
      reconnectionDelay: 1000, reconnectionDelayMax: 5000, timeout: 10000,
      auth: callback => {
        void getLoginSession().then(session => callback({ token: session?.userId === stylistId ? session.loginId : '' }));
      },
    });
    const resync = () => {
      dispatch({ stylistId, action: 'resync' });
      notifyBookingRefresh();
    };
    socket.on('connect', () => {
      socket.emit('join_stylist_room', { stylistId }, (result: { ok: boolean }) => {
        if (result?.ok) resync();
      });
    });
    socket.on('booking_updated', payload => {
      if (String(payload?.stylistId) === stylistId) dispatch(payload);
    });
    const appState = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      if (!socket.connected) socket.connect();
      resync();
    });
    connection = { socket, users: 0, removeAppState: () => appState.remove() };
    connections.set(stylistId, connection);
  }
  connection.users++;
  const owned = connection;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    owned.users--;
    if (owned.users === 0) {
      owned.socket.emit('leave_stylist_room', { stylistId });
      owned.socket.disconnect();
      owned.removeAppState();
      if (connections.get(stylistId) === owned) connections.delete(stylistId);
    }
  };
};
export const disconnectStylistRealtimeSocket = () => {
  connections.forEach(connection => {
    connection.socket.disconnect();
    connection.removeAppState();
  });
  connections.clear();
};
