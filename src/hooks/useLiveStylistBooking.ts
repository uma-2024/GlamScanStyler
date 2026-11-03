import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { API_BASE_URL_WITH_API } from '../config/api';
import { authenticatedFetch } from '../services/apiClient';
import { connectStylistRealtimeSocket, subscribeToSocketBookingUpdates } from '../services/stylistRealtime';

type Booking = { bookingId: string; status: string; [key: string]: any };

export function useLiveStylistBooking(options: {
  stylistId?: string;
  selected?: Booking | null;
  onBooking: (booking: Booking) => void;
  onRefresh?: () => void;
}) {
  const latest = useRef(options);
  latest.current = options;
  const reload = useRef<() => void>(() => {});
  useEffect(() => {
    const stylistId = options.stylistId;
    if (!stylistId) return;
    let disposed = false;
    let generation = 0;
    const timestamps = new Map<string, number>();
    const refresh = async () => {
      latest.current.onRefresh?.();
      const bookingId = latest.current.selected?.bookingId;
      if (!bookingId) return;
      const version = ++generation;
      try {
        const response = await authenticatedFetch(`${API_BASE_URL_WITH_API}/stylist/bookings/${stylistId}?bookingId=${encodeURIComponent(bookingId)}&limit=1`);
        if (!response.ok) return;
        const result = await response.json();
        if (disposed || generation !== version || latest.current.selected?.bookingId !== bookingId) return;
        const booking = result.data?.bookings?.find((item: Booking) => item.bookingId === bookingId);
        if (result.success && booking) latest.current.onBooking(booking);
      } catch (error) { console.warn('Unable to refresh selected booking', error); }
    };
    reload.current = () => { void refresh(); };
    const unsubscribe = subscribeToSocketBookingUpdates(update => {
      if (disposed || String(update?.stylistId) !== stylistId) return;
      const time = Date.parse(update.booking?.updatedAt || update.timestamp || '');
      if (Number.isFinite(time) && time < (timestamps.get(update.bookingId) || 0)) return;
      if (Number.isFinite(time)) timestamps.set(update.bookingId, time);
      generation++;
      const selected = latest.current.selected;
      if (selected?.bookingId === update.bookingId && update.booking?.status) {
        latest.current.onBooking({ ...selected, ...update.booking });
      }
      void refresh();
    });
    const disconnect = connectStylistRealtimeSocket(stylistId);
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void refresh();
    }, 30000);
    return () => {
      disposed = true;
      generation++;
      reload.current = () => {};
      clearInterval(timer);
      unsubscribe();
      disconnect();
    };
  }, [options.stylistId]);
  useEffect(() => { if (options.selected?.bookingId) reload.current(); }, [options.selected?.bookingId]);
}
