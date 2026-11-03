import {saveOnboardingChoice} from './onboardingProgress';

/**
 * Update onboarding step completion status
 * @param userId - User ID
 * @param step - Step name (proofOfIdentity, certificateUploaded, paymentDetails, selectService, selectAvailableSlots, completeProfile, locationSelection, reviewProfile)
 * @param completed - Whether the step is completed (default: true)
 */
let onStepUpdatedCallback: ((userId: string) => void) | null = null;

export const setOnStepUpdatedCallback = (cb: ((userId: string) => void) | null) => {
  onStepUpdatedCallback = cb;
};

export const updateOnboardingStep = async (
  userId: string,
  step: 'proofOfIdentity' | 'certificateUploaded' | 'paymentDetails' | 'selectService' | 'selectAvailableSlots' | 'completeProfile' | 'locationSelection' | 'reviewProfile',
  completed: boolean = true,
  skipped: boolean = false
): Promise<boolean> => {
  try {
    if (!userId) {
      console.error('❌ User ID is required to update onboarding step');
      return false;
    }

    const saved = await saveOnboardingChoice(userId, step, completed, skipped);
    onStepUpdatedCallback?.(userId);
    return saved;
  } catch (error) {
    console.error(`❌ Error updating step ${step}:`, error);
    return false;
  }
};

