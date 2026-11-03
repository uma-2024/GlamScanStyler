declare module 'react-native-config' {
  export interface NativeConfig {
    API_URL?: string;
    GOOGLE_WEB_CLIENT_ID?: string;
    GOOGLE_IOS_CLIENT_ID?: string;
    GOOGLE_IOS_REVERSED_CLIENT_ID?: string;
    ENV?: string;
    [name: string]: string | undefined;
  }

  const Config: NativeConfig;
  export default Config;
}
