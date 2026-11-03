import Config from 'react-native-config';

const LIVE_API_URL = 'https://api.glammefy.com';

const sanitizeBaseUrl = (value?: string): string => {
  return String(value || LIVE_API_URL)
    .trim()
    .replace(/\/+$/, '');
};

/**
 * Get the API base URL from environment variables
 * Uses react-native-config to read from .env file
 * @param includeApiPath - If true, appends '/api' to the base URL (default: false)
 * @returns The API base URL string
 */
export const getApiBaseUrl = (includeApiPath: boolean = false): string => {
  let baseUrl = sanitizeBaseUrl(Config.API_URL);

  if (!Config.API_URL) {
    console.warn(
      'react-native-config API_URL is missing at runtime. Falling back to production URL:',
      LIVE_API_URL,
    );
  }

  baseUrl = baseUrl.replace(/\/api$/, '');

  return includeApiPath ? `${baseUrl}/api` : baseUrl;
};

/**
 * Get the Admin Panel API base URL
 * Admin panel server runs on port 3001
 * @returns The admin panel API base URL
 */
export const getAdminPanelApiUrl = (): string => {
  // If API_URL is set, use it and replace port 3000 with 3001
  const baseUrl = sanitizeBaseUrl(Config.API_URL);
  const adminUrl = baseUrl.replace(':3000', ':3001').replace('localhost:3000', 'localhost:3001');
  return `${adminUrl}/api`;
};

/**
 * API base URL constant (without /api path)
 * Use this for root-level routes like /signup, /login, /verification/save
 */
export const API_BASE_URL = getApiBaseUrl();

/**
 * API base URL with /api path
 * Use this for routes under /api like /api/services
 */
export const API_BASE_URL_WITH_API = getApiBaseUrl(true);

/**
 * Admin Panel API base URL with /api path
 * Use this for admin panel routes like /api/admin/main-categories
 */
export const ADMIN_PANEL_API_URL = getAdminPanelApiUrl();
