import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Animated,
} from 'react-native';
import SafeAreaView from '../components/SafeAreaView';
import { compactTopPadding } from '../utils/responsiveLayout';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from '../components/AppLinearGradient';
import { API_BASE_URL_WITH_API } from '../config/api';
import { toCloudFrontUrl } from '../utils/cdnUrl';

interface BookingDetailsScreenProps {
  bookingId: string;
  booking: {
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
  };
  onBack: () => void;
  onShowOTP?: (actionType: 'start' | 'end') => void;
}

// Helper function to get the appropriate service image based on booking gender and images object
const getServiceImageForBooking = (
  booking: BookingDetailsScreenProps['booking'],
  defaultImage: string = 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=200&h=200&fit=crop',
): string => {
  // If serviceImages object exists, try to get image for the booking gender
  if (booking.serviceImages && typeof booking.serviceImages === 'object') {
    const targetGender =
      booking.gender === 'Female'
        ? 'Female'
        : booking.gender === 'Male'
        ? 'Male'
        : null;

    if (targetGender) {
      // Try exact match first (case-sensitive)
      if (booking.serviceImages[targetGender]) {
        return toCloudFrontUrl(booking.serviceImages[targetGender]) || defaultImage;
      }

      // Try case-insensitive match
      const imageKeys = Object.keys(booking.serviceImages);
      const matchingKey = imageKeys.find(key => {
        const keyLower = key.toLowerCase();
        const targetLower = targetGender.toLowerCase();
        return (
          keyLower === targetLower ||
          (keyLower === 'female' && targetLower === 'female') ||
          (keyLower === 'male' && targetLower === 'male') ||
          (keyLower === 'women' && targetLower === 'female') ||
          (keyLower === 'men' && targetLower === 'male')
        );
      });

      if (matchingKey && booking.serviceImages[matchingKey]) {
        return toCloudFrontUrl(booking.serviceImages[matchingKey]) || defaultImage;
      }

      // Fallback to first available image
      if (imageKeys.length > 0 && booking.serviceImages[imageKeys[0]]) {
        return toCloudFrontUrl(booking.serviceImages[imageKeys[0]]) || defaultImage;
      }
    } else {
      // If no gender specified, use first available image
      const imageKeys = Object.keys(booking.serviceImages);
      if (imageKeys.length > 0 && booking.serviceImages[imageKeys[0]]) {
        return toCloudFrontUrl(booking.serviceImages[imageKeys[0]]) || defaultImage;
      }
    }
  }

  // Fallback to default image
  return defaultImage;
};

