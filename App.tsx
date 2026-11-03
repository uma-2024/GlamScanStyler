import { QueuedModal as Modal, PopupProvider } from './src/popup/PopupProvider';
import { QueuedAlert as Alert, dismissActivePopup } from './src/popup/QueuedAlert';
import React, { useCallback, useState, useEffect, useRef } from 'react';
import { StatusBar, useColorScheme, View, Text, ActivityIndicator, BackHandler, Animated, Image, Dimensions, ScrollView, TouchableOpacity, DeviceEventEmitter } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  SafeAreaProvider,
} from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { API_BASE_URL_WITH_API } from './src/config/api';
import { getLoginSession, storeLoginSession, clearLoginSession } from './src/utils/authStorage';
import LoginSignupScreen from './src/pages/LoginSignupScreen';
import LoginScreen from './src/pages/LoginScreen';
import VerificationScreen from './src/pages/VerificationScreen';
import ProofOfIdentityScreen from './src/pages/ProofOfIdentityScreen';
import ProofOfAddressScreen from './src/pages/ProofOfAddressScreen';
import VerifyAccountScreen from './src/pages/VerifyAccountScreen';
import CertificateUploadScreen from './src/pages/CertificateUploadScreen';
import PaymentDetailsScreen, { PaymentDetailsData } from './src/pages/PaymentDetailsScreen';
import SelectServiceScreen from './src/pages/SelectServiceScreen';
import SelectAvailableSlotsScreen, { SelectAvailableSlotsDraft } from './src/pages/SelectAvailableSlotsScreen';
import CompleteProfileScreen from './src/pages/CompleteProfileScreen';
import ProfessionalTypeScreen, { ProfessionalType } from './src/pages/ProfessionalTypeScreen';
import LocationSelectionScreen from './src/pages/LocationSelectionScreen';
import ReviewProfileScreen from './src/pages/ReviewProfileScreen';
import PendingStatusScreen from './src/pages/PendingStatusScreen';
import HomeScreen from './src/pages/HomeScreen';
import BookingsScreen, { BookingTab } from './src/pages/BookingsScreen';
import { useLiveStylistBooking } from './src/hooks/useLiveStylistBooking';
import BookingDetailsScreen from './src/pages/BookingDetailsScreen';
import CompletedBookingDetailsScreen from './src/pages/CompletedBookingDetailsScreen';
import CancelledBookingDetailsScreen from './src/pages/CancelledBookingDetailsScreen';
import OTPVerificationScreen from './src/pages/OTPVerificationScreen';
import AccountScreen from './src/pages/AccountScreen';
import AccountSettingsScreen from './src/pages/AccountSettingsScreen';
import NotificationsScreen from './src/pages/NotificationsScreen';
import BookingChatScreen from './src/pages/BookingChatScreen';
import HelpScreen from './src/pages/HelpScreen';
import ContactUsScreen from './src/pages/ContactUsScreen';
import TermsAndPrivacyScreen from './src/pages/TermsAndPrivacyScreen';
import AboutUsScreen from './src/pages/AboutUsScreen';
import ReferAndEarnScreen from './src/pages/ReferAndEarnScreen';
import FAQsScreen from './src/pages/FAQsScreen';
import EditProfileScreen from './src/pages/EditProfileScreen';
import MyAccountScreen from './src/pages/MyAccountScreen';
import HistoryScreen from './src/pages/HistoryScreen';
import MyServiceScreen from './src/pages/MyServiceScreen';
import SpecialServiceScreen from './src/pages/SpecialServiceScreen';
import MySlotsScreen from './src/pages/MySlotsScreen';
import WalletScreen from './src/pages/WalletScreen';
import SubscriptionScreen from './src/pages/SubscriptionScreen';
import AdsScreen from './src/pages/AdsScreen';
import AnalyticsScreen from './src/pages/AnalyticsScreen';
import PaymentsScreen from './src/pages/PaymentsScreen';
import BottomNavigation from './src/components/BottomNavigation';
import CustomModal from './src/components/CustomModal';
import GlobalPendingBookingModal from './src/components/GlobalPendingBookingModal';
import { initializeFCM } from './src/services/fcmService';
import { initializeMetaTracking, logMetaEvent } from './src/services/metaTracking';
import { getAnalyticsConsent, setAnalyticsConsent } from './src/utils/authStorage';
import { useModal } from './src/hooks/useModal';
import { signInStylistWithGoogle, signOutGoogleStylist } from './src/services/googleAuth';
import { signInStylistWithApple } from './src/services/appleAuth';
import { unregisterFCMToken } from './src/services/fcmService';
import AppErrorBoundary from './src/components/AppErrorBoundary';
import { PARTNER_PRIVACY_TEXT } from './src/constants/legalContent';
import { getNextIncompleteStep } from './src/utils/onboardingNavigation';
import {getOnboardingProgress, onboardingStepKeys} from './src/utils/onboardingProgress';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 1,
      refetchOnMount: false,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    },
  },
});

import { installAuthenticatedFetch } from './src/services/apiClient';
installAuthenticatedFetch();


import { setOnStepUpdatedCallback, updateOnboardingStep } from './src/utils/onboardingSteps';

setOnStepUpdatedCallback((userId: string) => {
  queryClient.invalidateQueries({ queryKey: ['onboardingSteps', userId] });
  queryClient.invalidateQueries({ queryKey: ['userProfile', userId] });
});

const invalidateStylistAccountQueries = (userId?: string) => {
  if (!userId) return;

  void queryClient.invalidateQueries({
    queryKey: ['stylist-account'],
    refetchType: 'all',
  });
};

type AppScreen =
  | 'loginSignup'
  | 'login'
  | 'verification'
  | 'proofOfIdentity'
  | 'proofOfAddress'
  | 'verifyAccount'
  | 'certificateUpload'
  | 'paymentDetails'
  | 'selectService'
  | 'selectAvailableSlots'
  | 'completeProfile'
  | 'professionalType'
  | 'locationSelection'
  | 'reviewProfile'
  | 'pendingStatus'
  | 'verifiedStatus'
  | 'bookings'
  | 'bookingDetails'
  | 'completedBookingDetails'
  | 'cancelledBookingDetails'
  | 'otpVerification'
  | 'help'
  | 'contactUs'
  | 'termsPrivacy'
  | 'aboutUs'
  | 'referAndEarn'
  | 'faqs'
  | 'account'
  | 'editProfile'
  | 'myAccount'
  | 'history'
  | 'payments'
  | 'myService'
  | 'specialService'
  | 'mySlots'
  | 'wallet'
  | 'subscription'
  | 'subscription'
  | 'ads'
  | 'analytics'
  | 'accountSettings'
  | 'notifications';

const onboardingScreens: AppScreen[] = [
  'professionalType',
  'locationSelection',
  'verification',
  'certificateUpload',
  'paymentDetails',
  'selectService',
  'selectAvailableSlots',
  'completeProfile',
  'reviewProfile',
  'pendingStatus',
  'verifiedStatus',
];

