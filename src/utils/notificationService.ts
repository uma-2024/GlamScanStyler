import notifee, { AndroidImportance, TriggerType } from '@notifee/react-native';
import { Platform } from 'react-native';
import { alertBookingRequestOnce } from './bookingRequestAlerts';

export const BOOKING_REQUEST_CHANNEL = 'booking-requests-v3';

interface Booking {
  bookingId: string;
  serviceName: string;
  date: string;
  startTime: string;
  period: string;
  userName: string;
  status?: string; // Optional status field
}

/**
 * Request notification permissions
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'android') {
      const settings = await notifee.requestPermission();
      return settings.authorizationStatus >= 1; // 1 = AUTHORIZED, 2 = PROVISIONAL
    }
    // iOS permission handling
    const settings = await notifee.requestPermission();
    return settings.authorizationStatus >= 1;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
};

/**
 * Create a notification channel for Android (required for Android 8.0+)
 */
export const createNotificationChannel = async (): Promise<void> => {
  if (Platform.OS === 'android') {
    try {
      await notifee.createChannel({
        id: BOOKING_REQUEST_CHANNEL,
        name: 'Incoming Booking Requests',
        importance: AndroidImportance.HIGH,
        sound: 'ring_3',
        vibration: true,
        vibrationPattern: [300, 1000, 300, 1000, 300, 1000],
      });
      await notifee.createChannel({
        id: 'upcoming-service',
        name: 'Upcoming Service Reminders',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
        vibrationPattern: [300, 500],
      });
      await notifee.createChannel({
        id: 'glammefy-notifications-v3',
        name: 'GlamMefy Notifications',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: false,
      });
      console.log('✅ Notification channel created');
    } catch (error) {
      console.error('Error creating notification channel:', error);
    }
  }
};

/**
 * Convert time to 24-hour format (handles both 12-hour with period and 24-hour formats)
 */
const convertTo24Hour = (time: string, period?: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  
  // If time is already in 24-hour format (hours >= 13 or hours === 0 with minutes > 0)
  // Or if period is missing/empty, assume 24-hour format
  if (!period || period.trim() === '' || hours >= 13 || (hours === 0 && minutes > 0)) {
    return hours * 60 + minutes;
  }
  
  // Convert 12-hour to 24-hour format
  const periodUpper = period.toUpperCase();
  let hour24 = hours;
  
  if (periodUpper === 'AM' || periodUpper === 'AM') {
    hour24 = hours === 12 ? 0 : hours;
  } else if (periodUpper === 'PM' || periodUpper === 'PM') {
    hour24 = hours === 12 ? 12 : hours + 12;
  }
  
  return hour24 * 60 + minutes;
};

/**
 * Calculate the notification time (10 minutes before service start)
 */
const calculateNotificationTime = (booking: Booking): Date | null => {
  try {
    const bookingDate = new Date(booking.date);
    if (isNaN(bookingDate.getTime())) {
      console.error('Invalid booking date:', booking.date);
      return null;
    }

    // Extract date components in LOCAL timezone to avoid timezone issues
    const localYear = bookingDate.getFullYear();
    const localMonth = bookingDate.getMonth();
    const localDay = bookingDate.getDate();

    // Parse start time and convert to 24-hour format
    const startTotalMinutes = convertTo24Hour(booking.startTime, booking.period);
    const startHour24 = Math.floor(startTotalMinutes / 60);
    const startMinute24 = startTotalMinutes % 60;

    // Validate hour and minute ranges
    if (startHour24 < 0 || startHour24 > 23 || startMinute24 < 0 || startMinute24 > 59) {
      console.error('Invalid time values:', { startHour24, startMinute24, startTime: booking.startTime, period: booking.period });
      return null;
    }

    // Create start datetime in LOCAL timezone
    const startDateTime = new Date(localYear, localMonth, localDay, startHour24, startMinute24, 0, 0);

    // Calculate notification time (10 minutes before)
    const notificationTime = new Date(startDateTime.getTime() - 10 * 60 * 1000);

    // Only schedule if notification time is in the future
    const now = new Date();
    if (notificationTime <= now) {
      console.log('⚠️ Notification time is in the past, skipping:', booking.bookingId, {
        notificationTime: notificationTime.toLocaleString(),
        now: now.toLocaleString(),
        startTime: booking.startTime,
        period: booking.period,
      });
      return null;
    }

    console.log('✅ Notification time calculated:', {
      bookingId: booking.bookingId,
      startTime: booking.startTime,
      period: booking.period,
      startDateTime: startDateTime.toLocaleString(),
      notificationTime: notificationTime.toLocaleString(),
      minutesUntilNotification: Math.round((notificationTime.getTime() - now.getTime()) / 60000),
    });

    return notificationTime;
  } catch (error) {
    console.error('Error calculating notification time:', error, {
      booking: booking.bookingId,
      date: booking.date,
      startTime: booking.startTime,
      period: booking.period,
    });
    return null;
  }
};