const BookingDetailsScreen: React.FC<BookingDetailsScreenProps> = ({
  booking,
  onBack,
  onShowOTP,
}) => {
  const [timeLeft, setTimeLeft] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [stylistInfo, setStylistInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const pulse = useRef(new Animated.Value(1)).current;

  // Extract city, state, and country from address
  const getLocationShort = (address: string | undefined): string => {
    if (!address) return 'Address not available';

    // Split address by comma
    const parts = address
      .split(',')
      .map(part => part.trim())
      .filter(part => part.length > 0);

    // Usually address format: street, area, city, state, country
    // Or: street, city, state, country
    // We want the last 3 parts (city, state, country) if available
    if (parts.length >= 3) {
      // Take last 3 parts (city, state, country)
      return parts.slice(-3).join(', ');
    } else if (parts.length === 2) {
      // Take last 2 parts (city, state or city, country)
      return parts.slice(-2).join(', ');
    } else if (parts.length === 1) {
      // If only one part, return it
      return parts[0];
    } else {
      return 'Address not available';
    }
  };
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  // Calculate time left for ongoing booking
  useEffect(() => {
    const calculateTimeLeft = () => {
      try {
        const now = new Date();
        const bookingDate = new Date(booking.date);
        if (isNaN(bookingDate.getTime())) {
          console.error('Invalid booking date:', booking.date);
          setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
          return;
        }

        // Extract date components in LOCAL timezone
        const localYear = bookingDate.getFullYear();
        const localMonth = bookingDate.getMonth();
        const localDay = bookingDate.getDate();

        // Backend stores time in 24-hour format (e.g., "14:00", "09:30")
        // Parse time strings safely
        const startTimeParts = booking.startTime.split(':');
        const endTimeParts = booking.endTime.split(':');

        if (startTimeParts.length < 2 || endTimeParts.length < 2) {
          console.error('Invalid time format:', {
            startTime: booking.startTime,
            endTime: booking.endTime,
          });
          setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
          return;
        }

        const startHours = parseInt(startTimeParts[0], 10);
        const startMinutes = parseInt(startTimeParts[1], 10) || 0;
        const endHours = parseInt(endTimeParts[0], 10);
        const endMinutes = parseInt(endTimeParts[1], 10) || 0;

        // Validate parsed values
        if (
          isNaN(startHours) ||
          isNaN(startMinutes) ||
          isNaN(endHours) ||
          isNaN(endMinutes)
        ) {
          console.error('Invalid time values:', {
            startHours,
            startMinutes,
            endHours,
            endMinutes,
          });
          setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
          return;
        }

        // Validate hour range (0-23) and minute range (0-59)
        if (
          startHours < 0 ||
          startHours > 23 ||
          startMinutes < 0 ||
          startMinutes > 59 ||
          endHours < 0 ||
          endHours > 23 ||
          endMinutes < 0 ||
          endMinutes > 59
        ) {
          console.error('Time values out of range:', {
            startHours,
            startMinutes,
            endHours,
            endMinutes,
          });
          setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
          return;
        }

        const startDateTime = new Date(
          localYear,
          localMonth,
          localDay,
          startHours,
          startMinutes,
          0,
          0,
        );
        const endDateTime = new Date(
          localYear,
          localMonth,
          localDay,
          endHours,
          endMinutes,
          0,
          0,
        );

        // If end time is before start time, it means it's the next day
        if (endDateTime < startDateTime) {
          endDateTime.setDate(endDateTime.getDate() + 1);
        }

        const diff = endDateTime.getTime() - now.getTime();

        if (diff > 0) {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          setTimeLeft({ hours, minutes, seconds });
        } else {
          setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
        }
      } catch (error) {
        console.error('Error calculating time left:', error);
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [booking]);

  // Fetch stylist info (assuming we have stylistId in booking)
  useEffect(() => {
    const fetchStylistInfo = async () => {
      // For now, we'll use mock data or fetch from API if stylistId is available
      // TODO: Add stylistId to booking data structure
      setLoading(false);
    };

    fetchStylistInfo();
  }, []);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const formatTime = (time: string, period?: string): string => {
    // Backend stores time in 24-hour format, convert to 12-hour format
    // Always treat as 24-hour format regardless of period parameter
    const [hoursStr, minutesStr] = time.split(':');
    const hour24 = parseInt(hoursStr, 10);

    // Handle edge cases
    if (isNaN(hour24)) {
      return time; // Return original if parsing fails
    }

    // Convert to 12-hour format
    let hour12: number;
    if (hour24 === 0) {
      hour12 = 12; // Midnight (00:00) = 12:00 AM
    } else if (hour24 === 12) {
      hour12 = 12; // Noon (12:00) = 12:00 PM
    } else if (hour24 > 12) {
      hour12 = hour24 - 12; // Afternoon/evening
    } else {
      hour12 = hour24; // Morning
    }

    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    const minutes = minutesStr || '00';
    const minutesPadded = minutes.padStart(2, '0');

    return `${hour12}:${minutesPadded} ${ampm}`;
  };

  const formatDateTime = (
    dateString: string,
    startTime: string,
    period?: string,
  ): string => {
    return `${formatDate(dateString)}, ${formatTime(startTime, period)}`;
  };

  // Calculate duration from start/end time
  const calculateDuration = (): string => {
    try {
      const bookingDate = new Date(booking.date);
      if (isNaN(bookingDate.getTime())) {
        console.error('Invalid booking date for duration:', booking.date);
        return '0.0';
      }

      // Extract date components in LOCAL timezone
      const localYear = bookingDate.getFullYear();
      const localMonth = bookingDate.getMonth();
      const localDay = bookingDate.getDate();

      // Backend stores time in 24-hour format (e.g., "14:00", "09:30")
      // Parse time strings safely
      const startTimeParts = booking.startTime.split(':');
      const endTimeParts = booking.endTime.split(':');

      if (startTimeParts.length < 2 || endTimeParts.length < 2) {
        console.error('Invalid time format for duration:', {
          startTime: booking.startTime,
          endTime: booking.endTime,
        });
        return '0.0';
      }

      const startHours = parseInt(startTimeParts[0], 10);
      const startMinutes = parseInt(startTimeParts[1], 10) || 0;
      const endHours = parseInt(endTimeParts[0], 10);
      const endMinutes = parseInt(endTimeParts[1], 10) || 0;

      // Validate parsed values
      if (
        isNaN(startHours) ||
        isNaN(startMinutes) ||
        isNaN(endHours) ||
        isNaN(endMinutes)
      ) {
        console.error('Invalid time values for duration:', {
          startHours,
          startMinutes,
          endHours,
          endMinutes,
        });
        return '0.0';
      }

      // Validate hour range (0-23) and minute range (0-59)
      if (
        startHours < 0 ||
        startHours > 23 ||
        startMinutes < 0 ||
        startMinutes > 59 ||
        endHours < 0 ||
        endHours > 23 ||
        endMinutes < 0 ||
        endMinutes > 59
      ) {
        console.error('Time values out of range for duration:', {
          startHours,
          startMinutes,
          endHours,
          endMinutes,
        });
        return '0.0';
      }

      const start = new Date(
        localYear,
        localMonth,
        localDay,
        startHours,
        startMinutes,
        0,
        0,
      );
      const end = new Date(
        localYear,
        localMonth,
        localDay,
        endHours,
        endMinutes,
        0,
        0,
      );

      // If end time is before start time, it's next day
      if (end < start) {
        end.setDate(end.getDate() + 1);
      }

      const diffMs = end.getTime() - start.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      return diffHours.toFixed(1);
    } catch (e) {
      console.error('Error calculating duration:', e);
      return '0.0';
    }
  };

  // Calculate admin fee (2.5% of price)
  const adminFee = (booking.price * 0.025).toFixed(2);
  const totalPrice = (booking.price + parseFloat(adminFee)).toFixed(0);

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ongoing </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Ongoing Booking Section */}
        <View style={styles.section}>
          {/* <Text style={styles.sectionTitle}>Ongoing Booking</Text> */}
          <View style={styles.ongoingCard}>
            <TouchableOpacity style={styles.salonButton} activeOpacity={0.7}>
              <LinearGradient
                colors={['#FD8B36', '#f7bb2c']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.salonButtonGradient}
              >
                <Text style={styles.salonButtonText}>
                  {booking.serviceType === 'Home'
                    ? 'Home'
                    : booking.serviceType === 'Salon'
                    ? 'Salon'
                    : booking.serviceType === 'Both'
                    ? 'Both'
                    : 'Salon'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
            <View style={styles.ongoingHeader}>
              <View style={styles.serviceIconContainer}>
                <Icon name="content-cut" size={32} color="#333" />
              </View>
              <View style={styles.serviceInfo}>
                <View style={styles.serviceNameRow}>
                  <Text style={styles.serviceNameText}>
                    {booking.serviceName}
                  </Text>
                  <View style={styles.liveContainer}>
                    <Animated.View
                      style={[styles.liveDot, { opacity: pulse }]}
                    />
                    <Text style={styles.liveText}>LIVE</Text>
                  </View>
                </View>
                <Text style={styles.durationText}>
                  Time Duration: {calculateDuration()} Hrs.
                </Text>
              </View>
            </View>

            {/* Timer Section */}
            <View style={styles.timerSection}>
              <Text style={styles.timerLabel}>Time Left</Text>
              <View style={styles.timerContainer}>
                <View style={styles.timerBox}>
                  <Text style={styles.timerValue}>
                    {String(timeLeft.hours).padStart(2, '0')}
                  </Text>
                  <Text style={styles.timerLabel}>Hours</Text>
                </View>
                <View style={styles.timerBox}>
                  <Text style={styles.timerValue}>
                    {String(timeLeft.minutes).padStart(2, '0')}
                  </Text>
                  <Text style={styles.timerLabel}>Minutes</Text>
                </View>
                <View style={styles.timerBox}>
                  <Text style={styles.timerValue}>
                    {String(timeLeft.seconds).padStart(2, '0')}
                  </Text>
                  <Text style={styles.timerLabel}>Seconds</Text>
                </View>
              </View>
            </View>

            {/* Price at bottom */}
            <View style={styles.priceRow}>
              <Icon name="account-balance-wallet" size={20} color="#FD8B36" />
              <Text style={styles.priceText}>₹{(Number(booking.price) * 1.05).toFixed(2)}</Text>
            </View>

            {/* End Now Button - Only show for ongoing bookings */}
            {booking.status === 'ongoing' && (
              <TouchableOpacity
                style={styles.endNowButton}
                onPress={() => {
                  if (onShowOTP) {
                    onShowOTP('end');
                  }
                }}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['#FD8B36', '#f7bb2c']}
                  start={{ x: 0.5, y: 0.5 }}
                  end={{ x: 0.5, y: 0 }}
                  style={styles.endNowButtonGradient}
                >
                  <Text style={styles.endNowButtonText}>End Now</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Upcoming Booking Details */}
        <View style={styles.section}>
          <View style={styles.bookingCard}>
            <Text style={styles.dateTimeText}>
              {formatDateTime(booking.date, booking.startTime, booking.period)}
            </Text>

            <View style={styles.bookingContent}>
              <Image
                source={{
                  uri: getServiceImageForBooking(booking),
                }}
                style={styles.stylistImage}
              />

              <View style={styles.bookingDetails}>
                <Text style={styles.stylistName}>{booking.userName}</Text>
                <View style={styles.locationRow}>
                  <Icon name="place" size={16} color="#666" />
                  <Text style={styles.locationText} numberOfLines={2}>
                    {getLocationShort(
                      booking.salonLocation?.address ||
                        booking.homeLocation?.address,
                    )}
                  </Text>
                </View>
                <Text style={styles.serviceText}>
                  Service: {booking.serviceName}
                </Text>
              </View>
              <View style={styles.bookingHeader}>
                <Text style={styles.bookingPrice}>₹{(Number(booking.price) * 1.05).toFixed(2)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Price Details Section */}
        <View style={styles.section}>
          <Text style={styles.priceDetailsTitle}>Price Details</Text>
          <View style={styles.priceDetailsCard}>
            <View style={styles.priceDetailRow}>
              <Text style={styles.priceDetailLabel}>Service Base Cost</Text>
              <Text style={styles.priceDetailValue}>₹{Number(booking.price).toFixed(2)}</Text>
            </View>
            <View style={styles.priceDetailRow}>
              <Text style={styles.priceDetailLabel}>GST (5%)</Text>
              <Text style={styles.priceDetailValue}>₹{(Number(booking.price) * 0.05).toFixed(2)}</Text>
            </View>
            {/*   */}
            <View style={styles.priceDivider} />
            <View style={styles.priceDetailRow}>
              <Text style={styles.totalLabel}>Total price</Text>
              <Text style={styles.totalValue}>₹{(Number(booking.price) * 1.05).toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Promo Section */}
        {/* <View style={styles.section}>
          <Text style={styles.promoTitle}>Promo</Text>
          <TouchableOpacity style={styles.promoButton} activeOpacity={0.7}>
            <View style={styles.promoButtonLeft}>
              <Icon name="local-offer" size={20} color="#2196F3" />
              <Text style={styles.promoButtonText}>Select</Text>
            </View>
            <Icon name="chevron-right" size={24} color="#999" />
          </TouchableOpacity>
        </View> */}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF3E8',
    // marginTop: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: compactTopPadding(40),
    paddingBottom: 16,
    // backgroundColor: 'red',
  },
  backButton: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    // backgroundColor: 'blue',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: compactTopPadding(16),
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  ongoingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ongoingHeader: {
    flexDirection: 'row',
    // justifyContent: 'space-between',
    // alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  serviceIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  salonButton: {
    position: 'absolute',
    right: 20,
    top: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  salonButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  salonButtonGradient: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    alignItems: 'center',
  },
  serviceInfo: {
    // marginBottom: 20,
    // backgroundColor:"red",
    justifyContent: 'center',
    // alignItems:"center",
  },
  serviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  serviceNameText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    // backgroundColor:"blue",
  },
  durationText: {
    fontSize: 14,
    color: '#666',
    // backgroundColor:"red",
  },
  timerSection: {
    marginBottom: 20,
  },
  timerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  timerContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  timerBox: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  timerValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: compactTopPadding(16),
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    width: '100%',
    justifyContent: 'center',
  },
  priceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FD8B36',
  },
  endNowButton: {
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  endNowButtonGradient: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endNowButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  dateTimeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    // borderWidth:1,
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
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  bookingPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  bookingContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stylistImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
    marginRight: 12,
  },
  bookingDetails: {
    flex: 1,
  },
  stylistName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#666',
  },
  serviceText: {
    fontSize: 14,
    color: '#FD8B36',
  },
  priceDetailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FD8B36',
    marginBottom: 12,
  },
  priceDetailsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    // shadowColor: '#000',
    // shadowOffset: {
    //   width: 0,
    //   height: 2,
    // },
    // shadowOpacity: 0.1,
    // shadowRadius: 4,
    // elevation: 3,
  },
  priceDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  priceDetailLabel: {
    fontSize: 14,
    color: '#666',
  },
  priceDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  priceDivider: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    borderStyle: 'dashed',
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  promoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  promoButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
  },
  promoButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  promoButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2196F3',
  },
  liveContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    marginLeft: 8,
  },

  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 4,
  },

  liveText: {
    fontSize: 8,
    fontWeight: '600',
    color: '#4CAF50',
  },
});

export default BookingDetailsScreen;
