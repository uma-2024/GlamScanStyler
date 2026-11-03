import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { API_BASE_URL_WITH_API } from '../config/api';
import { subscribeToBookingRefresh } from '../utils/bookingRefresh';
import { subscribeToSocketBookingUpdates } from '../services/stylistRealtime';
import { showNewBookingRequestNotification } from '../utils/notificationService';

export interface PendingBookingRequest {
  bookingId: string;
  userId: string;
  userName?: string;
  serviceName?: string;
  status?: string;
}

export const usePendingBookingRequests = <T extends PendingBookingRequest>(
  stylistId?: string,
  enabled = true,
) => {
  const [pendingBookings, setPendingBookings] = useState<T[]>([]);
  const [visible, setVisible] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const generation = useRef(0);

  useEffect(() => {
    let disposed = false;
    let active = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    let inFlight = false;
    let queued = false;
    let reopenQueued = false;
    let knownIds = new Set<string>();
    let timer: ReturnType<typeof setInterval> | undefined;
    let controller: AbortController | undefined;
    generation.current += 1;
    setPendingBookings([]);
    setVisible(false);
    setAppActive(active);
    if (!enabled || !stylistId) return;

    const refresh = async (reopen = false) => {
      if (disposed || !active) return;
      if (inFlight) {
        queued = true;
        reopenQueued = reopenQueued || reopen;
        return;
      }
      inFlight = true;
      const version = generation.current;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 20000);
      try {
        const response = await fetch(`${API_BASE_URL_WITH_API}/stylist/bookings/${stylistId}?status=pending&limit=25`, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        if (!response.ok) return;
        const result = await response.json();
        if (disposed || !active || version !== generation.current || !result.success || !Array.isArray(result.data?.bookings)) return;
        const pending: T[] = result.data.bookings.filter((booking: T) => booking.status === 'pending');
        const newBookings = pending.filter(booking => !knownIds.has(booking.bookingId));
        knownIds = new Set(pending.map(booking => booking.bookingId));
        setPendingBookings(pending);
        setVisible(previous => pending.length > 0 && (previous || reopen || newBookings.length > 0));
        for (const booking of newBookings) {
          if (disposed || !active) break;
          await showNewBookingRequestNotification(booking.serviceName || 'Service', booking.userName || 'Client', booking.bookingId);
        }
      } catch (error) {
        if (!disposed && active) console.warn('Unable to refresh incoming booking requests:', error);
      } finally {
        if (timeout) clearTimeout(timeout);
        inFlight = false;
        if (queued && !disposed && active) {
          const reopenNext = reopenQueued;
          queued = false;
          reopenQueued = false;
          void refresh(reopenNext);
        }
      }
    };
    const startPolling = () => {
      // clearInterval(timer); // Removed polling
      void refresh(true);
    };
    if (active) startPolling();
    const unsubscribe = subscribeToBookingRefresh(() => { void refresh(true); });
    const unsubscribeSocket = subscribeToSocketBookingUpdates((payload: any) => {
      if (disposed || !active) return;
      const { booking, action, bookingId } = payload;
      
      if (booking) {
        setPendingBookings(current => {
          // If the booking is no longer pending or is cancelled/deleted, remove it
          if (booking.status !== 'pending' || action === 'cancelled') {
            const filtered = current.filter(b => b.bookingId !== (booking.bookingId || bookingId));
            setVisible(previous => filtered.length > 0 && previous);
            return filtered;
          }
          
          // Otherwise, it's a pending booking. Add or update it.
          const existsIndex = current.findIndex(b => b.bookingId === (booking.bookingId || bookingId));
          if (existsIndex >= 0) {
            const copy = [...current];
            copy[existsIndex] = booking;
            return copy;
          } else {
            // It's a brand new pending booking!
            if (action === 'created' || action === 'updated') {
              void showNewBookingRequestNotification(booking.serviceName || 'Service', booking.userName || 'Client', booking.bookingId);
            }
            setVisible(true);
            return [...current, booking];
          }
        });
      }
    });
    const appState = AppState.addEventListener('change', state => {
      active = state === 'active';
      setAppActive(active);
      if (active) {
        startPolling();
      } else {
        if (timer) clearInterval(timer);
        controller?.abort();
      }
    });
    return () => {
      disposed = true;
      generation.current += 1;
      if (timer) clearInterval(timer);
      controller?.abort();
      unsubscribe();
      unsubscribeSocket();
      appState.remove();
    };
  }, [stylistId, enabled]);

  const removeBooking = (bookingId: string) => {
    generation.current += 1;
    setPendingBookings(bookings => bookings.filter(booking => booking.bookingId !== bookingId));
  };
  return { pendingBookings, visible: enabled && appActive && visible && pendingBookings.length > 0, setVisible, removeBooking };
};
