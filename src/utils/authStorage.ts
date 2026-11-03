import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_STORAGE_KEY = '@GlammefyPartner:auth';
const SESSION_DURATION = 90 * 24 * 60 * 60 * 1000; // 90 days in milliseconds

interface AuthData {
  userId: string;
  loginId: string;
  loginTimestamp: number;
}

/**
 * Store login session data
 */
export const storeLoginSession = async (userId: string, loginId: string): Promise<void> => {
  try {
    const authData: AuthData = {
      userId,
      loginId,
      loginTimestamp: Date.now(),
    };
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
    console.log('✅ Login session stored:', { userId, loginId });
  } catch (error) {
    console.error('❌ Error storing login session:', error);
    throw error;
  }
};

/**
 * Get stored login session data
 */
export const getLoginSession = async (): Promise<AuthData | null> => {
  try {
    const storedData = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    if (!storedData) {
      console.log('📭 No stored login session found');
      return null;
    }

    const authData: AuthData = JSON.parse(storedData);
    console.log('📦 Retrieved login session:', authData);

    // Check if session is still valid (within 90 days)
    const now = Date.now();
    const sessionAge = now - authData.loginTimestamp;

    if (sessionAge > SESSION_DURATION) {
      console.log('⏰ Login session expired:', {
        sessionAgeDays: Math.round(sessionAge / (24 * 60 * 60 * 1000)),
        days: 'days',
        maxDuration: '90 days',
      });
      // Session expired, clear it
      await clearLoginSession();
      return null;
    }

    const remainingTime = SESSION_DURATION - sessionAge;
    const remainingDays = Math.round(remainingTime / (24 * 60 * 60 * 1000));
    console.log(`✅ Valid login session found. Remaining time: ${remainingDays} days`);

    return authData;
  } catch (error) {
    console.error('❌ Error retrieving login session:', error);
    return null;
  }
};

/**
 * Check if user has a valid login session
 */
export const hasValidSession = async (): Promise<boolean> => {
  const session = await getLoginSession();
  return session !== null;
};

/**
 * Clear login session data
 */
export const clearLoginSession = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    console.log('🗑️ Login session cleared');
  } catch (error) {
    console.error('❌ Error clearing login session:', error);
    throw error;
  }
};

/**
 * Get remaining session time in hours
 */
export const getRemainingSessionTime = async (): Promise<number> => {
  const session = await getLoginSession();
  if (!session) {
    return 0;
  }

  const now = Date.now();
  const sessionAge = now - session.loginTimestamp;
  const remainingTime = SESSION_DURATION - sessionAge;

  if (remainingTime <= 0) {
    return 0;
  }

  return Math.round(remainingTime / (60 * 60 * 1000)); // Return in hours
};
