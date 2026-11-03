# Environment Variables Setup with react-native-config

## ✅ Installation Complete

The project is now configured to use `react-native-config` for environment variables.

## 📁 Files Created/Modified

1. **`.env`** - Environment variables file (not committed to git)
2. **`.env.example`** - Example environment variables file (committed to git)
3. **`src/config/api.ts`** - Updated to use `Config` from react-native-config
4. **`android/app/build.gradle`** - Added react-native-config configuration
5. **`src/types/react-native-config.d.ts`** - TypeScript type definitions

## 🔧 Configuration

### Current `.env` file:
```env
API_URL=http://localhost:3000
ENV=development
```

### How it works:

1. **For iOS Simulator**: Uses `http://localhost:3000` from `.env`
2. **For Android Emulator**: Automatically converts `localhost` to `10.0.2.2`
3. **For Production**: Update `.env` with production URL

## 📝 Usage in Code

The API configuration is centralized in `src/config/api.ts`:

```typescript
import { API_BASE_URL, API_BASE_URL_WITH_API } from '../config/api';

// For root-level routes (signup, login, verification)
const url = `${API_BASE_URL}/signup`;

// For /api routes (services)
const url = `${API_BASE_URL_WITH_API}/services`;
```

## 🔄 Updating Environment Variables

1. **Edit `.env` file** at project root:
   ```env
   API_URL=http://your-api-url.com
   ENV=production
   ```

2. **For Android**: Rebuild the app
   ```bash
   npm run android
   ```

3. **For iOS**: Run pod install and rebuild
   ```bash
   cd ios && pod install && cd ..
   npm run ios
   ```

## ⚠️ Important Notes

1. **`.env` is in `.gitignore`** - Never commit your `.env` file
2. **`.env.example` is committed** - Use this as a template
3. **Android requires rebuild** - Changes to `.env` require a full rebuild
4. **iOS requires pod install** - Run `pod install` after changing `.env`

## 🚀 Production Setup

For production builds, create different `.env` files:

- `.env.development` - Development environment
- `.env.staging` - Staging environment  
- `.env.production` - Production environment

Then use build scripts to copy the appropriate file to `.env` before building.

## 📚 Documentation

- [react-native-config GitHub](https://github.com/lugg/react-native-config)
- [Official Documentation](https://github.com/lugg/react-native-config#readme)

