import { useLiveStylistBooking } from '../hooks/useLiveStylistBooking';
import { QueuedModal as Modal } from '../popup/PopupProvider';
import { QueuedAlert as Alert } from '../popup/QueuedAlert';
import { canStartBooking, getBookingDateKey, getBookingStartTimestamp } from '../utils/bookingTime';
import { useBookingClock } from '../hooks/useBookingClock';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Switch,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import SafeAreaView from '../components/SafeAreaView';
import { compactTopPadding } from '../utils/responsiveLayout';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from '../components/AppLinearGradient';
import { API_BASE_URL_WITH_API } from '../config/api';
import UpcomingBookingDetailsScreen from './UpcomingBookingDetailsScreen';
import BookingChatScreen from './BookingChatScreen';
import RatingModal from '../components/RatingModal';
import { cancelBookingNotification } from '../utils/notificationService';
import { subscribeToBookingRefresh, notifyBookingRefresh } from '../utils/bookingRefresh';
import Shimmer from '../components/Shimmer';
import { useModal } from '../hooks/useModal';
import CustomModal from '../components/CustomModal';
import { toCloudFrontUrl } from '../utils/cdnUrl';
import SmoothToggle from '../components/SmoothToggle';

const DEFAULT_SERVICE_IMAGE_SOURCE = require('../assets/image.png');

interface BookingsScreenProps {
  initialTab?: BookingTab;
  onTabChange?: (tab: BookingTab) => void;
  initialRatingBooking?: Booking | null;
  userId?: string;
  onBookingPress?: (booking: Booking) => void;
  onCompletedBookingPress?: (booking: Booking) => void;
  onShowOTP?: (booking: Booking, actionType?: 'start' | 'end') => void;
  onHelp?: () => void;
  onHistory?: () => void;
  onChatVisibilityChange?: (visible: boolean) => void;
}

interface Booking {
  bookingId: string;
  userId: string;
  userName: string;
  serviceName: string;
  date: string;
  startTime: string;
  endTime: string;
  period: string;
  price: number;
  status: 'pending' | 'confirmed' | 'ongoing' | 'completed' | 'cancelled';
  serviceImages?: { [key: string]: string }; // Object with gender keys and image values (e.g., { Female: "data:image/...", Male: "data:image/..." })
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
  stylistRating?: number;
  stylistRatingComment?: string;
  stylistRatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Helper function to get the appropriate service image based on booking gender and images object
const getServiceImageForBooking = (booking: Booking, defaultImage: string = 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=200&h=200&fit=crop'): string => {
  // Debug logging
  console.log(`🔍 getServiceImageForBooking called for booking ${booking.bookingId}:`, {
    serviceName: booking.serviceName,
    gender: booking.gender,
    hasServiceImages: !!booking.serviceImages,
    serviceImagesType: typeof booking.serviceImages,
    serviceImages: booking.serviceImages,
  });

  // If serviceImages object exists, try to get image for the booking gender
  if (booking.serviceImages && typeof booking.serviceImages === 'object' && !Array.isArray(booking.serviceImages)) {
    const targetGender = booking.gender === 'Female' ? 'Female' :
      booking.gender === 'Male' ? 'Male' :
        null;

    console.log(`🎯 Target gender: ${targetGender}`);

    if (targetGender) {
      // Try exact match first (case-sensitive)
      if (booking.serviceImages[targetGender]) {
        console.log(`✅ Found exact match for gender "${targetGender}"`);
        return toCloudFrontUrl(booking.serviceImages[targetGender]) || defaultImage;
      }

      // Try case-insensitive match
      const imageKeys = Object.keys(booking.serviceImages);
      console.log(`🔑 Available image keys: ${imageKeys.join(', ')}`);

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
        console.log(`✅ Found case-insensitive match: "${matchingKey}"`);
        return toCloudFrontUrl(booking.serviceImages[matchingKey]) || defaultImage;
      }

      // Fallback to first available image
      if (imageKeys.length > 0 && booking.serviceImages[imageKeys[0]]) {
        console.log(`⚠️ Using first available image: "${imageKeys[0]}"`);
        return toCloudFrontUrl(booking.serviceImages[imageKeys[0]]) || defaultImage;
      }
    } else {
      // If no gender specified, use first available image
      const imageKeys = Object.keys(booking.serviceImages);
      if (imageKeys.length > 0 && booking.serviceImages[imageKeys[0]]) {
        console.log(`⚠️ No gender specified, using first available image: "${imageKeys[0]}"`);
        return toCloudFrontUrl(booking.serviceImages[imageKeys[0]]) || defaultImage;
      }
    }
  } else {
    console.log(`❌ No serviceImages found or invalid format`);
  }

  return defaultImage;
};

export type BookingTab = 'ongoing' | 'complete' | 'upcoming';
const BOOKING_FETCH_LIMIT = 5;

const getStatusForBookingTab = (tab: BookingTab): Booking['status'] => {
  if (tab === 'ongoing') {
    return 'ongoing';
  }

  if (tab === 'complete') {
    return 'completed';
  }

  return 'confirmed';
};

