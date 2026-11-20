// Booking dates and wall-clock times represent appointments in India (UTC+05:30).
const INDIA_OFFSET_MS = 330 * 60 * 1000;

// The customer app serializes local midnight as the previous UTC evening.
// Resolve its India calendar day before combining it with the service time.
export const getBookingDateKey = (value: string | Date): string | null => {
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp + INDIA_OFFSET_MS).toISOString().slice(0, 10);
};

export const canStartBooking = (
  booking: { date: string | Date; startTime: string; period?: string; status: string },
  now: number = Date.now(),
): boolean =>
  booking.status === 'confirmed' && now >= getBookingStartTimestamp(booking);

export const getBookingStartTimestamp = (booking: { date: string | Date; startTime: string; period?: string }): number => {
  try {
    const dateStr = getBookingDateKey(booking.date);
    if (!dateStr) return NaN;
    const dayMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
    if (!dayMatch) return NaN;

    let rawTime = (booking.startTime || '').trim();
    let detectedPeriod = (booking.period || '').trim().toUpperCase();

    const amPmMatch = rawTime.match(/(am|pm)/i);
    if (amPmMatch) {
      detectedPeriod = amPmMatch[1].toUpperCase();
      rawTime = rawTime.replace(/(am|pm)/i, '').trim();
    }

    const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(rawTime);
    if (!timeMatch) return NaN;

    const year = Number(dayMatch[1]);
    const month = Number(dayMatch[2]) - 1; // 0-indexed
    const day = Number(dayMatch[3]);

    let hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);

    if (detectedPeriod === 'PM' && hour < 12) {
      hour += 12;
    } else if (detectedPeriod === 'AM' && hour === 12) {
      hour = 0;
    }

    if (hour > 23 || minute > 59) return NaN;

    // Create UTC date considering the +05:30 offset (India Standard Time)
    // IST is UTC + 5:30, so UTC time is IST time minus 5 hours and 30 minutes.
    const utcTimestamp = Date.UTC(year, month, day, hour, minute, 0) - INDIA_OFFSET_MS;

    return utcTimestamp;
  } catch {
    return NaN;
  }
};