/**
 * Schedule a notification for an upcoming booking
 */
export const scheduleBookingNotification = async (booking: Booking): Promise<string | null> => {
  try {
    // Request permission if not already granted
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.warn('⚠️ Notification permission not granted');
      return null;
    }

    // Create channel for Android
    await createNotificationChannel();

    // Calculate notification time
    const notificationTime = calculateNotificationTime(booking);
    if (!notificationTime) {
      return null;
    }

    // Format time for display (convert 24-hour to 12-hour format)
    const bookingDate = new Date(booking.date);
    const localYear = bookingDate.getFullYear();
    const localMonth = bookingDate.getMonth();
    const localDay = bookingDate.getDate();
    
    const startTotalMinutes = convertTo24Hour(booking.startTime, booking.period);
    const startHour24 = Math.floor(startTotalMinutes / 60);
    const startMinute24 = startTotalMinutes % 60;
    
    const startDateTime = new Date(localYear, localMonth, localDay, startHour24, startMinute24, 0, 0);

    const formattedTime = startDateTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    // Schedule notification
    const notificationId = await notifee.createTriggerNotification(
      {
        title: 'Upcoming Service Reminder',
        body: `${booking.serviceName} with ${booking.userName} starts in 10 minutes (${formattedTime})`,
        android: {
          channelId: 'upcoming-service',
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'default',
          },
          smallIcon: 'ic_launcher',
          largeIcon: 'ic_launcher',
        },
        data: {
          bookingId: booking.bookingId,
          type: 'upcoming-service',
        },
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: notificationTime.getTime(),
      }
    );

    console.log(`✅ Notification scheduled for booking ${booking.bookingId} at ${notificationTime.toLocaleString()}`);
    return notificationId;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return null;
  }
};

/**
 * Cancel a scheduled notification
 */
export const cancelBookingNotification = async (bookingId: string): Promise<void> => {
  try {
    // Get all scheduled notifications
    const notifications = await notifee.getTriggerNotifications();
    
    // Find and cancel the notification for this booking
    for (const notification of notifications) {
      if (notification.notification.data?.bookingId === bookingId && notification.notification.id) {
        await notifee.cancelNotification(notification.notification.id);
        console.log(`✅ Cancelled notification for booking ${bookingId}`);
      }
    }
  } catch (error) {
    console.error('Error cancelling notification:', error);
  }
};

/**
 * Cancel all scheduled notifications
 */
export const cancelAllNotifications = async (): Promise<void> => {
  try {
    await notifee.cancelAllNotifications();
    console.log('✅ All notifications cancelled');
  } catch (error) {
    console.error('Error cancelling all notifications:', error);
  }
};

/**
 * Schedule notifications for multiple upcoming bookings
 */
export const scheduleUpcomingBookingsNotifications = async (
  bookings: Booking[]
): Promise<void> => {
  try {
    console.log(`📅 Scheduling notifications for ${bookings.length} upcoming bookings`);
    
    // First, cancel all existing notifications to avoid duplicates
    const existingNotifications = await notifee.getTriggerNotifications();
    console.log(`🗑️ Cancelling ${existingNotifications.length} existing notifications`);
    for (const notification of existingNotifications) {
      if (notification.notification.data?.type === 'upcoming-service' && notification.notification.id) {
        await notifee.cancelNotification(notification.notification.id);
      }
    }

    // Schedule notifications for all upcoming bookings
    const scheduledIds: string[] = [];
    const skippedBookings: string[] = [];
    
    for (const booking of bookings) {
      // Only schedule for confirmed bookings (status is optional, default to confirmed if not provided)
      if (!booking.status || booking.status === 'confirmed') {
        console.log(`📋 Processing booking ${booking.bookingId}:`, {
          serviceName: booking.serviceName,
          date: booking.date,
          startTime: booking.startTime,
          period: booking.period,
          status: booking.status,
        });
        
        const notificationId = await scheduleBookingNotification(booking);
        if (notificationId) {
          scheduledIds.push(notificationId);
          console.log(`✅ Scheduled notification for booking ${booking.bookingId}`);
        } else {
          skippedBookings.push(booking.bookingId);
          console.log(`⚠️ Failed to schedule notification for booking ${booking.bookingId}`);
        }
      } else {
        console.log(`⏭️ Skipping booking ${booking.bookingId} - status: ${booking.status}`);
      }
    }

    console.log(`✅ Scheduled ${scheduledIds.length} notifications for upcoming bookings`);
    if (skippedBookings.length > 0) {
      console.log(`⚠️ Skipped ${skippedBookings.length} bookings:`, skippedBookings);
    }
    
    // Log all scheduled notifications for debugging
    const allScheduled = await notifee.getTriggerNotifications();
    console.log(`📊 Total scheduled notifications: ${allScheduled.length}`);
    allScheduled.forEach((notif) => {
      if (notif.trigger && 'timestamp' in notif.trigger) {
        const triggerTime = new Date(notif.trigger.timestamp);
        console.log(`  - Notification ${notif.notification.id}: ${triggerTime.toLocaleString()}`);
      }
    });
  } catch (error) {
    console.error('Error scheduling upcoming bookings notifications:', error);
  }
};