const resolveOnboardingScreen = (_data?: any): AppScreen => {
  // Stylists always land on HomeScreen (verifiedStatus)
  return 'verifiedStatus';
};

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('loginSignup');
  const [faqPreviousScreen, setFaqPreviousScreen] = useState<'help' | 'referAndEarn'>('help');
  const [contactPreviousScreen, setContactPreviousScreen] = useState<'help' | 'faqs'>('help');
  const [selectedDocType, setSelectedDocType] = useState<string>('');
  const [previousScreen, setPreviousScreen] = useState<'proofOfIdentity' | 'proofOfAddress' | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>(''); // Store logged-in user ID
  useEffect(() => initializeFCM(currentUserId), [currentUserId]);
  useEffect(() => {
    const setupMetaTracking = async () => {
      try {
        const storedConsent = await getAnalyticsConsent();
        // If consent is true (or not explicitly false/opted-out)
        const hasConsent = storedConsent !== false;
        await initializeMetaTracking(hasConsent);
      } catch (err) {
        console.warn('Meta tracking initialization failed:', err);
      }
    };
    setupMetaTracking();
  }, []);
  const [directChatBooking, setDirectChatBooking] = useState<{
    bookingId: string;
    counterpartName?: string;
    serviceName?: string;
  } | null>(null);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('open_chat_booking', (data: {
      bookingId: string;
      counterpartName?: string;
      serviceName?: string;
    }) => {
      if (data?.bookingId) {
        setDirectChatBooking({
          bookingId: String(data.bookingId),
          counterpartName: data.counterpartName ? String(data.counterpartName) : undefined,
          serviceName: data.serviceName ? String(data.serviceName) : undefined,
        });
      }
    });
    return () => sub.remove();
  }, []);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true); // Loading state for auth check
  const profileCompletionMode = useRef(false);
  const dismissedProfileSteps = useRef<string[]>([]);
  const [hasSkippedAuth, setHasSkippedAuth] = useState(false); // Track if user skipped auth
  const [locationSelectionSource, setLocationSelectionSource] = useState<'onboarding' | 'account'>('onboarding');
  const [documentCategory, setDocumentCategory] = useState<'identity' | 'address'>('identity');
  const [activeTab, setActiveTab] = useState<'home' | 'bookings' | 'alerts' | 'account'>('home');
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [otpActionType, setOtpActionType] = useState<'start' | 'end'>('start');
  const [bookingsRefreshKey, setBookingsRefreshKey] = useState(0);
  const [bookingTab, setBookingTab] = useState<BookingTab>('upcoming');
  const [completedRatingBooking, setCompletedRatingBooking] = useState<any>(null);
  const lastBookingTransition = useRef('');
  const [isBookingsChatVisible, setIsBookingsChatVisible] = useState(false);
  const [shouldReopenProfileDrawer, setShouldReopenProfileDrawer] = useState(false);
  const [profileDrawerScrollY, setProfileDrawerScrollY] = useState(0);
  const navigationHistory = useRef<string[]>([]); // Track navigation history for back button
  const [historyPreviousScreen, setHistoryPreviousScreen] = useState<'account' | 'myAccount' | null>(null); // Track where history was navigated from
  const [showWelcomeModalOnLogin, setShowWelcomeModalOnLogin] = useState(false); // Show welcome modal only on home screen
  const [displayWelcomeModal, setDisplayWelcomeModal] = useState(false); // Track actual modal display
  const [welcomePresented, setWelcomePresented] = useState(false);
  const [homePopupTriggerKey, setHomePopupTriggerKey] = useState(0);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [privacyPolicyVisible, setPrivacyPolicyVisible] = useState(false);
  const [isProfileRedirecting, setIsProfileRedirecting] = useState(false);
  const [welcomeScaleAnim] = useState(new Animated.Value(0.3)); // Modal animation
  const wasWelcomeModalVisibleRef = useRef(false);
  const modal = useModal();
  
  const returnToBookings = useCallback((booking: any, status: 'ongoing' | 'completed') => {
    const transition = `${booking?.bookingId}:${status}`;
    if (lastBookingTransition.current === transition) return;
    lastBookingTransition.current = transition;
    setBookingTab(status === 'ongoing' ? 'ongoing' : 'complete');
    setCompletedRatingBooking(status === 'completed' && !booking?.stylistRating ? { ...booking, status } : null);
    setSelectedBooking(null);
    setIsBookingsChatVisible(false);
    setActiveTab('bookings');
    setBookingsRefreshKey(version => version + 1);
    setCurrentScreen('bookings');
    invalidateStylistAccountQueries(currentUserId);
  }, [currentUserId]);

  useLiveStylistBooking({
    stylistId: currentUserId,
    selected: currentScreen === 'bookingDetails' || currentScreen === 'otpVerification' ? selectedBooking : null,
    onBooking: booking => {
      if (booking.status === 'completed' || (currentScreen === 'otpVerification' && otpActionType === 'start' && booking.status === 'ongoing')) {
        returnToBookings(booking, booking.status);
      } else if (booking.status === 'cancelled') {
        setSelectedBooking(null);
        setCurrentScreen('bookings');
      } else {
        setSelectedBooking((current: any) => current?.bookingId === booking.bookingId ? { ...current, ...booking } : current);
      }
    },
  });

  useEffect(() => {
    if (currentScreen !== 'bookings') setCompletedRatingBooking(null);
  }, [currentScreen]);

  // Welcome modal carousel state
  const baseImages = [
    require('./src/assets/Beauty Care.png'),
    require('./src/assets/image.png'),
    require('./src/assets/image2.png'),
  ];
  const welcomeImages = [...baseImages, baseImages[0]];
  const { width } = Dimensions.get('window');
  const SLIDE_WIDTH = width * 0.15;
  const TOTAL_WIDTH = SLIDE_WIDTH * welcomeImages.length;
  
  const [carouselIndex, setCarouselIndex] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  
  // Welcome modal animation & auto-dismiss fallback
  useEffect(() => {
    if (displayWelcomeModal && welcomePresented) {
      Animated.spring(welcomeScaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 1,
        bounciness: 12,
      }).start();

      const autoDismissTimer = setTimeout(() => {
        welcomeScaleAnim.setValue(0);
        setDisplayWelcomeModal(false);
      }, 3200);

      return () => clearTimeout(autoDismissTimer);
    }
    if (!displayWelcomeModal) setWelcomePresented(false);
  }, [displayWelcomeModal, welcomePresented, welcomeScaleAnim]);

  // Carousel auto-rotation effect
  useEffect(() => {
    if (!displayWelcomeModal || !welcomePresented) return;

    const run = () => {
      const next = carouselIndex + 1;

      Animated.timing(slideAnim, {
        toValue: -SLIDE_WIDTH * next,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        if (next === welcomeImages.length - 1) {
          // reached duplicate slide → jump back to real first
          slideAnim.setValue(0);
          setCarouselIndex(0);
        } else {
          setCarouselIndex(next);
        }
      });
    };

    const id = setInterval(run, 1200);

    return () => clearInterval(id);
  }, [displayWelcomeModal, welcomePresented, carouselIndex]);

  useEffect(() => {
    if (
      wasWelcomeModalVisibleRef.current &&
      !displayWelcomeModal &&
      showWelcomeModalOnLogin &&
      currentScreen === 'verifiedStatus'
    ) {
      setHomePopupTriggerKey(currentKey => currentKey + 1);
      setShowWelcomeModalOnLogin(false);
    }

    wasWelcomeModalVisibleRef.current = displayWelcomeModal;
  }, [currentScreen, displayWelcomeModal, showWelcomeModalOnLogin]);
  
  // Profile data state
  const [profileData, setProfileData] = useState<{
    name: string;
    age: string;
    gender: 'Male' | 'Female' | 'Other';
    about: string;
    phoneNumber: string;
    instagram: string;
    yearsOfExperience: string;
    profileImage: string | null;
    profileImageUrl?: string | null;
    location: string;
    salonWorkLocation?: string;
    professionalType: ProfessionalType;
  }>({
    name: '',
    age: '',
    gender: 'Male',
    about: '',
    phoneNumber: '',
    instagram: '',
    yearsOfExperience: '',
    profileImage: null,
    profileImageUrl: null,
    location: '',
    salonWorkLocation: '',
    professionalType: 'freelancer',
  });
  const [paymentDetailsDraft, setPaymentDetailsDraft] = useState<PaymentDetailsData>({
    bankAccountNumber: '',
    bankAccountHolderName: '',
    ifscCode: '',
    bankName: '',
    branchName: '',
    upiId: '',
  });
  const [paymentDetailsSource, setPaymentDetailsSource] = useState<'onboarding' | 'account' | 'home'>('onboarding');
  const [selectedMainCategoryIds, setSelectedMainCategoryIds] = useState<string[]>([]);
  const [availableSlotsDraft, setAvailableSlotsDraft] = useState<SelectAvailableSlotsDraft>({
    selectedDayRange: '',
    selectedTimeSlotKeys: [],
  });

  const getProfilePhoneNumber = (value?: string | null) => {
    const digits = (value || '').replace(/\D/g, '');
    return digits.length > 10 ? digits.slice(-10) : digits;
  };

  const handleCompleteProfileDraftChange = useCallback((data: {
    name: string;
    age: string;
    gender: 'Male' | 'Female' | 'Other';
    about: string;
    phoneNumber: string;
    instagram: string;
    yearsOfExperience: string;
    profileImage: string | null;
    profileImageUrl: string | null;
  }) => {
    setProfileData(prev => ({
      ...prev,
      ...data,
    }));
  }, []);

  useEffect(() => {
    if (
      !isCheckingAuth &&
      !currentUserId &&
      !hasSkippedAuth &&
      currentScreen !== 'loginSignup' &&
      currentScreen !== 'login'
    ) {
      setCurrentScreen('loginSignup');
    }
  }, [currentScreen, currentUserId, isCheckingAuth, hasSkippedAuth]);

  const handleContinueWithEmail = () => {
    setCurrentScreen('login');
  };

  const handleContinueWithGoogle = async () => {
    if (isGoogleSigningIn) {
      return;
    }

    try {
      setIsGoogleSigningIn(true);
      const googleLogin = await signInStylistWithGoogle();
      if (!googleLogin) {
        return;
      }

      console.log('✅ Google login successful:', {
        userId: googleLogin.userId,
        email: googleLogin.email,
      });

      if (googleLogin.token) {
        await storeLoginSession(googleLogin.userId, googleLogin.token);
      }

      await handleLoginSubmit(googleLogin.email, googleLogin.userId);
    } catch (error) {
      console.error('❌ Google login failed:', error);
      Alert.alert(
        'Google Login Failed',
        error instanceof Error ? error.message : 'Unable to login with Google. Please try again.',
      );
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const handleContinueWithApple = async () => {
    try {
      console.log('🍎 Starting Apple Sign-In...');
      const appleLogin = await signInStylistWithApple();
      if (!appleLogin) {
        return;
      }

      console.log('✅ Apple login successful:', {
        userId: appleLogin.userId,
        email: appleLogin.email,
      });

      if (appleLogin.token) {
        await storeLoginSession(appleLogin.userId, appleLogin.token);
      }

      await handleLoginSubmit(appleLogin.email, appleLogin.userId);
    } catch (error: any) {
      if (error?.code === '1001' || error?.message?.includes?.('canceled') || error?.message?.includes?.('cancelled')) {
        console.log('Apple sign-in cancelled by user');
        return;
      }
      console.error('❌ Apple login failed:', error);
      Alert.alert(
        'Apple Login Failed',
        error instanceof Error ? error.message : 'Unable to login with Apple. Please try again.',
      );
    }
  };

  const hydrateUserProfile = useCallback(async (userId: string) => {
    if (!userId) return;
    try {
      console.log('🔄 Hydrating profile data for user:', userId);
      const response = await fetch(`${API_BASE_URL_WITH_API}/profile/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        console.warn('⚠️ Could not fetch user profile to hydrate:', response.status);
        return;
      }

      const result = await response.json();
      if (result.success && result.data) {
        const data = result.data;
        console.log('✅ Hydrated profile data received for:', data.name || data.phoneNumber);

        setProfileData(prev => ({
          ...prev,
          name: data.name || prev.name,
          age: data.age !== undefined && data.age !== null ? String(data.age) : prev.age,
          gender: data.gender === 'Female' || data.gender === 'Other' ? data.gender : (data.gender === 'Male' ? 'Male' : prev.gender),
          about: data.about || prev.about,
          phoneNumber: data.phoneNumber ? getProfilePhoneNumber(data.phoneNumber) : prev.phoneNumber,
          instagram: data.instagram ? (typeof data.instagram === 'object' ? data.instagram.username : String(data.instagram)) : prev.instagram,
          yearsOfExperience: data.yearsOfExperience !== undefined && data.yearsOfExperience !== null ? String(data.yearsOfExperience) : prev.yearsOfExperience,
          profileImage: data.profileImage || prev.profileImage,
          location: typeof data.location === 'object' ? (data.location?.address || prev.location) : (data.location || prev.location),
          salonWorkLocation: data.salonWorkLocation || prev.salonWorkLocation,
          professionalType: (data.professionalType === 'working_professional' ? 'working_professional' : 'freelancer'),
        }));

        if (Array.isArray(data.mainCategoryIds) && data.mainCategoryIds.length > 0) {
          setSelectedMainCategoryIds(data.mainCategoryIds);
        }

        if (data.paymentDetails) {
          setPaymentDetailsDraft(prev => ({
            ...prev,
            bankAccountNumber: data.paymentDetails.bankAccountNumber || prev.bankAccountNumber,
            bankAccountHolderName: data.paymentDetails.bankAccountHolderName || prev.bankAccountHolderName,
            ifscCode: data.paymentDetails.ifscCode || prev.ifscCode,
            bankName: data.paymentDetails.bankName || prev.bankName,
            branchName: data.paymentDetails.branchName || prev.branchName,
            upiId: data.paymentDetails.upiId || prev.upiId,
          }));
        }
      }
    } catch (err) {
      console.error('❌ Error hydrating user profile:', err);
    }
  }, []);

  const handleLogin = () => {
    setCurrentScreen('login');
  };

  // Check for existing login session on app start
  useEffect(() => {
    const checkAuthSession = async () => {
      try {
        console.log('🔍 Checking for existing login session...');
        const session = await getLoginSession();
        
        if (session) {
          console.log('✅ Valid session found, auto-logging in user:', session.userId);
          setCurrentUserId(session.userId);
          const savedPhoneNumber = getProfilePhoneNumber(session.loginId);
          if (savedPhoneNumber) {
            setProfileData(prev => ({
              ...prev,
              phoneNumber: prev.phoneNumber || savedPhoneNumber,
            }));
          }
          
          // Hydrate stylist profile data from DB into local draft states so screens aren't blank
          hydrateUserProfile(session.userId);

          try {
            const {steps, skippedSteps, actualCompletedSteps} = await getOnboardingProgress(session.userId);
            setCurrentScreen((getNextIncompleteStep(steps, skippedSteps, actualCompletedSteps) || 'verifiedStatus') as AppScreen);
          } catch {
            // A failed read must never restart onboarding.
            setCurrentScreen('verifiedStatus');
          }
        } else {
          console.log('📭 No valid session found, showing login screen');
          setCurrentScreen('loginSignup');
        }
      } catch (error) {
        console.error('❌ Error checking auth session:', error);
        setCurrentScreen('loginSignup');
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuthSession();
  }, []);

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (dismissActivePopup()) return true;
      return handleBackPress();
    });

    return () => backHandler.remove();
  }, [currentScreen, activeTab, otpActionType, previousScreen, locationSelectionSource]);

  // Update navigation history when screen changes
  useEffect(() => {
    if (currentScreen && !isCheckingAuth) {
      if (currentScreen === 'verifiedStatus' && currentUserId) {
        queryClient.invalidateQueries({ queryKey: ['onboardingSteps', currentUserId] });
        queryClient.invalidateQueries({ queryKey: ['userProfile', currentUserId] });
      }
      // Don't add duplicate consecutive screens
      const lastScreen = navigationHistory.current[navigationHistory.current.length - 1];
      if (lastScreen !== currentScreen) {
        navigationHistory.current.push(currentScreen);
        logMetaEvent('ScreenView', { screen_name: currentScreen });
        // Keep only last 20 screens to prevent memory issues
        if (navigationHistory.current.length > 20) {
          navigationHistory.current.shift();
        }
      }
    }
  }, [currentScreen, isCheckingAuth, currentUserId]);

  // Helper function for sidebar-accessible screens back button
  const createSidebarScreenBackHandler = (fallbackScreen: string = 'account') => {
    return () => {
      if (navigationHistory.current.length > 1) {
        navigationHistory.current.pop(); // Remove current screen
        const prevScreen = navigationHistory.current[navigationHistory.current.length - 1];
        if (prevScreen) {
          setCurrentScreen(prevScreen as any);
        } else {
          setCurrentScreen(fallbackScreen as any);
        }
      } else {
        setCurrentScreen(fallbackScreen as any);
      }
    };
  };

  const restorePreviousScreenFromHistory = (fallbackScreen: 'verifiedStatus' | 'bookings' | 'help' | 'account' = 'verifiedStatus') => {
    if (navigationHistory.current.length > 1) {
      navigationHistory.current.pop(); // Remove current screen
      const previousScreenFromHistory = navigationHistory.current[navigationHistory.current.length - 1];
      if (previousScreenFromHistory) {
        if (previousScreenFromHistory === 'verifiedStatus') {
          setActiveTab('home');
        } else if (previousScreenFromHistory === 'bookings') {
          setActiveTab('bookings');
        } else if (previousScreenFromHistory === 'help') {
          setActiveTab('home');
        } else if (previousScreenFromHistory === 'account') {
          setActiveTab('account');
        }
        setCurrentScreen(previousScreenFromHistory as any);
        return true;
      }
    }

    if (fallbackScreen === 'verifiedStatus') {
      setActiveTab('home');
    } else if (fallbackScreen === 'bookings') {
      setActiveTab('bookings');
    } else if (fallbackScreen === 'help') {
      setActiveTab('home');
    } else if (fallbackScreen === 'account') {
      setActiveTab('account');
    }
    setCurrentScreen(fallbackScreen);
    return true;
  };

  const handleBackPress = (): boolean => {
    // If checking auth, don't handle back button
    if (isCheckingAuth) {
      return true;
    }

    if (directChatBooking) {
      setDirectChatBooking(null);
      return true;
    }

    // Handle back navigation based on current screen
    switch (currentScreen) {
      case 'loginSignup':
      case 'login':
        // On login screens, exit app
        modal.showConfirm(
          'Exit App',
          'Are you sure you want to exit the app?',
          () => BackHandler.exitApp(),
          undefined,
          'Exit',
          'Stay',
          true
        );
        return true;

      case 'verifiedStatus':
        // Show exit confirmation only on home screen
        modal.showConfirm(
          'Exit App',
          'Are you sure you want to exit the app?',
          () => BackHandler.exitApp(),
          undefined,
          'Exit',
          'Stay',
          true
        );
        return true;

      case 'bookings':
      case 'help':
      case 'account':
        // For other main tabs, return to the previously opened screen
        return restorePreviousScreenFromHistory('verifiedStatus');

      case 'otpVerification':
        // Go back based on action type
        if (otpActionType === 'start') {
          setCurrentScreen('bookings');
        } else {
          setCurrentScreen('bookingDetails');
        }
        return true;

      case 'bookingDetails':
        setCurrentScreen('bookings');
        return true;

      case 'completedBookingDetails':
      case 'cancelledBookingDetails':
        // Check if came from bookings or history
        const prevScreen = navigationHistory.current[navigationHistory.current.length - 2];
        if (prevScreen === 'history') {
          setCurrentScreen('history');
        } else {
          setCurrentScreen('bookings');
        }
        return true;

      case 'editProfile':
        setCurrentScreen('account');
        return true;

      case 'myAccount':
        setCurrentScreen('account');
        return true;

      case 'history':
      case 'myService':
      case 'specialService':
      case 'mySlots':
      case 'wallet':
      case 'subscription':
      case 'ads':
      case 'notifications':
        // For sidebar-accessed screens, use navigation history
        if (navigationHistory.current.length > 1) {
          navigationHistory.current.pop(); // Remove current screen
          const previousScreenFromHistory = navigationHistory.current[navigationHistory.current.length - 1];
          if (previousScreenFromHistory) {
            setCurrentScreen(previousScreenFromHistory as any);
            return true;
          }
        }
        // Fallback to account if no history
        setCurrentScreen('account');
        return true;

      case 'verification':
      case 'proofOfIdentity':
      case 'proofOfAddress':
      case 'verifyAccount':
      case 'certificateUpload':
      case 'paymentDetails':
      case 'selectService':
      case 'selectAvailableSlots':
      case 'completeProfile':
      case 'locationSelection':
      case 'reviewProfile':
        // Use navigation history for all onboarding screens
        if (navigationHistory.current.length > 1) {
          navigationHistory.current.pop();
          const prevScreen = navigationHistory.current[navigationHistory.current.length - 1];
          setCurrentScreen(prevScreen as AppScreen);
        } else {
          setCurrentScreen('verifiedStatus');
        }
        return true;

      case 'pendingStatus':
        modal.showConfirm(
          'Exit App',
          'Are you sure you want to exit the app?',
          () => BackHandler.exitApp(),
          undefined,
          'Exit',
          'Stay',
          true
        );
        return true;

      default:
        // For other screens, try to go back in history
        if (navigationHistory.current.length > 1) {
          navigationHistory.current.pop(); // Remove current screen
          const previousScreenFromHistory = navigationHistory.current[navigationHistory.current.length - 1];
          if (previousScreenFromHistory) {
            setCurrentScreen(previousScreenFromHistory as any);
            return true;
          }
        }
        // If no history, exit app
        modal.showConfirm(
          'Exit App',
          'Are you sure you want to exit the app?',
          () => BackHandler.exitApp(),
          undefined,
          'Exit',
          'Stay',
          true
        );
        return true;
    }
  };

  const handleLoginSubmit = async (phoneNumber: string, userId?: string) => {
    profileCompletionMode.current = false;
    dismissedProfileSteps.current = [];
    console.log('Login with phone number:', phoneNumber);
    // Store user ID after login
    if (userId) {
      console.log('💾 Storing userId:', userId);
      setCurrentUserId(userId);
      // Persist user consent upon agreeing to terms/logging in
      try {
        await setAnalyticsConsent(true);
        await initializeMetaTracking(true);
        logMetaEvent('CompletedRegistration', { method: 'partner_login' });
      } catch (trackErr) {
        console.warn('⚠️ Non-blocking tracking error on login:', trackErr);
      }

      const loginPhoneNumber = getProfilePhoneNumber(phoneNumber);
      if (loginPhoneNumber) {
        setProfileData(prev => ({
          ...prev,
          phoneNumber: loginPhoneNumber,
        }));
      }
      
      // Hydrate stylist profile data from DB into local draft states so screens aren't blank
      hydrateUserProfile(userId);
      
      // Check onboarding steps: if any step is incomplete, route to that onboarding step.
      // If all steps are complete, proceed to HomeScreen (verifiedStatus) and display welcome modal.
      await navigateToNextIncompleteStep(userId);
    } else {
      console.warn('⚠️ No userId received from login response, going to verifiedStatus');
      try {
        await setAnalyticsConsent(true);
        await initializeMetaTracking(true);
        logMetaEvent('CompletedRegistration', { method: 'partner_login' });
      } catch (trackErr) {
        console.warn('⚠️ Non-blocking tracking error on login fallback:', trackErr);
      }
      setShowWelcomeModalOnLogin(true);
      setDisplayWelcomeModal(true);
      setCurrentScreen('verifiedStatus');
    }
  };

  const handleForgotPassword = () => {
    console.log('Forgot password');
    // Navigate to forgot password screen
  };

  const handleProofOfAddress = () => {
    setCurrentScreen('proofOfAddress');
  };

  const handleBackFromAddress = () => {
    setCurrentScreen('verification');
  };

  const handleSelectAddressDocType = (docType: string) => {
    setSelectedDocType(docType);
    setPreviousScreen('proofOfAddress');
    setCurrentScreen('verifyAccount');
  };

  const handleBackFromVerifyAccount = () => {
    // Go back to the previous screen (either proofOfIdentity or proofOfAddress)
    if (previousScreen) {
      setCurrentScreen(previousScreen);
    } else {
      // Default fallback
      setCurrentScreen('proofOfIdentity');
    }
  };

  const navigateToNextIncompleteStep = async (userId: string) => {
    try {
      const {steps, skippedSteps, actualCompletedSteps} = await getOnboardingProgress(userId);
      const screenStep: Record<string, string> = {professionalType: 'locationSelection', locationSelection: 'locationSelection', verification: 'proofOfIdentity', verifyAccount: 'proofOfIdentity', certificateUpload: 'certificateUploaded'};
      if (profileCompletionMode.current) {
        dismissedProfileSteps.current.push(screenStep[currentScreen] || currentScreen);
      }
      const nextScreen = getNextIncompleteStep(steps, skippedSteps, actualCompletedSteps, {
        includeSkipped: profileCompletionMode.current,
        dismissedSteps: dismissedProfileSteps.current,
      });
      queryClient.invalidateQueries({ queryKey: ['onboardingSteps', userId] });
      queryClient.invalidateQueries({ queryKey: ['userProfile', userId] });
      if (nextScreen) {
        setCurrentScreen(nextScreen as AppScreen);
      } else {
        setShowWelcomeModalOnLogin(true);
        setDisplayWelcomeModal(true);
        setCurrentScreen('verifiedStatus');
      }
    } catch (e) {
      setShowWelcomeModalOnLogin(true);
      setDisplayWelcomeModal(true);
      setCurrentScreen('verifiedStatus');
    }
  };

  const handleVerifyAccountContinue = async () => {
    if (currentUserId) {
      await updateOnboardingStep(currentUserId, 'proofOfIdentity', true);
      await navigateToNextIncompleteStep(currentUserId);
    } else {
      setCurrentScreen('certificateUpload');
    }
  };

  const handleCertificateSkip = async () => {
    if (currentUserId) {
      await updateOnboardingStep(currentUserId, 'certificateUploaded', true, true);
      await navigateToNextIncompleteStep(currentUserId);
    } else {
      setCurrentScreen('paymentDetails');
    }
  };

  const handleCertificateContinue = async () => {
    if (currentUserId) {
      await updateOnboardingStep(currentUserId, 'certificateUploaded', true, false);
      await navigateToNextIncompleteStep(currentUserId);
    } else {
      setCurrentScreen('paymentDetails');
    }
  };

  const handlePaymentDetailsContinue = async () => {
    if (paymentDetailsSource === 'account') {
      setActiveTab('account');
      setCurrentScreen('account');
      return;
    }
    if (paymentDetailsSource === 'home') {
      setActiveTab('home');
      setCurrentScreen('verifiedStatus');
      return;
    }

    if (currentUserId) {
      await updateOnboardingStep(currentUserId, 'paymentDetails', true, false);
      await navigateToNextIncompleteStep(currentUserId);
    } else {
      setCurrentScreen('selectService');
    }
  };

  const handlePaymentDetailsSkip = async () => {
    if (paymentDetailsSource === 'account') {
      setActiveTab('account');
      setCurrentScreen('account');
      return;
    }
    if (paymentDetailsSource === 'home') {
      setActiveTab('home');
      setCurrentScreen('verifiedStatus');
      return;
    }

    if (currentUserId) {
      await updateOnboardingStep(currentUserId, 'paymentDetails', true, true);
      await navigateToNextIncompleteStep(currentUserId);
    } else {
      setCurrentScreen('selectService');
    }
  };

  const handleSelectServiceSkip = async () => {
    if (currentUserId) {
      await updateOnboardingStep(currentUserId, 'selectService', true, true);
      await navigateToNextIncompleteStep(currentUserId);
    } else {
      setCurrentScreen('selectAvailableSlots');
    }
  };

  const handleServiceToggle = (serviceId: string, isEnabled: boolean) => {
    console.log('Service toggled:', serviceId, isEnabled);
    // Handle service toggle logic here
  };

  const handleBackFromSelectService = () => {
    setCurrentScreen('paymentDetails');
  };

  const handleSelectServiceNext = async (mainCategoryIds?: string[]) => {
    console.log('Navigating to Select Available Slots');
    const nextMainCategoryIds = mainCategoryIds || selectedMainCategoryIds;

    if (mainCategoryIds) {
      setSelectedMainCategoryIds(nextMainCategoryIds);
    }

    if (currentUserId) {
      const response = await fetch(`${API_BASE_URL_WITH_API}/profile/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          userId: currentUserId,
          mainCategoryIds: nextMainCategoryIds,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to save selected main categories:', errorText);
        Alert.alert(
          'Error',
          'Failed to save selected main categories. Please try again.',
        );
        return;
      }

      await updateOnboardingStep(currentUserId, 'selectService', true, false);
      await navigateToNextIncompleteStep(currentUserId);
    } else {
      setCurrentScreen('selectAvailableSlots');
    }
  };

  const handleBackFromSelectSlots = () => {
    setCurrentScreen('selectService');
  };

  const handleConfirmSlots = async () => {
    console.log('Slots confirmed');
    // Mark selectAvailableSlots step as completed
    if (currentUserId) {
      await updateOnboardingStep(currentUserId, 'selectAvailableSlots', true, false);
      await navigateToNextIncompleteStep(currentUserId);
    } else {
      setCurrentScreen('completeProfile');
    }
  };

  const handleSkipToHome = async () => {
    // Leaving the entire wizard defers every remaining step, across logins.
    if (currentUserId) {
      try {
        const progress = await getOnboardingProgress(currentUserId);
        for (const step of onboardingStepKeys) {
          if (!progress.steps[step] && !progress.actualCompletedSteps[step]) {
            await updateOnboardingStep(currentUserId, step, true, true);
          }
        }
      } catch {
        Alert.alert('Unable to save progress', 'Please try again before leaving onboarding.');
        return;
      }
    }
    profileCompletionMode.current = false;
    setHasSkippedAuth(true);
    if (currentUserId) {
      queryClient.invalidateQueries({ queryKey: ['onboardingSteps', currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['userProfile', currentUserId] });
    }
    setCurrentScreen('verifiedStatus');
  };

  const handleAvailableSlotsSkip = async () => {
    if (currentUserId) {
      await updateOnboardingStep(currentUserId, 'selectAvailableSlots', true, true);
      await navigateToNextIncompleteStep(currentUserId);
    } else {
      setCurrentScreen('completeProfile');
    }
  };

  const handleCompleteProfileSkip = async () => {
    if (currentUserId) {
      await updateOnboardingStep(currentUserId, 'completeProfile', true, true);
      await updateOnboardingStep(currentUserId, 'reviewProfile', true, true);
      queryClient.invalidateQueries({ queryKey: ['onboardingSteps', currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['userProfile', currentUserId] });
    }
    setCurrentScreen('verifiedStatus');
  };

  const handleBackFromCompleteProfile = () => {
    setCurrentScreen('selectAvailableSlots');
  };

  const handleCompleteProfileNext = async (data: {
    name: string;
    age: string;
    gender: 'Male' | 'Female' | 'Other';
    about: string;
    phoneNumber: string;
    instagram: string;
    yearsOfExperience: string;
    profileImage: string | null;
    profileImageUrl?: string | null;
  }) => {
    console.log('Profile data collected:', data);
    setProfileData(prev => ({
      ...prev,
      ...data,
    }));
    // Mark completeProfile step as completed
    if (currentUserId) {
      await updateOnboardingStep(currentUserId, 'completeProfile', true, false);
      await navigateToNextIncompleteStep(currentUserId);
    } else {
      setCurrentScreen('reviewProfile');
    }
  };

  
  const handleOnboardingBack = () => {
    if (navigationHistory.current.length > 1) {
      navigationHistory.current.pop();
      const prevScreen = navigationHistory.current[navigationHistory.current.length - 1];
      if (prevScreen === 'verifiedStatus' && currentUserId) {
        queryClient.invalidateQueries({ queryKey: ['onboardingSteps', currentUserId] });
        queryClient.invalidateQueries({ queryKey: ['userProfile', currentUserId] });
      }
      setCurrentScreen(prevScreen as AppScreen);
    } else {
      setCurrentScreen('loginSignup');
    }
  };

  const handleBackFromLocationSelection = () => {
    // Go back based on where we came from
    if (locationSelectionSource === 'account') {
      setCurrentScreen('account');
    } else {
      setCurrentScreen('professionalType');
    }
  };

  const handleLocationSelectionSkip = async () => {
    if (currentUserId) {
      await updateOnboardingStep(currentUserId, 'locationSelection', true, true);
      await navigateToNextIncompleteStep(currentUserId);
    }
  };

  const handleProfessionalTypeSelect = async (type: ProfessionalType) => {
    console.log('Professional type selected:', type);
    setProfileData(prev => ({
      ...prev,
      professionalType: type,
    }));

    if (currentUserId) {
      try {
        await fetch(`${API_BASE_URL_WITH_API}/profile/update-profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            userId: currentUserId,
            professionalType: type,
          }),
        });
      } catch (e) {
        console.error('Error saving professionalType:', e);
      }
    }

    setLocationSelectionSource('onboarding');
    setCurrentScreen('locationSelection');
  };

  const handleWorkLocationSelect = async (workLocation: string) => {
    console.log('Salon/Work location selected:', workLocation);
    setProfileData(prev => ({
      ...prev,
      salonWorkLocation: workLocation,
    }));

    if (currentUserId) {
      try {
        await fetch(`${API_BASE_URL_WITH_API}/profile/update-profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            userId: currentUserId,
            salonWorkLocation: workLocation,
          }),
        });
      } catch (e) {
        console.error('Error saving salonWorkLocation:', e);
      }
    }
  };

  const handleLocationSelect = async (location: string) => {
    console.log('Location selected:', location);
    setProfileData(prev => ({
      ...prev,
      location,
    }));
    // Mark locationSelection step as completed
    if (currentUserId) {
      await updateOnboardingStep(currentUserId, 'locationSelection', true);
    }
    // Navigate based on source
    if (locationSelectionSource === 'account') {
      setCurrentScreen('account');
    } else {
      if (currentUserId) await navigateToNextIncompleteStep(currentUserId);
      else setCurrentScreen('verification');
    }
  };

  const handleBackFromReviewProfile = () => {
    setCurrentScreen('completeProfile');
  };

  const handleReviewProfileConfirm = async (isVerified: boolean) => {
    console.log('Profile confirmed and saved. Verification status:', isVerified);
    // Mark reviewProfile step as completed
    if (currentUserId) {
      await updateOnboardingStep(currentUserId, 'reviewProfile', true);
    }
    // Navigate to appropriate screen based on verification status
    if (isVerified) {
      setCurrentScreen('verifiedStatus');
    } else {
      setCurrentScreen('pendingStatus');
    }
  };

  const handleReviewProfileSkip = async () => {
    if (currentUserId) {
      await updateOnboardingStep(currentUserId, 'reviewProfile', true, true);
      queryClient.invalidateQueries({ queryKey: ['onboardingSteps', currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['userProfile', currentUserId] });
    }
    setCurrentScreen('verifiedStatus');
  };

  const handlePendingStatusSkip = () => {
    if (currentUserId) {
      queryClient.invalidateQueries({ queryKey: ['onboardingSteps', currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['userProfile', currentUserId] });
    }
    setCurrentScreen('verifiedStatus');
  };

  const handleTabChange = (tab: 'home' | 'bookings' | 'alerts' | 'account') => {
    setActiveTab(tab);
    console.log('Tab changed to:', tab);
    
    // Navigate to appropriate screen based on tab
    if (tab === 'home') {
      setCurrentScreen('verifiedStatus');
    } else if (tab === 'bookings') {
      setCurrentScreen('bookings');
    } else if (tab === 'alerts') {
      setCurrentScreen('notifications');
    } else if (tab === 'account') {
      setCurrentScreen('account');
    }
  };

  const handleAccountSettings = () => {
    setCurrentScreen('accountSettings');
  };

  const handleProofOfIdentity = () => {
    setDocumentCategory('identity');
    setCurrentScreen('proofOfIdentity');
  };

  const handleBackFromIdentity = () => {
    setCurrentScreen('verification');
  };

  const handleSelectIDType = (idType: string) => {
    setSelectedDocType(idType);
    setPreviousScreen('proofOfIdentity');
    setDocumentCategory('identity');
    setCurrentScreen('verifyAccount');
  };

  const handlePrivacyPolicy = () => {
    setPrivacyPolicyVisible(true);
  };

  const handleLogout = async () => {
    console.log('Logout clicked');
    if (currentUserId) {
      await unregisterFCMToken(currentUserId);
    }
    // Clear login session and Google session
    try {
      await clearLoginSession();
      await signOutGoogleStylist();
      console.log('✅ Login session and Google session cleared');
    } catch (error) {
      console.error('❌ Error clearing login session:', error);
    }
    // Clear user data and navigate to login
    setCurrentUserId('');
    setActiveTab('home');
    setShowWelcomeModalOnLogin(false);
    setDisplayWelcomeModal(false);
    setHomePopupTriggerKey(0);
    setCurrentScreen('login');
  };

  const handleAccountDeleted = async () => {
    console.log('Account deleted');
    if (currentUserId) {
      await unregisterFCMToken(currentUserId);
    }
    try {
      await clearLoginSession();
      await signOutGoogleStylist();
      console.log('✅ Login session and Google session cleared after account deletion');
    } catch (error) {
      console.error('❌ Error clearing login session after account deletion:', error);
    }
    setCurrentUserId('');
    setActiveTab('home');
    setCurrentScreen('loginSignup');
  };

  // Show loading screen while checking auth
  if (isCheckingAuth) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <View style={styles.splashContainer}>
          <View style={styles.splashBrandBadge}>
            <Image
              source={require('./src/assets/logo.png')}
              style={styles.splashLogo}
              resizeMode="contain"
            />
          </View>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
      <PopupProvider key={currentUserId || 'guest'}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <CustomModal
          visible={modal.visible}
          title={modal.title}
          message={modal.message}
          type={modal.type}
          buttons={modal.buttons}
          onClose={modal.hideModal}
        />
        {directChatBooking && currentUserId ? (
          <BookingChatScreen
            bookingId={directChatBooking.bookingId}
            currentUserId={currentUserId}
            counterpartName={directChatBooking.counterpartName || 'Customer'}
            serviceName={directChatBooking.serviceName}
            onBack={() => setDirectChatBooking(null)}
          />
        ) : currentScreen === 'loginSignup' ? (
        <LoginSignupScreen
          onContinueWithEmail={handleContinueWithEmail}
          onContinueWithGoogle={handleContinueWithGoogle}
          onContinueWithApple={handleContinueWithApple}
          onLogin={handleLogin}
        />
      ) : currentScreen === 'login' ? (
        <LoginScreen
          onLogin={handleLoginSubmit}
          onContinueWithGoogle={handleContinueWithGoogle}
          onContinueWithApple={handleContinueWithApple}
          onForgotPassword={handleForgotPassword}
        />
      ) : currentScreen === 'verification' ? (
        <VerificationScreen
          onBack={handleOnboardingBack}
          onProofOfIdentity={handleProofOfIdentity}
          onPrivacyPolicy={handlePrivacyPolicy}
          onSkip={async () => {
            if (currentUserId) {
              await updateOnboardingStep(currentUserId, 'proofOfIdentity', true, true);
              await navigateToNextIncompleteStep(currentUserId);
            }
          }}
        />
      ) : currentScreen === 'proofOfIdentity' ? (
        <ProofOfIdentityScreen
          onBack={handleOnboardingBack}
          onSelectIDType={handleSelectIDType}
          onPrivacyPolicy={handlePrivacyPolicy}
        />
      ) : currentScreen === 'proofOfAddress' ? (
        <ProofOfAddressScreen
          onBack={handleOnboardingBack}
          onSelectDocType={handleSelectAddressDocType}
          onPrivacyPolicy={handlePrivacyPolicy}
          onSkip={handleSkipToHome}
        />
      ) : currentScreen === 'verifyAccount' ? (
        <VerifyAccountScreen
          onBack={handleOnboardingBack}
          onContinue={handleVerifyAccountContinue}
          onSkip={handleSkipToHome}
          documentType={selectedDocType}
          documentCategory={documentCategory}
          userId={currentUserId} // Pass userId from App state to verification screen
        />
      ) : currentScreen === 'certificateUpload' ? (
        <CertificateUploadScreen
          onBack={handleOnboardingBack}
          onSkip={handleCertificateSkip}
          onContinue={handleCertificateContinue}
          onPrivacyPolicy={handlePrivacyPolicy}
          userId={currentUserId}
        />
      ) : currentScreen === 'paymentDetails' ? (
        <PaymentDetailsScreen
          onBack={() => {
            if (paymentDetailsSource === 'account') {
              setActiveTab('account');
              setCurrentScreen('account');
            } else if (paymentDetailsSource === 'home') {
              setActiveTab('home');
              setCurrentScreen('verifiedStatus');
            } else {
              handleOnboardingBack();
            }
          }}
          onContinue={handlePaymentDetailsContinue}
          onSkip={handlePaymentDetailsSkip}
          userId={currentUserId}
          initialData={paymentDetailsDraft}
          onDataChange={setPaymentDetailsDraft}
          isEditMode={paymentDetailsSource === 'account' || paymentDetailsSource === 'home'}
        />
      ) : currentScreen === 'selectService' ? (
        <SelectServiceScreen
          onBack={handleOnboardingBack}
          onServiceToggle={handleServiceToggle}
          onNext={handleSelectServiceNext}
          onSkip={handleSelectServiceSkip}
          selectedMainCategoryIds={selectedMainCategoryIds}
          onSelectionChange={setSelectedMainCategoryIds}
          userId={currentUserId}
        />
      ) : currentScreen === 'selectAvailableSlots' ? (
        <SelectAvailableSlotsScreen
          onBack={handleOnboardingBack}
          onConfirm={handleConfirmSlots}
          onSkip={handleAvailableSlotsSkip}
          userId={currentUserId}
          initialData={availableSlotsDraft}
          onChange={setAvailableSlotsDraft}
        />
      ) : currentScreen === 'completeProfile' ? (
        <CompleteProfileScreen
          onBack={handleOnboardingBack}
          onNext={handleCompleteProfileNext}
          onSkip={handleCompleteProfileSkip}
          userId={currentUserId}
          initialData={profileData}
          onDataChange={handleCompleteProfileDraftChange}
        />
      ) : currentScreen === 'professionalType' ? (
        <ProfessionalTypeScreen
          initialType={profileData.professionalType}
          onContinue={handleProfessionalTypeSelect}
          onSkip={handleLocationSelectionSkip}
          onBack={handleOnboardingBack}
        />
      ) : currentScreen === 'locationSelection' ? (
        <LocationSelectionScreen
          userId={currentUserId}
          onBack={handleBackFromLocationSelection}
          onLocationSelect={handleLocationSelect}
          onWorkLocationSelect={handleWorkLocationSelect}
          onNext={handleLocationSelect}
          initialLocation={profileData.location}
          initialWorkLocation={profileData.salonWorkLocation}
          professionalType={profileData.professionalType}
        />
      ) : currentScreen === 'reviewProfile' ? (
        <ReviewProfileScreen
          onBack={handleOnboardingBack}
          onConfirm={handleReviewProfileConfirm}
          onSkip={handleReviewProfileSkip}
          userId={currentUserId}
          profileData={profileData}
          selectedMainCategoryIds={selectedMainCategoryIds}
        />
      ) : currentScreen === 'pendingStatus' ? (
        <PendingStatusScreen 
          userId={currentUserId}
          onVerified={() => {
            setActiveTab('home');
            setCurrentScreen('verifiedStatus');
          }}
          onSkip={handlePendingStatusSkip}
        />
      ) : currentScreen === 'verifiedStatus' ? (
        <HomeScreen 
          userId={currentUserId}
          enablePendingBookingModal={false}
          pauseHomePopup={displayWelcomeModal}
          homePopupTriggerKey={homePopupTriggerKey}
          onNavigateToBookings={() => {
            setActiveTab('bookings');
            setCurrentScreen('bookings');
          }}
          onShowOTP={(actionType, booking) => {
            setSelectedBooking(booking);
            setOtpActionType(actionType);
            setCurrentScreen('otpVerification');
          }}
          onLogout={handleLogout}
          onEditProfile={() => {
            console.log('HomeScreen: onEditProfile called, navigating to editProfile');
            setCurrentScreen('editProfile');
          }}
          onSubscription={() => {
            setCurrentScreen('subscription');
          }}
          onAds={() => {
            setCurrentScreen('ads');
          }}
          onReferAndEarn={() => {
            setCurrentScreen('referAndEarn');
          }}
          onMyService={() => {
            setCurrentScreen('myService');
          }}
          onSpecialService={() => {
            setCurrentScreen('specialService');
          }}
          onMySlots={() => {
            setCurrentScreen('mySlots');
          }}
          onHistory={() => {
            setActiveTab('account');
            setCurrentScreen('history');
          }}
          onPortfolio={() => {
            setCurrentScreen('myAccount');
          }}
          onPaymentDetails={() => {
            setPaymentDetailsSource('home');
            navigationHistory.current.push('paymentDetails');
            setCurrentScreen('paymentDetails');
          }}
          isCompletingProfile={isProfileRedirecting}
          onCompleteProfile={async () => {
            setIsProfileRedirecting(true);
            try {
              const {steps, skippedSteps, actualCompletedSteps} = await getOnboardingProgress(currentUserId);
              profileCompletionMode.current = true;
              dismissedProfileSteps.current = [];
              setLocationSelectionSource('onboarding');
              const nextScreen = getNextIncompleteStep(steps, skippedSteps, actualCompletedSteps, {includeSkipped: true});
              const targetScreen = (nextScreen as AppScreen) || 'completeProfile';
              setCurrentScreen(targetScreen);
            } catch (e) {
              console.error('Error fetching onboarding steps onCompleteProfile', e);
              setCurrentScreen('completeProfile');
            } finally {
              setIsProfileRedirecting(false);
            }
          }}
          openProfileDrawerOnMount={shouldReopenProfileDrawer}
          profileDrawerInitialScrollY={profileDrawerScrollY}
          onProfileDrawerNavigate={() => {
            setShouldReopenProfileDrawer(true);
          }}
          onProfileDrawerScrollChange={setProfileDrawerScrollY}
          onProfileDrawerOpenedFromReturn={() => {
            setShouldReopenProfileDrawer(false);
          }}
        />
      ) : currentScreen === 'bookings' ? (
        <BookingsScreen
          key={bookingsRefreshKey}
          initialTab={bookingTab}
          onTabChange={setBookingTab}
          initialRatingBooking={completedRatingBooking}
          userId={currentUserId}
          onChatVisibilityChange={setIsBookingsChatVisible}
          onHistory={() => setCurrentScreen('history')}
          onHelp={() => {
            setActiveTab('home');
            setCurrentScreen('help');
          }}
          onBookingPress={(booking) => {
            setSelectedBooking(booking);
            setCurrentScreen('bookingDetails');
          }}
          onCompletedBookingPress={(booking) => {
            setSelectedBooking(booking);
            setCurrentScreen('completedBookingDetails');
          }}
          onShowOTP={(booking, actionType = 'start') => {
            setSelectedBooking(booking);
            setOtpActionType(actionType);
            setCurrentScreen('otpVerification');
          }}
        />
      ) : currentScreen === 'bookingDetails' ? (
        <BookingDetailsScreen
          bookingId={selectedBooking?.bookingId || ''}
          booking={selectedBooking}
          onBack={() => setCurrentScreen('bookings')}
          onShowOTP={(actionType) => {
            setOtpActionType(actionType);
            setCurrentScreen('otpVerification');
          }}
        />
      ) : currentScreen === 'otpVerification' ? (
        <OTPVerificationScreen
          booking={selectedBooking}
          stylistId={currentUserId}
          phoneNumber={currentUserId} // You may want to fetch actual phone number
          onOTPVerified={() => {
            returnToBookings(selectedBooking, otpActionType === 'start' ? 'ongoing' : 'completed');
          }}
          onBack={() => {
            if (otpActionType === 'start') {
              setCurrentScreen('bookings');
            } else {
              setCurrentScreen('bookingDetails');
            }
          }}
          actionType={otpActionType}
        />
      ) : currentScreen === 'completedBookingDetails' ? (
        <CompletedBookingDetailsScreen
          bookingId={selectedBooking?.bookingId || ''}
          booking={selectedBooking}
          stylistId={currentUserId} // Pass current user ID as stylistId (logged-in user is the stylist)
          onBack={() => setCurrentScreen('bookings')}
          onHelp={() => setCurrentScreen('help')}
        />
      ) : currentScreen === 'cancelledBookingDetails' ? (
        <CancelledBookingDetailsScreen
          bookingId={selectedBooking?.bookingId || ''}
          booking={selectedBooking}
          stylistId={currentUserId} // Pass current user ID as stylistId (logged-in user is the stylist)
          onBack={() => setCurrentScreen('bookings')}
          onHelp={() => {
            setActiveTab('home');
            setCurrentScreen('help');
          }}
        />
      ) : currentScreen === 'help' ? (
        <HelpScreen
          onTermsPress={() => setCurrentScreen('termsPrivacy')}
          onContactPress={() => {
            setContactPreviousScreen('help');
            setActiveTab('home');
            setCurrentScreen('contactUs');
          }}
          onReferEarn={() => {
            setActiveTab('home');
            setCurrentScreen('referAndEarn');
          }}
          onFAQs={() => {
            setFaqPreviousScreen('help');
            setActiveTab('home');
            setCurrentScreen('faqs');
          }}
          onAboutUs={() => {
            setActiveTab('home');
            setCurrentScreen('aboutUs');
          }}
        />
      ) : currentScreen === 'contactUs' ? (
        <ContactUsScreen
          onBack={() => {
            setActiveTab('home');
            setCurrentScreen(contactPreviousScreen);
          }}
        />
      ) : currentScreen === 'termsPrivacy' ? (
        <TermsAndPrivacyScreen onBack={() => setCurrentScreen('help')} />
      ) : currentScreen === 'aboutUs' ? (
        <AboutUsScreen onBack={() => setCurrentScreen('help')} />
      ) : currentScreen === 'referAndEarn' ? (
        <ReferAndEarnScreen
          userId={currentUserId}
          onBack={() => setCurrentScreen('help')}
          onFAQs={() => {
            setFaqPreviousScreen('referAndEarn');
            setCurrentScreen('faqs');
          }}
        />
      ) : currentScreen === 'faqs' ? (
        <FAQsScreen
          onBack={() => setCurrentScreen(faqPreviousScreen)}
          onContactSupport={() => {
            setContactPreviousScreen('faqs');
            setCurrentScreen('contactUs');
          }}
        />
      ) : currentScreen === 'account' ? (
        <AccountScreen
          userId={currentUserId}
          onSignIn={() => {
            setCurrentScreen('loginSignup');
          }}
          onBack={() => {
            setActiveTab('home');
            setCurrentScreen('verifiedStatus');
          }}
          onLogout={handleLogout}
          onEditProfile={() => {
            console.log('onEditProfile called, currentUserId:', currentUserId);
            console.log('Setting screen to editProfile');
            setCurrentScreen('editProfile');
          }}
          onPayments={() => {
            setCurrentScreen('payments');
          }}
          onPaymentDetails={() => {
            setPaymentDetailsSource('account');
            navigationHistory.current.push('paymentDetails');
            setCurrentScreen('paymentDetails');
          }}
          onMyAccount={() => {
            setCurrentScreen('myAccount');
          }}
          onWallet={() => {
            setCurrentScreen('wallet');
          }}
          onSubscription={() => {
            setCurrentScreen('subscription');
          }}
          onAds={() => {
            setCurrentScreen('ads');
          }}
          onCurrentBooking={() => {
            console.log('AccountScreen: onCurrentBooking called, navigating to bookings');
            setActiveTab('bookings');
            setCurrentScreen('bookings');
          }}
          onHistory={() => {
            console.log('AccountScreen: onHistory called, navigating to history');
            setHistoryPreviousScreen('account');
            setCurrentScreen('history');
          }}
          onHelp={() => {
            console.log('AccountScreen: onHelp called, navigating to help');
            setActiveTab('home');
            setCurrentScreen('help');
          }}
          onMyService={() => {
            console.log('AccountScreen: onMyService called, navigating to myService');
            setCurrentScreen('myService');
          }}
          onSpecialService={() => {
            console.log('AccountScreen: onSpecialService called, navigating to specialService');
            setCurrentScreen('specialService');
          }}
          onLocation={() => {
            console.log('AccountScreen: onLocation called, navigating to locationSelection');
            setLocationSelectionSource('account');
            setCurrentScreen('locationSelection');
          }}
          onMySlots={() => {
            console.log('AccountScreen: onMySlots called, navigating to mySlots');
            setCurrentScreen('mySlots');
          }}
          onAccountSettings={handleAccountSettings}
          onNotifications={() => setCurrentScreen('notifications')}
        />
      ) : currentScreen === 'notifications' ? (
        <NotificationsScreen
          userId={currentUserId}
          onOpenChat={booking => {
            setDirectChatBooking(booking);
          }}
          onBack={() => {
            createSidebarScreenBackHandler('account')();
          }}
        />
      ) : currentScreen === 'myAccount' ? (
        <MyAccountScreen
          userId={currentUserId}
          onBack={() => {
            console.log('MyAccountScreen: onBack called');
            createSidebarScreenBackHandler('account')();
          }}
          onHelp={() => {
            console.log('MyAccountScreen: onHelp called, navigating to help');
            setActiveTab('home');
            setCurrentScreen('help');
          }}
          onCurrentBooking={() => {
            console.log('MyAccountScreen: onCurrentBooking called, navigating to bookings');
            setActiveTab('bookings');
            setCurrentScreen('bookings');
          }}
          onHistory={() => {
            console.log('MyAccountScreen: onHistory called, navigating to history');
            setHistoryPreviousScreen('myAccount');
            setCurrentScreen('history');
          }}
        />
      ) : currentScreen === 'history' ? (
        <HistoryScreen
          userId={currentUserId}
          onBack={() => {
            // Use navigation history for back button
            if (navigationHistory.current.length > 1) {
              navigationHistory.current.pop();
              const prevScreen = navigationHistory.current[navigationHistory.current.length - 1];
              if (prevScreen) {
                setCurrentScreen(prevScreen as any);
              } else {
                setCurrentScreen('account');
              }
            } else {
              setCurrentScreen('account');
            }
          }}
          onBookingPress={(booking) => {
            setSelectedBooking(booking);
            // Navigate to appropriate screen based on booking status
            if (booking.status === 'completed') {
            setCurrentScreen('completedBookingDetails');
            } else if (booking.status === 'cancelled') {
              setCurrentScreen('cancelledBookingDetails');
            }
          }}
        />
      ) : currentScreen === 'myService' ? (
        <MyServiceScreen
          userId={currentUserId}
          onDataChanged={() => invalidateStylistAccountQueries(currentUserId)}
          onUpgradePlan={() => {
            navigationHistory.current.push('subscription');
            setCurrentScreen('subscription');
          }}
          onBack={() => {
            // Use navigation history for back button
            if (navigationHistory.current.length > 1) {
              navigationHistory.current.pop();
              const prevScreen = navigationHistory.current[navigationHistory.current.length - 1];
              if (prevScreen) {
                setCurrentScreen(prevScreen as any);
              } else {
                setCurrentScreen('account');
              }
            } else {
              setCurrentScreen('account');
            }
          }}
        />
      ) : currentScreen === 'specialService' ? (
        <SpecialServiceScreen
          userId={currentUserId}
          onBack={() => {
            // Use navigation history for back button
            if (navigationHistory.current.length > 1) {
              navigationHistory.current.pop();
              const prevScreen = navigationHistory.current[navigationHistory.current.length - 1];
              if (prevScreen) {
                setCurrentScreen(prevScreen as any);
              } else {
                setCurrentScreen('account');
              }
            } else {
              setCurrentScreen('account');
            }
          }}
        />
      ) : currentScreen === 'mySlots' ? (
        <MySlotsScreen
          userId={currentUserId}
          onBack={() => {
            // Use navigation history for back button
            if (navigationHistory.current.length > 1) {
              navigationHistory.current.pop();
              const prevScreen = navigationHistory.current[navigationHistory.current.length - 1];
              if (prevScreen) {
                setCurrentScreen(prevScreen as any);
              } else {
                setCurrentScreen('account');
              }
            } else {
              setCurrentScreen('account');
            }
          }}
        />
      ) : currentScreen === 'wallet' ? (
        <WalletScreen
          userId={currentUserId}
          onBack={() => {
            // Use navigation history for back button
            if (navigationHistory.current.length > 1) {
              navigationHistory.current.pop();
              const prevScreen = navigationHistory.current[navigationHistory.current.length - 1];
              if (prevScreen) {
                setCurrentScreen(prevScreen as any);
              } else {
                setCurrentScreen('account');
              }
            } else {
              setCurrentScreen('account');
            }
          }}
        />
      ) : currentScreen === 'subscription' ? (
        <SubscriptionScreen
          stylistId={currentUserId}
          onSubscriptionActivated={() => invalidateStylistAccountQueries(currentUserId)}
          onBack={() => {
            // Use navigation history for back button
            if (navigationHistory.current.length > 1) {
              navigationHistory.current.pop();
              const prevScreen = navigationHistory.current[navigationHistory.current.length - 1];
              if (prevScreen) {
                setCurrentScreen(prevScreen as any);
              } else {
                setCurrentScreen('account');
              }
            } else {
              setCurrentScreen('account');
            }
          }}
        />
      ) : currentScreen === 'ads' ? (
        <AdsScreen
          userId={currentUserId}
          onAnalytics={() => {
            setCurrentScreen('analytics');
          }}
          onBack={() => {
            // Use navigation history for back button
            if (navigationHistory.current.length > 1) {
              navigationHistory.current.pop();
              const prevScreen = navigationHistory.current[navigationHistory.current.length - 1];
              if (prevScreen) {
                setCurrentScreen(prevScreen as any);
              } else {
                setCurrentScreen('account');
              }
            } else {
              setCurrentScreen('account');
            }
          }}
        />
      ) : currentScreen === 'analytics' ? (
        <AnalyticsScreen
          userId={currentUserId}
          onBack={() => {
            if (navigationHistory.current.length > 1) {
              navigationHistory.current.pop();
              const prevScreen = navigationHistory.current[navigationHistory.current.length - 1];
              if (prevScreen) {
                setCurrentScreen(prevScreen as any);
              } else {
                setCurrentScreen('ads');
              }
            } else {
              setCurrentScreen('ads');
            }
          }}
        />
      ) : currentScreen === 'payments' ? (
        <PaymentsScreen
          navigation={{
            goBack: () => {
              if (navigationHistory.current.length > 1) {
                navigationHistory.current.pop();
                const prevScreen = navigationHistory.current[navigationHistory.current.length - 1];
                if (prevScreen) {
                  setCurrentScreen(prevScreen as any);
                } else {
                  setCurrentScreen('account');
                }
              } else {
                setCurrentScreen('account');
              }
            }
          }}
        />
      ) : currentScreen === 'editProfile' ? (
        <EditProfileScreen
          userId={currentUserId || ''}
          onBack={() => {
            console.log('EditProfileScreen onBack called');
            setCurrentScreen('account');
          }}
          onUpdateSuccess={() => {
            console.log('Profile updated successfully');
            invalidateStylistAccountQueries(currentUserId);
            setCurrentScreen('account');
          }}
        />
      ) : currentScreen === 'accountSettings' ? (
        <AccountSettingsScreen
          userId={currentUserId || ''}
          onBack={() => {
            console.log('AccountSettingsScreen onBack called');
            setCurrentScreen('account');
          }}
          onLogout={handleLogout}
          onDeleteSuccess={handleAccountDeleted}
        />
      ) : (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text>Screen not found</Text>
        </View>
      )}
      
      {/* Global Bottom Navigation - Show only on main screens */}
      {!directChatBooking && (currentScreen === 'verifiedStatus' || currentScreen === 'bookings' || currentScreen === 'notifications' || currentScreen === 'help' || currentScreen === 'contactUs' || currentScreen === 'account') && !(currentScreen === 'bookings' && isBookingsChatVisible) && (
        <BottomNavigation activeTab={activeTab} onTabChange={handleTabChange} userId={currentUserId} />
      )}

      <GlobalPendingBookingModal
        stylistId={currentUserId}
        enabled={!!currentUserId && currentScreen !== 'loginSignup' && currentScreen !== 'login' && !displayWelcomeModal}
      />

      <Modal
        visible={privacyPolicyVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPrivacyPolicyVisible(false)}
      >
        <View style={styles.policyModalOverlay}>
          <View style={styles.policyModalCard}>
            <View style={styles.policyModalHeader}>
              <Text style={styles.policyModalTitle}>Privacy Policy</Text>
              <TouchableOpacity
                style={styles.policyModalClose}
                onPress={() => setPrivacyPolicyVisible(false)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Close privacy policy"
              >
                <Text style={styles.policyModalCloseText}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.policyModalScroll}
              contentContainerStyle={styles.policyModalScrollContent}
              showsVerticalScrollIndicator
            >
              <Text style={styles.policyModalBody}>{PARTNER_PRIVACY_TEXT}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Welcome Modal */}
      <Modal
        visible={displayWelcomeModal}
        onActiveChange={setWelcomePresented}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          welcomeScaleAnim.setValue(0);
          setDisplayWelcomeModal(false);
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            welcomeScaleAnim.setValue(0);
            setDisplayWelcomeModal(false);
          }}>
          <View style={{ width: '100%', alignItems: 'center', paddingHorizontal: 24 }}>
            <Animated.View
              style={[
                styles.modalContent,
                {
                  transform: [{ scale: welcomeScaleAnim }],
                },
              ]}
            >
              {/* Top Close Icon */}
              <TouchableOpacity
                style={{
                  position: 'absolute',
                  top: 14,
                  right: 14,
                  zIndex: 10,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: '#F5F5F5',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                activeOpacity={0.7}
                onPress={() => {
                  welcomeScaleAnim.setValue(0);
                  setDisplayWelcomeModal(false);
                }}
              >
                <Text style={{ fontSize: 18, color: '#666', fontWeight: 'bold' }}>×</Text>
              </TouchableOpacity>

              {/* Carousel Container */}
              <View
                style={{
                  width: SLIDE_WIDTH,
                  height: 140,
                  overflow: 'hidden',
                  marginBottom: 16,
                }}
              >
                <Animated.View
                  style={{
                    flexDirection: 'row',
                    width: SLIDE_WIDTH * welcomeImages.length,
                    transform: [{ translateX: slideAnim }],
                  }}
                >
                  {welcomeImages.map((img, i) => (
                    <Image
                      key={i}
                      source={img}
                      fadeDuration={0}
                      style={{
                        width: SLIDE_WIDTH,
                        height: 140,
                        resizeMode: 'contain',
                      }}
                    />
                  ))}
                </Animated.View>
              </View>

              {/* Welcome Text */}
              <Text style={styles.welcomeTitle}>Welcome to</Text>
              <Text style={styles.glammefy}>
                <Text style={styles.glam}>Glam</Text>
                <Text style={styles.mefy}>Mefy</Text>
              </Text>
              <Text style={styles.welcomeMessage}>
                You're all set to start your journey as a stylist!
              </Text>

              {/* Explicit Dismiss / Get Started Button */}
              <TouchableOpacity
                style={{
                  marginTop: 20,
                  width: '100%',
                  paddingVertical: 14,
                  borderRadius: 24,
                  backgroundColor: '#FD8B36',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#FD8B36',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 4,
                }}
                activeOpacity={0.85}
                onPress={() => {
                  welcomeScaleAnim.setValue(0);
                  setDisplayWelcomeModal(false);
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
                  Get Started
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </TouchableOpacity>
      </Modal>
      </PopupProvider>
      </SafeAreaProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = {
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF7F1',
    paddingHorizontal: 24,
  } as any,
  splashBrandBadge: {
    width: 148,
    height: 148,
    borderRadius: 36,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    // shadowColor: '#000',
    // shadowOpacity: 0.08,
    // shadowRadius: 18,
    // shadowOffset: { width: 0, height: 8 },
    // elevation: 6,
    marginBottom: 20,
  } as any,
  splashLogo: {
    width: 112,
    height: 112,
  } as any,
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  } as any,
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    width: '85%',
  } as any,
  policyModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  } as any,
  policyModalCard: {
    width: '100%',
    maxHeight: '82%',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
  } as any,
  policyModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1E5DA',
  } as any,
  policyModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
  } as any,
  policyModalClose: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  } as any,
  policyModalCloseText: {
    fontSize: 28,
    lineHeight: 30,
    color: '#555',
  } as any,
  policyModalScroll: {
    maxHeight: 520,
  } as any,
  policyModalScrollContent: {
    padding: 18,
    paddingBottom: 24,
  } as any,
  policyModalBody: {
    fontSize: 13,
    lineHeight: 20,
    color: '#444',
  } as any,
  welcomeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  } as any,
  glammefy: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 15,
  } as any,
  glam: {
    color: '#FD8B36',
  } as any,
  mefy: {
    color: '#333',
  } as any,
  welcomeMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  } as any,
};

export default App;
