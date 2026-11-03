import {
  appleAuth,
} from '@invertase/react-native-apple-authentication';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../config/api';

export type AppleStylerLoginResult = {
  userId: string;
  email: string;
  name?: string | null;
  token?: string;
};

export const signInStylistWithApple = async (): Promise<AppleStylerLoginResult | null> => {
  if (Platform.OS !== 'ios') {
    throw new Error('Apple Sign-In is only supported on iOS devices.');
  }

  // Performs Apple Sign-In request
  const appleAuthRequestResponse = await appleAuth.performRequest({
    requestedOperation: appleAuth.Operation.LOGIN,
    requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
  });

  // Ensure Apple identity token exists
  const { identityToken, user, email, fullName } = appleAuthRequestResponse;
  if (!identityToken || !user) {
    throw new Error('Apple authentication failed to retrieve valid credentials.');
  }

  // Send credentials to backend
  const response = await fetch(`${API_BASE_URL}/apple-styler-login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      identityToken,
      user,
      email,
      fullName,
    }),
  });

  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.message || 'Apple login failed. Please try again.');
  }

  const userId =
    result.data?.userId ||
    result.data?.user?._id ||
    result.data?.user?.id ||
    result.data?.user?._id?.toString?.();

  if (!userId) {
    throw new Error('Apple login succeeded, but server did not return user ID.');
  }

  return {
    userId,
    email: result.data?.user?.email || email || '',
    name: result.data?.user?.name || (fullName?.givenName ? `${fullName.givenName} ${fullName.familyName || ''}`.trim() : null),
    token: result.data?.token || result.token || result.data?.accessToken,
  };
};

export const isAppleAuthSupported = () => {
  return Platform.OS === 'ios' && appleAuth.isSupported;
};
