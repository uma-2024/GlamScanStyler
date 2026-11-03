import { AppState, Platform } from 'react-native';
import notifee, { EventType } from '@notifee/react-native';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { API_BASE_URL_WITH_API } from '../config/api';
import { displayNotification, initializeNotifications } from '../utils/notificationService';
import { markBookingRequestNotified } from '../utils/bookingRequestAlerts';


const wait = (milliseconds: number) =>
  new Promise<void>(resolve => setTimeout(() => resolve(), milliseconds));

const registerToken = async (userId: string, token: string, signal?: AbortSignal) => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    if (signal?.aborted) return;
    try {
      const response = await fetch(`${API_BASE_URL_WITH_API}/push/register`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, token, platform: Platform.OS }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || `HTTP ${response.status}`);
      }
      console.info(`[push] Device registered for stylist ${userId}`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await wait(attempt * 1000);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('Push token registration failed');
};

/** Own these listeners at the app root, independently of the selected screen. */
export const initializeFCM = (userId?: string): (() => void) => {
  if (!userId) return () => { };
  let disposed = false;
  let registering = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  const subscriptions: Array<() => void> = [];

  try {
    const messaging = require('@react-native-firebase/messaging').default;
    const client = messaging();
    const handleOpen = async (data?: Record<string, unknown>) => {
      if (disposed) return;
      if (data?.type === 'new-booking-request') {
        await markBookingRequestNotified(String(data.bookingId || '')).catch(() => { });
      } else if (data?.type === 'chat_message' && data?.bookingId) {
        const { DeviceEventEmitter } = require('react-native');
        DeviceEventEmitter.emit('open_chat_booking', {
          bookingId: String(data.bookingId),
          counterpartName: data.counterpartName ? String(data.counterpartName) : undefined,
          serviceName: data.serviceName ? String(data.serviceName) : undefined,
        });
      }
    };

    // Install listeners before permission/token work so neither a denied
    // permission nor a slow registration disables foreground booking popups.
    subscriptions.push(client.onMessage(async (message: FirebaseMessagingTypes.RemoteMessage) => {
      if (disposed) return;
      await displayNotification(
        String(message.notification?.title || message.data?.title || 'New notification'),
        String(message.notification?.body || message.data?.body || ''),
        message.data as Record<string, string | undefined>,
        String(message.data?.type || 'app_notification'),
      );
    }));
    subscriptions.push(client.onNotificationOpenedApp((message: FirebaseMessagingTypes.RemoteMessage) => {
      void handleOpen(message.data);
    }));
    subscriptions.push(notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
        void handleOpen(detail.notification?.data);
      }
    }));

    const registerDevice = async (requestPermission = false) => {
      if (disposed || registering) return;
      registering = true;
      if (retryTimer) clearTimeout(retryTimer);
      try {
        if (requestPermission) await initializeNotifications();
        if (disposed) return;
        if (Platform.OS === 'ios') {
          if (requestPermission) {
            await client.requestPermission({
              alert: true,
              badge: true,
              sound: true,
            });
          }
          if (!client.isDeviceRegisteredForRemoteMessages) {
            await client.registerDeviceForRemoteMessages();
          }
          let apnsToken = await client.getAPNSToken().catch(() => null);
          let attempts = 0;
          while (!apnsToken && attempts < 10 && !disposed) {
            await wait(500);
            apnsToken = await client.getAPNSToken().catch(() => null);
            attempts += 1;
          }
        }
        const token = await client.getToken();
        if (!disposed && token) await registerToken(userId, token, controller.signal);
      } catch (error) {
        if (!disposed) {
          console.warn('Unable to register booking notifications; retrying:', error);
          retryTimer = setTimeout(() => { void registerDevice(); }, 30000);
        }
      } finally {
        registering = false;
      }
    };
    subscriptions.push(client.onTokenRefresh(async (token: string) => {
      if (disposed) return;
      try {
        await registerToken(userId, token, controller.signal);
      } catch (error) {
        if (!disposed) void registerDevice();
      }
    }));
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active' && !disposed) {
        void registerDevice();
      }
    });
    subscriptions.push(() => appState.remove());
    void registerDevice(true);
    void client.getInitialNotification()
      .then((message: FirebaseMessagingTypes.RemoteMessage | null) => {
        if (message) return handleOpen(message.data);
      }).catch(() => { });
    if (Platform.OS === 'android') {
      void notifee.getInitialNotification().then(notification => {
        if (notification) return handleOpen(notification.notification.data);
      }).catch(() => { });
    }
  } catch (error) {
    console.warn('Unable to initialize push notifications:', error);
  }

  return () => {
    disposed = true;
    controller.abort();
    if (retryTimer) clearTimeout(retryTimer);
    subscriptions.forEach(unsubscribe => unsubscribe());
  };
};

  export const unregisterFCMToken = async (userId?: string) => {
    if (!userId) return;
    try {
      const messaging = require('@react-native-firebase/messaging').default;
      const token = await messaging().getToken();
      await fetch(`${API_BASE_URL_WITH_API}/push/unregister`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, token }),
      });
    } catch (error) {
      console.warn('Failed to unregister FCM token:', error);
    }
  };
