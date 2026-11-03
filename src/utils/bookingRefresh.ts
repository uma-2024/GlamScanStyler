type BookingRefreshListener = () => void | Promise<void>;

const listeners = new Set<BookingRefreshListener>();

export const subscribeToBookingRefresh = (listener: BookingRefreshListener): (() => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

export const notifyBookingRefresh = (): void => {
  console.log('notifyBookingRefresh triggered! Trace:', new Error().stack);
  for (const listener of Array.from(listeners)) {
    try {
      void listener();
    } catch (error) {
      console.warn('Failed to trigger booking refresh listener:', error);
    }
  }
};
