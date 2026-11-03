/**
 * Determines the next screen to navigate to during onboarding.
 *
 * @param steps - Map of step keys to boolean status (true if completed or skipped)
 * @param skippedSteps - Map of step keys to boolean (true if user clicked Skip)
 * @param actualCompletedSteps - Map of step keys to boolean (true if genuinely filled/verified)
 * @param options.includeSkipped - If true (e.g. clicking 'Complete Profile' from Home banner),
 *                                skipped steps that are not actually completed are treated as pending.
 *                                If false (default, for forward onboarding step navigation),
 *                                once a step is completed OR skipped, it is considered done for this pass.
 */
export const getNextIncompleteStep = (
  steps: any,
  skippedSteps?: any,
  actualCompletedSteps?: any,
  options?: { includeSkipped?: boolean; dismissedSteps?: string[] }
): string | null => {
  if (!steps || typeof steps !== 'object') return 'professionalType';

  const includeSkipped = options?.includeSkipped ?? false;

  const isStepPending = (stepKey: string): boolean => {
    if (options?.dismissedSteps?.includes(stepKey)) return false;
    // If genuine completion is true, the step is done
    if (actualCompletedSteps?.[stepKey] === true) return false;

    // If we are in 'Complete Profile' mode from Home:
    // Any step that has NOT been actually completed is pending!
    if (includeSkipped) {
      // If the partner has already completed initial onboarding pass (steps.locationSelection is true)
      // do not send them back to locationSelection unless it's genuinely completely unconfigured.
      if (stepKey === 'locationSelection' && steps[stepKey] === true) {
        return false;
      }
      // 'reviewProfile' is the final onboarding confirmation gate before home;
      // once a user is on home screen, profile completion should direct to specific profile steps,
      // not reviewProfile.
      if (stepKey === 'reviewProfile') {
        return false;
      }
      return true;
    }

    // Standard forward onboarding progression:
    // If the step is already marked as completed OR skipped, do NOT show it again in this pass!
    if (steps[stepKey] === true || (skippedSteps && skippedSteps[stepKey] === true)) {
      return false;
    }

    return true;
  };

  if (isStepPending('locationSelection')) return 'professionalType';
  if (isStepPending('proofOfIdentity')) return 'verification';
  if (isStepPending('certificateUploaded')) return 'certificateUpload';
  if (isStepPending('paymentDetails')) return 'paymentDetails';
  if (isStepPending('selectService')) return 'selectService';
  if (isStepPending('selectAvailableSlots')) return 'selectAvailableSlots';
  if (isStepPending('completeProfile')) return 'completeProfile';
  if (isStepPending('reviewProfile')) return 'reviewProfile';

  return null; // All complete
};


