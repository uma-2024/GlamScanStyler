import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_BASE_URL_WITH_API} from '../config/api';

export const onboardingStepKeys = ['locationSelection', 'proofOfIdentity', 'certificateUploaded', 'paymentDetails', 'selectService', 'selectAvailableSlots', 'completeProfile', 'reviewProfile'] as const;
export type OnboardingStep = typeof onboardingStepKeys[number];
type Choice = {completed: boolean; skipped: boolean; pending: boolean};
type Choices = Partial<Record<OnboardingStep, Choice>>;
const key = (userId: string) => `@partner:onboarding:${userId}`;
let queue: Promise<unknown> = Promise.resolve();
const serialize = <T,>(work: () => Promise<T>): Promise<T> => {
  const task = queue.then(work);
  queue = task.catch(() => {});
  return task;
};
const read = async (userId: string): Promise<Choices> => {
  const value = await AsyncStorage.getItem(key(userId));
  return value ? JSON.parse(value) : {};
};
const send = async (userId: string, step: OnboardingStep, choice: Choice) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${API_BASE_URL_WITH_API}/profile/update-step`, {
      method: 'PUT', signal: controller.signal,
      headers: {'Content-Type': 'application/json', Accept: 'application/json'},
      body: JSON.stringify({userId, step, completed: choice.completed, skipped: choice.skipped}),
    });
    return response.ok && (await response.json()).success === true;
  } catch { return false; }
  finally { clearTimeout(timer); }
};

// Persist before navigating. Keep failed writes for the next authenticated read.
export const saveOnboardingChoice = (userId: string, step: OnboardingStep, completed: boolean, skipped: boolean) => serialize(async () => {
  const choices = await read(userId);
  const choice = {completed: completed || skipped, skipped, pending: true};
  choices[step] = choice;
  await AsyncStorage.setItem(key(userId), JSON.stringify(choices));
  if (await send(userId, step, choice)) {
    choice.pending = false;
    await AsyncStorage.setItem(key(userId), JSON.stringify(choices));
  }
  return true;
});

export const getOnboardingProgress = (userId: string) => serialize(async () => {
  const choices = await read(userId);
  for (const step of onboardingStepKeys) {
    const choice = choices[step];
    if (choice?.pending && await send(userId, step, choice)) choice.pending = false;
  }
  await AsyncStorage.setItem(key(userId), JSON.stringify(choices));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL_WITH_API}/profile/onboarding-steps/${userId}`, {
      signal: controller.signal, headers: {Accept: 'application/json'},
    });
  } finally { clearTimeout(timer); }
  if (!response.ok) throw new Error('Unable to load onboarding progress');
  const result = await response.json();
  if (!result.success || !result.data) throw new Error('Invalid onboarding progress');
  const {steps = {}, skippedSteps = {}, actualCompletedSteps = {}} = result.data;
  for (const step of onboardingStepKeys) {
    const choice = choices[step];
    if (!choice) continue;
    // Real server data takes precedence over an older local skip.
    if (actualCompletedSteps[step] === true) {
      steps[step] = true;
      skippedSteps[step] = false;
    } else if (choice.completed) {
      const serverCompleted = steps[step] === true && skippedSteps[step] === false;
      steps[step] = true;
      // A later completion on another device must not be replaced by a local skip.
      skippedSteps[step] = serverCompleted && !choice.pending
        ? false : choice.skipped;
    }
  }
  return {steps, skippedSteps, actualCompletedSteps};
});
