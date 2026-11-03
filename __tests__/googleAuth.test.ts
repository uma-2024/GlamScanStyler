import {GoogleSignin} from '@react-native-google-signin/google-signin';
import {signInStylistWithGoogle} from '../src/services/googleAuth';

jest.mock('react-native-config', () => ({
  GOOGLE_WEB_CLIENT_ID: 'web.apps.googleusercontent.com',
  GOOGLE_IOS_CLIENT_ID: 'stale-ios-override',
}));
jest.mock('../src/config/api', () => ({API_BASE_URL: 'https://example.test'}));

const success = {type: 'success', data: {idToken: 'google-token', user: {email: 'stylist@example.test', name: 'Stylist'}}};
const originalFetch = globalThis.fetch;
beforeEach(() => {
  jest.clearAllMocks();
  globalThis.fetch = jest.fn().mockResolvedValue({ok: true, json: async () => ({success: true, data: {user: {_id: 'stylist'}, token: 'session'}})});
});
afterAll(() => { globalThis.fetch = originalFetch; });

test('uses bundled iOS configuration and exchanges the ID token without signing out', async () => {
  (GoogleSignin.signIn as jest.Mock).mockResolvedValue(success);
  expect(await signInStylistWithGoogle()).toMatchObject({userId: 'stylist', token: 'session'});
  expect(GoogleSignin.configure).toHaveBeenCalledWith({webClientId: 'web.apps.googleusercontent.com', offlineAccess: false});
  expect(GoogleSignin.signOut).not.toHaveBeenCalled();
  expect(globalThis.fetch).toHaveBeenCalledWith('https://example.test/google-styler-login', expect.objectContaining({body: JSON.stringify({idToken: 'google-token'})}));
});

test('overlapping attempts open only one native sign-in flow', async () => {
  let finish!: (value: typeof success) => void;
  (GoogleSignin.signIn as jest.Mock).mockImplementation(() => new Promise(resolve => {finish = resolve;}));
  const pending = signInStylistWithGoogle();
  expect(await signInStylistWithGoogle()).toBeNull();
  expect(GoogleSignin.signIn).toHaveBeenCalledTimes(1);
  finish(success);
  await pending;
});

test('cancelled sign-in can be retried without contacting the backend', async () => {
  (GoogleSignin.signIn as jest.Mock).mockResolvedValue({type: 'cancelled', data: null});
  expect(await signInStylistWithGoogle()).toBeNull();
  expect(globalThis.fetch).not.toHaveBeenCalled();
  (GoogleSignin.signIn as jest.Mock).mockResolvedValue(success);
  expect(await signInStylistWithGoogle()).toMatchObject({userId: 'stylist'});
});

test('native failure releases the guard for the next attempt', async () => {
  (GoogleSignin.signIn as jest.Mock).mockRejectedValueOnce(new Error('native failure')).mockResolvedValueOnce(success);
  await expect(signInStylistWithGoogle()).rejects.toThrow('native failure');
  expect(await signInStylistWithGoogle()).toMatchObject({userId: 'stylist'});
});
