import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import SafeAreaView from '../components/SafeAreaView';
import { compactTopPadding } from '../utils/responsiveLayout';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from '../components/AppLinearGradient';
import { API_BASE_URL_WITH_API } from '../config/api';

interface HistoryScreenProps {
  userId?: string;
  onBack?: () => void;
  onBookingPress?: (booking: any) => void;
}

interface Booking {
  bookingId: string;
  userId?: string;
  userName: string;
  serviceName: string;
  date: string | Date;
  startTime: string;
  endTime: string;
  period: 'Am' | 'Pm';
  price: number;
  status: 'pending' | 'confirmed' | 'ongoing' | 'completed' | 'cancelled';
  createdAt?: string | Date;
  updatedAt?: string | Date;
  serviceImages?: { [key: string]: string }; // Object with gender keys and image values
  gender?: 'Male' | 'Female' | 'Other';
  cancelledBy?: 'user' | 'stylist' | 'styler' | 'system';
  cancellation?: { cancelledBy?: string };
}

// Helper function to get the appropriate service image based on booking gender and images object
const getServiceImageForBooking = (booking: Booking, defaultImage: string = 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=200&h=200&fit=crop'): string => {
  // If serviceImages object exists, try to get image for the booking gender
  if (booking.serviceImages && typeof booking.serviceImages === 'object') {
    const targetGender = booking.gender === 'Female' ? 'Female' : 
                        booking.gender === 'Male' ? 'Male' : 
                        null;
    
    if (targetGender) {
      // Try exact match first (case-sensitive)
      if (booking.serviceImages[targetGender]) {
        return booking.serviceImages[targetGender];
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
        return booking.serviceImages[matchingKey];
      }
      
      // Fallback to first available image
      if (imageKeys.length > 0 && booking.serviceImages[imageKeys[0]]) {
        return booking.serviceImages[imageKeys[0]];
      }
    } else {
      // If no gender specified, use first available image
      const imageKeys = Object.keys(booking.serviceImages);
      if (imageKeys.length > 0 && booking.serviceImages[imageKeys[0]]) {
        return booking.serviceImages[imageKeys[0]];
      }
    }
  }
  
  // Fallback to default image
  return defaultImage;
};

const PRIMARY_COLOR = '#FD8B36';
const BACKGROUND_COLOR = '#FFF3E8';

const HistoryScreen: React.FC<HistoryScreenProps> = ({ userId, onBack, onBookingPress }) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL_WITH_API}/stylist/bookings/${userId}?status=completed,cancelled`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Fetch history error:', errorText);
          throw new Error(`Failed to fetch history: ${response.status}`);
        }

        const result = await response.json();
        if (result.success && result.data && result.data.bookings) {

          // Filter for both completed and cancelled bookings
          const historyBookings = result.data.bookings.filter(
            (booking: Booking) => booking.status === 'completed' || booking.status === 'cancelled'
          );

          // Sort by date (most recent first)
          historyBookings.sort((a: Booking, b: Booking) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return dateB - dateA;
          });
          setBookings(historyBookings);
        }
      } catch (error) {
        console.error('❌ Error fetching history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [userId]);

  const formatDate = (date: string | Date): string => {
    const d = new Date(date);
    const day = d.getDate();
    const month = d.toLocaleString('default', { month: 'short' });
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const formatTime = (time: string, period: 'Am' | 'Pm'): string => {
    // Backend stores time in 24-hour format, convert to 12-hour format
    const [hours, minutes] = time.split(':');
    const hour24 = parseInt(hours, 10);
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    const minutesStr = minutes.toString().padStart(2, '0');
    return `${hour12}:${minutesStr} ${ampm}`;
  };

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
     
      {/* Header */}
        <View style={styles.header}>
          {onBack && (
            <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
              <Icon name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
          )}
        <Text style={styles.headerTitle}>History</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        </View>
      ) : bookings.length > 0 ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {bookings.map((booking) => (
            <TouchableOpacity
              key={booking.bookingId}
              style={styles.bookingCard}
              onPress={() => {
                if (onBookingPress) {
                  onBookingPress(booking);
                }
              }}
              activeOpacity={0.7}>
              <View style={styles.bookingHeader}>
                <View style={styles.serviceImageContainer}>
                  <Image
                    source={{
                      uri: getServiceImageForBooking(booking),
                    }}
                    style={styles.serviceImage}
                    resizeMode="cover"
                    onError={(e) => {
                      console.error('❌ Error loading service image:', e.nativeEvent.error);
                    }}
                  />
                </View>
                <View style={styles.bookingInfo}>
                  <Text style={styles.serviceName}>{booking.serviceName}</Text>
                  <Text style={styles.customerName}>{booking.userName}</Text>
                  <View style={styles.dateTimeRow}>
                    <Icon name="calendar-today" size={14} color={PRIMARY_COLOR} />
                    <Text style={styles.dateTimeText}>
                      {formatDate(booking.date)} • {formatTime(booking.startTime, booking.period)} - {formatTime(booking.endTime, booking.period)}
                    </Text>
                  </View>
                </View>
                <View style={styles.priceContainer}>
                  <Text style={styles.price}>₹{booking.price}</Text>
                  <View style={[
                    styles.statusBadge,
                    booking.status === 'completed' && styles.completedBadge,
                    booking.status === 'cancelled' && styles.cancelledBadge,
                  ]}>
                    <Text style={[
                      styles.statusText,
                      booking.status === 'completed' && styles.completedText,
                      booking.status === 'cancelled' && styles.cancelledText,
                    ]}>
                      {booking.status === 'completed'
                        ? 'Completed'
                        : booking.cancelledBy === 'system' || booking.cancellation?.cancelledBy === 'system'
                          ? 'Auto-cancelled'
                          : 'Cancelled'}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyContainer}>
          <Icon name="history" size={64} color={PRIMARY_COLOR} />
          <Text style={styles.emptyText}>No history found</Text>
          <Text style={styles.emptySubtext}>Your completed and cancelled bookings will appear here</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
    paddingTop: compactTopPadding(20),
    position: 'relative',
  },
  pageGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: compactTopPadding(20),
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    // borderWidth: 1,
    // borderColor: '#FFE6D3',
    // shadowColor: '#000',
    // shadowOffset: { width: 0, height: 2 },
    // shadowOpacity: 0.08,
    // shadowRadius: 6,
    // elevation: 4,
  },
  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceImageContainer: {
    width: 62,
    height: 62,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: '#f0f0f0',
  },
  serviceImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  bookingInfo: {
    flex: 1,
    marginRight: 12,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateTimeText: {
    fontSize: 12,
    color: '#666',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  completedBadge: {
    backgroundColor: '#4CAF50',
  },
  cancelledBadge: {
    backgroundColor: '#F44336',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  completedText: {
    color: '#fff',
  },
  cancelledText: {
    color: '#fff',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

export default HistoryScreen;
