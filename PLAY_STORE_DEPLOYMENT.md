# Glammefy Partner Play Store Deployment

## Release build

The Android release build is configured to produce a signed Android App Bundle for Google Play.

```bash
cd android
./gradlew clean bundleRelease
```

The Play Store artifact is created at:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

## Signing

Release signing is read from `android/local.properties` or environment variables. `android/local.properties` is ignored by git and must stay private.

```properties
GLAMMEFY_PARTNER_UPLOAD_STORE_FILE=glammefy-partner-upload-key.jks
GLAMMEFY_PARTNER_UPLOAD_STORE_PASSWORD=replace-with-private-password
GLAMMEFY_PARTNER_UPLOAD_KEY_ALIAS=glammefy-partner-upload
GLAMMEFY_PARTNER_UPLOAD_KEY_PASSWORD=replace-with-private-password
```

To create a new upload key:

```bash
keytool -genkeypair -v -storetype JKS -keystore android/app/glammefy-partner-upload-key.jks -alias glammefy-partner-upload -keyalg RSA -keysize 2048 -validity 10000
```

Back up the keystore and passwords securely before uploading the first release. Google Play can reset an upload key, but it is slower than keeping a clean backup.

## Pre-submit checks

- Confirm `API_URL` in `.env` points to the production HTTPS API.
- Increment `versionCode` for every Play Store upload.
- Update `versionName` when the public app version changes.
- Run `npm test` and `npm run lint`.
- Upload the `.aab`, not the old root-level APK.