const BookingsScreen: React.FC<BookingsScreenProps> = ({
  userId,
  initialTab = 'upcoming',
  onTabChange,
  initialRatingBooking,
  onBookingPress,
  onCompletedBookingPress,
  onShowOTP,
  onHelp,
  onHistory,
  onChatVisibilityChange,
}) => {
  const [activeTab, setActiveTab] = useState<BookingTab>(initialTab);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  // Track reminder toggles for each booking
  const [reminderToggles, setReminderToggles] = useState<Record<string, boolean>>({});
  const [selectedUpcomingBooking, setSelectedUpcomingBooking] = useState<Booking | null>(null);
  const [chatBooking, setChatBooking] = useState<Booking | null>(null);
  const [userImages, setUserImages] = useState<Record<string, string>>({});
  const [showRatingModal, setShowRatingModal] = useState(Boolean(initialRatingBooking));
  const [bookingToRate, setBookingToRate] = useState<Booking | null>(initialRatingBooking ?? null);
  const [ratedBookings, setRatedBookings] = useState<Set<string>>(new Set());
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);
  const [confirmingBookingId, setConfirmingBookingId] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [failedServiceImages, setFailedServiceImages] = useState<Record<string, boolean>>({});
  const previousBookingsRef = useRef<Booking[]>([]);
  const modal = useModal();

  useEffect(() => { onTabChange?.(activeTab); }, [activeTab, onTabChange]);
  useLiveStylistBooking({
    stylistId: userId,
    selected: selectedUpcomingBooking,
    onRefresh: () => setRefreshVersion(version => version + 1),
    onBooking: updated => {
      if (['ongoing', 'completed', 'cancelled'].includes(updated.status)) {
        setSelectedUpcomingBooking(null);
        setActiveTab(updated.status === 'ongoing' ? 'ongoing' : updated.status === 'completed' ? 'complete' : 'upcoming');
      } else {
        setSelectedUpcomingBooking(current => current?.bookingId === updated.bookingId ? { ...current, ...updated } as Booking : current);
      }
    },
  });

  useEffect(() => {
    onChatVisibilityChange?.(Boolean(chatBooking));

    return () => {
      onChatVisibilityChange?.(false);
    };
  }, [chatBooking, onChatVisibilityChange]);

  // Fetch bookings from backend
  useEffect(() => {
    let disposed = false;
    const fetchBookings = async () => {
      if (!userId) {
        console.log('No userId provided');
        setLoading(false);
        return;
      }

      try {
        const bookingStatus = activeTab === 'upcoming' ? 'pending,confirmed' : getStatusForBookingTab(activeTab);
        const response = await fetch(`${API_BASE_URL_WITH_API}/stylist/bookings/${userId}?status=${bookingStatus}&limit=${BOOKING_FETCH_LIMIT}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Fetch bookings error:', errorText);
          throw new Error(`Failed to fetch bookings: ${response.status}`);
        }

        const result = await response.json();
        // A response for a previous tab must not replace the current list.
        if (disposed) return;
        console.log('✅ Bookings fetched successfully:', result);

        if (result.success && Array.isArray(result.data?.bookings)) {
          const fetchedBookings = result.data.bookings;
          // Debug: Log serviceImages for each booking
          fetchedBookings.forEach((booking: Booking) => {
            console.log(`📸 Booking ${booking.bookingId}:`, {
              serviceName: booking.serviceName,
              gender: booking.gender,
              serviceImages: booking.serviceImages,
              hasServiceImages: !!booking.serviceImages,
              serviceImagesKeys: booking.serviceImages ? Object.keys(booking.serviceImages) : [],
            });
          });
          setBookings(fetchedBookings);

          // Check for newly completed bookings without ratings
          if (!showRatingModal && !bookingToRate) {
            const newlyCompletedBookings = fetchedBookings.filter(
              (booking: Booking) =>
                booking.status === 'completed' &&
                !booking.stylistRating &&
                !ratedBookings.has(booking.bookingId) &&
                // Check if this booking was just completed (was ongoing before)
                previousBookingsRef.current.some(
                  (prevBooking) =>
                    prevBooking.bookingId === booking.bookingId &&
                    prevBooking.status === 'ongoing'
                )
            );

            // Show rating modal for the first newly completed booking
            if (newlyCompletedBookings.length > 0) {
              setBookingToRate(newlyCompletedBookings[0]);
              setShowRatingModal(true);
            }
          }

          previousBookingsRef.current = fetchedBookings;
        }
      } catch (error) {
        if (!disposed) console.error('❌ Error fetching bookings:', error);
      } finally {
        if (!disposed) setLoading(false);
      }
    };

    fetchBookings();
    return () => { disposed = true; };
  }, [userId, activeTab, showRatingModal, bookingToRate, ratedBookings, refreshVersion]);

  useEffect(() => {
    if (!userId) return;

    const unsubscribe = subscribeToBookingRefresh(() => {
      setRefreshVersion(prev => prev + 1);
    });

    return () => unsubscribe();
  }, [userId]);

  // Note: Removed automatic OTP trigger - OTP will only show when user clicks "Start Now" button

  const bookingNow = useBookingClock();

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const formatTime = (startTime: string, period: string): string => {
    // Backend stores time in 24-hour format, convert to 12-hour format
    const [hours, minutes] = startTime.split(':');
    const hour24 = parseInt(hours, 10);
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    const minutesStr = minutes.toString().padStart(2, '0');
    return `${hour12}:${minutesStr} ${ampm}`;
  };

  const formatDateTime = (dateString: string, startTime: string, period: string): string => {
    const dateKey = getBookingDateKey(dateString);
    if (!dateKey) return 'Schedule unavailable';
    const [year, month, day] = dateKey.split('-').map(Number);
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    // Backend stores time in 24-hour format, convert to 12-hour format
    const [hours, minutes] = startTime.split(':');
    const hour24 = parseInt(hours, 10);
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    const minutesStr = minutes.toString().padStart(2, '0');
    const formattedTime = `${hour12}:${minutesStr} ${ampm}`;
    return `${day} ${months[month - 1]} ${year}, ${formattedTime}`;
  };

  const formatDateShort = (dateString: string): string => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const calculateDuration = (startTime: string, endTime: string, period: string): string => {
    // Backend stores time in 24-hour format, so use it directly
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);

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
  };

  // Check if booking can be cancelled (must be more than 30 minutes before start time)
  const canCancelBooking = (booking: Booking): boolean => {
    return bookingNow < getBookingStartTimestamp(booking) - 30 * 60 * 1000;
  };


  // Helper function to check if booking time has started
  // Helper function to convert time to 24-hour format
  const convertTo24Hour = (time: string, period?: string): number => {
    const [hours, minutes] = time.split(':').map(Number);

    // If time is already in 24-hour format (hours >= 13 or hours === 0 with minutes > 0)
    // Or if period is missing/empty, assume 24-hour format
    if (!period || period.trim() === '' || hours >= 13 || (hours === 0 && minutes > 0)) {
      return hours * 60 + minutes;
    }

    // Convert 12-hour to 24-hour format
    const periodUpper = period.toUpperCase();
    let hour24 = hours;

    if (periodUpper === 'AM') {
      hour24 = hours === 12 ? 0 : hours;
    } else if (periodUpper === 'PM') {
      hour24 = hours === 12 ? 12 : hours + 12;
    }

    return hour24 * 60 + minutes;
  };

  const hasBookingStarted = (booking: Booking): boolean =>
    canStartBooking(booking, bookingNow);

  // Helper function to check if booking time has ended
  const hasBookingEnded = (booking: Booking): boolean => {
    try {
      const now = new Date();
      const bookingDate = new Date(booking.date);
      if (isNaN(bookingDate.getTime())) return false;

      // Extract date components in LOCAL timezone
      const localYear = bookingDate.getFullYear();
      const localMonth = bookingDate.getMonth();
      const localDay = bookingDate.getDate();

      // Parse start time first
      const startTotalMinutes = convertTo24Hour(booking.startTime, booking.period);
      const startHour24 = Math.floor(startTotalMinutes / 60);
      const startMinute24 = startTotalMinutes % 60;
      const startDateTime = new Date(localYear, localMonth, localDay, startHour24, startMinute24, 0, 0);

      // Parse end time - need to determine correct period
      // If end time is less than start time when using same period, it means end time is in PM (if start is AM) or next day
      const [endHours, endMinutes] = booking.endTime.split(':').map(Number);
      const [startHours, startMinutes] = booking.startTime.split(':').map(Number);

      let endPeriod = booking.period;
      let endTotalMinutes = convertTo24Hour(booking.endTime, endPeriod);
      let endHour24 = Math.floor(endTotalMinutes / 60);
      let endMinute24 = endTotalMinutes % 60;

      // Check if end time is logically after start time
      // If start is AM and end time (with same period) is before start, end should be PM
      // Example: start 11:30 AM, end 12:30 -> should be 12:30 PM, not 12:30 AM
      if (booking.period && booking.period.toUpperCase() === 'AM') {
        const endWithSamePeriod = convertTo24Hour(booking.endTime, 'Am');
        const startWithPeriod = convertTo24Hour(booking.startTime, booking.period);

        // If end time with AM period is before start time, it means end is actually PM
        if (endWithSamePeriod < startWithPeriod && endHours === 12) {
          // 12:XX in AM period means midnight, but if it's after an AM start time, it should be PM (noon)
          endPeriod = 'Pm';
          endTotalMinutes = convertTo24Hour(booking.endTime, 'Pm');
          endHour24 = Math.floor(endTotalMinutes / 60);
          endMinute24 = endTotalMinutes % 60;
        }
      }

      // Create end datetime in LOCAL timezone
      const endDateTime = new Date(localYear, localMonth, localDay, endHour24, endMinute24, 0, 0);

      // If end time is still before start time, it's next day
      if (endDateTime < startDateTime) {
        endDateTime.setDate(endDateTime.getDate() + 1);
      }

      // Debug logging
      if (__DEV__) {
        console.log(`🔍 hasBookingEnded check for ${booking.bookingId}:`, {
          startTime: booking.startTime,
          endTime: booking.endTime,
          period: booking.period,
          endPeriod: endPeriod,
          startDateTime: startDateTime.toISOString(),
          endDateTime: endDateTime.toISOString(),
          now: now.toISOString(),
          hasEnded: now.getTime() >= endDateTime.getTime(),
        });
      }

      // Check if booking time has ended
      return now.getTime() >= endDateTime.getTime();
    } catch (e) {
      console.error('Error checking if booking ended:', e);
      return false;
    }
  };

  const getBookingImageSource = (booking: Booking) => {
    if (failedServiceImages[booking.bookingId]) {
      return DEFAULT_SERVICE_IMAGE_SOURCE;
    }

    return { uri: getServiceImageForBooking(booking) };
  };

  const handleServiceImageError = (booking: Booking, error?: string) => {
    console.warn('Service image failed, using fallback:', {
      bookingId: booking.bookingId,
      serviceName: booking.serviceName,
      imageUrl: getServiceImageForBooking(booking),
      error,
    });
    setFailedServiceImages(prev => ({
      ...prev,
      [booking.bookingId]: true,
    }));
  };

  // Card visibility depends on status. For upcoming tab, show both pending and confirmed bookings.
  const filteredBookings = useMemo(() => {
    if (activeTab === 'upcoming') {
      const upcomingList = bookings.filter(
        booking => booking.status === 'confirmed' || booking.status === 'pending'
      );
      // Prioritize pending bookings at the top so stylist can take action quickly
      return upcomingList.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return 0;
      });
    }
    return bookings.filter(booking => booking.status === getStatusForBookingTab(activeTab));
  }, [bookings, activeTab]);

  const emptyStateConfig = activeTab === 'upcoming'
    ? {
      icon: 'event-available',
      title: 'No upcoming bookings',
      subtitle: 'New appointments will appear here as soon as clients book your services.',
      actionLabel: 'Refresh Later',
    }
    : activeTab === 'ongoing'
      ? {
        icon: 'timelapse',
        title: 'No ongoing bookings',
        subtitle: 'When a session starts, it will show up here for quick actions.',
        actionLabel: 'View Upcoming',
      }
      : {
        icon: 'task-alt',
        title: 'No completed bookings yet',
        subtitle: 'Completed sessions will be listed here with details and ratings.',
        actionLabel: 'View Upcoming',
      };

  // Show upcoming booking details screen if a booking is selected
  if (selectedUpcomingBooking) {
    return (
      <UpcomingBookingDetailsScreen
        booking={selectedUpcomingBooking}
        userImage={userImages[selectedUpcomingBooking.userId] || null}
        onBack={() => setSelectedUpcomingBooking(null)}
        onHelp={onHelp}
        onOpenChat={() => {
          setChatBooking(selectedUpcomingBooking);
          setSelectedUpcomingBooking(null);
        }}
      />
    );
  }

  if (chatBooking && userId) {
    return (
      <BookingChatScreen
        bookingId={chatBooking.bookingId}
        currentUserId={userId}
        counterpartName={chatBooking.userName}
        serviceName={chatBooking.serviceName}
        onBack={() => setChatBooking(null)}
      />
    );
  }

  // Handle cancel booking with reason
  const handleCancelBooking = async (reason: string) => {
    if (!bookingToCancel) {
      Alert.alert('Error', 'No booking selected for cancellation.');
      return;
    }

    if (!userId) {
      Alert.alert('Error', 'User ID is required to cancel booking.');
      return;
    }

    if (!reason.trim()) {
      Alert.alert('Reason Required', 'Please provide a reason for cancellation.');
      return;
    }

    setCancellingBookingId(bookingToCancel.bookingId);

    try {
      // Step 1: Update booking status to cancelled
      console.log('📡 Step 1: Updating booking status to cancelled...');
      const statusApiUrl = `${API_BASE_URL_WITH_API}/bookings/${bookingToCancel.bookingId}/cancel-status`;
      const statusResponse = await fetch(statusApiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          bookingId: bookingToCancel.bookingId,
          userId: bookingToCancel.userId,
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
      const cancelApiUrl = `${API_BASE_URL_WITH_API}/bookings/${bookingToCancel.bookingId}/save-cancellation`;
      const cancelResponse = await fetch(cancelApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          userId: bookingToCancel.userId,
          stylistId: userId, // Current user is the stylist
          reason: reason.trim(),
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

      // Update bookings state to reflect the cancellation
      setBookings(prevBookings =>
        prevBookings.map(b =>
          b.bookingId === bookingToCancel.bookingId ? { ...b, status: 'cancelled' } : b
        )
      );

      // Cancel notification for this booking
      await cancelBookingNotification(bookingToCancel.bookingId);

      // Close modal and reset
      setShowCancelModal(false);
      setCancelReason('');
      setBookingToCancel(null);

      Alert.alert('Success', 'Booking cancelled successfully.');
    } catch (error) {
      console.error('❌ Error cancelling booking:', error);
      Alert.alert('Error', 'Failed to cancel booking. Please try again.');
    } finally {
      setCancellingBookingId(null);
    }
  };

  // Handle confirm pending booking
  const handleConfirmBooking = async (booking: Booking) => {
    if (!userId) {
      Alert.alert('Error', 'Stylist ID is required to confirm booking.');
      return;
    }

    setConfirmingBookingId(booking.bookingId);
    try {
      const response = await fetch(`${API_BASE_URL_WITH_API}/booking/update-status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          bookingId: booking.bookingId,
          userId: booking.userId,
          stylistId: userId,
          status: 'confirmed',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Confirm booking error:', errorText);
        throw new Error('Failed to confirm booking');
      }

      // Update local state to mark booking as confirmed
      setBookings(prevBookings =>
        prevBookings.map(b =>
          b.bookingId === booking.bookingId ? { ...b, status: 'confirmed' } : b
        )
      );

      // Cancel reminder notification if any was set
      await cancelBookingNotification(booking.bookingId);
      // Trigger global refresh so other screens/modals stay synced
      notifyBookingRefresh();

      Alert.alert('Booking Confirmed', 'The booking has been successfully accepted.');
    } catch (error) {
      console.error('❌ Error confirming booking:', error);
      Alert.alert('Error', 'Failed to confirm booking. Please try again.');
    } finally {
      setConfirmingBookingId(null);
    }
  };

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Glam Bookings</Text>
        <TouchableOpacity
          style={styles.helpButton}
          activeOpacity={0.7}
          onPress={() => {
            if (onHelp) {
              onHelp();
            }
          }}>
          <Text style={styles.helpButtonText}>HELP</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'ongoing' && styles.tabActive]}
          onPress={() => setActiveTab('ongoing')}
          activeOpacity={0.7}>
          {activeTab === 'ongoing' && (
            <LinearGradient
              colors={['#FD8B36', '#f7bb2c']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.tabGradient}
            />
          )}
          <Text style={[styles.tabText, activeTab === 'ongoing' && styles.tabTextActive]}>
            Ongoing
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'complete' && styles.tabActive]}
          onPress={() => setActiveTab('complete')}
          activeOpacity={0.7}>
          {activeTab === 'complete' && (
            <LinearGradient
              colors={['#FD8B36', '#f7bb2c']}
              start={{ x: 0.5, y: 0.5 }}
              end={{ x: 0.5, y: 0 }}
              style={styles.tabGradient}
            />
          )}
          <Text style={[styles.tabText, activeTab === 'complete' && styles.tabTextActive]}>
            Complete
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upcoming' && styles.tabActive]}
          onPress={() => setActiveTab('upcoming')}
          activeOpacity={0.7}>
          {activeTab === 'upcoming' && (
            <LinearGradient
              colors={['#FD8B36', '#f7bb2c']}
              start={{ x: 0.5, y: 0.5 }}
              end={{ x: 0.5, y: 0 }}
              style={styles.tabGradient}
            />
          )}
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>
            Upcoming
          </Text>
        </TouchableOpacity>
      </View>

      {/* {onHistory && (
        <TouchableOpacity
          onPress={onHistory}
          style={styles.historyLink}
          activeOpacity={0.7}>
          <Icon name="history" size={18} color="#FD8B36" />
          <Text style={styles.historyLinkText}>Completed & cancelled history</Text>
        </TouchableOpacity>
      )} */}

      {/* Bookings List */}
      {loading ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* Booking Cards Shimmer */}
          {[1, 2, 3].map((item) => (
            <View key={item} style={styles.bookingCardShimmer}>
              {/* Header Shimmer */}
              <View style={styles.bookingHeaderShimmer}>
                <Shimmer width={200} height={16} borderRadius={8} />
                <Shimmer width={60} height={24} borderRadius={12} />
              </View>

              {/* Content Shimmer */}
              <View style={styles.bookingContentShimmer}>
                <Shimmer width={80} height={80} borderRadius={20} />
                <View style={styles.bookingDetailsShimmer}>
                  <Shimmer width={120} height={16} borderRadius={8} style={{ marginBottom: 8 }} />
                  <Shimmer width={80} height={18} borderRadius={8} style={{ marginBottom: 8 }} />
                  <Shimmer width={150} height={14} borderRadius={8} />
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : filteredBookings.length > 0 ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {filteredBookings.map((booking) => (
            activeTab === 'complete' ? (
              // Complete Tab UI
              <TouchableOpacity
                key={booking.bookingId}
                style={styles.completeBookingCard}
                onPress={() => {
                  if (onCompletedBookingPress) {
                    onCompletedBookingPress(booking);
                  }
                }}
                activeOpacity={0.7}>
                <LinearGradient
                  colors={['#FFF3E8', '#FDF0E0']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.completeCardGradientBackground}
                />
                <View style={styles.completeBookingContent}>
                  {/* Service Provider Image */}
                  <View style={styles.completeImageContainer}>
                    <Image
                      source={getBookingImageSource(booking)}
                      style={styles.completeServiceImage}
                      onError={e => handleServiceImageError(booking, e.nativeEvent.error)}
                    />
                  </View>

                  {/* Booking Details */}
                  <View style={styles.completeBookingDetails}>
                    <Text style={styles.completeServiceName}>{booking.serviceName}</Text>
                    <View style={styles.completeInfoRow}>
                      <Text style={styles.completeDateText}>
                        {formatDateShort(booking.date)}
                      </Text>
                      <Icon name="access-time" size={14} color="#999" />
                      <Text style={styles.completeDurationText}>
                        {calculateDuration(booking.startTime, booking.endTime, booking.period)}
                      </Text>
                    </View>
                    {/* Address Section */}
                    {/* {(booking.salonLocation?.address || booking.homeLocation?.address) && (
                      <View style={styles.completeAddressRow}>
                        <Icon name="place" size={14} color="#999" />
                        <Text style={styles.completeAddressText} numberOfLines={2}>
                          {booking.serviceType === 'Home' && booking.homeLocation?.address
                            ? booking.homeLocation.address
                            : booking.serviceType === 'Salon' && booking.salonLocation?.address
                            ? booking.salonLocation.address
                            : booking.homeLocation?.address || booking.salonLocation?.address || 'Address not available'}
                        </Text>
                      </View>
                    )} */}
                  </View>

                  {/* Completed Button */}
                  <View style={styles.completedButton}>
                    <LinearGradient
                      colors={['#FD8B36', '#f7bb2c']}
                      start={{ x: 0.5, y: 0.5 }}
                      end={{ x: 0.5, y: 0 }}
                      style={styles.completedButtonGradient}
                    >
                      <Text style={styles.completedButtonText}>Completed</Text>
                    </LinearGradient>
                  </View>
                </View>
              </TouchableOpacity>
            ) : (
              // Ongoing/Upcoming Tab UI
              activeTab === 'upcoming' ? (
                // Upcoming Tab UI - New Design
                <TouchableOpacity
                  key={booking.bookingId}
                  style={styles.upcomingBookingCard}
                  onPress={() => setSelectedUpcomingBooking(booking)}
                  activeOpacity={0.7}>
                    {/* Date and Time Header with Service Type Badge & Status Badge */}
                    <View style={styles.upcomingDateTimeRow}>
                      <Text style={styles.upcomingDateTime}>
                        {formatDateTime(booking.date, booking.startTime, booking.period)}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {booking.status === 'pending' && (
                          <View style={styles.pendingBadge}>
                            <Icon name="schedule" size={12} color="#fff" style={{ marginRight: 4 }} />
                            <Text style={styles.pendingBadgeText}>Pending</Text>
                          </View>
                        )}
                        {booking.serviceType && (
                          <View style={[
                            styles.serviceTypeBadge,
                            booking.serviceType === 'Home' && styles.serviceTypeBadgeHome,
                            booking.serviceType === 'Salon' && styles.serviceTypeBadgeSalon,
                            booking.serviceType === 'Both' && styles.serviceTypeBadgeBoth,
                          ]}>
                            <Icon
                              name={booking.serviceType === 'Home' ? 'home' : booking.serviceType === 'Salon' ? 'store' : 'location-on'}
                              size={12}
                              color="#fff"
                              style={{ marginRight: 4 }}
                            />
                            <Text style={styles.serviceTypeBadgeText}>
                              {booking.serviceType === 'Home' ? 'At-Home' : booking.serviceType}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <View style={styles.upcomingBookingContent}>
                      <View style={styles.upcomingBookingContentRow}>
                        {/* Profile Image */}
                        <View style={styles.upcomingImageContainer}>
                          <Image
                            source={getBookingImageSource(booking)}
                            style={styles.upcomingServiceImage}
                            onError={e => handleServiceImageError(booking, e.nativeEvent.error)}
                          />
                        </View>

                        {/* Booking Details */}
                        <View style={styles.upcomingBookingDetails}>
                          <Text style={styles.upcomingUserName}>{booking.userName}</Text>
                          <Text style={styles.upcomingPrice}>₹{parseFloat((Number(booking.price) * 1.05).toFixed(2))}</Text>
                          <Text style={styles.upcomingServiceName}>
                            Service: {booking.serviceName}
                          </Text>
                        </View>
                      </View>

                      {/* Pending Action Row: Confirm Now and Cancel Buttons */}
                      {booking.status === 'pending' ? (
                        <View style={styles.pendingActionRow}>
                          <TouchableOpacity
                            style={[
                              styles.pendingCancelButton,
                              cancellingBookingId === booking.bookingId && styles.buttonDisabled,
                            ]}
                            onPress={() => {
                              modal.showConfirm(
                                'Decline Booking',
                                'Are you sure you want to decline this booking request?',
                                () => {
                                  setBookingToCancel(booking);
                                  setShowCancelModal(true);
                                },
                                () => {
                                  console.log('❌ User kept the booking request');
                                },
                                'Yes, Decline',
                                'Keep'
                              );
                            }}
                            disabled={cancellingBookingId === booking.bookingId || confirmingBookingId === booking.bookingId}
                            activeOpacity={0.7}>
                            {cancellingBookingId === booking.bookingId ? (
                              <ActivityIndicator size="small" color="#E53935" />
                            ) : (
                              <Text style={styles.pendingCancelButtonText}>Cancel</Text>
                            )}
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.confirmNowButton,
                              confirmingBookingId === booking.bookingId && styles.buttonDisabled,
                            ]}
                            onPress={() => handleConfirmBooking(booking)}
                            disabled={confirmingBookingId === booking.bookingId || cancellingBookingId === booking.bookingId}
                            activeOpacity={0.8}>
                            <LinearGradient
                              colors={['#FD8B36', '#f7bb2c']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={styles.confirmNowGradient}>
                              {confirmingBookingId === booking.bookingId ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <Text style={styles.confirmNowButtonText}>Confirm Now</Text>
                              )}
                            </LinearGradient>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        /* Confirmed Booking Row: Reminder Toggle + Start Now / Cancel Button */
                        <View style={styles.reminderRow}>
                          <View style={styles.reminderToggleContainer}>
                            <SmoothToggle
                              value={reminderToggles[booking.bookingId] || false}
                              onValueChange={(value) => {
                                setReminderToggles(prev => ({
                                  ...prev,
                                  [booking.bookingId]: value,
                                }));
                              }}
                              activeTrackColor="#FD8B36"
                              inactiveTrackColor="#E0E0E0"
                              thumbColor="#FFFFFF"
                            />
                            <Text style={styles.reminderText}>Will notify you 30 mins before</Text>
                          </View>

                          {hasBookingStarted(booking) ? (
                            <TouchableOpacity
                              style={styles.startButton}
                              onPress={() => {
                                if (onShowOTP && canStartBooking(booking)) {
                                  onShowOTP(booking, 'start');
                                }
                              }}
                              activeOpacity={0.7}>
                              <Text style={styles.startButtonText}>Start Now</Text>
                            </TouchableOpacity>
                          ) : (
                            canCancelBooking(booking) && (
                              <TouchableOpacity
                                style={[styles.cancelButton, cancellingBookingId === booking.bookingId && styles.buttonDisabled]}
                                onPress={() => {
                                  modal.showConfirm(
                                    'Cancel Booking',
                                    'Are you sure you want to cancel this booking?',
                                    () => {
                                      setBookingToCancel(booking);
                                      setShowCancelModal(true);
                                    },
                                    () => {
                                      console.log('❌ User cancelled the confirmation');
                                    },
                                    'Yes',
                                    'No'
                                  );
                                }}
                                disabled={cancellingBookingId === booking.bookingId}
                                activeOpacity={0.7}>
                                {cancellingBookingId === booking.bookingId ? (
                                  <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                  <Text style={styles.cancelButtonText}>Cancel</Text>
                                )}
                              </TouchableOpacity>
                            )
                          )}
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ) : (
                // Ongoing Tab UI - Existing Design
                <View key={booking.bookingId} style={styles.bookingCard}>
                  <TouchableOpacity
                    onPress={() => {
                      if (onBookingPress && activeTab === 'ongoing') {
                        onBookingPress(booking);
                      }
                    }}
                    activeOpacity={0.7}>
                    {/* Date and Time with Service Type Badge */}
                    <View style={styles.bookingHeader}>
                      <View style={styles.bookingDateTimeRow}>
                        <Text style={styles.bookingDateTime}>
                          {formatDateTime(booking.date, booking.startTime, booking.period)}
                        </Text>
                        {booking.serviceType && (
                          <View style={[
                            styles.serviceTypeBadge,
                            booking.serviceType === 'Home' && styles.serviceTypeBadgeHome,
                            booking.serviceType === 'Salon' && styles.serviceTypeBadgeSalon,
                            booking.serviceType === 'Both' && styles.serviceTypeBadgeBoth,
                          ]}>
                            <Icon
                              name={booking.serviceType === 'Home' ? 'home' : booking.serviceType === 'Salon' ? 'store' : 'location-on'}
                              size={12}
                              color="#fff"
                              style={{ marginRight: 4 }}
                            />
                            <Text style={styles.serviceTypeBadgeText}>
                              {booking.serviceType === 'Home' ? 'At-Home' : booking.serviceType}
                            </Text>
                          </View>
                        )}
                      </View>
                      {/* <View style={styles.statusIcon}>
                        <Icon name="check-circle" size={20} color="#4CAF50" />
                      </View> */}
                    </View>

                    <View style={styles.bookingContent}>
                      {/* Service Provider Image */}
                      <View style={styles.imageContainer}>
                        <Image
                          source={getBookingImageSource(booking)}
                          style={styles.serviceImage}
                          onError={e => handleServiceImageError(booking, e.nativeEvent.error)}
                        />
                      </View>

                      {/* Booking Details */}
                      <View style={styles.bookingDetails}>
                        <Text style={styles.userName}>{booking.userName}</Text>
                        <Text style={styles.price}>₹{parseFloat((Number(booking.price) * 1.05).toFixed(2))}</Text>
                        <Text style={styles.serviceName}>
                          Service: {booking.serviceName}
                        </Text>
                        {/* Address Section */}
                        {/* {(booking.salonLocation?.address || booking.homeLocation?.address) && (
                          <View style={styles.ongoingAddressRow}>
                            <Icon name="place" size={14} color="#666" />
                            <Text style={styles.ongoingAddressText} numberOfLines={2}>
                              {booking.serviceType === 'Home' && booking.homeLocation?.address
                                ? booking.homeLocation.address
                                : booking.serviceType === 'Salon' && booking.salonLocation?.address
                                ? booking.salonLocation.address
                                : booking.homeLocation?.address || booking.salonLocation?.address || 'Address not available'}
                            </Text>
                          </View>
                        )} */}
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* End Now Button - Show when booking time has ended */}
                  {hasBookingEnded(booking) && (
                    <TouchableOpacity
                      style={styles.endNowButton}
                      onPress={() => {
                        if (onShowOTP) {
                          // Pass booking and indicate it's for ending
                          onShowOTP(booking, 'end');
                        }
                      }}
                      activeOpacity={0.7}>
                      <Text style={styles.endNowButtonText}>End Now</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )
            )
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyContent}>
            <Icon name={emptyStateConfig.icon} size={48} color="#FD8B36" style={styles.emptyIcon} />
            {/* <Image
            source={require('../assets/noresultfound.gif')}
            style={styles.emptyGif}
            resizeMode="contain"
          /> */}
            <Text style={styles.emptyTitle}>{emptyStateConfig.title}</Text>
            <Text style={styles.emptyText}>{emptyStateConfig.subtitle}</Text>
            {activeTab !== 'upcoming' && (
              <TouchableOpacity
                style={styles.emptyActionButton}
                onPress={() => setActiveTab('upcoming')}
                activeOpacity={0.8}>
                <Text style={styles.emptyActionText}>{emptyStateConfig.actionLabel}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Rating Modal - Show for completed bookings without ratings */}
      {bookingToRate && userId && (
        <RatingModal
          visible={showRatingModal}
          bookingId={bookingToRate.bookingId}
          userId={bookingToRate.userId}
          stylistId={userId}
          userName={bookingToRate.userName}
          onClose={() => {
            setShowRatingModal(false);
            setRatedBookings(prev => new Set(prev).add(bookingToRate.bookingId));
            setBookingToRate(null);
          }}
          onRatingSubmitted={() => {
            setShowRatingModal(false);
            setRatedBookings(prev => new Set(prev).add(bookingToRate.bookingId));
            setBookingToRate(null);
            // Use the same guarded request as tab changes and booking refreshes.
            setRefreshVersion(prev => prev + 1);
          }}
        />
      )}

      {/* Cancel Booking Modal */}
      <Modal
        visible={showCancelModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => !cancellingBookingId && setShowCancelModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Cancel Booking</Text>
                  <TouchableOpacity
                    onPress={() => !cancellingBookingId && setShowCancelModal(false)}
                    disabled={!!cancellingBookingId}
                    style={styles.modalCloseButton}>
                    <Icon name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalSubtitle}>
                  Please provide a reason for cancelling this booking
                </Text>

                <TextInput
                  style={styles.reasonInput}
                  placeholder="Enter cancellation reason..."
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={4}
                  value={cancelReason}
                  onChangeText={setCancelReason}
                  editable={!cancellingBookingId}
                />

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelModalButton]}
                    onPress={() => {
                      setShowCancelModal(false);
                      setCancelReason('');
                      setBookingToCancel(null);
                    }}
                    disabled={!!cancellingBookingId}>
                    <Text style={styles.cancelModalButtonText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.confirmCancelButton,
                      (!cancelReason.trim() || cancellingBookingId) && styles.disabledButton,
                    ]}
                    onPress={() => {
                      if (!cancelReason.trim()) {
                        Alert.alert('Reason Required', 'Please provide a reason for cancellation.');
                        return;
                      }
                      handleCancelBooking(cancelReason);
                    }}
                    disabled={!cancelReason.trim() || !!cancellingBookingId}>
                    <LinearGradient
                      colors={['#FD8B36', '#f7bb2c']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.modalButtonGradient}
                    >
                      <Text style={styles.confirmCancelButtonText}>
                        {cancellingBookingId ? 'Cancelling...' : 'Confirm Cancellation'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
      <CustomModal
        visible={modal.visible}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        buttons={modal.buttons}
        onClose={modal.hideModal}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  historyLink: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 24,
    marginBottom: 12,
    paddingVertical: 6,
  },
  historyLinkText: {
    color: '#FD8B36',
    fontSize: 13,
    fontWeight: '600',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFF3E8',
    paddingTop: compactTopPadding(20),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: compactTopPadding(20),
    paddingBottom: 16,
    // backgroundColor: 'red',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: '#333',
  },
  helpButton: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#FD8B36',
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },


  helpButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FD8B36',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 16,
    gap: 8,
    backgroundColor: '#fff',
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: 40,
    marginHorizontal: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#f9f9f9',
  },
  tabActive: {
    backgroundColor: 'transparent',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
    zIndex: 1,
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  tabGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    zIndex: 0,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: compactTopPadding(16),
    paddingBottom: 100,
    backgroundColor: '#FFF3E8',
  },
  bookingCardShimmer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bookingHeaderShimmer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bookingContentShimmer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bookingDetailsShimmer: {
    flex: 1,
    marginLeft: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  emptyContent: {
    width: '100%',
    maxWidth: 320,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  emptyGif: {
    width: 180,
    height: 140,
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyIcon: {
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#707070',
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 290,
  },
  emptyActionButton: {
    marginTop: 14,
    backgroundColor: '#FD8B36',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  emptyActionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,

  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bookingDateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: "space-between",
  },
  bookingDateTime: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  statusIcon: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookingContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',


  },
  imageContainer: {
    marginRight: 12,
  },
  serviceImage: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
  },
  bookingDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  serviceName: {
    fontSize: 14,
    color: '#FD8B36',
    marginBottom: 0,
  },
  ongoingAddressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  ongoingAddressText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  // Complete Tab Styles
  completeBookingCard: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  completeCardGradientBackground: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
  },
  completeBookingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    position: 'relative',
    zIndex: 1,
  },
  completeImageContainer: {
    marginRight: 12,
  },
  completeServiceImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#E0E0E0',
  },
  completeBookingDetails: {
    flex: 1,
  },
  completeServiceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  completeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,

  },
  completeAddressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  completeAddressText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  completeDateText: {
    fontSize: 13,
    color: '#999',
  },
  completeDurationText: {
    fontSize: 13,
    color: '#999',
  },
  completedButton: {
    marginLeft: 8,
    marginTop: 4,
    borderRadius: 20,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  completedButtonGradient: {
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  // Upcoming Booking Card Styles
  upcomingBookingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  upcomingDateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    justifyContent: "space-between",
    width: "100%",
  },
  upcomingDateTime: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  upcomingBookingContent: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    // marginBottom: 12,
  },
  upcomingBookingContentRow: {
    flexDirection: 'row',
    marginBottom: 12,
    // alignItems: 'center',
  },
  upcomingImageContainer: {
    marginRight: 12,
  },
  upcomingServiceImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
  },
  upcomingBookingDetails: {
    flex: 1,
  },
  upcomingUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  upcomingPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  upcomingServiceName: {
    fontSize: 14,
    color: '#FD8B36',
    marginBottom: 12,
  },
  upcomingAddressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 8,
  },
  upcomingAddressText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    // backgroundColor:"red",
    width: "100%",
    justifyContent: "space-between",
  },
  reminderToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    flex: 1,
    paddingRight: 8,
  },
  reminderText: {
    fontSize: 14,
    color: '#666',
    flexShrink: 1,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
    marginLeft: 12,
    alignSelf: 'flex-start',
  },
  cancelButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  startButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#FFA778',
    marginLeft: 12,
    alignSelf: 'flex-start',
  },
  startButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
  },
  endNowButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#FFA778',
    borderRadius: 8,
    alignItems: 'center',
    // width:"25%",
    alignSelf: "flex-end",
  },
  endNowButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
  },
  // Cancel Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    textAlignVertical: 'top',
    minHeight: 100,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cancelModalButton: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#FD8B36',
  },
  cancelModalButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FD8B36',
  },
  confirmCancelButton: {
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  confirmCancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  modalButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  // Service Type Badge Styles
  serviceTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
    flexShrink: 0,
  },
  serviceTypeBadgeHome: {
    backgroundColor: 'rgba(76, 175, 80, 0.5)',
  },
  serviceTypeBadgeSalon: {
    backgroundColor: 'rgba(33, 150, 243, 0.5)',
  },
  serviceTypeBadgeBoth: {
    backgroundColor: 'rgba(255, 152, 0, 1)',
  },
  serviceTypeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  // Pending Booking Badge and Action Buttons
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#FF9800',
    marginLeft: 8,
  },
  pendingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase',
  },
  pendingActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  pendingCancelButton: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E53935',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingCancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E53935',
  },
  confirmNowButton: {
    flex: 1.5,
    height: 42,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#FD8B36',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  confirmNowGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmNowButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});

export default BookingsScreen;
