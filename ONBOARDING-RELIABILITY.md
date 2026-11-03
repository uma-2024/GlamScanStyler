# Partner onboarding progress

Completed and skipped steps are excluded from automatic login/session-resume navigation. The Home Complete Profile action explicitly includes skipped steps; completed data wins over an old skipped flag. Completing or skipping a step in that manual flow advances to the next deferred step without looping back during that visit.

Progress choices are persisted per user in AsyncStorage before navigation. Failed server updates remain pending and are retried when progress is next loaded. Logout does not delete these choices; another account uses a different storage key. Server persistence is still required for another device or reinstall to see changes made offline.

Verification Skip now awaits persistence and uses the same progress resolver. Professional Type Skip is wired up. Skip-to-Home from verification/address defers remaining unfinished steps. A failed progress read lands at Home instead of restarting the wizard. Completed profiles no longer fall back to opening Complete Profile when there are no outstanding steps.

The backend progress GET only persists discovered true values, preventing a stale read from writing false over a concurrently saved step.

Validation:
- Seven onboarding regression tests pass.
- Backend TypeScript check passes.
- Partner TypeScript check reports existing issues in other files, with no diagnostics in changed onboarding/App files.
- Full App render test is blocked by the existing missing RNGestureHandlerModule mock.

Release requires the updated partner app and backend. On a device, test completion, skipping individual steps, Skip-to-Home, logout/login, force-close/reopen, offline skip then reconnect, and Home Complete Profile with multiple deferred steps. Already-lost skips from old app versions cannot be reconstructed if neither the server nor device recorded them.
