import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';
import Config from 'react-native-config';
import { API_BASE_URL } from '../config/api';

type GoogleStylerLoginResult = {
  userId: string;
  email: string;
  name?: string | null;
  token?: string;
};

let isConfigured = false;
let signInInProgress = false;

const DEFAULT_GOOGLE_WEB_CLIENT_ID = '646971224460-8mhps2rodvmdvf703c63bg3niugovqda.apps.googleusercontent.com';

const getGoogleWebClientId = () => String(Config.GOOGLE_WEB_CLIENT_ID || DEFAULT_GOOGLE_WEB_CLIENT_ID).trim();

const configureGoogleSignIn = () => {
  if (isConfigured) {
    return;
  }

  const webClientId = getGoogleWebClientId();
  if (!webClientId) {
    console.warn('Google login web client ID is not available. Google Sign-In may fail.');
  }

  GoogleSignin.configure({
    webClientId,
    // iOS reads CLIENT_ID from the bundled GoogleService-Info.plist so an
    // environment override cannot disagree with the registered callback scheme.
    offlineAccess: false,
  });
  isConfigured = true;
};

export const signOutGoogleStylist = async (): Promise<void> => {
  try {
    configureGoogleSignIn();
    await GoogleSignin.signOut();
  } catch (error) {
    // Silently ignore if not signed in
    console.log('Google signOut info:', error);
  }
};

export const signInStylistWithGoogle = async (): Promise<GoogleStylerLoginResult | null> => {
  if (signInInProgress) return null;
  signInInProgress = true;
  try {
    configureGoogleSignIn();
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    // Clear any cached Google user session so Google prompts account picker every time
    try {
      await GoogleSignin.signOut();
    } catch {
      // Ignore if no user was signed in
    }

    const signInResponse = await GoogleSignin.signIn();
    if (signInResponse.type !== 'success') {
      return null;
    }

    const { idToken, user } = signInResponse.data;
    if (!idToken) {
      throw new Error('Google did not return an ID token. Check that GOOGLE_WEB_CLIENT_ID is a Web client ID from Google Cloud Console.');
    }

    const response = await fetch(`${API_BASE_URL}/google-styler-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ idToken }),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Google login failed. Please try again.');
    }

    const userId =
      result.data?.userId ||
      result.data?.user?._id ||
      result.data?.user?.id ||
      result.data?.user?._id?.toString?.();

    if (!userId) {
      throw new Error('Google login succeeded, but the server did not return a user ID.');
    }

    return {
      userId,
      email: result.data?.user?.email || user.email,
      name: result.data?.user?.name || user.name,
      token: result.data?.token || result.token || result.data?.accessToken,
    };
  } catch (error: any) {
    if (error?.code === statusCodes.SIGN_IN_CANCELLED) {
      return null;
    }
    if (error?.code === statusCodes.IN_PROGRESS) {
      throw new Error('Google login is already in progress.');
    }
    if (error?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error('Google Play Services is not available or needs an update.');
    }
    if (
      error?.code === 'DEVELOPER_ERROR' ||
      error?.message?.includes?.('DEVELOPER_ERROR') ||
      error?.message?.includes?.('code: 10')
    ) {
      throw new Error(
        'Google Login failed because Google OAuth is not configured for this app build. Add the Android package name + SHA-1/SHA-256 in Firebase or Google Cloud, and add the iOS client ID + reversed URL scheme for iOS.',
      );
    }
    throw error;
  } finally {
    signInInProgress = false;
  }
};
