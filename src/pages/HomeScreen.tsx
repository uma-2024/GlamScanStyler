import { QueuedModal as Modal } from '../popup/PopupProvider';
import { QueuedAlert as Alert } from '../popup/QueuedAlert';
import { canStartBooking, getBookingDateKey, getBookingStartTimestamp } from '../utils/bookingTime';
import { useBookingClock } from '../hooks/useBookingClock';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Animated,
  PanResponder,
  Dimensions,
  ImageSourcePropType,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SafeAreaView from '../components/SafeAreaView';
import { compactTopPadding } from '../utils/responsiveLayout';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL_WITH_API } from '../config/api';
import Shimmer from '../components/Shimmer';
import CustomModal from '../components/CustomModal';
import { useModal } from '../hooks/useModal';
import {
  scheduleUpcomingBookingsNotifications,
  cancelBookingNotification,
} from '../utils/notificationService';
import { subscribeToBookingRefresh, notifyBookingRefresh } from '../utils/bookingRefresh';
import { connectStylistRealtimeSocket, subscribeToSocketBookingUpdates } from '../services/stylistRealtime';
import Icons from 'react-native-vector-icons/FontAwesome5';
import Svg, { Defs, Rect, Stop, Text as SvgText, G, Path, LinearGradient as SvgLinearGradient } from 'react-native-svg';
import LinearGradient from '../components/AppLinearGradient';
import { toCloudFrontUrl } from '../utils/cdnUrl';
import PopupCampaignModal from '../components/PopupCampaignModal';
import StatusChangeModal from '../components/StatusChangeModal';
import ProfileRedirectModal from '../components/ProfileRedirectModal';
const WINDOW_SIZE = Dimensions.get('window');
const SUBSCRIPTION_MODAL_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const HOME_POPUP_IMAGE_SIZE = Math.min(
  WINDOW_SIZE.width - 4,
  WINDOW_SIZE.height * 0.995,
  640,
);
const CONFIRM_SWIPE_TRIGGER_RATIO = 0.8;
const shownHomePopupSessionKeys = new Set<string>();

type HomePopupTarget = 'ads' | 'referAndEarn';

interface HomePopupCampaign {
  id: string;
  image: ImageSourcePropType;
  target: HomePopupTarget;
}

const OLD_POPUP_CAMPAIGNS: HomePopupCampaign[] = [
  { id: 'popup1', image: require('../assets/popup1.webp'), target: 'ads' },
  { id: 'popup2', image: require('../assets/popup2.webp'), target: 'ads' },
  { id: 'popup3', image: require('../assets/popup3.png'), target: 'referAndEarn' },
];
interface HomeScreenProps {
  userId?: string;
  onNavigateToBookings?: () => void;
  onShowOTP?: (actionType: 'start' | 'end', booking: any) => void;
  onCurrentBooking?: () => void;
  onLogout?: () => void;
  onEditProfile?: () => void;
  onSubscription?: () => void;
  onAds?: () => void;
  onReferAndEarn?: () => void;
  onMyService?: () => void;
  onSpecialService?: () => void;
  onMySlots?: () => void;
  onHistory?: () => void;
  onPortfolio?: () => void;
  onPaymentDetails?: () => void;
  onCompleteProfile?: () => void;
  isCompletingProfile?: boolean;
  openProfileDrawerOnMount?: boolean;
  profileDrawerInitialScrollY?: number;
  onProfileDrawerNavigate?: () => void;
  onProfileDrawerScrollChange?: (scrollY: number) => void;
  onProfileDrawerOpenedFromReturn?: () => void;
  enablePendingBookingModal?: boolean;
  pauseHomePopup?: boolean;
  homePopupTriggerKey?: number;
}

type ProfileDrawerMenuItemId =
  | 'editProfile'
  | 'currentBookings'
  | 'subscription'
  | 'ads'
  | 'services'
  | 'specialService'
  | 'slots'
  | 'portfolio'
  | 'bankDetails';

interface CurrentSubscriptionInfo {
  planName: string;
  planCode?: string;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  amount?: number;
  status?: string;
}

interface UserProfile {
  _id?: string;
  userId: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
  specialization?: string;
  selectedServices?: Array<{ serviceName?: string; name?: string } | string>;
  profileImage?: string;
  age?: number;
  gender?: string;
  about?: string;
  location?: {
    latitude?: number;
    longitude?: number;
    address?: string;
  };
  isOnline?: boolean;
  rating?: number;
  adminRating?: number;
}

interface TimeSlot {
  id: string;
  time: string;
  status: 'available' | 'booked';
  startTime?: string; // Store original startTime for sorting
}

interface AvailableSlot {
  dayRange: string;
  day?: string;
  createdAt?: string;
  updatedAt?: string;
  timeSlots: Array<{
    startTime: string;
    endTime: string;
    period: string;
  }>;
}

interface BookedSlot {
  bookingId: string;
  userId: string;
  userName: string;
  serviceName: string;
  date: string;
  startTime: string;
  endTime: string;
  period: string;
  price: number;
  status: string;
  serviceImages?: { [key: string]: string }; // Object with gender keys and image values
  salonLocation?: {
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  homeLocation?: {
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  serviceType?: 'Home' | 'Salon' | 'Both';
  gender?: 'Male' | 'Female' | 'Other';
  rating?: number; // Customer's rating of the stylist
}

interface UpcomingBookingCard extends BookedSlot {
  distanceKm: number;
  travelTime: string;
  isHomeService: boolean;
  isSalonService: boolean;
  displayServiceType: 'Home' | 'Salon' | 'Both';
  salonAddress: string | null;
  homeAddress: string | null;
  hasSalonLocation: boolean;
  hasHomeLocation: boolean;
}

// Helper function to get the appropriate service image based on booking gender and images object
const getServiceImageForBooking = (booking: BookedSlot, defaultImage: string = 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=200&h=200&fit=crop'): string => {
  // If serviceImages object exists, try to get image for the booking gender
  if (booking.serviceImages && typeof booking.serviceImages === 'object') {
    const targetGender = booking.gender === 'Female' ? 'Female' :
      booking.gender === 'Male' ? 'Male' :
        null;

    if (targetGender) {
      // Try exact match first (case-sensitive)
      if (booking.serviceImages[targetGender]) {
        return toCloudFrontUrl(booking.serviceImages[targetGender]);
      }

      // Try case-insensitive match
      const imageKeys = Object.keys(booking.serviceImages);
      const matchingKey = imageKeys.find(key => {
        const keyLower = key.toLowerCase();
        const targetLower = targetGender.toLowerCase();
        return keyLower === targetLower ||
          (keyLower === 'female' && targetLower === 'female') ||
          (keyLower === 'male' && targetLower === 'male') ||
          (keyLower === 'women' && targetLower === 'female') ||
          (keyLower === 'men' && targetLower === 'male');
      });

      if (matchingKey && booking.serviceImages[matchingKey]) {
        return toCloudFrontUrl(booking.serviceImages[matchingKey]);
      }

      // Fallback to first available image
      if (imageKeys.length > 0 && booking.serviceImages[imageKeys[0]]) {
        return toCloudFrontUrl(booking.serviceImages[imageKeys[0]]);
      }
    } else {
      // If no gender specified, use first available image
      const imageKeys = Object.keys(booking.serviceImages);
      if (imageKeys.length > 0 && booking.serviceImages[imageKeys[0]]) {
        return toCloudFrontUrl(booking.serviceImages[imageKeys[0]]);
      }
    }
  }

  // Fallback to default image or serviceImages state if available
  return defaultImage;
};

// Service Chart Component
interface ServiceChartProps {
  data: Array<{ label: string; count: number; date: Date }>;
}

const ServiceChart: React.FC<ServiceChartProps> = ({ data }) => {
  const screenWidth = Dimensions.get('window').width - 48; // Screen width minus padding
  const chartHeight = 220;
  const barWidth = 28;
  const barSpacing = 22;
  const sidePadding = 24;
  const topPadding = 20;
  const bottomPadding = 44;
  const chartAreaHeight = chartHeight - topPadding - bottomPadding;

  const totalChartWidth = Math.max(
    screenWidth,
    sidePadding * 2 + data.length * barWidth + Math.max(0, data.length - 1) * barSpacing
  );

  const maxValue = Math.max(...data.map((d) => d.count), 1);
  const formatValue = (value: number) => (Number.isInteger(value) ? `${value}` : value.toFixed(1));

  const bars = data.map((item, index) => {
    const x = sidePadding + index * (barWidth + barSpacing);
    const normalizedValue = maxValue > 0 ? item.count / maxValue : 0;
    const barHeight = Math.max(3, normalizedValue * chartAreaHeight);
    const y = topPadding + chartAreaHeight - barHeight;
    return { x, y, barHeight, value: item.count, label: item.label };
  });

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingVertical: 0 }}
      style={{ height: chartHeight }}>
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={totalChartWidth} height={chartHeight}>
          <Defs>
            <SvgLinearGradient id="glamBarGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#f7bb2c" stopOpacity={1} />
              <Stop offset="100%" stopColor="#FD8B36" stopOpacity={1} />
            </SvgLinearGradient>
          </Defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = topPadding + chartAreaHeight - (ratio * chartAreaHeight);
            return (
              <Path
                key={ratio}
                d={`M ${sidePadding} ${y} L ${totalChartWidth - sidePadding} ${y}`}
                stroke="#E0E0E0"
                strokeWidth="1"
                strokeDasharray="4,4"
                opacity={0.3}
              />
            );
          })}

          {/* Bars */}
          {bars.map((bar, index) => (
            <G key={index}>
              <Rect
                x={bar.x}
                y={bar.y}
                width={barWidth}
                height={bar.barHeight}
                rx={8}
                fill="url(#glamBarGradient)"
              />
              {bar.value > 0 && (
                <SvgText
                  x={bar.x + barWidth / 2}
                  y={bar.y - 8}
                  fontSize="11"
                  fill="#333"
                  textAnchor="middle"
                  fontWeight="bold">
                  {formatValue(bar.value)}
                </SvgText>
              )}
              <SvgText
                x={bar.x + barWidth / 2}
                y={chartHeight - 20}
                fontSize="11"
                fill="#666"
                textAnchor="middle"
                fontWeight="500">
                {bar.label}
              </SvgText>
            </G>
          ))}
        </Svg>
      </View>
    </ScrollView>
  );
};

