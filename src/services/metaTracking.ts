import { Platform, AppState } from 'react-native';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';

let isMetaTrackingReady = false;

// Helper: Ensure the application is active and window hierarchy is ready
// Apple requires requestTrackingAuthorization to be called when applicationState == .active
const waitForAppActive = async (): Promise<void> => {
  if (AppState.currentState === 'active') {
    return;
  }
  return new Promise<void>((resolve) => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        sub.remove();
        resolve();
      }
    });
  });
};

// Lazy loader for react-native-fbsdk-next to avoid initialization race conditions
export function getFbSdk(): any {
  try {
    return require('react-native-fbsdk-next');
  } catch {
    return null;
  }
}

export function getSettings(): any {
  return getFbSdk()?.Settings ?? null;
}

export function getAppEventsLogger(): any {
  return getFbSdk()?.AppEventsLogger ?? null;
}

/**
 * Requests iOS App Tracking Transparency (ATT) permission.
 * Bulletproof on iPadOS/iOS: ensures active state and allows window hierarchy to stabilize.
 */
export async function requestAppTrackingTransparency(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return true;
  }

  try {
    await waitForAppActive();
    // Safety delay to ensure rootViewController is presented and key window is active
    await new Promise((res) => setTimeout(() => res(true), 1000));

    // Request ATT directly; if already determined, react-native-permissions resolves immediately
    const result = await request(PERMISSIONS.IOS.APP_TRACKING_TRANSPARENCY);
    const granted = result === RESULTS.GRANTED;
    console.log(`📱 [ATT] Permission result: ${result}, granted: ${granted}`);
    return granted;
  } catch (error) {
    console.warn('⚠️ [ATT] Request failed:', error);
    return false;
  }
}

/**
 * Initializes Meta (Facebook) App Events tracking with consent gating.
 *
 * @param hasAnalyticsConsent - Pass true if user gave consent, or false to disable tracking.
 */
export async function initializeMetaTracking(hasAnalyticsConsent: boolean = true): Promise<boolean> {
  isMetaTrackingReady = false;

  const settingsModule = getSettings();
  const appEventsModule = getAppEventsLogger();

  if (!hasAnalyticsConsent) {
    try {
      settingsModule?.setAutoLogAppEventsEnabled?.(false);
      settingsModule?.setAdvertiserIDCollectionEnabled?.(false);
      settingsModule?.setAdvertiserTrackingEnabled?.(false);
    } catch {}
    return false;
  }

  let attGranted = false;
  if (Platform.OS === 'ios') {
    attGranted = await requestAppTrackingTransparency();
    try {
      settingsModule?.setAdvertiserTrackingEnabled?.(attGranted);
      settingsModule?.setAdvertiserIDCollectionEnabled?.(attGranted);
    } catch (attErr) {
      console.warn('⚠️ [ATT] Failed to update advertiser tracking:', attErr);
    }
  } else {
    attGranted = true;
    try {
      settingsModule?.setAdvertiserIDCollectionEnabled?.(true);
    } catch {}
  }

  // If native SDK is not present in binary, fail gracefully after handling ATT
  if (!settingsModule || !appEventsModule) {
    console.log('ℹ️ Meta SDK native modules not present in this build; ATT prompt handled.');
    return false;
  }

  try {
    // Automatic event collection follows consent
    settingsModule?.setAutoLogAppEventsEnabled?.(true);

    // Initialize SDK
    if (typeof settingsModule?.initializeSDK === 'function') {
      settingsModule.initializeSDK();
    }
    isMetaTrackingReady = true;
    console.log('✅ Meta tracking initialized successfully');
    return true;
  } catch (error) {
    console.warn('⚠️ Meta tracking initialization failed gracefully:', error);
    isMetaTrackingReady = false;
    return false;
  }
}

/**
 * Logs a standard or custom Meta App Event with optional valueToSum and parameter dictionary.
 * Completely fail-safe: never throws or blocks app/login flow.
 */
