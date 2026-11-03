# 🚀 Running GlamScanStyler App Locally

## Prerequisites

1. **Node.js** (>= 20) - [Download](https://nodejs.org/)
2. **Java Development Kit (JDK)** - Version 17 or higher
3. **Android Studio** - [Download](https://developer.android.com/studio)
4. **Android SDK** - Installed via Android Studio
5. **Android Emulator** or **Physical Android Device**
6. **Backend Server** - Must be running (see backend setup)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
cd /home/lenovo/Desktop/Work/Glamify/GlamScanStyler
npm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory:

```bash
# Create .env file
touch .env
```

Add your API URL to `.env`:

```env
API_URL=http://localhost:3000
ENV=development
```

**For Physical Device (not emulator):**
- Replace `localhost` with your computer's IP address
- Find your IP: `hostname -I` (Linux) or `ipconfig` (Windows)
- Example: `API_URL=http://192.168.1.2:3000`

### 3. Start Backend Server

**Important:** The backend must be running before starting the app!

```bash
# In a separate terminal
cd /home/lenovo/Desktop/Work/Glamify/backend
npm install  # If not already installed
npm run build
npm start
```

The backend should be running on `http://localhost:3000`

### 4. Start Metro Bundler

```bash
cd /home/lenovo/Desktop/Work/Glamify/GlamScanStyler
npm start
```

Or with cache reset:
```bash
npm start -- --reset-cache
```

Keep this terminal open - Metro bundler must be running.

### 5. Run on Android

#### Option A: Using Command Line

**For Emulator:**
```bash
# Make sure Android emulator is running first
npm run android
```

**For Physical Device:**
1. Enable USB Debugging on your Android device
2. Connect device via USB
3. Verify device is detected: `adb devices`
4. Run: `npm run android`

#### Option B: Using Android Studio

1. Open Android Studio
2. Open project: `GlamScanStyler/android`
3. Wait for Gradle sync to complete
4. Select your device/emulator from the dropdown
5. Click "Run" button (green play icon)

### 6. Build Release APK (Optional)

If you want to build a release APK:

```bash
cd android
./gradlew assembleRelease
```

The APK will be at:
`android/app/build/outputs/apk/release/app-release.apk`

## 🔔 Notification Setup

After installing the app:

1. **Grant Notification Permission:**
   - When the app first launches, it will request notification permission
   - Allow notifications for the app to work properly

2. **Test Notifications:**
   - Create a booking with a start time 15+ minutes in the future
   - You should receive a notification 10 minutes before the service starts

## 🐛 Troubleshooting

### Metro Bundler Issues

```bash
# Clear Metro cache
npm start -- --reset-cache

# Clear watchman
watchman watch-del-all

# Clear node modules and reinstall
rm -rf node_modules
npm install
```

### Android Build Issues

```bash
# Clean build
cd android
./gradlew clean

# Rebuild
cd ..
npm run android
```

### Connection Issues (Physical Device)

1. **Check IP Address:**
   ```bash
   hostname -I  # Linux
   ipconfig      # Windows
   ```

2. **Update .env file** with correct IP address

3. **Restart Metro bundler** after changing .env

4. **Check Firewall:** Make sure port 3000 is not blocked

5. **Verify Backend is Accessible:**
   - Open browser on phone: `http://YOUR_IP:3000/api/health`
   - Should return a response

### Notification Not Working

1. **Check Permissions:**
   - Go to Android Settings → Apps → GlamScanStyler → Notifications
   - Ensure notifications are enabled

2. **Check Notification Channel:**
   - The app creates a channel "Upcoming Service Reminders"
   - Verify it exists in Android Settings

3. **Check Logs:**
   ```bash
   adb logcat | grep -i "notifee\|notification"
   ```

### App Crashes on Launch

1. **Check Logs:**
   ```bash
   adb logcat | grep -i "error\|exception"
   ```

2. **Verify Dependencies:**
   ```bash
   npm install
   cd android && ./gradlew clean && cd ..
   ```

3. **Rebuild:**
   ```bash
   npm run android
   ```

## 📱 Development Tips

### Hot Reload
- Shake device or press `Ctrl+M` (Windows/Linux) or `Cmd+M` (Mac) to open Dev Menu
- Select "Reload" to refresh the app

### Debugging
- Use React Native Debugger or Chrome DevTools
- Enable remote debugging in Dev Menu

### View Logs
```bash
# React Native logs
npx react-native log-android

# System logs
adb logcat
```

## ✅ Quick Start Checklist

- [ ] Backend server is running on port 3000
- [ ] `.env` file exists with correct API_URL
- [ ] Dependencies installed (`npm install`)
- [ ] Metro bundler is running (`npm start`)
- [ ] Android device/emulator is connected
- [ ] App builds and runs successfully
- [ ] Notification permission is granted

## 🎯 Common Commands

```bash
# Start Metro
npm start

# Run on Android
npm run android

# Clean and rebuild
cd android && ./gradlew clean && cd .. && npm run android

# Build release APK
cd android && ./gradlew assembleRelease

# Check connected devices
adb devices

# View logs
adb logcat | grep ReactNativeJS
```

## 📝 Notes

- **First Run:** The first build may take 5-10 minutes
- **Subsequent Runs:** Usually much faster (1-2 minutes)
- **Notification Testing:** Use a booking time 15+ minutes in the future to test
- **Network:** Ensure phone and computer are on the same WiFi network (for physical device)