const HomeScreen: React.FC<HomeScreenProps> = ({
  userId,
  onNavigateToBookings,
  onCurrentBooking,
  onShowOTP,
  onLogout,
  onEditProfile,
  onSubscription,
  onAds,
  onReferAndEarn,
  onMyService,
  onSpecialService,
  onMySlots,
  onHistory,
  onPortfolio,
  onPaymentDetails,
  onCompleteProfile,
  isCompletingProfile = false,
  openProfileDrawerOnMount,
  profileDrawerInitialScrollY = 0,
  onProfileDrawerNavigate,
  onProfileDrawerScrollChange,
  onProfileDrawerOpenedFromReturn,
  enablePendingBookingModal = true,
  pauseHomePopup = false,
  homePopupTriggerKey = 0,
}) => {
  const queryClient = useQueryClient();
  const cachedProfile = queryClient.getQueryData<UserProfile>(['userProfile', userId]);
  const [isOnline, setIsOnline] = useState<boolean>(cachedProfile?.isOnline ?? true);
  const [showStatusModal, setShowStatusModal] = useState<boolean>(false);
  const insets = useSafeAreaInsets();
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedDateObj, setSelectedDateObj] = useState<Date | null>(null);
  
  // Replaced with React Query: const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  // Replaced with React Query: const [loading, setLoading] = useState(true);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  // Replaced with React Query: const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [slotFilter, setSlotFilter] = useState<'available' | 'booked'>('available');
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [pendingBookings, setPendingBookings] = useState<BookedSlot[]>([]);
  const [currentPendingIndex, setCurrentPendingIndex] = useState(0);
  // ✅ FIXED: Use refs to access latest state values in PanResponder
  const pendingBookingsRef = useRef<BookedSlot[]>([]);
  const currentPendingIndexRef = useRef(0);
  const previousPendingBookingIdsRef = useRef<Set<string>>(new Set());
  const refreshPendingBookingsRef = useRef<(() => Promise<void>) | null>(null);
  const [updatingBooking, setUpdatingBooking] = useState(false);
  const [bookingActionLoading, setBookingActionLoading] = useState<'confirm' | 'cancel' | null>(null);
  const [ongoingBooking, setOngoingBooking] = useState<BookedSlot | null>(null);
  // Time left calculation for ongoing booking
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });

  const bookingNow = useBookingClock();

  const [upcomingBookings, setUpcomingBookings] = useState<BookedSlot[]>([]);
  const [upcomingBookingsScrollIndex, setUpcomingBookingsScrollIndex] = useState(0);
  const [serviceImages, setServiceImages] = useState<Record<string, string>>({});
  const [showImageModal, setShowImageModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSubscriptionPlanModal, setShowSubscriptionPlanModal] = useState(false);
  const profileDrawerScrollRef = useRef<ScrollView>(null);
  const profileDrawerAnim = useRef(new Animated.Value(-340)).current;
  const profileDrawerAnimatingRef = useRef(false);
  const subscriptionPromptSlideAnim = useRef(new Animated.Value(420)).current;
  const subscriptionPromptShownRef = useRef(false);
  // Replaced with React Query: const [todayEarnings, setTodayEarnings] = useState<number>(0);
  // Replaced with React Query: const [todayAppointments, setTodayAppointments] = useState<number>(0);
  // Replaced with React Query: const [currentPlanName, setCurrentPlanName] = useState<string>('Free Plan');
  // Replaced with React Query: const [currentSubscriptionInfo, setCurrentSubscriptionInfo] = useState<CurrentSubscriptionInfo | null>(null);
  // Replaced with React Query: const [specialServiceNames, setSpecialServiceNames] = useState<string[]>([]);
  // Replaced with React Query: const [completedCount, setCompletedCount] = useState<number>(0);
  // Replaced with React Query: const [upcomingCount, setUpcomingCount] = useState<number>(0);
  // Replaced with React Query: const [ongoingCount, setOngoingCount] = useState<number>(0);
  // Replaced with React Query: const [loadingTodayStats, setLoadingTodayStats] = useState(false);
  const [serviceStatsPeriod, setServiceStatsPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');
  // Replaced with React Query: const [serviceStats, setServiceStats] = useState<Array<{ label: string; count: number; date: Date }>>([]);
  // Replaced with React Query: const [loadingServiceStats, setLoadingServiceStats] = useState(false);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [chartViewType, setChartViewType] = useState<'services' | 'earnings'>('services');
  // Replaced with React Query: const [earningsStats, setEarningsStats] = useState<Array<{ label: string; count: number; date: Date }>>([]);
  const modal = useModal();

  // Fetch user profile data
  // Fetch user profile data using React Query
  const { data: userProfile = null, isLoading: loading } = useQuery<UserProfile | null>({
    queryKey: ['userProfile', userId],
    queryFn: async () => {
      if (!userId) return null;
      console.log('Fetching user profile for userId:', userId);
      const apiUrl = `${API_BASE_URL_WITH_API}/profile/${userId}`;
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch profile: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ User profile fetched successfully:', result);
      return result.success && result.data ? result.data : null;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    enabled: !!userId,
  });

  useEffect(() => {
    if (userProfile?.isOnline !== undefined) {
      setIsOnline(userProfile.isOnline);
    }
  }, [userProfile]);

  // Fetch onboarding steps to determine progress
  const { data: onboardingData = null, isLoading: loadingOnboarding, refetch: refetchOnboardingSteps } = useQuery({
    queryKey: ['onboardingSteps', userId],
    queryFn: async () => {
      if (!userId) return null;
      const res = await fetch(`${API_BASE_URL_WITH_API}/profile/onboarding-steps/${userId}`);
      if (!res.ok) throw new Error('Failed to fetch onboarding steps');
      const result = await res.json();
      return result.success && result.data ? result.data : null;
    },
    enabled: !!userId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Always refresh onboarding data when HomeScreen is mounted or userId changes
  useEffect(() => {
    if (userId) {
      refetchOnboardingSteps();
    }
  }, [userId, refetchOnboardingSteps]);

  const progressPercentage = useMemo(() => {
    if (!onboardingData) return 100;
    const actualSteps = onboardingData.actualCompletedSteps || onboardingData.steps || {};
    const skipped = onboardingData.skippedSteps || {};
    const requiredSteps = [
      'locationSelection',
      'proofOfIdentity',
      'certificateUploaded',
      'paymentDetails',
      'selectService',
      'selectAvailableSlots',
      'completeProfile',
    ];
    let completed = 0;
    requiredSteps.forEach(step => {
      // Step is considered done only if genuinely completed and not marked as skipped
      if (actualSteps[step] && !skipped[step]) completed++;
    });
    return Math.round((completed / requiredSteps.length) * 100);
  }, [onboardingData]);

  const hasIncompleteSteps = useMemo(() => {
    if (!onboardingData) return false;
    const actualSteps = onboardingData.actualCompletedSteps || {};
    const skipped = onboardingData.skippedSteps || {};
    const requiredSteps = [
      'locationSelection',
      'proofOfIdentity',
      'certificateUploaded',
      'paymentDetails',
      'selectService',
      'selectAvailableSlots',
      'completeProfile',
    ];
    return requiredSteps.some(step => !actualSteps[step] || skipped[step]);
  }, [onboardingData]);

  const showCompletionBanner = !!userId && (progressPercentage < 100 || hasIncompleteSteps) && !loadingOnboarding;

  // Fetch current subscription plan for profile modal details using React Query
  const { data: currentSubscriptionInfo = null } = useQuery<CurrentSubscriptionInfo | null>({
    queryKey: ['currentSubscriptionPlan', userId],
    queryFn: async () => {
      if (!userId) return null;
      try {
        const response = await fetch(`${API_BASE_URL_WITH_API}/subscriptions/current/${userId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        if (!response.ok) return null;

        const result = await response.json();
        const data = result?.data;
        if (!data) return null;

        return {
          planName: data.planName || 'Free Plan',
          planCode: data.planCode || 'FREE',
          startDate: data.startDate || null,
          endDate: data.endDate || null,
          amount: data.amount || 0,
          status: data.status || 'active',
        };
      } catch (error) {
        console.error('❌ Error fetching current plan:', error);
        return null;
      }
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    enabled: !!userId,
  });

  const currentPlanName = currentSubscriptionInfo?.planName || 'Free Plan';

  // Reset prompt flag when user changes
  useEffect(() => {
    subscriptionPromptShownRef.current = false;
  }, [userId]);

  // Show subscription plan modal only if cooldown has passed and popups are not paused
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const maybeShowModal = async () => {
      if (loading || subscriptionPromptShownRef.current || pauseHomePopup) {
        return;
      }

      const canShow = await shouldShowSubscriptionPrompt();
      if (!canShow || cancelled || pauseHomePopup) {
        return;
      }

      timer = setTimeout(() => {
        if (!cancelled && !pauseHomePopup) {
          subscriptionPromptShownRef.current = true;
          setShowSubscriptionPlanModal(true);
        }
      }, 500);
    };

    maybeShowModal();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [loading, userId, pauseHomePopup]);

  // Fetch only special services for profile modal using React Query
  const { data: specialServiceNames = [] } = useQuery<string[]>({
    queryKey: ['specialServices', userId],
    queryFn: async () => {
      if (!userId) return [];
      try {
        const response = await fetch(`${API_BASE_URL_WITH_API}/services/special/${userId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        if (!response.ok) return [];

        const result = await response.json();
        const list = Array.isArray(result?.data) ? result.data : [];
        return list
          .map((item: any) => item?.serviceName)
          .filter((name: string) => !!name);
      } catch (error) {
        console.error('❌ Error fetching special services:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    enabled: !!userId,
  });

  // Fetch today's stats (earnings and appointments) using React Query
  const { data: todayStatsData, isLoading: loadingTodayStats } = useQuery({
    queryKey: ['todayStats', userId],
    queryFn: async () => {
      if (!userId) return null;
      const apiUrl = `${API_BASE_URL_WITH_API}/stylist/today-stats/${userId}`;
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Fetch today stats error:', errorText);
        throw new Error(`Failed to fetch today stats: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Today stats fetched successfully:', result);
      return result.success && result.data ? result.data : null;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchInterval: 60000, // refresh every minute
    enabled: !!userId,
  });

  const todayEarnings = todayStatsData?.todayEarnings || 0;
  const todayAppointments = todayStatsData?.todayAppointments || 0;
  const completedCount = todayStatsData?.completedCount || 0;
  const upcomingCount = todayStatsData?.upcomingCount || 0;
  const ongoingCount = todayStatsData?.ongoingCount || 0;

  // Fetch service statistics using React Query
  const { data: serviceStats = [], isLoading: loadingServiceStats } = useQuery({
    queryKey: ['serviceStats', userId, serviceStatsPeriod],
    queryFn: async () => {
      if (!userId) return [];
      try {
        const apiUrl = `${API_BASE_URL_WITH_API}/stylist/service-stats/${userId}?period=${serviceStatsPeriod}`;
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch service stats: ${response.status}`);
        }

        const result = await response.json();
        return result.success && result.data && result.data.stats ? result.data.stats : [];
      } catch (error) {
        console.error('❌ Error fetching service stats:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    enabled: !!userId,
  });

  // Fetch earnings statistics using React Query
  const { data: earningsStats = [], isLoading: loadingEarningsStats } = useQuery({
    queryKey: ['earningsStats', userId, serviceStatsPeriod],
    queryFn: async () => {
      if (!userId) return [];
      try {
        const apiUrl = `${API_BASE_URL_WITH_API}/stylist/earnings-stats/${userId}?period=${serviceStatsPeriod}`;
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch earnings stats: ${response.status}`);
        }

        const result = await response.json();

        if (result.success && result.data && result.data.stats && Array.isArray(result.data.stats)) {
          // Transform the API response to match the chart data format
          // API returns { label, amount, date }, we need { label, count, date }
          return result.data.stats.map((stat: any) => ({
            label: stat.label,
            count: stat.amount, // Use 'amount' as 'count' for the chart
            date: new Date(stat.date),
          }));
        } else {
          return [];
        }
      } catch (error) {
        console.error('❌ Error fetching earnings stats:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    enabled: !!userId && chartViewType === 'earnings',
  });

  // Use pre-calculated stylist rating from backend User collection
  const stylistRating = Number(userProfile?.rating ?? 0);

  const getSubscriptionPromptStorageKey = () =>
    `subscription_prompt_last_action_at:${userId || 'unknown_user'}`;


  // Initialize Stylist WebSockets for Real-time Booking Updates
  useEffect(() => {
    if (!userId) return;
    const disconnect = connectStylistRealtimeSocket(userId);
    return () => {
      disconnect();
    };
  }, [userId]);

  const shouldShowSubscriptionPrompt = async (): Promise<boolean> => {
    try {
      const raw = await AsyncStorage.getItem(getSubscriptionPromptStorageKey());
      if (!raw) return true;

      const lastActionAt = Number(raw);
      if (Number.isNaN(lastActionAt)) return true;

      return Date.now() - lastActionAt >= SUBSCRIPTION_MODAL_COOLDOWN_MS;
    } catch (error) {
      console.error('❌ Error reading subscription prompt cooldown:', error);
      return true;
    }
  };

  const markSubscriptionPromptAction = async () => {
    try {
      await AsyncStorage.setItem(
        getSubscriptionPromptStorageKey(),
        Date.now().toString(),
      );
    } catch (error) {
      console.error('❌ Error saving subscription prompt cooldown:', error);
    }
  };

  const closeSubscriptionPromptModal = (onClosed?: () => void) => {
    Animated.timing(subscriptionPromptSlideAnim, {
      toValue: 420,
      duration: 240,
      useNativeDriver: true,
    }).start(() => {
      setShowSubscriptionPlanModal(false);
      if (onClosed) onClosed();
    });
  };

  const presentSubscriptionPrompt = () => {
    subscriptionPromptSlideAnim.setValue(420);
    Animated.spring(subscriptionPromptSlideAnim, {
      toValue: 0,
      useNativeDriver: true,
      speed: 14,
      bounciness: 6,
    }).start();
  };

  const specialServicesText = useMemo(() => {
    if (!specialServiceNames || specialServiceNames.length === 0) {
      return 'Not added';
    }

    return specialServiceNames.join(', ');
  }, [specialServiceNames]);

  const planDaysRemainingText = useMemo(() => {
    const endDate = currentSubscriptionInfo?.endDate;
    if (!endDate) {
      return 'No expiry';
    }

    const end = new Date(endDate);
    if (isNaN(end.getTime())) {
      return 'N/A';
    }

    const diffDays = Math.ceil((end.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) {
      return 'Expired';
    }
    if (diffDays === 1) {
      return 'Expires in 1 day';
    }
    return `Expires in ${diffDays} days`;
  }, [currentSubscriptionInfo]);

  const isFreemiumPlan = useMemo(() => {
    const planCode = (currentSubscriptionInfo?.planCode || '').toLowerCase();
    const planName = (currentSubscriptionInfo?.planName || '').toLowerCase();
    return planCode.includes('freemium') || planName.includes('freemium');
  }, [currentSubscriptionInfo]);

  const { width: screenWidth } = Dimensions.get('window');
  const isSmallHomeScreen = screenWidth <= 390;
  const profileDrawerTopInset = Math.max(insets.top, Platform.OS === 'ios' ? 14 : 0);
  const profileDrawerBottomInset = Math.max(insets.bottom, 24);
  const subscriptionPromptBottomInset = Math.max(insets.bottom, 36);
  const profileDrawerHiddenX = -Math.ceil(screenWidth * 0.96);
  const upcomingBookingCardWidth = Math.min(screenWidth - 48, 360);
  const upcomingBookingSnapInterval = upcomingBookingCardWidth + 16;

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    try {
      const R = 6371; // Radius of the Earth in km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c; // Distance in km
      return distance;
    } catch (error) {
      console.error('Error calculating distance:', error);
      return 0;
    }
  }, []);

  // Calculate travel time based on distance (assuming average speed of 30 km/h in city)
  const calculateTravelTime = useCallback((distanceKm: number): string => {
    try {
      if (distanceKm <= 0) {
        return '0 Mins';
      }

      const averageSpeedKmh = 30; // Average city speed in km/h
      const travelTimeHours = distanceKm / averageSpeedKmh;
      const totalMinutes = Math.round(travelTimeHours * 60);

      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      if (hours > 0 && minutes > 0) {
        return `${hours} Hr ${minutes} Mins`;
      } else if (hours > 0) {
        return `${hours} Hr`;
      } else {
        return `${minutes} Mins`;
      }
    } catch (error) {
      console.error('Error calculating travel time:', error);
      return 'N/A';
    }
  }, []);

  const upcomingBookingCards = useMemo<UpcomingBookingCard[]>(() => {
    return upcomingBookings.map((booking) => {
      const rawServiceType = (booking.serviceType || 'Salon').toString().trim().toLowerCase();
      const isHomeService =
        rawServiceType === 'home' ||
        rawServiceType === 'at home' ||
        rawServiceType === 'both';
      const isSalonService = rawServiceType === 'salon';
      const displayServiceType =
        rawServiceType === 'home' || rawServiceType === 'at home'
          ? 'Home'
          : rawServiceType === 'salon'
            ? 'Salon'
            : 'Both';

      const salonAddress = booking.salonLocation?.address?.trim() || null;
      const homeAddress = booking.homeLocation?.address?.trim() || null;
      const hasSalonLocation =
        !!booking.salonLocation &&
        typeof booking.salonLocation === 'object' &&
        !!salonAddress;
      const hasHomeLocation =
        !!booking.homeLocation &&
        typeof booking.homeLocation === 'object' &&
        !!homeAddress;

      const salonLat = booking.salonLocation?.latitude;
      const salonLon = booking.salonLocation?.longitude;
      const homeLat = booking.homeLocation?.latitude;
      const homeLon = booking.homeLocation?.longitude;

      let distanceKm = 0;
      let travelTime = 'N/A';

      if (
        salonLat !== undefined &&
        salonLon !== undefined &&
        homeLat !== undefined &&
        homeLon !== undefined
      ) {
        distanceKm = calculateDistance(salonLat, salonLon, homeLat, homeLon);
        travelTime = calculateTravelTime(distanceKm);
      }

      return {
        ...booking,
        distanceKm,
        travelTime,
        isHomeService,
        isSalonService,
        displayServiceType,
        salonAddress,
        homeAddress,
        hasSalonLocation,
        hasHomeLocation,
      };
    });
  }, [upcomingBookings, calculateDistance, calculateTravelTime]);

  // Slide animation state for confirm button
  const slideAnim = useRef(new Animated.Value(0)).current;
  const slideWidth = useRef(0);
  const hasTriggeredAPI = useRef(false);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const currentSlideValue = useRef(0);
  // ✅ FIXED: Compute maxSlide ONCE and reuse everywhere
  const maxSlideRef = useRef(0);
  const triggerPointRef = useRef(0);
  const triggeredRef = useRef(false);
  const slideValueRef = useRef(0);

  // Generate dates for the next 7 days (from today)
  const weekDates = useMemo(() => {
    const dates: Array<{ day: string; date: string; dateObj: Date; key: string; month: string }> = [];
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const today = new Date();

    // Reset time to start of day for consistent date comparison
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 15; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dayName = dayNames[date.getDay()];
      const dateNum = date.getDate().toString();
      const month = monthNames[date.getMonth()];

      dates.push({
        day: dayName,
        date: dateNum,
        dateObj: new Date(date), // Create a new Date object to avoid reference issues
        key: `${dayName.toLowerCase()}-${dateNum}-${date.getMonth()}-${date.getFullYear()}`,
        month: month,
      });
    }

    return dates;
  }, []); // Empty dependency array means it only calculates once, but we want it to be based on "today"

  // Fetch available slots and booked slots using React Query
  const { data: slotsData, isLoading: loadingSlots } = useQuery({
    queryKey: ['slotsData', userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const stylistProfileUrl = `${API_BASE_URL_WITH_API}/profile/stylist/${userId}?includeSlots=true`;
      const bookedSlotsUrl = `${API_BASE_URL_WITH_API}/stylist/bookings/${userId}?status=pending,confirmed,ongoing`;

      const [profileRes, bookedRes] = await Promise.allSettled([
        fetch(stylistProfileUrl, { method: 'GET', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } }),
        fetch(bookedSlotsUrl, { method: 'GET', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } })
      ]);

      let availableSlots: AvailableSlot[] = [];
      if (profileRes.status === 'fulfilled' && profileRes.value.ok) {
        const result = await profileRes.value.json();
        if (result.success && result.data) {
          availableSlots = result.data.availableSlots || [];
        }
      }

      let allBookings: BookedSlot[] = [];
      if (bookedRes.status === 'fulfilled' && bookedRes.value.ok) {
        const result = await bookedRes.value.json();
        if (result.success && result.data) {
          allBookings = result.data.bookings || [];
        }
      }

      return { availableSlots, allBookings };
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    enabled: !!userId,
  });

  // Sync slots React Query data to local state
  useEffect(() => {
    if (slotsData) {
      setAvailableSlots(slotsData.availableSlots);
      setBookedSlots(slotsData.allBookings);

      const pending = slotsData.allBookings.filter((booking: BookedSlot) => booking.status === 'pending');
      setPendingBookings(pending);
      pendingBookingsRef.current = pending;
      setCurrentPendingIndex(0);
      currentPendingIndexRef.current = 0;
      previousPendingBookingIdsRef.current = new Set(pending.map((b: BookedSlot) => b.bookingId as string));

      if (pending.length > 0 && enablePendingBookingModal) {
        setShowPendingModal(true);
      }
    }
  }, [slotsData, enablePendingBookingModal]);

  // Refresh pending bookings on demand when a new booking arrives or the app regains focus
  useEffect(() => {
    if (!userId || !enablePendingBookingModal) return;
    let disposed = false;
    let inFlight = false;

    const checkForNewPendingBookings = async () => {
      if (disposed || inFlight) return;
      inFlight = true;
      try {
        const bookedSlotsUrl = `${API_BASE_URL_WITH_API}/stylist/bookings/${userId}?status=pending&limit=5`;
        const bookedResponse = await fetch(bookedSlotsUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        if (bookedResponse.ok) {
          const bookedResult = await bookedResponse.json();
          if (disposed) return;
          if (bookedResult.success && bookedResult.data) {
            const allBookings = bookedResult.data.bookings || [];
            const pending = allBookings.filter((booking: BookedSlot) => booking.status === 'pending');
            const currentPendingIds = new Set<string>(pending.map((b: BookedSlot) => b.bookingId as string));
            const previousPendingIds = previousPendingBookingIdsRef.current;
            const newPendingBookings = pending.filter(
              (booking: BookedSlot) => !previousPendingIds.has(booking.bookingId as string)
            );

            previousPendingBookingIdsRef.current = currentPendingIds;

            if (newPendingBookings.length > 0) {
              console.log('🔔 New pending bookings detected:', newPendingBookings.length);
              setPendingBookings(pending);
              pendingBookingsRef.current = pending;
              setCurrentPendingIndex(0);
              currentPendingIndexRef.current = 0;

              if (enablePendingBookingModal) {
                setShowPendingModal(true);
              }
            } else if (pending.length !== pendingBookingsRef.current.length) {
              setPendingBookings(pending);
              pendingBookingsRef.current = pending;

              if (pending.length === 0) {
                setShowPendingModal(false);
              }
            }
          }
        }
      } catch (error) {
        console.error('❌ Error checking for new pending bookings:', error);
      } finally {
        inFlight = false;
      }
    };

    refreshPendingBookingsRef.current = checkForNewPendingBookings;
    void checkForNewPendingBookings();

    const unsubscribeRefresh = subscribeToBookingRefresh(() => {
      void checkForNewPendingBookings();
    });

    return () => {
      disposed = true;
      refreshPendingBookingsRef.current = null;
      unsubscribeRefresh();
    };
  }, [userId, enablePendingBookingModal]);

  // Initialize previous pending booking IDs when pending bookings are first set
  useEffect(() => {
    if (pendingBookings.length > 0 && previousPendingBookingIdsRef.current.size === 0) {
      const ids = new Set<string>(pendingBookings.map(b => b.bookingId as string));
      previousPendingBookingIdsRef.current = ids;
    }
  }, [pendingBookings]);

  // Generate time slots for selected date
  useEffect(() => {
    if (!selectedDateObj) {
      setTimeSlots([]);
      return;
    }

    const slots: TimeSlot[] = [];
    const seenSlotKeys = new Set<string>();
    const selectedDayOfWeek = selectedDateObj.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const selectedDayName = dayNames[selectedDayOfWeek];

    const slotMatchesSelectedDay = (slot: AvailableSlot): boolean => {
      const slotDay = slot.day?.trim().toLowerCase();
      const selectedDay = selectedDayName.toLowerCase();

      if (slot.day) {
        return slotDay === selectedDay;
      }

      switch (slot.dayRange) {
        case 'mon-fri':
          return selectedDayOfWeek >= 1 && selectedDayOfWeek <= 5;
        case 'mon-sun':
        case 'all-week':
          return true;
        case 'sat-sun':
          return selectedDayOfWeek === 0 || selectedDayOfWeek === 6;
        default:
          return false;
      }
    };

    const getSlotUpdatedTime = (slot: AvailableSlot, fallbackIndex: number): number => {
      const timestamp = slot.updatedAt || slot.createdAt;
      const parsed = timestamp ? new Date(timestamp).getTime() : NaN;

      return Number.isNaN(parsed) ? fallbackIndex : parsed;
    };

    if (slotFilter === 'available') {
      // Show only available slots
      if (availableSlots.length === 0) {
        setTimeSlots([]);
        return;
      }

      // Only the newest saved slot entry for the selected day should drive Home.
      const latestSlotForSelectedDay = availableSlots
        .map((slot, index) => ({ slot, index }))
        .filter(({ slot }) => slotMatchesSelectedDay(slot) && Array.isArray(slot.timeSlots))
        .sort(
          (a, b) =>
            getSlotUpdatedTime(b.slot, b.index) - getSlotUpdatedTime(a.slot, a.index) ||
            b.index - a.index,
        )[0]?.slot;

      if (latestSlotForSelectedDay?.timeSlots) {
        latestSlotForSelectedDay.timeSlots.forEach((timeSlot) => {
          // Format time to 12-hour format for display
          const timeString = `${formatTimeTo12Hour(timeSlot.startTime)} - ${formatTimeTo12Hour(timeSlot.endTime)}`;

          // Check if this slot is booked for the selected date
          const isBooked = bookedSlots.some((booking) => {
            try {
              const bookingDate = new Date(booking.date);
              // Compare dates (ignore time)
              const isSameDate =
                bookingDate.getDate() === selectedDateObj.getDate() &&
                bookingDate.getMonth() === selectedDateObj.getMonth() &&
                bookingDate.getFullYear() === selectedDateObj.getFullYear();

              // Compare time slots
              const isSameTime =
                booking.startTime === timeSlot.startTime &&
                booking.endTime === timeSlot.endTime &&
                booking.period === timeSlot.period;

              // Only mark as booked if date matches, time matches, and status is confirmed
              return isSameDate && isSameTime && booking.status === 'confirmed';
            } catch (e) {
              console.error('Error comparing booking date:', e);
              return false;
            }
          });

          // Only add available slots (not booked ones)
          if (!isBooked) {
            const slotKey = `${timeSlot.startTime}-${timeSlot.endTime}-${timeSlot.period || ''}`.toLowerCase();
            if (seenSlotKeys.has(slotKey)) {
              return;
            }
            seenSlotKeys.add(slotKey);

            slots.push({
              id: `slot-${slotKey}`,
              time: timeString,
              status: 'available',
              startTime: timeSlot.startTime, // Store original startTime for sorting
            });
          }
        });
      }
    } else {
      // Show only booked slots
      bookedSlots.forEach((booking) => {
        try {
          const bookingDate = new Date(booking.date);
          // Compare dates (ignore time)
          const isSameDate =
            bookingDate.getDate() === selectedDateObj.getDate() &&
            bookingDate.getMonth() === selectedDateObj.getMonth() &&
            bookingDate.getFullYear() === selectedDateObj.getFullYear();

          if (isSameDate && booking.status === 'confirmed') {
            // Format time to 12-hour format for display
            const timeString = `${formatTimeTo12Hour(booking.startTime)} - ${formatTimeTo12Hour(booking.endTime)}`;
            const slotKey = `${booking.startTime}-${booking.endTime}-${booking.period || ''}`.toLowerCase();
            if (seenSlotKeys.has(slotKey)) {
              return;
            }
            seenSlotKeys.add(slotKey);

            slots.push({
              id: `booked-${slotKey}`,
              time: timeString,
              status: 'booked',
              startTime: booking.startTime, // Store original startTime for sorting
            });
          }
        } catch (e) {
          console.error('Error processing booked slot:', e);
        }
      });
    }

    // Sort slots by startTime in increasing order (chronological)
    slots.sort((a, b) => {
      // Convert startTime (24-hour format, e.g., "09:00", "14:30") to minutes for comparison
      const parseTimeToMinutes = (timeStr: string | undefined): number => {
        if (!timeStr) return 0;
        try {
          const [hours, minutes] = timeStr.split(':').map(Number);
          return (hours || 0) * 60 + (minutes || 0);
        } catch (e) {
          return 0;
        }
      };

      const minutesA = parseTimeToMinutes(a.startTime);
      const minutesB = parseTimeToMinutes(b.startTime);
      return minutesA - minutesB; // Sort in increasing order
    });

    setTimeSlots(slots);
  }, [selectedDateObj, availableSlots, bookedSlots, slotFilter]);

  // Set first date as selected by default
  useEffect(() => {
    if (weekDates.length > 0 && !selectedDate) {
      const firstDate = weekDates[0];
      setSelectedDate(`${firstDate.day} ${firstDate.date}`);
      setSelectedDateObj(firstDate.dateObj);
    }
  }, [weekDates]);

  // Refresh both sections together; only successful API responses change visibility.
  // Fetch ongoing and upcoming bookings using React Query
  const { data: bookingsData, refetch: refreshBookings } = useQuery({
    queryKey: ['ongoingAndUpcomingBookings', userId],
    queryFn: async () => {
      if (!userId) return null;
      const fetchStatus = async (status: 'ongoing' | 'confirmed'): Promise<BookedSlot[]> => {
        const response = await fetch(
          `${API_BASE_URL_WITH_API}/stylist/bookings/${userId}?status=${status}&limit=5`,
          { headers: { Accept: 'application/json' } },
        );
        if (!response.ok) throw new Error(`Booking refresh failed: ${response.status}`);
        const result = await response.json();
        if (!result.success || !Array.isArray(result.data?.bookings)) {
          throw new Error('Invalid booking response');
        }
        return result.data.bookings.filter((booking: BookedSlot) => booking.status === status);
      };

      const [ongoing, upcoming] = await Promise.allSettled([
        fetchStatus('ongoing'),
        fetchStatus('confirmed'),
      ]);

      const fetchedOngoingBooking = ongoing.status === 'fulfilled' ? ongoing.value[0] || null : null;
      const fetchedUpcomingBookings = upcoming.status === 'fulfilled' ? upcoming.value.sort((a, b) =>
        (getBookingStartTimestamp(a) || 0) - (getBookingStartTimestamp(b) || 0),
      ) : [];

      return { ongoing: fetchedOngoingBooking, upcoming: fetchedUpcomingBookings };
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    enabled: !!userId,
  });

  // Sync React Query data to local state
  useEffect(() => {
    if (bookingsData) {
      setOngoingBooking(bookingsData.ongoing);
      setUpcomingBookings(bookingsData.upcoming);
      
      if (bookingsData.upcoming.length > 0) {
        void scheduleUpcomingBookingsNotifications(bookingsData.upcoming).catch(error => {
          console.warn('Unable to schedule booking reminders:', error);
        });
      }
    }
  }, [bookingsData]);

  // Subscribe to WebSocket updates and manual refreshes
  useEffect(() => {
    if (!userId) return;

    const handleRefresh = () => { refreshBookings(); };
    const unsubscribeRefresh = subscribeToBookingRefresh(handleRefresh);

    const unsubscribeSocket = subscribeToSocketBookingUpdates((payload: any) => {
      const { booking, action, bookingId } = payload;
      if (!booking) return;

      const targetId = booking.bookingId || bookingId;

      if (action === 'cancelled' || booking.status === 'completed' || booking.status === 'pending') {
        setOngoingBooking(current => (current?.bookingId === targetId ? null : current));
        setUpcomingBookings(current => current.filter(b => b.bookingId !== targetId));
        return;
      }

      if (booking.status === 'ongoing') {
        setOngoingBooking(booking);
        setUpcomingBookings(current => current.filter(b => b.bookingId !== targetId));
      } else if (booking.status === 'confirmed') {
        setUpcomingBookings(current => {
          const filtered = current.filter(b => b.bookingId !== targetId);
          return [booking, ...filtered];
        });
        setOngoingBooking(current => (current?.bookingId === targetId ? null : current));
      }
    });

    return () => {
      unsubscribeRefresh();
      unsubscribeSocket();
    };
  }, [userId, refreshBookings]);

  // Notification listeners are owned by App so they survive screen changes.

  // Cancel notification when booking becomes ongoing (service has started)
  useEffect(() => {
    if (ongoingBooking) {
      cancelBookingNotification(ongoingBooking.bookingId);
    }
  }, [ongoingBooking]);

  // Calculate and update time left for ongoing booking
  useEffect(() => {
    if (!ongoingBooking) {
      setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
      return;
    }

    const updateTimeLeft = () => {
      try {
        const now = new Date();
        const bookingDate = new Date(ongoingBooking.date);
        if (isNaN(bookingDate.getTime())) {
          console.error('Invalid booking date:', ongoingBooking.date);
          setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
          return;
        }

        // Extract date components in LOCAL timezone
        const localYear = bookingDate.getFullYear();
        const localMonth = bookingDate.getMonth();
        const localDay = bookingDate.getDate();

        // Backend stores time in 24-hour format (e.g., "14:00", "09:30")
        // Parse time strings safely
        const startTimeParts = ongoingBooking.startTime.split(':');
        const endTimeParts = ongoingBooking.endTime.split(':');

        if (startTimeParts.length < 2 || endTimeParts.length < 2) {
          console.error('Invalid time format:', { startTime: ongoingBooking.startTime, endTime: ongoingBooking.endTime });
          setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
          return;
        }

        const startHours = parseInt(startTimeParts[0], 10);
        const startMinutes = parseInt(startTimeParts[1], 10) || 0;
        const endHours = parseInt(endTimeParts[0], 10);
        const endMinutes = parseInt(endTimeParts[1], 10) || 0;

        // Validate parsed values
        if (isNaN(startHours) || isNaN(startMinutes) || isNaN(endHours) || isNaN(endMinutes)) {
          console.error('Invalid time values:', { startHours, startMinutes, endHours, endMinutes });
          setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
          return;
        }

        // Validate hour range (0-23) and minute range (0-59)
        if (startHours < 0 || startHours > 23 || startMinutes < 0 || startMinutes > 59 ||
          endHours < 0 || endHours > 23 || endMinutes < 0 || endMinutes > 59) {
          console.error('Time values out of range:', { startHours, startMinutes, endHours, endMinutes });
          setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
          return;
        }

        // Use 24-hour format directly (no AM/PM conversion needed)
        const startDateTime = new Date(localYear, localMonth, localDay, startHours, startMinutes, 0, 0);
        const endDateTime = new Date(localYear, localMonth, localDay, endHours, endMinutes, 0, 0);

        // If end time is before start time, it's next day
        if (endDateTime < startDateTime) {
          endDateTime.setDate(endDateTime.getDate() + 1);
        }

        const diff = endDateTime.getTime() - now.getTime();

        if (diff <= 0) {
          // Reaching the scheduled end does not complete the service.
          // Keep the card until the backend status changes after end OTP verification.
          setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
          return;
        }

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        setTimeLeft({ hours, minutes, seconds });
      } catch (error) {
        console.error('Error calculating time left:', error);
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
      }
    };

    // Update immediately
    updateTimeLeft();

    // Update every second
    const interval = setInterval(updateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [ongoingBooking]);

  // Reset selected slot when date or filter changes
  useEffect(() => {
    setSelectedSlotId(null);
  }, [selectedDateObj, slotFilter]);

  const handleToggleStatus = async (targetStatus: boolean) => {
    if (targetStatus === isOnline) return;
    
    if (!userId) {
      console.error('No userId available for updating online status');
      return;
    }

    const newStatus = targetStatus;

    try {
      // Optimistically update UI
      setIsOnline(newStatus);
      setShowStatusModal(true);

      const apiUrl = `${API_BASE_URL_WITH_API}/stylist/online-status/${userId}`;
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          isOnline: newStatus,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Update online status error:', errorText);
        // Revert on error
        setIsOnline(!newStatus);
        setShowStatusModal(false);
        Alert.alert('Error', 'Failed to update online status. Please try again.');
        return;
      }

      const result = await response.json();
      console.log('✅ Online status updated successfully:', result);

      if (result.success && result.data) {
        setIsOnline(result.data.isOnline);
        
        // Optimistically update the cache so we don't get a flash of old data when returning to this screen
        queryClient.setQueryData(['userProfile', userId], (oldData: any) => {
          return { ...(oldData || {}), isOnline: result.data.isOnline };
        });

        queryClient.invalidateQueries({ queryKey: ['userProfile', userId] });
      }
    } catch (error) {
      console.error('❌ Error updating online status:', error);
      // Revert on error
      setIsOnline(!newStatus);
      setShowStatusModal(false);
      Alert.alert('Error', 'Failed to update online status. Please try again.');
    }
  };

  // Helper function to show full user ID (used in modal)
  const formatUserId = (id: string | undefined | null): string => {
    if (!id || typeof id !== 'string') {
      return 'N/A';
    }

    return id.toString();
  };

  // Helper function to show short user ID (used on home page)
  const formatUserIdShort = (id: string | undefined | null): string => {
    if (!id || typeof id !== 'string') {
      return 'N/A';
    }

    const idString = id.toString();
    if (idString.length <= 16) {
      return idString;
    }

    return `${idString.substring(0, 12)}...`;
  };

  // Helper function to format date
  const formatDateShort = (dateInput: string | Date): string => {
    try {
      const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
      if (isNaN(date.getTime())) {
        console.warn('Invalid date:', dateInput);
        return 'N/A';
      }
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (error) {
      console.error('Error formatting date:', error, dateInput);
      return 'N/A';
    }
  };

  // Helper function to format time to 12-hour format
  const formatTimeTo12Hour = (time: string): string => {
    try {
      // Backend stores time in 24-hour format, convert to 12-hour format
      const [hours, minutes] = time.split(':');
      const hour24 = parseInt(hours, 10);
      const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
      const ampm = hour24 >= 12 ? 'PM' : 'AM';
      const minutesStr = minutes.toString().padStart(2, '0');
      return `${hour12}:${minutesStr} ${ampm}`;
    } catch (error) {
      console.error('Error formatting time:', error);
      return time;
    }
  };

  // Helper function to calculate duration
  const formatUpcomingDate = (dateInput: string | Date, startTime: string, period: string): string => {
    try {
      const dateKey = getBookingDateKey(dateInput);
      if (!dateKey) {
        return 'N/A';
      }

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const [, monthNumber, day] = dateKey.split('-').map(Number);
      const month = months[monthNumber - 1];

      // Backend stores time in 24-hour format, convert to 12-hour format
      const [hours, minutes] = startTime.split(':').map(Number);
      const hour24 = hours;
      const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
      const ampm = hour24 >= 12 ? 'PM' : 'AM';
      const minutesStr = minutes.toString().padStart(2, '0');
      const formattedTime = `${hour12}:${minutesStr} ${ampm}`;

      return `${day} ${month}, ${formattedTime}`;
    } catch (error) {
      console.error('Error formatting upcoming date:', error);
      return 'N/A';
    }
  };

  const calculateDuration = (startTime: string, endTime: string, period?: string): string => {
    try {
      // Backend stores time in 24-hour format (e.g., "14:00", "09:30")
      // Parse time strings safely
      const startTimeParts = startTime.split(':');
      const endTimeParts = endTime.split(':');

      if (startTimeParts.length < 2 || endTimeParts.length < 2) {
        console.error('Invalid time format for duration:', { startTime, endTime });
        return '0 Hr';
      }

      const startHours = parseInt(startTimeParts[0], 10);
      const startMinutes = parseInt(startTimeParts[1], 10) || 0;
      const endHours = parseInt(endTimeParts[0], 10);
      const endMinutes = parseInt(endTimeParts[1], 10) || 0;

      // Validate parsed values
      if (isNaN(startHours) || isNaN(startMinutes) || isNaN(endHours) || isNaN(endMinutes)) {
        console.error('Invalid time values for duration:', { startHours, startMinutes, endHours, endMinutes });
        return '0 Hr';
      }

      // Validate hour range (0-23) and minute range (0-59)
      if (startHours < 0 || startHours > 23 || startMinutes < 0 || startMinutes > 59 ||
        endHours < 0 || endHours > 23 || endMinutes < 0 || endMinutes > 59) {
        console.error('Time values out of range for duration:', { startHours, startMinutes, endHours, endMinutes });
        return '0 Hr';
      }

      // Calculate duration in minutes (24-hour format, no AM/PM conversion needed)
      let startTotalMinutes = startHours * 60 + startMinutes;
      let endTotalMinutes = endHours * 60 + endMinutes;

      // If end time is before start time, it's next day
      if (endTotalMinutes < startTotalMinutes) {
        endTotalMinutes += 24 * 60;
      }

      const totalMinutes = endTotalMinutes - startTotalMinutes;
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      if (hours > 0 && minutes > 0) {
        return `${hours} Hr ${minutes} Mins`;
      } else if (hours > 0) {
        return `${hours} Hr`;
      } else {
        return `${minutes} Mins`;
      }
    } catch (error) {
      console.error('Error calculating duration:', error);
      return '0 Hr';
    }
  };

  const openProfileDrawer = () => {
    if (profileDrawerAnimatingRef.current || showProfileModal) {
      return;
    }

    profileDrawerAnimatingRef.current = true;
    profileDrawerAnim.stopAnimation();
    profileDrawerAnim.setValue(profileDrawerHiddenX);
    setShowProfileModal(true);
    // Start animation on next frame after modal mounts
    requestAnimationFrame(() => {
      Animated.timing(profileDrawerAnim, {
        toValue: 0,
        duration: 210,
        useNativeDriver: true,
      }).start(() => {
        profileDrawerAnimatingRef.current = false;
      });
    });
  };

  const closeProfileDrawer = (onClosed?: () => void) => {
    if (profileDrawerAnimatingRef.current) {
      return;
    }

    profileDrawerAnimatingRef.current = true;
    profileDrawerAnim.stopAnimation();
    Animated.timing(profileDrawerAnim, {
      toValue: profileDrawerHiddenX,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      profileDrawerAnimatingRef.current = false;
      setShowProfileModal(false);
      profileDrawerAnim.setValue(profileDrawerHiddenX);
      onClosed?.();
    });
  };

  useEffect(() => {
    if (!openProfileDrawerOnMount) {
      return;
    }

    const timeoutId = setTimeout(() => {
      profileDrawerAnim.stopAnimation();
      profileDrawerAnim.setValue(profileDrawerHiddenX);
      setShowProfileModal(true);
      requestAnimationFrame(() => {
        profileDrawerScrollRef.current?.scrollTo({
          y: profileDrawerInitialScrollY,
          animated: false,
        });
        Animated.timing(profileDrawerAnim, {
          toValue: 0,
          duration: 210,
          useNativeDriver: true,
        }).start();
      });
      if (onProfileDrawerOpenedFromReturn) {
        onProfileDrawerOpenedFromReturn();
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [openProfileDrawerOnMount, onProfileDrawerOpenedFromReturn, profileDrawerAnim, profileDrawerHiddenX, profileDrawerInitialScrollY]);

  const handleLogout = () => {
    closeProfileDrawer(() => {
      modal.showConfirm(
        'Logout',
        'Are you sure you want to logout?',
        () => {
          if (onLogout) {
            onLogout();
          }
        },
        undefined,
        'Logout',
        'Cancel',
        true
      );
    });
  };

  const handleProfileDrawerMenuPress = (itemId: ProfileDrawerMenuItemId) => {
    const closeAndRun = (action: () => void) => {
      closeProfileDrawer(() => {
        if (onProfileDrawerNavigate) {
          onProfileDrawerNavigate();
        }
        action();
      });
    };

    switch (itemId) {
      case 'editProfile':
        if (onEditProfile) {
          closeAndRun(onEditProfile);
          return;
        }
        break;
      case 'currentBookings':
        if (onCurrentBooking) {
          closeAndRun(onCurrentBooking);
          return;
        }
        if (onNavigateToBookings) {
          closeAndRun(onNavigateToBookings);
          return;
        }
        break;
      case 'subscription':
        if (onSubscription) {
          closeAndRun(onSubscription);
          return;
        }
        break;
      case 'ads':
        if (onAds) {
          closeAndRun(onAds);
          return;
        }
        break;
      case 'services':
        if (onMyService) {
          closeAndRun(onMyService);
          return;
        }
        break;
      case 'specialService':
        if (onSpecialService) {
          closeAndRun(onSpecialService);
          return;
        }
        break;
      case 'slots':
        if (onMySlots) {
          closeAndRun(onMySlots);
          return;
        }
        break;
      case 'portfolio':
        if (onPortfolio) {
          closeAndRun(onPortfolio);
          return;
        }
        closeProfileDrawer(() => {
          Alert.alert('Unavailable', 'Portfolio page is not connected yet.');
        });
        return;
      case 'bankDetails':
        if (onPaymentDetails) {
          closeAndRun(onPaymentDetails);
          return;
        }
        closeProfileDrawer(() => {
          Alert.alert('Unavailable', 'Bank Details page is not connected yet.');
        });
        return;
      default:
        break;
    }

    closeProfileDrawer(() => {
      Alert.alert('Unavailable', 'This option is not connected yet.');
    });
  };

  // Handle confirm booking API call
  const confirmBookingAPI = async () => {
    // ✅ FIXED: Use refs to get latest values (not stale closure)
    const latestPendingBookings = pendingBookingsRef.current;
    const latestIndex = currentPendingIndexRef.current;

    console.log('🚀 confirmBookingAPI called', {
      pendingBookingsLength: latestPendingBookings.length,
      currentPendingIndex: latestIndex,
      statePendingBookingsLength: pendingBookings.length,
      stateCurrentPendingIndex: currentPendingIndex,
      userId,
    });

    if (latestPendingBookings.length === 0 || latestIndex >= latestPendingBookings.length) {
      console.error('⚠️ No pending bookings or invalid index:', {
        latestPendingBookingsLength: latestPendingBookings.length,
        latestIndex,
        statePendingBookingsLength: pendingBookings.length,
        stateCurrentPendingIndex: currentPendingIndex,
      });
      return;
    }

    const booking = latestPendingBookings[latestIndex];
    if (!booking || !booking.bookingId) {
      console.error('❌ Invalid booking data:', booking);
      return;
    }

    console.log('📋 Confirming booking:', {
      bookingId: booking.bookingId,
      userId: booking.userId,
      stylistId: userId,
      serviceName: booking.serviceName,
    });
    setUpdatingBooking(true);
    setBookingActionLoading('confirm');

    try {
      const apiUrl = `${API_BASE_URL_WITH_API}/booking/update-status`;
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          bookingId: booking.bookingId,
          userId: booking.userId,
          stylistId: userId, // Current user is the stylist
          status: 'confirmed',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Update booking status error:', errorText);
        throw new Error('Failed to confirm booking');
      }

      const result = await response.json();
      console.log('✅ Booking confirmed successfully:', result);

      // Remove confirmed booking from pending list
      const updatedPending = latestPendingBookings.filter(
        (b) => b.bookingId !== booking.bookingId
      );
      setPendingBookings(updatedPending);
      pendingBookingsRef.current = updatedPending; // ✅ FIXED: Update ref

      // Update bookedSlots state to reflect the change
      const updatedBookedSlots = bookedSlots.map((b) =>
        b.bookingId === booking.bookingId ? { ...b, status: 'confirmed' } : b
      );
      setBookedSlots(updatedBookedSlots);
      notifyBookingRefresh();

      // If there are more pending bookings, move to next, otherwise close modal
      if (updatedPending.length > 0) {
        // Adjust index if needed
        const newIndex = latestIndex >= updatedPending.length ? updatedPending.length - 1 : latestIndex;
        setCurrentPendingIndex(newIndex);
        currentPendingIndexRef.current = newIndex; // ✅ FIXED: Update ref
      } else {
        setShowPendingModal(false);
      }
    } catch (error) {
      console.error('❌ Error confirming booking:', error);
      // You can add an Alert here to show error message
    } finally {
      setUpdatingBooking(false);
      setBookingActionLoading(null);
    }
  };

  // ✅ FIXED: Sync refs with state whenever they change
  useEffect(() => {
    pendingBookingsRef.current = pendingBookings;
  }, [pendingBookings]);

  useEffect(() => {
    currentPendingIndexRef.current = currentPendingIndex;
  }, [currentPendingIndex]);

  // Reset slide animation when modal opens or booking changes
  useEffect(() => {
    if (showPendingModal && pendingBookings.length > 0) {
      // Stop any ongoing animation
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
      // Reset animation value
      slideAnim.setValue(0);
      hasTriggeredAPI.current = false;
      triggeredRef.current = false; // ✅ FIXED: Also reset triggeredRef
      currentSlideValue.current = 0;
      slideValueRef.current = 0;
      pendingBookingsRef.current = pendingBookings;
      currentPendingIndexRef.current = currentPendingIndex;
      console.log('Animation reset for new booking', {
        pendingBookingsLength: pendingBookings.length,
        currentPendingIndex,
        refPendingBookingsLength: pendingBookingsRef.current.length,
        refCurrentPendingIndex: currentPendingIndexRef.current,
      });
    }
  }, [showPendingModal, currentPendingIndex, pendingBookings.length]);

  // Fetch service images when pending bookings change
  useEffect(() => {
    const fetchServiceImages = async () => {
      if (pendingBookings.length === 0) return;

      try {
        const apiUrl = `${API_BASE_URL_WITH_API}/services/categories`;
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            const imageMap: Record<string, string> = {};
            result.data.forEach((service: any) => {
              const serviceName = service.name || service.serviceName;
              if (serviceName && service.image) {
                imageMap[serviceName] = toCloudFrontUrl(service.image);
              }
            });
            setServiceImages(imageMap);
            console.log('✅ Service images fetched:', imageMap);
          }
        }
      } catch (error) {
        console.error('Error fetching service images:', error);
      }
    };

    fetchServiceImages();
  }, [pendingBookings]);

  // Add listener to track animated value for swipe (REQUIRED for API trigger)
  useEffect(() => {
    const listenerId = slideAnim.addListener(({ value }) => {
      currentSlideValue.current = value;
    });

    return () => {
      slideAnim.removeListener(listenerId);
    };
  }, []);

  // ✅ FIXED: Also track in slideValueRef for consistency
  useEffect(() => {
    const id = slideAnim.addListener(({ value }) => {
      slideValueRef.current = value;
    });
    return () => slideAnim.removeListener(id);
  }, []);

  // ✅ FIXED: Also track in slideValueRef for consistency
  useEffect(() => {
    const id = slideAnim.addListener(({ value }) => {
      slideValueRef.current = value;
    });
    return () => slideAnim.removeListener(id);
  }, []);

  // Create PanResponder for swipe gesture - follows touch location
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        return !updatingBooking && !triggeredRef.current;
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Respond to horizontal movement
        return !updatingBooking && !triggeredRef.current && Math.abs(gestureState.dx) > 1;
      },
      onPanResponderGrant: (evt) => {
        // Set offset to current value when gesture starts
        slideAnim.setOffset(currentSlideValue.current);
        slideAnim.setValue(0);
        triggeredRef.current = false; // Reset trigger on new gesture
        hasTriggeredAPI.current = false; // Also reset the other ref for consistency
      },
      onPanResponderMove: (evt, gestureState) => {
        if (updatingBooking || triggeredRef.current) return;

        // ✅ FIXED: Use maxSlideRef.current (computed ONCE in onLayout)
        const dx = Math.max(0, gestureState.dx);
        const newValue = Math.min(dx, maxSlideRef.current);
        slideAnim.setValue(newValue);

        // Trigger API when the arrow crosses the configured swipe threshold.
        if (newValue >= triggerPointRef.current && !triggeredRef.current) {
          // ✅ FIXED: Use refs to get latest values (not stale closure)
          const latestPendingBookings = pendingBookingsRef.current;
          const latestIndex = currentPendingIndexRef.current;

          console.log('🔥 Arrow hit confirm threshold - FIRING API', {
            newValue: newValue.toFixed(2),
            triggerPoint: triggerPointRef.current.toFixed(2),
            pendingBookingsLength: latestPendingBookings.length,
            currentPendingIndex: latestIndex,
            statePendingBookingsLength: pendingBookings.length,
            stateCurrentPendingIndex: currentPendingIndex,
          });

          // Validate before triggering using refs (latest values)
          if (latestPendingBookings.length === 0 || latestIndex >= latestPendingBookings.length) {
            console.error('❌ Cannot trigger API - invalid state:', {
              latestPendingBookingsLength: latestPendingBookings.length,
              latestIndex,
              statePendingBookingsLength: pendingBookings.length,
              stateCurrentPendingIndex: currentPendingIndex,
            });
            return;
          }

          triggeredRef.current = true;
          hasTriggeredAPI.current = true;

          // Fire API immediately when crossing the threshold.
          confirmBookingAPI().catch((error) => {
            console.error('❌ Error in confirmBookingAPI:', error);
            triggeredRef.current = false;
            hasTriggeredAPI.current = false;
            slideAnim.setValue(0);
          });
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (updatingBooking) {
          slideAnim.flattenOffset();
          return;
        }

        // Flatten offset first to combine offset + value
        slideAnim.flattenOffset();

        // ✅ Use current value to determine final animation
        const current = slideValueRef.current;
        const threshold = triggerPointRef.current;

        console.log({
          current: current.toFixed(2),
          threshold: threshold.toFixed(2),
          maxSlide: maxSlideRef.current.toFixed(2),
          percent: maxSlideRef.current > 0 ? ((current / maxSlideRef.current) * 100).toFixed(1) : '0',
          apiAlreadyTriggered: triggeredRef.current,
        });

        // If API already triggered, complete animation.
        if (triggeredRef.current) {
          // Complete animation to end
          Animated.spring(slideAnim, {
            toValue: maxSlideRef.current,
            useNativeDriver: false,
            tension: 50,
            friction: 7,
          }).start();
        } else if (current >= threshold) {
          // If threshold was reached on release but API not triggered yet.
          triggeredRef.current = true;
          hasTriggeredAPI.current = true;

          Animated.spring(slideAnim, {
            toValue: maxSlideRef.current,
            useNativeDriver: false,
            tension: 50,
            friction: 7,
          }).start();

          console.log('🔥 API FIRING (on release)');
          confirmBookingAPI().catch((error) => {
            console.error('❌ Error in confirmBookingAPI:', error);
            triggeredRef.current = false;
            hasTriggeredAPI.current = false;
            slideAnim.setValue(0);
          });
        } else {
          // Snap back if the threshold was not reached.
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: false,
            tension: 50,
            friction: 7,
          }).start(() => {
            triggeredRef.current = false;
            hasTriggeredAPI.current = false;
          });
        }
      },
      onPanResponderTerminate: () => {
        console.log('❌ PanResponder terminated');
        slideAnim.flattenOffset();
        triggeredRef.current = false;
        hasTriggeredAPI.current = false;
      },
    })
  ).current;


  // Handle cancel booking
  const handleCancelBooking = async () => {
    if (pendingBookings.length === 0 || currentPendingIndex >= pendingBookings.length) {
      return;
    }

    const booking = pendingBookings[currentPendingIndex];
    setUpdatingBooking(true);
    setBookingActionLoading('cancel');

    try {
      // Step 1: Update booking status to cancelled
      console.log('📡 Step 1: Updating booking status to cancelled...');
      const statusApiUrl = `${API_BASE_URL_WITH_API}/bookings/${booking.bookingId}/cancel-status`;
      const statusResponse = await fetch(statusApiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          bookingId: booking.bookingId,
          userId: booking.userId,
          stylistId: userId, // Current user is the stylist
        }),
      });

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        console.error('❌ Update booking status error:', errorText);
        throw new Error('Failed to cancel booking');
      }

      const statusResult = await statusResponse.json();
      console.log('✅ Step 1: Booking status updated to cancelled successfully:', statusResult);

      // Step 2: Save cancellation data to Cancels collection
      console.log('📡 Step 2: Saving cancellation data to Cancels collection...');
      const cancellationReason = 'Styler declined the Booking request.';
      const cancelApiUrl = `${API_BASE_URL_WITH_API}/bookings/${booking.bookingId}/save-cancellation`;
      const cancelResponse = await fetch(cancelApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          userId: booking.userId,
          stylistId: userId, // Current user is the stylist
          reason: cancellationReason,
          cancelledBy: 'stylist', // Explicitly set since stylist is cancelling
        }),
      });

      if (!cancelResponse.ok) {
        const errorText = await cancelResponse.text();
        console.error('❌ Save cancellation data error:', errorText);
        // Don't throw error here - status is already updated, just log the error
        console.warn('⚠️ Warning: Booking status updated but cancellation data not saved');
      } else {
        const cancelResult = await cancelResponse.json();
        console.log('✅ Step 2: Cancellation data saved successfully:', cancelResult);
      }

      // Remove cancelled booking from pending list
      const updatedPending = pendingBookings.filter(
        (b) => b.bookingId !== booking.bookingId
      );
      setPendingBookings(updatedPending);

      // Update bookedSlots state to reflect the change
      const updatedBookedSlots = bookedSlots.map((b) =>
        b.bookingId === booking.bookingId ? { ...b, status: 'cancelled' } : b
      );
      setBookedSlots(updatedBookedSlots);

      // Cancel notification for this booking
      await cancelBookingNotification(booking.bookingId);

      // If there are more pending bookings, move to next, otherwise close modal
      if (updatedPending.length > 0) {
        // Adjust index if needed
        if (currentPendingIndex >= updatedPending.length) {
          setCurrentPendingIndex(updatedPending.length - 1);
        }
      } else {
        setShowPendingModal(false);
      }
    } catch (error) {
      console.error('❌ Error cancelling booking:', error);
      Alert.alert('Error', 'Failed to cancel booking. Please try again.');
    } finally {
      setUpdatingBooking(false);
      setBookingActionLoading(null);
    }
  };

  const goToPreviousPendingBooking = () => {
    if (currentPendingIndex > 0) {
      const newIndex = currentPendingIndex - 1;
      setCurrentPendingIndex(newIndex);
      currentPendingIndexRef.current = newIndex;
    }
  };

  const goToNextPendingBooking = () => {
    if (currentPendingIndex < pendingBookings.length - 1) {
      const newIndex = currentPendingIndex + 1;
      setCurrentPendingIndex(newIndex);
      currentPendingIndexRef.current = newIndex;
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.container}>
      <PopupCampaignModal appType="partner" />
      {/* Top Navigation Bar */}
      <View style={styles.topNav}>
        <TouchableOpacity
          style={[styles.topNavSide, styles.menuButton]}
          onPress={openProfileDrawer}
          activeOpacity={0.7}>
          <Icon name="menu" size={24} color="#333" />
        </TouchableOpacity>

        {/* Online/Offline Toggle */}
        <View style={[styles.toggleContainer, isSmallHomeScreen && styles.toggleContainerSmall]}>
          <TouchableOpacity
            style={[
              styles.toggleOption,
              isSmallHomeScreen && styles.toggleOptionSmall,
              !isOnline && styles.toggleOptionActive,
            ]}
            onPress={() => handleToggleStatus(false)}
            activeOpacity={0.7}>
            {!isOnline && (
              <LinearGradient
                colors={['#FD8B36', '#f7bb2c']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.toggleGradient}
              />
            )}
            <Text
              style={[
                styles.toggleText,
                isSmallHomeScreen && styles.toggleTextSmall,
                !isOnline && styles.toggleTextActive,
              ]}>
              Offline
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleOption,
              isSmallHomeScreen && styles.toggleOptionSmall,
              isOnline && styles.toggleOptionActive,
            ]}
            onPress={() => handleToggleStatus(true)}
            activeOpacity={0.7}>
            {isOnline && (
              <LinearGradient
                colors={['#FD8B36', '#f7bb2c']}
                start={{ x: 0.5, y: 0.5 }}
                end={{ x: 0.5, y: 0 }}
                style={styles.toggleGradient}
              />
            )}
            <Text
              style={[
                styles.toggleText,
                isSmallHomeScreen && styles.toggleTextSmall,
                isOnline && styles.toggleTextActive,
              ]}>
              Online
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.topNavSide}>
          <Image
            source={require('../assets/logo.png')}
            style={[
              styles.topNavLogo,
              isSmallHomeScreen && styles.topNavLogoSmall,
            ]}
            resizeMode="contain"
          />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        nestedScrollEnabled
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 100 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Profile Information Section */}
        {loading ? (
          <View style={styles.profileSection}>
            <Shimmer width={80} height={80} borderRadius={40} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Shimmer width="70%" height={20} borderRadius={4} style={{ marginBottom: 8 }} />
              <Shimmer width="50%" height={16} borderRadius={4} />
            </View>
            <View style={styles.ratingContainer}>
              <Shimmer width={60} height={24} borderRadius={4} />
            </View>
          </View>
        ) : (
          <View style={styles.profileSection}>
            <TouchableOpacity
              style={styles.profileImageContainer}
              onPress={() => {
                if (userProfile?.profileImage) {
                  setShowImageModal(true);
                }
              }}
              activeOpacity={userProfile?.profileImage ? 0.7 : 1}>
              {userProfile?.profileImage ? (
                <Image
                  source={{ uri: userProfile.profileImage }}
                  style={[
                    styles.profileImage,
                    isSmallHomeScreen && styles.profileImageSmall,
                  ]}
                  resizeMode="contain"
                />
              ) : (
                <View
                  style={[
                    styles.profileImagePlaceholder,
                    isSmallHomeScreen && styles.profileImageSmall,
                  ]}>
                  <Icon name="person" size={isSmallHomeScreen ? 32 : 40} color="#FD8B36" />
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {!userId ? 'Welcome Guest!' : (userProfile?.name || 'User Name')}
              </Text>
              {!!userId && (
                <Text style={styles.profileId}>
                  <Text>ID:</Text> #{formatUserIdShort(userProfile?._id)}
                </Text>
              )}
            </View>
            <View style={styles.ratingContainer}>
              <Icon name="star" size={20} color="#FD8B36" />
              <Text style={styles.ratingText}>
                {stylistRating > 0 ? (stylistRating === 5 ? '5' : stylistRating.toFixed(1)) : '0.0'}
              </Text>
            </View>
          </View>
        )}


        {/* Guest Banner */}
        {!userId && (
          <TouchableOpacity
            style={styles.guestBanner}
            onPress={onLogout}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#FD8B36', '#f7bb2c']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.guestBannerGradient}
            >
              <View style={styles.guestBannerContent}>
                <Icon name="person-add" size={24} color="#fff" />
                <View style={styles.guestBannerTextWrap}>
                  <Text style={styles.guestBannerTitle}>Complete Signup</Text>
                  <Text style={styles.guestBannerSubTitle}>Complete your profile to start getting service requests!</Text>
                </View>
                <Icon name="chevron-right" size={24} color="#fff" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Profile Completion Banner */}
        {showCompletionBanner && (
          <TouchableOpacity
            style={styles.guestBanner}
            onPress={onCompleteProfile}
            activeOpacity={0.8}
            disabled={isCompletingProfile}
          >
            <LinearGradient
              colors={['#FD8B36', '#f7bb2c']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.guestBannerGradient}
            >
              <View style={styles.guestBannerContent}>
                <View style={styles.guestBannerTextWrap}>
                  <Text style={styles.guestBannerTitle}>Complete Your Profile ({progressPercentage}%)</Text>
                  <Text style={styles.guestBannerSubTitle}>Complete your remaining profile details.</Text>
                  <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 3, marginTop: 8, width: '100%', overflow: 'hidden' }}>
                    <View style={{ height: '100%', backgroundColor: '#fff', width: `${progressPercentage}%`, borderRadius: 3 }} />
                  </View>
                </View>
                {isCompletingProfile ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Icon name="chevron-right" size={24} color="#fff" />
                )}
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <View style={styles.summaryCards}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Today's Glam Earnings</Text>
            {loadingTodayStats ? (
              <Shimmer width={80} height={24} borderRadius={4} />
            ) : (
              <Text style={styles.summaryCardValue}>₹{todayEarnings.toFixed(2)}</Text>
            )}
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Today's Glam Appointments</Text>
            {loadingTodayStats ? (
              <Shimmer width={40} height={24} borderRadius={4} />
            ) : (
              <Text style={styles.summaryCardValue}>{todayAppointments}</Text>
            )}
          </View>
        </View>



        {/* Weekly Time Slots Section */}
        <View style={styles.weeklySlotsSection}>
          <View style={styles.weeklySlotsHeader}>
            <Icons name="calendar-alt" size={20} color="#666" />
            <Text style={styles.weeklySlotsTitle}>This Week’s Glam Schedule</Text>
          </View>

          {/* Day Selection */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.dayScrollView}
            contentContainerStyle={styles.dayScrollContent}>
            {weekDates.map((date) => {
              const dateKey = `${date.day} ${date.date}`;
              const isSelected = selectedDate === dateKey;
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const isToday = date.dateObj.getTime() === today.getTime();

              return (
                <TouchableOpacity
                  key={date.key}
                  style={[
                    styles.dayButton,
                    isSelected && styles.dayButtonSelected,
                    isToday && !isSelected && styles.dayButtonToday,
                  ]}
                  onPress={() => {
                    setSelectedDate(dateKey);
                    setSelectedDateObj(date.dateObj);
                  }}
                  activeOpacity={0.7}>
                  <Text
                    style={[
                      styles.dayText,
                      isSelected && styles.dayTextSelected,
                      isToday && !isSelected && styles.dayTextToday,
                    ]}>
                    {date.day}
                  </Text>
                  <Text
                    style={[
                      styles.dateText,
                      isSelected && styles.dateTextSelected,
                      isToday && !isSelected && styles.dateTextToday,
                    ]}>
                    {date.date}
                  </Text>
                  {/* {isToday && (
                    <Text style={styles.todayLabel}>Today</Text>
                  )} */}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Available Slots Section */}
        <View style={styles.availableSlotsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {slotFilter === 'available' ? 'Available Glam Slots' : 'Booked Glam Slots'}
            </Text>
          </View>

          {/* Legend with Toggle Functionality */}
          <View style={styles.legend}>
            <TouchableOpacity
              style={styles.legendItem}
              onPress={() => setSlotFilter('available')}
              activeOpacity={0.7}>
              <View
                style={[
                  styles.legendAvailable,
                  slotFilter === 'available' && styles.legendBookedSelected
                ]}>
                {/* {slotFilter === 'available' && (
                  <View style={styles.legendAvailableInner} />
                )} */}
              </View>
              <Text
                style={[
                  styles.legendText,
                  slotFilter === 'available' && styles.legendTextSelected,
                ]}>
                Available
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.legendItem}
              onPress={() => setSlotFilter('booked')}
              activeOpacity={0.7}>
              <View
                style={[
                  styles.legendAvailable,
                  slotFilter === 'booked' && styles.legendBookedSelected,
                ]} />
              <Text
                style={[
                  styles.legendText,
                  slotFilter === 'booked' && styles.legendTextSelected,
                ]}>
                Booked
              </Text>
            </TouchableOpacity>
          </View>

          {/* Time Slots Grid */}
          {loadingSlots ? (
            <View style={styles.slotsShimmerContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.slotsScrollContainer}
                style={styles.slotsScrollView}>
                <View style={styles.slotsGridContainer}>
                  {Array.from({ length: 3 }).map((_, rowIndex) => (
                    <View key={`shimmer-row-${rowIndex}`} style={styles.slotRow}>
                      {Array.from({ length: 6 }).map((_, slotIndex) => (
                        <Shimmer
                          key={`shimmer-slot-${rowIndex}-${slotIndex}`}
                          width={80}
                          height={40}
                          borderRadius={8}
                          style={{ marginRight: 8, marginBottom: 8 }}
                        />
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          ) : timeSlots.length > 0 ? (
            (() => {
              // Group slots into exactly 3 rows
              const slotsPerRow = Math.ceil(timeSlots.length / 3);
              const rows: TimeSlot[][] = [];

              for (let i = 0; i < 3; i++) {
                const startIndex = i * slotsPerRow;
                const endIndex = Math.min(startIndex + slotsPerRow, timeSlots.length);
                rows.push(timeSlots.slice(startIndex, endIndex));
              }

              return (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.slotsScrollContainer}
                  style={styles.slotsScrollView}>
                  <View style={styles.slotsGridContainer}>
                    {rows.map((row, rowIndex) => (
                      <View key={rowIndex} style={styles.slotRow}>
                        {row.map((slot) => {
                          const isSelected = selectedSlotId === slot.id;
                          const isBooked = slot.status === 'booked';
                          const isAvailable = slotFilter === 'available' && !isBooked;

                          return (
                            <TouchableOpacity
                              key={slot.id}
                              style={[
                                styles.slotButton,
                                isSelected && isAvailable && styles.slotButtonSelected,
                                isBooked && styles.slotButtonBooked,
                              ]}
                              onPress={() => {
                                if (slotFilter === 'available' && !isBooked) {
                                  setSelectedSlotId(slot.id);
                                  console.log('Available slot selected:', slot.time);
                                  // TODO: Save selected slot to backend
                                }
                              }}
                              activeOpacity={0.7}
                              disabled={isBooked || slotFilter === 'booked'}>
                              <Text
                                style={[
                                  styles.slotText,
                                  isSelected && isAvailable && styles.slotTextSelected,
                                  isBooked && styles.slotTextBooked,
                                ]}>
                                {slot.time}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              );
            })()
          ) : (
            <View style={styles.noSlotsContainer}>
              <Text style={styles.noSlotsText}>
                {selectedDate ? 'No slots available for this date' : 'Select a date to view slots'}
              </Text>
            </View>
          )}
        </View>

        {/* Ongoing Booking Card - Show only when there's a valid ongoing booking */}
        {ongoingBooking && ongoingBooking.bookingId && (
          <View>
            <View style={styles.ongoingBookingCardHeader}>
              <Text style={styles.ongoingBookingCardHeaderText}>Glam in Progress</Text>
            </View>
            <View style={styles.ongoingBookingCard}>

              {/* Booking Header */}
              <View style={styles.ongoingBookingHeader}>
                <View style={styles.ongoingBookingLeft}>
                  <View style={styles.ongoingProfileIcon}>
                    <Image
                      source={{
                        uri: getServiceImageForBooking(ongoingBooking),
                      }}
                      style={styles.ongoingServiceImage}
                      resizeMode="cover"
                    />
                  </View>
                  <View style={styles.ongoingBookingInfo}>
                    <Text style={styles.ongoingServiceName}>{ongoingBooking.serviceName}</Text>
                    <Text style={styles.ongoingDuration}>
                      Time Duration: {calculateDuration(ongoingBooking.startTime, ongoingBooking.endTime, ongoingBooking.period)}
                    </Text>
                  </View>
                </View>
                <View style={styles.ongoingBookingRight}>
                  <View style={styles.liveIndicator}>
                    <Icon name="fiber-manual-record" size={8} color="#4CAF50" />
                    <Text style={styles.liveText}>LIVE</Text>
                  </View>
                  <View style={styles.serviceTypeTag}>
                    <Text style={styles.serviceTypeText}>
                      {ongoingBooking.serviceType === 'Home' ? 'Home' : ongoingBooking.serviceType === 'Salon' ? 'Salon' : 'Both'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Divider */}
              <View style={styles.ongoingDivider} />

              {/* Address Section */}
              {Boolean(ongoingBooking.salonLocation?.address || ongoingBooking.homeLocation?.address) && (
                <View style={styles.ongoingAddressSection}>
                  <Icon name="place" size={16} color="#666" />
                  <Text style={styles.ongoingAddressText} numberOfLines={2}>
                    {ongoingBooking.serviceType === 'Home' && ongoingBooking.homeLocation?.address
                      ? ongoingBooking.homeLocation.address
                      : ongoingBooking.serviceType === 'Salon' && ongoingBooking.salonLocation?.address
                        ? ongoingBooking.salonLocation.address
                        : ongoingBooking.homeLocation?.address || ongoingBooking.salonLocation?.address || 'Address not available'}
                  </Text>
                </View>
              )}

              {/* Divider */}
              <View style={styles.ongoingDivider} />

              {/* Time Left Countdown */}
              <View style={styles.timeLeftSection}>
                <Text style={styles.timeLeftLabel}>Time Left</Text>
                <View style={styles.countdownContainer}>
                  <View style={styles.countdownBox}>
                    <Text style={styles.countdownNumber}>
                      {timeLeft.hours.toString().padStart(2, '0')}
                    </Text>
                    <Text style={styles.countdownLabel}>Hours</Text>
                  </View>
                  <View style={styles.countdownBox}>
                    <Text style={styles.countdownNumber}>
                      {timeLeft.minutes.toString().padStart(2, '0')}
                    </Text>
                    <Text style={styles.countdownLabel}>Minutes</Text>
                  </View>
                  <View style={styles.countdownBox}>
                    <Text style={styles.countdownNumber}>
                      {timeLeft.seconds.toString().padStart(2, '0')}
                    </Text>
                    <Text style={styles.countdownLabel}>Seconds</Text>
                  </View>
                </View>
              </View>

              {/* Divider */}
              <View style={styles.ongoingDivider} />

              {/* Price Section */}
              <View style={styles.ongoingPriceSection}>
                <Icon name="account-balance-wallet" size={20} color="#FD8B36" />
                <Text style={styles.ongoingPrice}>₹{ongoingBooking.price}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Upcoming Bookings Section */}
        {upcomingBookings.length > 0 && (
          <View style={styles.upcomingBookingsSection}>
            {/* Header */}
            <View style={styles.upcomingBookingsHeader}>
              <Text style={styles.upcomingBookingsTitle}>Upcoming Bookings</Text>
              <TouchableOpacity
                style={styles.viewAllButton}
                onPress={() => {
                  if (onNavigateToBookings) {
                    onNavigateToBookings();
                  }
                }}
                activeOpacity={0.7}>
                <Text style={styles.viewAllText}>View All</Text>
                <Icon name="chevron-right" size={20} color="#FD8B36" />
              </TouchableOpacity>
            </View>

            {/* Horizontal Scrollable Cards */}
            <FlatList
              horizontal
              data={upcomingBookingCards}
              extraData={bookingNow}
              initialNumToRender={2}
              maxToRenderPerBatch={2}
              windowSize={3}
              removeClippedSubviews
              keyExtractor={(item, index) =>
                `${item.bookingId}-${item.date}-${item.startTime}-${index}`
              }
              showsHorizontalScrollIndicator={false}
              style={styles.upcomingBookingsScroll}
              contentContainerStyle={styles.upcomingBookingsScrollContent}
              decelerationRate="fast"
              snapToInterval={upcomingBookingSnapInterval}
              snapToAlignment="start"
              disableIntervalMomentum
              onMomentumScrollEnd={(event) => {
                const index = Math.round(event.nativeEvent.contentOffset.x / upcomingBookingSnapInterval);
                setUpcomingBookingsScrollIndex(index);
              }}
              getItemLayout={(_, index) => ({
                length: upcomingBookingSnapInterval,
                offset: upcomingBookingSnapInterval * index,
                index,
              })}
              renderItem={({ item: booking }) => {
                const locationContent = booking.isHomeService ? (
                  <View style={styles.upcomingLocationsSection}>
                    {/* FROM: Stylist's salon/base location */}
                    <View style={styles.upcomingLocationItem}>
                      <View style={styles.upcomingLocationDotContainer}>
                        <View style={styles.upcomingLocationStartDot}>
                          <View style={styles.upcomingLocationStartDotInner} />
                        </View>
                        {booking.hasHomeLocation && <View style={styles.upcomingLocationLine} />}
                      </View>
                      <View style={styles.upcomingLocationTextContainer}>
                        <Text style={styles.upcomingLocationLabel}>From (Your Location)</Text>
                        <Text style={styles.upcomingLocationText} numberOfLines={2}>
                          {booking.hasSalonLocation && booking.salonAddress
                            ? booking.salonAddress
                            : 'Your salon location'}
                        </Text>
                      </View>
                    </View>

                    {/* TO: Client's home location */}
                    <View style={styles.upcomingLocationItem}>
                      <View style={styles.upcomingLocationDotContainer}>
                        <Icon name="place" size={20} color="#FD8B36" />
                      </View>
                      <View style={styles.upcomingLocationTextContainer}>
                        <Text style={styles.upcomingLocationLabel}>To (Client's Home)</Text>
                        <Text style={styles.upcomingLocationText} numberOfLines={2}>
                          {booking.hasHomeLocation && booking.homeAddress
                            ? booking.homeAddress
                            : 'Client address not shared yet'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : booking.isSalonService ? (
                  <View style={styles.upcomingLocationsSection}>
                    {/* FROM: Client's location */}
                    <View style={styles.upcomingLocationItem}>
                      <View style={styles.upcomingLocationDotContainer}>
                        <View style={styles.upcomingLocationStartDot}>
                          <View style={styles.upcomingLocationStartDotInner} />
                        </View>
                        <View style={styles.upcomingLocationLine} />
                      </View>
                      <View style={styles.upcomingLocationTextContainer}>
                        <Text style={styles.upcomingLocationLabel}>From (Client Location)</Text>
                        <Text style={styles.upcomingLocationTextPlaceholder} numberOfLines={2}>
                          Client will travel to you
                        </Text>
                      </View>
                    </View>

                    {/* TO: Stylist's salon */}
                    <View style={styles.upcomingLocationItem}>
                      <View style={styles.upcomingLocationDotContainer}>
                        <Icon name="store" size={20} color="#FD8B36" />
                      </View>
                      <View style={styles.upcomingLocationTextContainer}>
                        <Text style={styles.upcomingLocationLabel}>To (Your Salon)</Text>
                        {booking.hasSalonLocation && booking.salonAddress ? (
                          <Text style={styles.upcomingLocationText} numberOfLines={2}>
                            {booking.salonAddress}
                          </Text>
                        ) : (
                          <Text style={styles.upcomingLocationTextPlaceholder} numberOfLines={2}>
                            Salon location will be shared soon
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                ) : null;

                return (
                  <View style={[styles.upcomingBookingCard, { width: upcomingBookingCardWidth }]}>
                    {/* Header Gradient Band */}
                    <LinearGradient
                      colors={['#FD8B36', '#f7bb2c']}
                      start={{ x: 1, y: 1 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.upcomingCardHeader}>
                      <View style={styles.upcomingCardHeaderLeft}>
                        <View style={styles.upcomingProfileIcon}>
                          <Image
                            source={{ uri: getServiceImageForBooking(booking) }}
                            style={styles.upcomingServiceImage}
                            resizeMode="cover"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.upcomingServiceName} numberOfLines={1}>{booking.serviceName}</Text>
                          <View style={styles.upcomingServiceTypePill}>
                            <Icon name={booking.isHomeService ? 'home' : 'store'} size={11} color="#FD8B36" />
                            <Text style={styles.upcomingServiceTypePillText}>{booking.displayServiceType} Service</Text>
                          </View>
                        </View>
                      </View>
                      <Text style={styles.upcomingCardPrice}>₹{booking.price}</Text>
                    </LinearGradient>

                    {/* Body */}
                    <View style={styles.upcomingCardBody}>
                      {/* Date & Time Row */}
                      <View style={styles.upcomingMetaRow}>
                        <View style={styles.upcomingMetaItem}>
                          <Icon name="access-time" size={14} color="#FD8B36" />
                          <Text style={styles.upcomingMetaText}>
                            {calculateDuration(booking.startTime, booking.endTime, booking.period)}
                          </Text>
                        </View>
                        <View style={styles.upcomingMetaSeparator} />
                        <View style={styles.upcomingMetaItem}>
                          <Icon name="event" size={14} color="#FD8B36" />
                          <Text style={styles.upcomingMetaText}>
                            {formatUpcomingDate(booking.date, booking.startTime, booking.period)}
                          </Text>
                        </View>
                      </View>

                      {/* Divider */}
                      <View style={styles.upcomingDivider} />

                      {/* Locations */}
                      {locationContent}

                      {/* Start Now Button */}
                      {canStartBooking(booking, bookingNow) && (
                        <TouchableOpacity
                          style={styles.upcomingStartButton}
                          onPress={() => {
                            if (canStartBooking(booking)) {
                              onShowOTP?.('start', booking);
                            }
                          }}
                        >
                          <Icon name="play-arrow" size={18} color="#fff" />
                          <Text style={styles.upcomingStartButtonText}>Start Now</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              }}
            />

            {/* Pagination Dots */}
            {upcomingBookings.length > 1 && (
              <View style={styles.upcomingPaginationDots}>
                {upcomingBookings.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.upcomingPaginationDot,
                      index === upcomingBookingsScrollIndex && styles.upcomingPaginationDotActive,
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        )}


        {/* Service Statistics Chart */}
        <View style={styles.chartContainer}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Your Glam Statistics</Text>
            <TouchableOpacity
              style={styles.periodDropdownButton}
              onPress={() => setShowPeriodDropdown(true)}
              activeOpacity={0.7}>
              <Text style={styles.periodDropdownText}>
                {serviceStatsPeriod === 'weekly' ? 'Weekly' : serviceStatsPeriod === 'monthly' ? 'Monthly' : 'Yearly'}
              </Text>
              <Icon name="arrow-drop-down" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {loadingServiceStats ? (
            <View style={styles.chartLoadingContainer}>
              <Shimmer width="100%" height={200} borderRadius={12} />
            </View>
          ) : (chartViewType === 'services' ? serviceStats : earningsStats).length > 0 ? (
            <View style={styles.chartContent}>
              <ServiceChart data={chartViewType === 'services' ? serviceStats : earningsStats} />
            </View>
          ) : (
            <View style={styles.chartEmptyContainer}>
              <Icon name="bar-chart" size={48} color="#E0E0E0" />
              <Text style={styles.chartEmptyText}>No data available</Text>
            </View>
          )}

          {/* Toggle for Services/Earnings - At bottom */}
          <View style={styles.chartToggleContainer}>
            <TouchableOpacity
              style={styles.chartRadioOption}
              onPress={() => setChartViewType('services')}
              activeOpacity={0.7}>
              <View style={[
                styles.chartRadioButton,
                chartViewType === 'services' && styles.chartRadioButtonSelected,
              ]}>
                {chartViewType === 'services' && <View style={styles.chartRadioButtonInner} />}
              </View>
              <Text style={styles.chartRadioLabel}>Services</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.chartRadioOption}
              onPress={() => setChartViewType('earnings')}
              activeOpacity={0.7}>
              <View style={[
                styles.chartRadioButton,
                chartViewType === 'earnings' && styles.chartRadioButtonSelected,
              ]}>
                {chartViewType === 'earnings' && <View style={styles.chartRadioButtonInner} />}
              </View>
              <Text style={styles.chartRadioLabel}>Earnings</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>

      {/* One-time Subscription Prompt Modal */}
      <Modal
        visible={showSubscriptionPlanModal && !pauseHomePopup}
        onPresent={presentSubscriptionPrompt}
        transparent={true}
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => closeSubscriptionPromptModal()}>
        <View
          style={[
            styles.subscriptionPromptOverlay,
            { paddingBottom: subscriptionPromptBottomInset },
          ]}>
          <TouchableOpacity
            style={styles.subscriptionBackdropPress}
            activeOpacity={1}
            onPress={() => closeSubscriptionPromptModal()}
          />
          <Animated.View
            style={[
              styles.subscriptionPromptCard,
              {
                transform: [{ translateY: subscriptionPromptSlideAnim }],
              },
            ]}>
            <View style={styles.subscriptionPromptIconWrap}>
              <Icon name="workspace-premium" size={28} color="#FD8B36" />
            </View>
            <Text style={styles.subscriptionPromptTitle}>Upgrade Your Plan</Text>
            <Text style={styles.subscriptionPromptSubtitle}>
              Boost your visibility and get more bookings with a premium subscription.
            </Text>
            <View style={styles.subscriptionInfoCard}>
              <View style={styles.subscriptionInfoRow}>
                <Text style={styles.subscriptionInfoLabel}>Current Plan</Text>
                <Text style={styles.subscriptionInfoValue}>
                  {currentSubscriptionInfo?.planName || 'Free Plan'}
                </Text>
              </View>
              <View style={styles.subscriptionInfoRow}>
                <Text style={styles.subscriptionInfoLabel}>Plan Code</Text>
                <Text style={styles.subscriptionInfoValue}>
                  {currentSubscriptionInfo?.planCode || 'FREE'}
                </Text>
              </View>
              <View style={styles.subscriptionInfoRow}>
                <Text style={styles.subscriptionInfoLabel}>Status</Text>
                <Text style={styles.subscriptionInfoValue}>
                  {currentSubscriptionInfo?.status || 'inactive'}
                </Text>
              </View>
              {!isFreemiumPlan && (
                <>
                  <View style={styles.subscriptionInfoRow}>
                    <Text style={styles.subscriptionInfoLabel}>Valid Till</Text>
                    <Text style={styles.subscriptionInfoValue}>
                      {currentSubscriptionInfo?.endDate ? formatDateShort(currentSubscriptionInfo.endDate) : 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.subscriptionInfoRow}>
                    <Text style={styles.subscriptionInfoLabel}>Duration</Text>
                    <Text style={styles.subscriptionInfoHighlight}>{planDaysRemainingText}</Text>
                  </View>
                </>
              )}
              <View style={styles.subscriptionInfoRowLast}>
                <Text style={styles.subscriptionInfoLabel}>Plan Amount</Text>
                <Text style={styles.subscriptionInfoValue}>
                  ₹{Number(currentSubscriptionInfo?.amount || 0).toFixed(2)}
                </Text>
              </View>
            </View>
            <View style={styles.subscriptionPromptActions}>
              <TouchableOpacity
                style={styles.subscriptionPromptLaterBtn}
                activeOpacity={0.8}
                onPress={async () => {
                  await markSubscriptionPromptAction();
                  closeSubscriptionPromptModal();
                }}>
                <Text style={styles.subscriptionPromptLaterText}>Later</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.subscriptionPromptPrimaryBtn}
                activeOpacity={0.8}
                onPress={async () => {
                  await markSubscriptionPromptAction();
                  closeSubscriptionPromptModal(() => {
                    if (onSubscription) {
                      onSubscription();
                    } else {
                      Alert.alert('Unavailable', 'Subscription page is not connected yet.');
                    }
                  });
                }}>
                <Text style={styles.subscriptionPromptPrimaryText}>View Plans</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Pending Bookings Modal */}
      <Modal
        visible={enablePendingBookingModal && showPendingModal}
        transparent={true}
        animationType="slide"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setShowPendingModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.swipeIndicator} />
            {/* Modal Header */}
            <View style={styles.modalHeader}>

              <TouchableOpacity
                onPress={() => setShowPendingModal(false)}
                style={styles.modalCloseButton}
                activeOpacity={0.7}>
                <View style={styles.closeButtonCircle}>
                  <Icon name="close" size={20} color="#333" />
                </View>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Upcoming Glam Sessions</Text>
              <TouchableOpacity
                style={styles.grabNowButton}
                activeOpacity={0.7}>
                <Icon name="flash-on" size={18} color="#fff" />
                <Text style={styles.grabNowText}>Grab now</Text>
              </TouchableOpacity>
            </View>

            {/* Swipe Indicator */}


            {/* Booking Counter */}
            {pendingBookings.length > 1 && (
              <View style={styles.bookingPagerRow}>
                <TouchableOpacity
                  style={[
                    styles.bookingPagerButton,
                    currentPendingIndex === 0 && styles.bookingPagerButtonDisabled,
                  ]}
                  onPress={goToPreviousPendingBooking}
                  disabled={currentPendingIndex === 0}
                  activeOpacity={0.7}>
                  <Icon
                    name="chevron-left"
                    size={22}
                    color={currentPendingIndex === 0 ? '#BFBFBF' : '#FD8B36'}
                  />
                </TouchableOpacity>

                <View style={styles.bookingCounter}>
                  <Text style={styles.bookingCounterText}>
                    {currentPendingIndex + 1} of {pendingBookings.length}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.bookingPagerButton,
                    currentPendingIndex === pendingBookings.length - 1 && styles.bookingPagerButtonDisabled,
                  ]}
                  onPress={goToNextPendingBooking}
                  disabled={currentPendingIndex === pendingBookings.length - 1}
                  activeOpacity={0.7}>
                  <Icon
                    name="chevron-right"
                    size={22}
                    color={currentPendingIndex === pendingBookings.length - 1 ? '#BFBFBF' : '#FD8B36'}
                  />
                </TouchableOpacity>
              </View>
            )}

            {/* Single Pending Booking Display */}
            {(() => {
              // Get current booking
              const currentBooking = pendingBookings.length > 0 && currentPendingIndex < pendingBookings.length
                ? pendingBookings[currentPendingIndex]
                : null;

              if (!currentBooking) {
                return (
                  <View style={styles.noPendingContainer}>
                    <Text style={styles.noPendingText}>No booking data available</Text>
                    <Text style={[styles.noPendingText, { fontSize: 12, marginTop: 8 }]}>
                      Total: {pendingBookings.length}, Index: {currentPendingIndex}
                    </Text>
                  </View>
                );
              }

              // Extract booking data with fallbacks
              const serviceName = currentBooking.serviceName || 'Service Name';
              const userName = currentBooking.userName || 'Unknown User';
              const date = currentBooking.date ? formatDateShort(currentBooking.date) : 'Date N/A';
              const startTime = currentBooking.startTime || 'N/A';
              const endTime = currentBooking.endTime || 'N/A';
              const period = currentBooking.period || '';
              const price = Number(currentBooking.price || 0);
              const gstAmount = +(price * 0.05).toFixed(2);
              const totalPriceWithGst = +(price + gstAmount).toFixed(2);
              const duration = currentBooking.startTime && currentBooking.endTime && currentBooking.period
                ? calculateDuration(currentBooking.startTime, currentBooking.endTime, currentBooking.period)
                : 'Duration N/A';
              const rawServiceType = (currentBooking.serviceType || 'Salon').toString();
              const normalizedServiceType = rawServiceType.trim().toLowerCase();
              const isHomeService =
                normalizedServiceType === 'home' ||
                normalizedServiceType === 'at home' ||
                normalizedServiceType === 'both';
              const displayServiceType =
                normalizedServiceType === 'home' || normalizedServiceType === 'at home'
                  ? 'Home'
                  : normalizedServiceType === 'salon'
                    ? 'Salon'
                    : 'Both';
              const gender = currentBooking.gender || 'N/A';
              const customerAddress =
                currentBooking.homeLocation?.address?.trim() ||
                (typeof (currentBooking as any).homeLocation === 'string'
                  ? (currentBooking as any).homeLocation.trim()
                  : '') ||
                (typeof (currentBooking as any).address === 'string'
                  ? (currentBooking as any).address.trim()
                  : '') ||
                null;

              return (
                <ScrollView
                  style={styles.pendingBookingContainer}
                  contentContainerStyle={styles.pendingBookingContent}
                  showsVerticalScrollIndicator={false}>
                  <View style={styles.pendingBookingCard}>
                    {/* Service Information */}
                    <View style={styles.bookingInfoCard}>
                      <View style={styles.bookingInfoHeader}>
                        {(() => {
                          const serviceImage = getServiceImageForBooking(currentBooking, serviceImages[serviceName] || '');
                          return serviceImage ? (
                            <Image
                              source={{ uri: serviceImage }}
                              style={styles.serviceImageIcon}
                              resizeMode="cover"
                              onError={() => {
                                console.log('Service image load error for:', serviceName);
                              }}
                            />
                          ) : (
                            <View style={styles.serviceImagePlaceholder}>
                              <Icon name="spa" size={20} color="#FF4444" />
                            </View>
                          );
                        })()}
                        <View style={styles.bookingInfoHeaderText}>
                          <Text style={styles.bookingServiceName}>
                            {serviceName}
                          </Text>
                          <View style={styles.bookingMetaRow}>
                            <Text style={styles.bookingMetaText}>
                              {date}
                            </Text>
                            <View style={styles.bookingMetaDivider} />
                            <Text style={styles.bookingMetaText}>
                              {duration}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <Text style={styles.bookingAddress}>
                        Customer: {userName}
                      </Text>

                      {/* Service Type and Gender */}
                      <View style={styles.bookingTagsRow}>
                        <View style={styles.bookingTag}>
                          <Text style={styles.bookingTagText}>
                            {displayServiceType}
                          </Text>
                        </View>
                        <View style={styles.bookingTag}>
                          <Text style={styles.bookingTagText}>
                            {gender === 'Male' ? 'Male' : gender === 'Female' ? 'Female' : gender}
                          </Text>
                        </View>
                      </View>

                      {/* Show customer address for Home/Both services */}
                      {isHomeService && (
                        <View style={styles.bookingLocationRow}>
                          <Icon name="place" size={16} color="#FD8B36" />
                          <Text style={styles.bookingLocationText} numberOfLines={2}>
                            {customerAddress
                              ? `Customer Address: ${customerAddress}`
                              : 'Customer Address: Address not available'}
                          </Text>
                        </View>
                      )}

                      <Text style={styles.bookingTime}>
                        {formatTimeTo12Hour(startTime)} - {formatTimeTo12Hour(endTime)}
                      </Text>
                    </View>

                    {/* Earnings Card */}
                    <View style={styles.earningsCard}>
                      <View style={styles.earningsLeft}>
                        <Text style={styles.earningsAmount}>
                          ₹ {totalPriceWithGst.toFixed(2)}
                        </Text>
                        <Text style={styles.priceWithGstSubtext}>
                          ₹{price.toFixed(2)} + ₹{gstAmount.toFixed(2)} (5% GST)
                        </Text>
                      </View>
                      <View style={styles.earningsRight}>
                        <Text style={styles.totalPriceBadge}>Total with GST</Text>
                        <Text style={styles.earningsLabel}>Est. Earnings: ₹{price.toFixed(2)}</Text>
                      </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.bookingActions}>
                      <Animated.View
                        style={[styles.confirmButtonContainer, updatingBooking && styles.buttonDisabled]}
                        onLayout={(event) => {
                          const width = event.nativeEvent.layout.width;
                          slideWidth.current = width;

                          // ✅ FIXED: Compute maxSlide ONCE when button is measured
                          const ARROW_WIDTH = 56; // must match UI
                          const PADDING = 8;
                          maxSlideRef.current = width - ARROW_WIDTH - (PADDING * 2);
                          triggerPointRef.current = maxSlideRef.current * CONFIRM_SWIPE_TRIGGER_RATIO;
                        }}
                        {...(!updatingBooking ? panResponder.panHandlers : {})}>
                        {updatingBooking && bookingActionLoading === 'confirm' ? (
                          <LinearGradient
                            colors={['#FD8B36', '#f7bb2c']}
                            start={{ x: 0.5, y: 0.5 }}
                            end={{ x: 0.5, y: 0 }}
                            style={styles.confirmButton}>
                            <ActivityIndicator size="small" color="#fff" />
                          </LinearGradient>
                        ) : (

                          <View style={{ flex: 1 }}>
                            <LinearGradient
                              colors={['#FD8B36', '#f7bb2c']}
                              start={{ x: 0.5, y: 0.5 }}
                              end={{ x: 0.5, y: 0 }}
                              style={styles.confirmButton}
                            >
                              <TouchableOpacity
                                activeOpacity={0.8}
                                style={styles.confirmButtonInner}
                              >
                                <Text style={styles.confirmButtonText}>Confirm</Text>
                              </TouchableOpacity>
                            </LinearGradient>

                            <Animated.View
                              style={[
                                styles.slideArrowContainer,
                                {
                                  transform: [{ translateX: slideAnim }],
                                },
                              ]}>
                              <View style={styles.slideArrow}>
                                <Icon name="arrow-forward" size={20} color="#fff" />
                              </View>
                            </Animated.View>

                            <Animated.View
                              style={[
                                styles.slideProgressBar,
                                {
                                  width: slideAnim.interpolate({
                                    inputRange: [0, Math.max((slideWidth.current || 200) - 56, 100)],
                                    outputRange: ['0%', '100%'],
                                    extrapolate: 'clamp',
                                  }),
                                },
                              ]}
                            />
                          </View>

                        )}
                      </Animated.View>
                      <TouchableOpacity
                        style={[styles.cancelButton, updatingBooking && styles.buttonDisabled]}
                        onPress={handleCancelBooking}
                        disabled={updatingBooking}
                        activeOpacity={0.7}>
                        {updatingBooking && bookingActionLoading === 'cancel' ? (
                          <ActivityIndicator size="small" color="#666" />
                        ) : (
                          <Text style={styles.cancelButtonText}>Cancel</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </ScrollView>
              );
            })()}

            {/* Navigation Buttons */}
            {pendingBookings.length > 1 && pendingBookings[currentPendingIndex] && (
              <View style={styles.navigationButtons}>
                <TouchableOpacity
                  style={[
                    styles.navButton,
                    currentPendingIndex === 0 && styles.navButtonDisabled,
                  ]}
                  onPress={() => {
                    goToPreviousPendingBooking();
                  }}
                  disabled={currentPendingIndex === 0}
                  activeOpacity={0.7}>
                  <Icon
                    name="chevron-left"
                    size={24}
                    color={currentPendingIndex === 0 ? '#ccc' : '#FD8B36'}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.navButton,
                    currentPendingIndex === pendingBookings.length - 1 && styles.navButtonDisabled,
                  ]}
                  onPress={() => {
                    goToNextPendingBooking();
                  }}
                  disabled={currentPendingIndex === pendingBookings.length - 1}
                  activeOpacity={0.7}>
                  <Icon
                    name="chevron-right"
                    size={24}
                    color={currentPendingIndex === pendingBookings.length - 1 ? '#ccc' : '#FD8B36'}
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Full Profile Modal */}
      <Modal
        visible={showProfileModal}
        transparent={true}
        animationType="none"
        hardwareAccelerated
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => closeProfileDrawer()}>
        <View style={styles.profileDrawerOverlay}>
          <TouchableOpacity
            style={styles.profileDrawerBackdrop}
            activeOpacity={1}
            onPress={() => closeProfileDrawer()}
          />
          <Animated.View
            renderToHardwareTextureAndroid
            shouldRasterizeIOS
            style={[
              styles.profileDrawerCard,
              isSmallHomeScreen && styles.profileDrawerCardSmall,
              {
                top: profileDrawerTopInset,
                paddingBottom: 18 + profileDrawerBottomInset,
              },
              { transform: [{ translateX: profileDrawerAnim }] },
            ]}>
            <View style={styles.profileDrawerHeader}>
              <TouchableOpacity
                style={styles.profileDrawerEditButton}
                onPress={() => {
                  closeProfileDrawer(() => {
                    if (onEditProfile) {
                      if (onProfileDrawerNavigate) {
                        onProfileDrawerNavigate();
                      }
                      onEditProfile();
                      return;
                    }
                    Alert.alert('Unavailable', 'Edit profile is not connected yet.');
                  });
                }}
                activeOpacity={0.8}>
                <Icon name="edit" size={16} color="#FD8B36" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.profileDrawerCloseButton}
                onPress={() => closeProfileDrawer()}
                activeOpacity={0.8}>
                <Icon name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={profileDrawerScrollRef}
              showsVerticalScrollIndicator={false}
              onScroll={(event) => {
                if (onProfileDrawerScrollChange) {
                  onProfileDrawerScrollChange(event.nativeEvent.contentOffset.y);
                }
              }}
              scrollEventThrottle={16}
              contentContainerStyle={[
                styles.profileDrawerContent,
                { paddingBottom: 14 + profileDrawerBottomInset },
              ]}>
              <View style={styles.profileDrawerTopCard}>
                {userProfile?.profileImage ? (
                  <Image
                    source={{ uri: userProfile.profileImage }}
                    style={styles.profileDrawerAvatar}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.profileDrawerAvatarPlaceholder}>
                    <Icon name="person" size={34} color="#FD8B36" />
                  </View>
                )}
                <Text style={styles.profileDrawerName}>{userProfile?.name || 'Expert'}</Text>
                <Text style={styles.profileDrawerId}>ID: #{formatUserId(userProfile?._id)}</Text>
                <View style={styles.profileDrawerBasicDetails}>
                  <Text style={styles.profileDrawerDetailsTitle}>Basic Details</Text>
                  {[
                    {
                      key: 'rating',
                      icon: 'star',
                      label: 'Rating',
                      value: stylistRating > 0 ? `${stylistRating === 5 ? '5' : stylistRating.toFixed(1)}/5` : 'No ratings yet',
                      lines: 1,
                    },
                    {
                      key: 'location',
                      icon: 'location-on',
                      label: 'Location',
                      value: userProfile?.location?.address || 'Not added',
                      lines: 2,
                    },
                    {
                      key: 'phone',
                      icon: 'call',
                      label: 'Phone',
                      value: userProfile?.phoneNumber || 'Not added',
                      lines: 1,
                    },
                    {
                      key: 'plan',
                      icon: 'workspace-premium',
                      label: 'Current Plan',
                      value: currentPlanName,
                      lines: 1,
                    },
                    {
                      key: 'services',
                      icon: 'spa',
                      label: 'Specialization',
                      value: specialServicesText,
                      lines: 2,
                    },
                  ].map((detail) => (
                    <TouchableOpacity
                      key={detail.key}
                      style={styles.profileDrawerDetailCard}
                      onPress={() => {
                        if (detail.key === 'rating' && onHistory) {
                          closeProfileDrawer(() => {
                            if (onProfileDrawerNavigate) {
                              onProfileDrawerNavigate();
                            }
                            onHistory();
                          });
                        } else if (detail.key === 'plan' && onSubscription) {
                          closeProfileDrawer(() => {
                            if (onProfileDrawerNavigate) {
                              onProfileDrawerNavigate();
                            }
                            onSubscription();
                          });
                        } else if (detail.key === 'services' && (onSpecialService || onMyService)) {
                          closeProfileDrawer(() => {
                            if (onProfileDrawerNavigate) {
                              onProfileDrawerNavigate();
                            }
                            if (onSpecialService) {
                              onSpecialService();
                            } else {
                              onMyService?.();
                            }
                          });
                        }
                      }}
                      activeOpacity={0.7}>
                      <View style={styles.profileDrawerDetailIconWrap}>
                        <Icon name={detail.icon} size={15} color="#FD8B36" />
                      </View>
                      <View style={styles.profileDrawerDetailContent}>
                        <Text style={styles.profileDrawerDetailLabel}>{detail.label}</Text>
                        <Text style={styles.profileDrawerDetailValue} numberOfLines={detail.lines}>
                          {detail.value}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.profileDrawerInfoCard}>
                <Text style={styles.profileDrawerSectionTitle}>About</Text>
                <Text style={styles.profileDrawerAboutText}>
                  {userProfile?.about || 'No profile description added yet.'}
                </Text>
              </View>

              <View style={styles.profileDrawerInfoCard}>
                <Text style={styles.profileDrawerSectionTitle}>Quick Access</Text>
                {([
                  {
                    id: 'portfolio',
                    icon: 'collections',
                    label: 'Portfolio',
                  },
                  {
                    id: 'currentBookings',
                    icon: 'event-note',
                    label: 'Current Bookings',
                  },
                  {
                    id: 'subscription',
                    icon: 'workspace-premium',
                    label: 'Upgrade Plan',
                  },
                  {
                    id: 'ads',
                    icon: 'campaign',
                    label: 'Ads & Promotions',
                  },
                  {
                    id: 'services',
                    icon: 'content-cut',
                    label: 'My Services',
                  },

                  {
                    id: 'slots',
                    icon: 'schedule',
                    label: 'My Slots',
                  },
                  {
                    id: 'bankDetails',
                    icon: 'account-balance',
                    label: 'Bank & UPI Details',
                  },

                ] as Array<{ id: ProfileDrawerMenuItemId; icon: string; label: string }>).map((item, index, arr) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.profileDrawerMenuRow,
                      index === arr.length - 1 && styles.profileDrawerMenuRowLast,
                    ]}
                    activeOpacity={0.75}
                    onPress={() =>
                      handleProfileDrawerMenuPress(item.id)
                    }
                  >
                    <View style={styles.profileDrawerMenuLeft}>
                      <View style={styles.profileDrawerMenuIconWrap}>
                        <Icon name={item.icon as any} size={18} color="#FD8B36" />
                      </View>
                      <Text style={styles.profileDrawerMenuLabel}>{item.label}</Text>
                    </View>
                    <View style={styles.profileDrawerMenuRight}>
                      <Icon name="chevron-right" size={20} color="#B9B9B9" />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.profileDrawerLogoutButton}
                activeOpacity={0.8}
                onPress={handleLogout}>
                <Icon name="logout" size={24} color="#FD8B36" />
              </TouchableOpacity>

              <View style={styles.profileDrawerBrandFooter}>
                <View style={styles.profileDrawerBrandLogoWrap}>
                  <Image
                    source={require('../assets/logo.png')}
                    style={styles.profileDrawerBrandLogo}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.profileDrawerBrandText}>GlamMefy Partner</Text>
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      <CustomModal
        visible={modal.visible}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        buttons={modal.buttons}
        onClose={modal.hideModal}
      />

      {/* Profile Image Modal */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setShowImageModal(false)}>
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity
            style={styles.imageModalCloseButton}
            onPress={() => setShowImageModal(false)}
            activeOpacity={0.7}>
            <Icon name="close" size={30} color="#fff" />
          </TouchableOpacity>
          {userProfile?.profileImage ? (
            <Image
              source={{ uri: userProfile.profileImage }}
              style={styles.imageModalImage}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>


      {/* Period Dropdown Modal */}
      <Modal
        visible={showPeriodDropdown}
        transparent={true}
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setShowPeriodDropdown(false)}>
        <TouchableOpacity
          style={styles.dropdownModalOverlay}
          activeOpacity={1}
          onPress={() => setShowPeriodDropdown(false)}>
          <View style={styles.dropdownModalContent}>
            <TouchableOpacity
              style={[
                styles.dropdownOption,
                serviceStatsPeriod === 'weekly' && styles.dropdownOptionSelected,
              ]}
              onPress={() => {
                setServiceStatsPeriod('weekly');
                setShowPeriodDropdown(false);
              }}
              activeOpacity={0.7}>
              <Text
                style={[
                  styles.dropdownOptionText,
                  serviceStatsPeriod === 'weekly' && styles.dropdownOptionTextSelected,
                ]}>
                Weekly
              </Text>
              {serviceStatsPeriod === 'weekly' && (
                <Icon name="check" size={20} color="#FD8B36" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.dropdownOption,
                serviceStatsPeriod === 'monthly' && styles.dropdownOptionSelected,
              ]}
              onPress={() => {
                setServiceStatsPeriod('monthly');
                setShowPeriodDropdown(false);
              }}
              activeOpacity={0.7}>
              <Text
                style={[
                  styles.dropdownOptionText,
                  serviceStatsPeriod === 'monthly' && styles.dropdownOptionTextSelected,
                ]}>
                Monthly
              </Text>
              {serviceStatsPeriod === 'monthly' && (
                <Icon name="check" size={20} color="#FD8B36" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.dropdownOption,
                serviceStatsPeriod === 'yearly' && styles.dropdownOptionSelected,
              ]}
              onPress={() => {
                setServiceStatsPeriod('yearly');
                setShowPeriodDropdown(false);
              }}
              activeOpacity={0.7}>
              <Text
                style={[
                  styles.dropdownOptionText,
                  serviceStatsPeriod === 'yearly' && styles.dropdownOptionTextSelected,
                ]}>
                Yearly
              </Text>
              {serviceStatsPeriod === 'yearly' && (
                <Icon name="check" size={20} color="#FD8B36" />
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <StatusChangeModal 
        visible={showStatusModal} 
        isOnline={isOnline} 
        onClose={() => setShowStatusModal(false)} 
      />

      <ProfileRedirectModal
        visible={isCompletingProfile}
        title="Opening Profile Setup"
        message="Loading your details..."
        icon="person"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF3E8',
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 64,
    paddingHorizontal: 18,
    paddingTop: compactTopPadding(8),
    paddingBottom: 12,
    position: 'relative',
  },
  topNavSide: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButton: {
    borderRadius: 26,
  },
  topNavRightSpacer: {
    width: 40,
    height: 40,
  },
  topNavLogoWrap: {
    // width: 40,
    // height: 40,
    // borderRadius: 12,

  },
  topNavLogo: {
    width: 52,
    height: 52,
  },
  topNavLogoSmall: {
    width: 44,
    height: 44,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 4,
    width: 196,
    maxWidth: '58%',
  },
  toggleContainerSmall: {
    borderRadius: 17,
    padding: 2,
    width: 176,
    maxWidth: '54%',
  },
  toggleOption: {
    flex: 1,
    borderRadius: 16,
    marginHorizontal: 2,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  toggleOptionSmall: {
    borderRadius: 14,
    marginHorizontal: 1,
    paddingVertical: 5,
  },
  toggleOptionActive: {
    backgroundColor: 'transparent',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  toggleTextSmall: {
    fontSize: 12,
  },
  toggleTextActive: {
    color: '#fff',
  },
  toggleGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  profileImageContainer: {
    marginRight: 12,
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFE5CC',
    overflow: 'hidden' as const,
  },
  profileImageSmall: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  profileImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFE5CC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  profileId: {
    fontSize: 14,
    color: '#666',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 4,
  },
  // Ongoing Booking Card Styles
  ongoingBookingCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    // marginHorizontal: 24,
    marginBottom: 14,
    // shadowColor: '#000',
    // shadowOffset: { width: 0, height: 2 },
    // shadowOpacity: 0.07,
    // shadowRadius: 3,
    // elevation: 2,
  },
  ongoingBookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  ongoingBookingLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  ongoingProfileIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  ongoingServiceImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    overflow: 'hidden' as const,
  },
  ongoingBookingInfo: {
    flex: 1,
  },
  ongoingServiceName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  ongoingDuration: {
    fontSize: 14,
    color: '#666',
  },
  ongoingBookingRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4CAF50',
  },
  serviceTypeTag: {
    backgroundColor: '#FD8B36',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  serviceTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  ongoingDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 12,
  },
  ongoingAddressSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  ongoingAddressText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  timeLeftSection: {
    alignItems: 'center',
    marginVertical: 12,
  },
  timeLeftLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  countdownContainer: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  countdownBox: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 70,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  countdownNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  countdownLabel: {
    fontSize: 12,
    color: '#666',
  },
  ongoingPriceSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  ongoingPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FD8B36',
  },
  ongoingBookingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  ongoingBookingCardHeaderText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
  },
  // Upcoming Bookings Section Styles
  upcomingBookingsSection: {
    marginBottom: 20,
    paddingHorizontal: 0,
    // backgroundColor: 'red',
  },
  upcomingBookingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 12,
  },
  upcomingBookingsTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: '#333',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    color: '#FD8B36',
    fontWeight: '500',
  },
  upcomingBookingsScroll: {
    marginHorizontal: -24,
  },
  upcomingBookingsScrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    gap: 16,
    alignItems: 'flex-start',
    // backgroundColor: 'red',
  },
  upcomingBookingCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 16,
    marginBottom: 12,
    alignSelf: 'flex-start',
    shadowColor: '#FD8B36',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  upcomingCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  upcomingCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  upcomingCardBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 12,
  },
  upcomingCardPrice: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  upcomingBookingTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  upcomingBookingLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  upcomingProfileIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    overflow: 'hidden',
  },
  upcomingServiceImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    overflow: 'hidden' as const,
  },
  upcomingBookingInfo: {
    flex: 1,
  },
  upcomingServiceName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  upcomingServiceTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: 'flex-start',
    gap: 4,
  },
  upcomingServiceTypePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FD8B36',
  },
  upcomingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  upcomingMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  upcomingMetaText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
    flex: 1,
  },
  upcomingMetaSeparator: {
    width: 1,
    height: 16,
    backgroundColor: '#E0E0E0',
  },
  upcomingStartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FD8B36',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  upcomingStartButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  upcomingDetailsRow: {
    marginBottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    // backgroundColor: 'red',
  },
  upcomingDetailText: {
    fontSize: 13,
    color: '#666',

  },
  upcomingDetailTextDate: {
    fontSize: 13,
    color: '#fff',
    backgroundColor: '#FD8B36',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 42,
  },
  upcomingDetailBoldDate: {
    fontWeight: 'bold',
    color: '#fff',
    fontSize: 12,
  },
  upcomingDetailBold: {
    fontWeight: 'bold',
    color: '#333',
    fontSize: 12,
  },
  upcomingServiceTypeTag: {
    backgroundColor: '#FD8B36',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  upcomingServiceTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  upcomingDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 12,
  },
  upcomingLocationsSection: {
    marginBottom: 12,
    paddingLeft: 8,
    minHeight: 90,
    justifyContent: 'center',
  },
  upcomingLocationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  upcomingLocationDotContainer: {
    alignItems: 'center',
    marginRight: 12,
    minWidth: 20,
  },
  upcomingLocationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FD8B36',
  },
  upcomingLocationStartDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  upcomingLocationStartDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FD8B36',
  },
  upcomingLocationLine: {
    width: 2,
    height: 40,
    marginTop: 4,
    marginBottom: 4,
    borderLeftWidth: 2,
    borderLeftColor: '#E0E0E0',
    borderStyle: 'dashed',
  },
  upcomingLocationText: {
    fontSize: 13,
    color: '#666',
    flex: 1,
    lineHeight: 18,
  },
  upcomingLocationTextPlaceholder: {
    fontSize: 13,
    color: '#999',
    flex: 1,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  upcomingLocationTextContainer: {
    flex: 1,
  },
  upcomingLocationLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
    fontWeight: '500',
  },
  upcomingPriceSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,

  },
  upcomingPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FD8B36',
  },
  upcomingPaginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  upcomingPaginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  upcomingPaginationDotActive: {
    backgroundColor: '#FD8B36',
    width: 24,
  },
  summaryCards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
    width: '100%',
    alignSelf: 'center',
    // backgroundColor: 'red',
  },
  summaryCard: {
    // flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginRight: 12,
    width: '48.5%',

  },
  summaryCardLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  summaryCardValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FD8B36',
  },
  chartContainer: {
    backgroundColor: '#FFE2BA40',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,

  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  chartHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  chartToggleContainer: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  chartRadioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chartRadioButton: {
    width: 10,
    height: 10,
    borderRadius: 10,
    borderWidth: 1.3,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartRadioButtonSelected: {
    borderColor: '#FD8B36',
  },
  chartRadioButtonInner: {
    width: 5,
    height: 5,
    borderRadius: 5,
    backgroundColor: '#FD8B36',
  },
  chartRadioLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: '#333',
  },
  periodDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
    gap: 4,
  },
  periodDropdownText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#333',
  },
  homePopupOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  homePopupBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.56)',
  },
  homePopupCard: {
    width: HOME_POPUP_IMAGE_SIZE,
    height: HOME_POPUP_IMAGE_SIZE,
    borderRadius: 18,
    overflow: 'visible',
  },
  homePopupCloseButton: {
    position: 'absolute',
    top: -12,
    right: 30,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 5,
  },
  homePopupImageButton: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    overflow: 'hidden',
  },
  homePopupImage: {
    width: '100%',
    height: '100%',
  },
  dropdownModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  dropdownOptionSelected: {
    backgroundColor: '#FFF5F0',
  },
  dropdownOptionText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '400',
  },
  dropdownOptionTextSelected: {
    color: '#FD8B36',
    fontWeight: '600',
  },
  chartLoadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartContent: {
    height: 250,
  },
  chartScrollView: {
    height: 200,
  },
  chartScrollContent: {
    paddingVertical: 0,
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartEmptyContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartEmptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  appointmentCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  appointmentCountLabel: {
    fontSize: 12,
    color: '#666',
  },
  appointmentCountValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FD8B36',
  },
  weeklySlotsSection: {
    marginBottom: 24,

  },
  weeklySlotsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D3DDE7',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 16,
    justifyContent: 'center',

  },
  weeklySlotsTitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#333',
    textAlign: 'center',
    marginLeft: 8,
  },
  dayScrollView: {
    marginHorizontal: -24,
  },
  dayScrollContent: {
    paddingHorizontal: 24,
  },
  dayButton: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    marginRight: 12,
    backgroundColor: '#fff',
    // borderWidth: 1,
    // borderColor: '#E0E0E0',
    alignItems: 'center',
    minWidth: 60,
    position: 'relative',
  },
  dayButtonSelected: {
    backgroundColor: '#FD8B3675',
    borderColor: '#FD8B3675',
  },
  dayButtonToday: {
    borderColor: '#FD8B36',
    borderWidth: 2,
  },
  dayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  dayTextSelected: {
    color: '#333',
  },
  dateText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  dateTextSelected: {
    color: '#333',
  },
  dayTextToday: {
    color: '#FD8B36',
    fontWeight: '700',
  },
  dateTextToday: {
    color: '#FD8B36',
    fontWeight: '700',
  },
  todayLabel: {
    fontSize: 8,
    color: '#FD8B36',
    fontWeight: '600',
    marginTop: 2,
  },
  availableSlotsSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
  },
  legend: {
    flexDirection: 'row',
    marginBottom: 20,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,

  },
  legendAvailable: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#999',
    backgroundColor: '#fff',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  legendAvailableSelected: {
    borderColor: '#FD8B36',
    borderWidth: 2,
  },
  legendAvailableInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FD8B36',
  },
  legendBooked: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFE5CC',
    marginRight: 8,
  },
  legendBookedSelected: {
    backgroundColor: '#FD8B36',
    borderWidth: 2,
    borderColor: '#FD8B36',
  },
  legendText: {
    fontSize: 14,
    color: '#666',
  },
  legendTextSelected: {
    color: '#FD8B36',
    fontWeight: '600',
  },
  slotsScrollView: {
    maxHeight: 200, // Limit height to show exactly 3 rows
  },
  slotsScrollContainer: {
    paddingVertical: 4,
  },
  slotsGridContainer: {
    flexDirection: 'column',
    gap: 12,
  },
  slotRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 0,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 10,
  },
  slotButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minWidth: 100, // Fixed minimum width instead of percentage
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotButtonSelected: {
    borderColor: '#E0E0E0',
    borderWidth: 1,
    backgroundColor: '#fff',
  },
  slotButtonBooked: {
    backgroundColor: '#FFE5CC',
    borderColor: '#FD8B36',
    borderWidth: 1,
  },
  slotContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  radioButtonSelected: {
    borderColor: '#FD8B36',
  },
  bookedIconContainer: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FD8B36',
  },
  slotText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
  },
  slotTextSelected: {
    color: '#333',
    fontWeight: '500',
  },
  slotTextBooked: {
    color: '#333',
    fontWeight: '500',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  slotsShimmerContainer: {
    minHeight: 150,
  },
  noSlotsContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noSlotsText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
    minHeight: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: compactTopPadding(20),
    paddingBottom: 10,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  grabNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FD8B36',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  grabNowText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  swipeIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginVertical: 4,
  },
  bookingCounter: {
    alignItems: 'center',
    // paddingVertical: 8,
    // paddingHorizontal: 12,
    // backgroundColor: '#FFF5F0',
    // borderRadius: 999,
    // borderWidth: 1,
    // borderColor: '#FFDCCD',
  },
  bookingCounterText: {
    fontSize: 10,
    color: '#B4562C',
    fontWeight: '500',
  },
  bookingPagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 4,
    marginBottom: 4,
  },
  bookingPagerButton: {
    width: 26,
    height: 26,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FFDCCD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingPagerButtonDisabled: {
    backgroundColor: '#F7F7F7',
    borderColor: '#E8E8E8',
  },
  pendingBookingContainer: {
    flex: 1,
    paddingHorizontal: 20,
    minHeight: 300,
  },
  pendingBookingContent: {
    paddingBottom: 20,
  },
  noPendingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  noPendingText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  pendingBookingsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  pendingBookingCard: {
    marginBottom: 20,
  },
  bookingInfoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bookingInfoHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  serviceImageIcon: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    overflow: 'hidden' as const,
  },
  serviceImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    // backgroundColor: 'red',
    justifyContent: 'center',
    alignItems: 'center',

  },
  bookingInfoHeaderText: {
    flex: 1,
    // backgroundColor: 'red'
    // marginLeft: 12,
  },
  bookingServiceName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  bookingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bookingMetaText: {
    fontSize: 14,
    color: '#666',
  },
  bookingMetaDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#999',
  },
  bookingAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  bookingTagsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  bookingTag: {
    backgroundColor: '#FD8B36',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bookingTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  bookingLocationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  bookingLocationText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  bookingTime: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  earningsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  earningsLeft: {
    flex: 1,
    marginRight: 10,
  },
  earningsRight: {
    alignItems: 'flex-end',
  },
  earningsSymbol: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  earningsAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  priceWithGstSubtext: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  totalPriceBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FD8B36',
    backgroundColor: '#FFF3E8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 4,
    overflow: 'hidden',
  },
  earningsLabel: {
    fontSize: 11,
    color: '#666',
  },
  earningsBonus: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
  },
  bookingActions: {
    gap: 12,
  },
  confirmButtonContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  confirmButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    minHeight: 56,
    justifyContent: 'center',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    minHeight: 56,
    borderRadius: 30,
    overflow: 'hidden', // 🔥 VERY IMPORTANT
  },
  confirmButtonContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },


  confirmButtonInner: {
    paddingVertical: 12,   // control height here
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  confirmButtonLeft: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // confirmButtonText: {
  //   fontSize: 16,
  //   fontWeight: 'bold',
  //   color: '#fff',
  //   flex: 1,
  //   textAlign: 'center',
  // },
  confirmButtonRight: {
    width: 40,
    height: 40,
  },
  slideArrowContainer: {
    position: 'absolute',
    left: 8,
    top: 8,
    bottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    zIndex: 10,
    pointerEvents: 'box-none', // Allow touches to be captured by this view
  },
  slideArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  slideProgressBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    zIndex: 1,
    borderRadius: 12,
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginTop: 8,
  },
  navButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#FD8B36',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  navButtonDisabled: {
    borderColor: '#E0E0E0',
    backgroundColor: '#F5F5F5',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    // height: '100%',
    // width: '100%',
  },
  imageModalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 30,
    zIndex: 1,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalImage: {
    width: '50%',
    height: '50%',
    overflow: 'hidden' as const,
    // resizeMode: 'contain',
  },
  profileDrawerOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  profileDrawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  profileDrawerCard: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '94%',
    // maxWidth: 360,
    backgroundColor: '#FFF8F2',
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
    borderWidth: 1,
    borderColor: '#F0E0D3',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
  },
  profileDrawerCardSmall: {
    paddingTop: 14,
  },
  profileDrawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  profileDrawerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  profileDrawerEditButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#F0E0D3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileDrawerCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#F0E0D3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileDrawerContent: {
    paddingBottom: 14,
  },
  profileDrawerTopCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0E0D3',
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  profileDrawerAvatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: '#FD8B36',
    backgroundColor: '#FFF3E8',
    marginBottom: 10,
  },
  profileDrawerAvatarPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#FFDCCD',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  profileDrawerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  profileDrawerId: {
    fontSize: 12,
    color: '#777',
    marginBottom: 8,
  },
  profileDrawerBasicDetails: {
    width: '100%',
    backgroundColor: '#FFF8F1',
    borderWidth: 1,
    borderColor: '#F4DCCB',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 9,
  },
  profileDrawerDetailsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
    marginBottom: 2,
    paddingHorizontal: 4,
  },
  profileDrawerDetailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F2E2D6',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  profileDrawerDetailIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF1E8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFDCC9',
  },
  profileDrawerDetailContent: {
    flex: 1,
  },
  profileDrawerDetailLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000',
    marginBottom: 2,
  },
  profileDrawerDetailValue: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
  },
  profileDrawerInfoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0E0D3',
    padding: 14,
    marginBottom: 12,
  },
  profileDrawerSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    marginBottom: 10,
  },
  profileDrawerInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  profileDrawerInfoTextWrap: {
    flex: 1,
  },
  profileDrawerInfoLabel: {
    fontSize: 11,
    color: '#000',
    fontWeight: '700',
    marginBottom: 2,
  },
  profileDrawerInfoValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
    lineHeight: 18,
  },
  profileDrawerMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F4ECE6',
  },
  profileDrawerMenuRowLast: {
    borderBottomWidth: 0,
  },
  profileDrawerMenuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  profileDrawerMenuIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF2EA',
    borderWidth: 1,
    borderColor: '#FFDCCD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileDrawerMenuLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  profileDrawerMenuRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  profileDrawerAboutText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
  },
  profileDrawerLogoutButton: {
    marginTop: 8,
    width: '30%',
    height: 44,
    borderRadius: 7,
    backgroundColor: '#FFF2EA',
    borderWidth: 1,
    borderColor: '#FFD6C2',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    // shadowColor: '#000',
    // shadowOffset: { width: 0, height: 2 },
    // shadowOpacity: 0.08,
    // shadowRadius: 4,
    // elevation: 2,
  },
  profileDrawerBrandFooter: {
    marginTop: 14,
    paddingTop: compactTopPadding(14),
    paddingBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  profileDrawerBrandLogoWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F0E0D3',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  profileDrawerBrandLogo: {
    width: 36,
    height: 36,
  },
  profileDrawerBrandText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F1F1F',
    letterSpacing: 0.2,
  },
  subscriptionPromptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    // paddingHorizontal: 14,
    // paddingBottom: 18,
  },
  subscriptionBackdropPress: {
    ...StyleSheet.absoluteFillObject,
  },
  subscriptionPromptCard: {
    width: '100%',
    // maxWidth: 460,
    backgroundColor: '#fff',
    // borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: '#F2E2D8',
  },
  subscriptionPromptIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFF2EA',
    borderWidth: 1,
    borderColor: '#FFDCCD',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 10,
  },
  subscriptionPromptTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
    textAlign: 'center',
    marginBottom: 6,
  },
  subscriptionPromptSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  subscriptionInfoCard: {
    backgroundColor: '#FFF9F5',
    borderWidth: 1,
    borderColor: '#F4E2D7',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  subscriptionInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F3E8E1',
    paddingVertical: 6,
    gap: 10,
  },
  subscriptionInfoRowLast: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    gap: 10,
  },
  subscriptionInfoLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  subscriptionInfoValue: {
    fontSize: 12,
    color: '#222',
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  subscriptionInfoHighlight: {
    fontSize: 12,
    color: '#FD8B36',
    fontWeight: '800',
    flex: 1,
    textAlign: 'right',
  },
  subscriptionPromptActions: {
    flexDirection: 'row',
    gap: 10,
  },
  subscriptionPromptLaterBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E6E6E6',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    overflow: 'hidden',
  },
  subscriptionPromptLaterText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  subscriptionPromptPrimaryBtn: {
    flex: 1,
    backgroundColor: '#FD8B36',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    overflow: 'hidden',
  },
  subscriptionPromptPrimaryText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '700',
  },
  badgeMiniProgressTextUnlocked: {
    color: '#333',
  },
  guestBanner: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  guestBannerGradient: {
    padding: 16,
  },
  guestBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  guestBannerTextWrap: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  guestBannerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  guestBannerSubTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.9,
  },
});

export default HomeScreen;