export function logMetaEvent(
  eventName: string,
  params?: Record<string, any>,
  valueToSum?: number,
): void {
  const appEventsModule = getAppEventsLogger();
  if (!isMetaTrackingReady || !appEventsModule) {
    return;
  }
  try {
    if (typeof valueToSum === 'number' && params) {
      appEventsModule?.logEvent?.(eventName, valueToSum, params);
    } else if (params) {
      appEventsModule?.logEvent?.(eventName, params);
    } else if (typeof valueToSum === 'number') {
      appEventsModule?.logEvent?.(eventName, valueToSum);
    } else {
      appEventsModule?.logEvent?.(eventName);
    }
    console.log(`📊 [Meta AppEvent] ${eventName}`, { valueToSum, params });
  } catch (error) {
    console.warn('⚠️ Failed to log Meta event:', eventName, error);
  }
}

/**
 * Standard Meta Event: Contact
 */
export function logMetaContact(params?: {
  contact_method?: string;
  contact_type?: string;
  [key: string]: any;
}): void {
  const appEvents = getAppEventsLogger();
  logMetaEvent(appEvents?.AppEvents?.Contact || 'Contact', params);
}

/**
 * Standard Meta Event: Search
 * Parameters: Content ID, Content Type, Search String
 */
export function logMetaSearch(searchString: string, params?: {
  content_id?: string;
  content_type?: string;
  [key: string]: any;
}): void {
  const appEvents = getAppEventsLogger();
  logMetaEvent(appEvents?.AppEvents?.Searched || 'Searched', {
    [appEvents?.AppEventParams?.SearchString || 'fb_search_string']: searchString,
    [appEvents?.AppEventParams?.ContentID || 'fb_content_id']: params?.content_id,
    [appEvents?.AppEventParams?.ContentType || 'fb_content_type']: params?.content_type || 'location',
    ...params,
  });
}

/**
 * Standard Meta Event: Complete Registration
 * Parameter: Registration Method
 */
export function logMetaCompleteRegistration(method: string, params?: Record<string, any>): void {
  const appEvents = getAppEventsLogger();
  logMetaEvent(appEvents?.AppEvents?.CompletedRegistration || 'CompletedRegistration', {
    [appEvents?.AppEventParams?.RegistrationMethod || 'fb_registration_method']: method,
    ...params,
  });
}

/**
 * Standard Meta Event: View Content
 * Parameters: Content ID, Content Type
 */
export function logMetaViewContent(params: {
  content_id: string;
  content_type: string;
  content_name?: string;
  currency?: string;
  valueToSum?: number;
  [key: string]: any;
}): void {
  const { valueToSum, ...rest } = params;
  const appEvents = getAppEventsLogger();
  logMetaEvent(
    appEvents?.AppEvents?.ViewedContent || 'ViewedContent',
    {
      [appEvents?.AppEventParams?.ContentID || 'fb_content_id']: rest.content_id,
      [appEvents?.AppEventParams?.ContentType || 'fb_content_type']: rest.content_type,
      ...rest,
    },
    valueToSum,
  );
}

/**
 * Standard Meta Event: Subscribe
 * Parameters: Content ID, Content Type, Currency, ValueToSum
 */
export function logMetaSubscribe(params: {
  content_id: string;
  content_type?: string;
  currency?: string;
  valueToSum?: number;
  [key: string]: any;
}): void {
  const { valueToSum, ...rest } = params;
  const appEvents = getAppEventsLogger();
  logMetaEvent(
    appEvents?.AppEvents?.Subscribe || 'Subscribe',
    {
      [appEvents?.AppEventParams?.ContentID || 'fb_content_id']: rest.content_id,
      [appEvents?.AppEventParams?.ContentType || 'fb_content_type']: rest.content_type || 'partner_subscription',
      [appEvents?.AppEventParams?.Currency || 'fb_currency']: rest.currency || 'INR',
      ...rest,
    },
    valueToSum,
  );
}

/**
 * Standard Meta Event: Initiate Checkout
 * Parameters: Content ID, Content Type, Currency, ValueToSum
 */
export function logMetaInitiateCheckout(params: {
  content_id: string;
  content_type?: string;
  currency?: string;
  valueToSum?: number;
  [key: string]: any;
}): void {
  const { valueToSum, ...rest } = params;
  const appEvents = getAppEventsLogger();
  logMetaEvent(
    appEvents?.AppEvents?.InitiatedCheckout || 'InitiatedCheckout',
    {
      [appEvents?.AppEventParams?.ContentID || 'fb_content_id']: rest.content_id,
      [appEvents?.AppEventParams?.ContentType || 'fb_content_type']: rest.content_type || 'subscription_plan',
      [appEvents?.AppEventParams?.Currency || 'fb_currency']: rest.currency || 'INR',
      ...rest,
    },
    valueToSum,
  );
}

