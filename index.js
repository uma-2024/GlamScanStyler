/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry, Text, TextInput } from 'react-native';

// Disable global font scaling to prevent UI breakage with large OS fonts
if (Text.defaultProps == null) Text.defaultProps = {};
Text.defaultProps.allowFontScaling = false;

if (TextInput.defaultProps == null) TextInput.defaultProps = {};
TextInput.defaultProps.allowFontScaling = false;
import App from './App';
import { name as appName } from './app.json';
import { installAuthenticatedFetch } from './src/services/apiClient';
import { displayNotification } from './src/utils/notificationService';

installAuthenticatedFetch();

// Background FCM message handler for Android/iOS
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const messaging = require('@react-native-firebase/messaging').default;
  messaging().setBackgroundMessageHandler(async remoteMessage => {
    // The OS displays notification payloads. Handle only data-only messages
    // locally so regular pushes are not shown twice.
    if (remoteMessage.notification) return;
    const notif = remoteMessage.notification;
    const title = notif?.title || (remoteMessage.data && remoteMessage.data.title) || 'New notification';
    const body = notif?.body || (remoteMessage.data && remoteMessage.data.body) || '';
    
    await displayNotification(
      title,
      body,
      remoteMessage.data,
      remoteMessage.data?.type || 'background_notification',
    );
  });
} catch (err) {
  console.warn('Background FCM setup failed:', err?.message || err);
}

AppRegistry.registerComponent(appName, () => App);
AppRegistry.registerComponent('GlamScanStyler', () => App);
AppRegistry.registerComponent('GlammefyPartner', () => App);
