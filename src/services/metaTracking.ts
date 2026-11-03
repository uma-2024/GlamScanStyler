import { Platform } from 'react-native';
import { Settings, AppEventsLogger } from 'react-native-fbsdk-next';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';

let isMetaTrackingReady = false;

/**
 * Initializes Meta (Facebook) App Events tracking with consent gating.
 *
 * @param hasAnalyticsConsent - Pass true if user gave consent, or false to disable tracking.
 */
export async function initializeMetaTracking(hasAnalyticsConsent: boolean = true): Promise<boolean> {
  isMetaTrackingReady = false;

  if (!hasAnalyticsConsent) {
    Settings.setAutoLogAppEventsEnabled(false);
    Settings.setAdvertiserIDCollectionEnabled(false);
    Settings.setAdvertiserTrackingEnabled(false);
    return false;
  }

  let attGranted = false;
  if (Platform.OS === 'ios') {
    try {
      // Request App Tracking Transparency permission on iOS 14+
      const result = await request(PERMISSIONS.IOS.APP_TRACKING_TRANSPARENCY);
      attGranted = result === RESULTS.GRANTED;
      Settings.setAdvertiserTrackingEnabled(attGranted);
    } catch {
      attGranted = false;
      Settings.setAdvertiserTrackingEnabled(false);
    }
  }

  // Automatic event collection follows consent
  Settings.setAutoLogAppEventsEnabled(true);

  // Advertiser ID collection: follow ATT on iOS, enabled on Android
  Settings.setAdvertiserIDCollectionEnabled(
    Platform.OS === 'ios' ? attGranted : true,
  );

  // Initialize SDK
  Settings.initializeSDK();
  isMetaTrackingReady = true;
  return true;
}

/**
 * Logs a standard or custom Meta App Event.
 */
export function logMetaEvent(eventName: string, params?: Record<string, any>): void {
  if (!isMetaTrackingReady) {
    return;
  }
  if (params) {
    AppEventsLogger.logEvent(eventName, params);
  } else {
    AppEventsLogger.logEvent(eventName);
  }
}

/**
 * Logs a purchase event.
 * NOTE: Automatic in-app purchase logging is ON by default in Meta App Events settings.
 * To avoid duplicate purchase counts in Meta Analytics, do NOT call this method manually
 * unless automatic purchase logging has been disabled in the Meta Developer Console.
 */
export function logMetaPurchase(
  amount: number,
  currency: string = 'INR',
  params?: Record<string, any>,
): void {
  if (!isMetaTrackingReady) {
    return;
  }
  AppEventsLogger.logPurchase(amount, currency, params);
}

export { AppEventsLogger, Settings };