/**
 * Standard Meta Event: Start Trial
 * Parameters: Content ID, Content Type, Currency, ValueToSum
 */
export function logMetaStartTrial(params?: {
  content_id?: string;
  content_type?: string;
  currency?: string;
  valueToSum?: number;
  [key: string]: any;
}): void {
  const { valueToSum, ...rest } = params || {};
  const appEvents = getAppEventsLogger();
  logMetaEvent(
    appEvents?.AppEvents?.StartTrial || 'StartTrial',
    {
      [appEvents?.AppEventParams?.ContentID || 'fb_content_id']: rest?.content_id || 'partner_freemium',
      [appEvents?.AppEventParams?.ContentType || 'fb_content_type']: rest?.content_type || 'membership_trial',
      [appEvents?.AppEventParams?.Currency || 'fb_currency']: rest?.currency || 'INR',
      ...rest,
    },
    valueToSum || 0,
  );
}

/**
 * Standard Meta Event: Rate
 * Parameters: MaxRating Value, Content Type, ValueToSum
 */
export function logMetaRate(params: {
  ratingValue: number;
  maxRatingValue?: number;
  content_type?: string;
  content_id?: string;
  [key: string]: any;
}): void {
  const maxRating = params.maxRatingValue ?? 5;
  const appEvents = getAppEventsLogger();
  logMetaEvent(
    appEvents?.AppEvents?.Rated || 'Rated',
    {
      [appEvents?.AppEventParams?.MaxRatingValue || 'fb_max_rating_value']: maxRating,
      [appEvents?.AppEventParams?.ContentType || 'fb_content_type']: params.content_type || 'service_booking',
      [appEvents?.AppEventParams?.ContentID || 'fb_content_id']: params.content_id,
      ...params,
    },
    params.ratingValue,
  );
}

/**
 * Standard Meta Event: Purchase
 * Parameters: Content ID, Content Type, Currency, ValueToSum
 */
export function logMetaPurchase(
  amount: number,
  currency: string = 'INR',
  params?: {
    content_id?: string;
    content_type?: string;
    [key: string]: any;
  },
): void {
  const appEvents = getAppEventsLogger();
  if (!isMetaTrackingReady || !appEvents) {
    return;
  }
  try {
    const enrichedParams = {
      [appEvents?.AppEventParams?.ContentID || 'fb_content_id']: params?.content_id,
      [appEvents?.AppEventParams?.ContentType || 'fb_content_type']: params?.content_type || 'product',
      [appEvents?.AppEventParams?.Currency || 'fb_currency']: currency,
      ...params,
    };
    appEvents?.logPurchase?.(amount, currency, enrichedParams);
    console.log(`📊 [Meta AppEvent] Purchase`, { amount, currency, enrichedParams });
  } catch (error) {
    console.warn('⚠️ Failed to log Meta purchase:', error);
  }
}

/**
 * Standard Meta Event: Add Payment Info
 * Parameters: Success (1/0 or true/false)
 */
export function logMetaAddPaymentInfo(success: boolean = true, params?: Record<string, any>): void {
  const appEvents = getAppEventsLogger();
  logMetaEvent(appEvents?.AppEvents?.AddedPaymentInfo || 'AddedPaymentInfo', {
    [appEvents?.AppEventParams?.Success || 'fb_success']: success ? '1' : '0',
    success: success ? 1 : 0,
    ...params,
  });
}

export const Settings = {
  setAutoLogAppEventsEnabled: (enabled: boolean) => getSettings()?.setAutoLogAppEventsEnabled?.(enabled),
  setAdvertiserIDCollectionEnabled: (enabled: boolean) => getSettings()?.setAdvertiserIDCollectionEnabled?.(enabled),
  setAdvertiserTrackingEnabled: (enabled: boolean) => getSettings()?.setAdvertiserTrackingEnabled?.(enabled),
  initializeSDK: () => getSettings()?.initializeSDK?.(),
};

export const AppEventsLogger = {
  logEvent: (name: string, ...args: any[]) => getAppEventsLogger()?.logEvent?.(name, ...args),
  logPurchase: (amount: number, currency: string, params?: any) => getAppEventsLogger()?.logPurchase?.(amount, currency, params),
};

