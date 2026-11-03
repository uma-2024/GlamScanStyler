# Apple login and partner notifications

Code fixes:
- Partner Debug and Release now use the existing entitlements file (Apple sign-in and APNs).
- Customer app also declares Apple sign-in entitlement.
- Partner Firebase/Google delegate interception is enabled so RNFirebase receives native registration and delivery callbacks. Removed the background handler that completed without forwarding to JavaScript.
- iOS booking alerts use bundled PCM ring_3.wav (2.46 seconds), matching the backend APNs sound. Android retains ring_3.mp3.
- Android creates booking/general channels in Application.onCreate, before an FCM notification can arrive before JS initialization.
- Distinct bookings arriving within five seconds each alert; duplicates of the same booking remain suppressed.
- Backend logs FCM error codes without logging tokens.

Before release:
1. In Apple Developer, enable Sign in with Apple and Push Notifications for the partner App ID com.getglamified.glammefypartner. Ensure the customer App ID has Apple sign-in enabled too. Regenerate provisioning profiles or let Xcode automatic signing update them. Archive both apps and inspect signed entitlements, not just source plists.
2. Verify the partner Firebase iOS app has a valid APNs key for the correct Apple team and bundle identifier. These account settings were not accessible during this change.
3. Release the new partner app and deploy the backend source changes using the normal build pipeline. The new backend WAV sound requires the updated iOS app; older installs may use the default sound.
4. Test Apple login on a physical device using the release/TestFlight build: first sign-in, returning sign-in (Apple may omit name/email), cancellation, and reinstall.
5. Test pushes on iOS and Android with app foregrounded, backgrounded, and normally terminated; include two bookings within five seconds, duplicate delivery, token refresh, and logout/login. Confirm banners, ringtone, and opening the app.
6. On affected Android devices inspect the booking channel's sound/importance and app notification permission; existing user-disabled channels are not reset by this patch. On iOS check Sounds/Focus/silent mode. OS force-stop, disabled notifications, and device power restrictions cannot be overridden by app code.

References:
- https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.applesignin
- https://developer.apple.com/documentation/usernotifications/unnotificationsound
- https://rnfirebase.io/messaging/usage/ios-setup

Validation performed:
- Three Jest regressions pass: simultaneous different bookings, duplicate booking delivery, retry after failed display.
- Backend `tsc --noEmit` passes.
- Apple plist/project syntax validates; generated WAV verified as 16-bit PCM, 2.46 seconds.
- Partner full TypeScript check is blocked by errors in untouched account/API/test files and react-native-iap typings. No diagnostics reference the changed TypeScript files.
- Live APNs/FCM delivery and Apple release sign-in have not been tested on physical devices.
- Android `:app:compileDebugKotlin --offline` passes, including manifest merge and app Kotlin compilation.

Google login follow-up:
- iOS now obtains its client ID from the bundled GoogleService-Info.plist, avoiding environment overrides that disagree with the callback scheme.
- Removed the unconditional Google sign-out before login and guarded concurrent attempts; cancellation/errors release the guard for retry.
- Removed the web OAuth client callback scheme from Info.plist; the iOS reversed client ID remains registered.
- Checked-in iOS bundle ID, client ID, URL scheme, and local backend web audience match. This does not establish the configuration on the deployed server or in Google Cloud.
- Rebuild and test Google login on a signed iPhone build. If it still fails, capture the exact error and whether failure happens before or after selecting an account. Check that the iOS OAuth client is enabled for com.getglamified.glammefypartner, the consent screen allows the account, and the deployed backend accepts the configured web client ID. No Google Cloud account settings were changed.