/**
 * Show immediate success notification when service is completed
 */
export const showServiceCompletedNotification = async (
  serviceName: string,
  userName: string
): Promise<void> => {
  try {
    // Request permission if not already granted
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.warn('⚠️ Notification permission not granted');
      return;
    }

    // Create channel for Android
    await createNotificationChannel();

    // Show immediate notification
    await notifee.displayNotification({
      title: '🎉 Congratulations!',
      body: `You have successfully completed ${serviceName} for ${userName}. Great job!`,
      android: {
        channelId: 'upcoming-service',
        importance: AndroidImportance.HIGH,
        pressAction: {
          id: 'default',
        },
        smallIcon: 'ic_launcher',
        largeIcon: 'ic_launcher',
        sound: 'default',
        vibrationPattern: [300, 500],
      },
      data: {
        type: 'service-completed',
      },
    });

    console.log('✅ Service completed notification shown');
  } catch (error) {
    console.error('Error showing service completed notification:', error);
  }
};

export const displayNotification = async (
  title: string,
  body: string,
  data: Record<string, string | undefined> = {},
  type: string = 'app_notification'
): Promise<void> => {
  try {
    const display = async (): Promise<boolean> => {
      // Permission is requested at app startup, never repeatedly by a poll or
      // a background handler. The in-app popup works even when it is denied.
      const settings = await notifee.getNotificationSettings();
      if (settings.authorizationStatus < 1) return false;
      await createNotificationChannel();
      await notifee.displayNotification({
      id: type === 'new-booking-request' && data.bookingId
        ? `booking-request-${data.bookingId}` : undefined,
      title: title || 'New Notification',
      body: body || '',
      android: {
        channelId: type === 'new-booking-request' ? BOOKING_REQUEST_CHANNEL : 'glammefy-notifications-v3',
        importance: AndroidImportance.HIGH,
        pressAction: {
          id: 'default',
        },
        smallIcon: 'ic_launcher',
        largeIcon: 'ic_launcher',
        sound: type === 'new-booking-request' ? 'ring_3' : 'default',
        vibrationPattern: type === 'new-booking-request' ? [300, 1000, 300, 1000, 300, 1000] : undefined,
        onlyAlertOnce: false,
      },
      ios: {
        sound: type === 'new-booking-request' ? 'ring_3.wav' : 'default',
      },
      data: {
        type,
        ...data,
      },
      });
      return true;
    };
    if (type === 'new-booking-request' && data.bookingId) {
      await alertBookingRequestOnce(data.bookingId, display);
    } else {
      await display();
    }
  } catch (error) {
    console.error('Error displaying notification:', error);
  }
};

export const showNewBookingRequestNotification = async (
  serviceName: string,
  userName: string,
  bookingId?: string,
): Promise<void> => {
  return displayNotification(
    'New Glam Booking Request',
    `${serviceName || 'Service'} request from ${userName || 'a client'}.`,
    { type: 'new-booking-request', bookingId },
    'new-booking-request',
  );
};

/**
 * Initialize notification service (call this when app starts)
 */
export const initializeNotifications = async (): Promise<void> => {
  try {
    await requestNotificationPermission();
    await createNotificationChannel();
    console.log('✅ Notification service initialized');
  } catch (error) {
    console.error('Error initializing notifications:', error);
  }
};
