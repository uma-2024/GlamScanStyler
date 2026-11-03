import AsyncStorage from '@react-native-async-storage/async-storage';
import {getOnboardingProgress, saveOnboardingChoice, onboardingStepKeys} from '../src/utils/onboardingProgress';
import {getNextIncompleteStep} from '../src/utils/onboardingNavigation';
jest.mock('../src/config/api', () => ({API_BASE_URL_WITH_API: 'https://example.test/api'}));
const originalFetch = globalThis.fetch;
const all = Object.fromEntries(onboardingStepKeys.map(key => [key, true]));
const reply = (data: unknown = {}) => ({ok: true, json: async () => ({success: true, data})});
beforeEach(async () => {await AsyncStorage.clear(); jest.clearAllMocks();});
afterAll(() => {globalThis.fetch = originalFetch;});

test('completed steps do not reappear when derived data is incomplete', () => {
  expect(getNextIncompleteStep(all, {}, {completeProfile: false})).toBeNull();
  expect(getNextIncompleteStep(all, {}, {completeProfile: false}, {includeSkipped: true})).toBeNull();
});
test('skipped steps reopen only in explicit Home completion mode', () => {
  expect(getNextIncompleteStep(all, {certificateUploaded: true}, {})).toBeNull();
  expect(getNextIncompleteStep(all, {certificateUploaded: true}, {}, {includeSkipped: true})).toBe('certificateUpload');
});
test('actual completion supersedes an old skip', () => {
  expect(getNextIncompleteStep(all, {certificateUploaded: true}, {certificateUploaded: true}, {includeSkipped: true})).toBeNull();
});
test('Home flow advances through multiple deferred steps without looping on a fresh skip', () => {
  expect(getNextIncompleteStep(all, {certificateUploaded: true, paymentDetails: true}, {}, {includeSkipped: true, dismissedSteps: ['certificateUploaded']})).toBe('paymentDetails');
});
test('failed skip write survives logout/relogin reads and is retried', async () => {
  globalThis.fetch = jest.fn().mockRejectedValueOnce(new Error('offline'));
  await saveOnboardingChoice('one', 'certificateUploaded', true, true);
  globalThis.fetch = jest.fn().mockResolvedValueOnce(reply()).mockResolvedValueOnce(reply({steps: all, skippedSteps: {certificateUploaded: true}}));
  const progress = await getOnboardingProgress('one');
  expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  expect(progress.skippedSteps.certificateUploaded).toBe(true);
  expect(getNextIncompleteStep(progress.steps, progress.skippedSteps)).toBeNull();
});
test('stale server read cannot undo a saved skip and accounts stay isolated', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue(reply());
  await saveOnboardingChoice('one', 'certificateUploaded', true, true);
  const first = await getOnboardingProgress('one');
  const second = await getOnboardingProgress('two');
  expect(first.skippedSteps.certificateUploaded).toBe(true);
  expect(second.skippedSteps.certificateUploaded).toBeUndefined();
});
test('concurrent step saves preserve both choices', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue(reply());
  await Promise.all([saveOnboardingChoice('one', 'certificateUploaded', true, true), saveOnboardingChoice('one', 'paymentDetails', true, true)]);
  const progress = await getOnboardingProgress('one');
  expect(progress.skippedSteps).toMatchObject({certificateUploaded: true, paymentDetails: true});
});
