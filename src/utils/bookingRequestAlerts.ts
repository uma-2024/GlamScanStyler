import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@GlammefyPartner:bookingRequestAlerts';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
let queue: Promise<void> = Promise.resolve();

// Serialize push and polling alerts so one request vibrates only once, even
// across background delivery and reopening the app.
export const alertBookingRequestOnce = (
  bookingId: string,
  display: () => Promise<boolean>,
): Promise<void> => {
  const task = queue.then(async () => {
    let seen: Record<string, number> = {};
    try {
      seen = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) || '{}');
    } catch {
      // An unreadable cache must not suppress a new request.
    }
    const now = Date.now();
    if (seen[bookingId] && now - seen[bookingId] < MAX_AGE_MS) return;

    // Deduplicate only this booking. Separate simultaneous requests must all alert.
    if (!(await display())) return;

    seen[bookingId] = Date.now();
    const recent = Object.fromEntries(Object.entries(seen)
      .filter(([, timestamp]) => now - timestamp < MAX_AGE_MS)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 200));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
  });
  queue = task.catch(() => {});
  return task;
};

export const markBookingRequestNotified = (bookingId?: string): Promise<void> =>
  bookingId ? alertBookingRequestOnce(bookingId, async () => true) : Promise.resolve();
