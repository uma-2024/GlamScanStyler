import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

// Service times have minute precision. Refresh at the minute boundary so a
// booking becomes startable on time without waiting for another API response.
export const useBookingClock = (): number => {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      const currentTime = Date.now();
      setNow(currentTime);
      timer = setTimeout(refresh, 60000 - (currentTime % 60000));
    };

    refresh();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refresh();
      }
    });

    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return now;
};
