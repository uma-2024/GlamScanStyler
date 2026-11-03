import { getLoginSession } from '../utils/authStorage';

export const authenticatedFetch = async (
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> => {
  const session = await getLoginSession();
  const headers = new Headers(init.headers);

  headers.set('Accept', headers.get('Accept') || 'application/json');
  if (session?.loginId) {
    headers.set('Authorization', `Bearer ${session.loginId}`);
  }

  const plainHeaders: Record<string, string> = {};
  headers.forEach((value, key) => {
    plainHeaders[key] = value;
  });

  return fetch(input, { ...init, headers: plainHeaders });
};

let fetchInstalled = false;

export const installAuthenticatedFetch = (): void => {
  if (fetchInstalled) return;
  fetchInstalled = true;

  const nativeFetch = globalThis.fetch.bind(globalThis);
  const authenticatedGlobalFetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const session = await getLoginSession();
    const headers = new Headers(init.headers);
    if (session?.loginId && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${session.loginId}`);
    }
    
    const plainHeaders: Record<string, string> = {};
    headers.forEach((value, key) => {
      plainHeaders[key] = value;
    });

    return nativeFetch(input, { ...init, headers: plainHeaders });
  };
  globalThis.fetch = authenticatedGlobalFetch as typeof globalThis.fetch;
};