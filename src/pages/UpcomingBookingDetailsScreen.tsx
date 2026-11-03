import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import SafeAreaView from '../components/SafeAreaView';
import { compactTopPadding } from '../utils/responsiveLayout';
import Icon from 'react-native-vector-icons/MaterialIcons';
import EvilIcon from 'react-native-vector-icons/EvilIcons';
import { toCloudFrontUrl } from '../utils/cdnUrl';

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
}

// Helper function to get the appropriate service image based on booking gender and images object
const getServiceImageForBooking = (booking: Booking, defaultImage: string = 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=200&h=200&fit=crop'): string => {
  // Debug logging
  console.log(`🔍 [UpcomingBookingDetails] getServiceImageForBooking called for booking ${booking.bookingId}:`, {
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

    console.log(`🎯 [UpcomingBookingDetails] Target gender: ${targetGender}`);

    if (targetGender) {
      // Try exact match first (case-sensitive)
      if (booking.serviceImages[targetGender]) {
        console.log(`✅ [UpcomingBookingDetails] Found exact match for gender "${targetGender}"`);
        return toCloudFrontUrl(booking.serviceImages[targetGender]) || defaultImage;
      }

      // Try case-insensitive match
      const imageKeys = Object.keys(booking.serviceImages);
      console.log(`🔑 [UpcomingBookingDetails] Available image keys: ${imageKeys.join(', ')}`);

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
        console.log(`✅ [UpcomingBookingDetails] Found case-insensitive match: "${matchingKey}"`);
        return toCloudFrontUrl(booking.serviceImages[matchingKey]) || defaultImage;
      }

      // Fallback to first available image
      if (imageKeys.length > 0 && booking.serviceImages[imageKeys[0]]) {
        console.log(`⚠️ [UpcomingBookingDetails] Using first available image: "${imageKeys[0]}"`);
        return toCloudFrontUrl(booking.serviceImages[imageKeys[0]]) || defaultImage;
      }
    } else {
      // If no gender specified, use first available image
      const imageKeys = Object.keys(booking.serviceImages);
      if (imageKeys.length > 0 && booking.serviceImages[imageKeys[0]]) {
        console.log(`⚠️ [UpcomingBookingDetails] No gender specified, using first available image: "${imageKeys[0]}"`);
        return toCloudFrontUrl(booking.serviceImages[imageKeys[0]]) || defaultImage;
      }
    }
  } else {
    console.log(`❌ [UpcomingBookingDetails] No serviceImages found or invalid format`);
  }

  // Fallback to default image
  console.log(`⚠️ [UpcomingBookingDetails] Returning default image`);
  return defaultImage;
};

interface UpcomingBookingDetailsScreenProps {
  booking: Booking;
  userImage?: string | null;
  onBack: () => void;
  onHelp?: () => void;
  onOpenChat?: () => void;
}

const UpcomingBookingDetailsScreen: React.FC<UpcomingBookingDetailsScreenProps> = ({
  booking,
  userImage,
  onBack,
  onHelp,
  onOpenChat,
}) => {
  const [addressExpanded, setAddressExpanded] = useState(true);

  // Format date and time
  const formatDateAndTime = (date: string, startTime: string, period: string): string => {
    const bookingDate = new Date(date);
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const day = bookingDate.getDate();
    const month = months[bookingDate.getMonth()];
    const year = bookingDate.getFullYear();

    // Backend stores time in 24-hour format, convert to 12-hour format
    const [hours, minutes] = startTime.split(':');
    const hour24 = parseInt(hours, 10);
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    const minutesStr = minutes.toString().padStart(2, '0');
    const formattedTime = `${hour12}:${minutesStr} ${ampm}`;

    return `${day} ${month} ${year}, ${formattedTime}`;
  };

  // Generate customer ID from booking ID
  const customerId = `#R${booking.bookingId.slice(-8).toUpperCase()}`;

  // Get addresses
  const salonAddress = booking.salonLocation?.address;
  const homeAddress = booking.homeLocation?.address;

  // Determine which addresses to show
  const hasSalonAddress = !!salonAddress;
  const hasHomeAddress = !!homeAddress;
  const showBothAddresses = hasSalonAddress && hasHomeAddress && salonAddress !== homeAddress;

  // For Home service, show homeLocation first; for Salon service, show salonLocation first
  const firstAddress = booking.serviceType === 'Home' && homeAddress
    ? { address: homeAddress, isHome: true }
    : salonAddress
      ? { address: salonAddress, isHome: false }
      : null;

  const secondAddress = showBothAddresses
    ? (booking.serviceType === 'Home' && salonAddress
      ? { address: salonAddress, isHome: false }
      : homeAddress && homeAddress !== salonAddress
        ? { address: homeAddress, isHome: true }
        : null)
    : null;

  // Parse service names (handle comma-separated)
  const serviceNames = booking.serviceName.split(',').map(s => s.trim());

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upcoming</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={true}>
        {/* First Card - Booking Details */}
        <View style={styles.bookingCard}>
          {/* Date and Time */}
          <Text style={styles.dateTimeText}>
            {formatDateAndTime(booking.date, booking.startTime, booking.period)}
          </Text>

          {/* Content Row */}
          <View style={styles.contentRow}>
            {/* Service Image */}
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: getServiceImageForBooking(booking) }}
                style={styles.profileImage}
                resizeMode="cover"
                onError={(e) => {
                  console.error('❌ [UpcomingBookingDetails] Error loading service image:', e.nativeEvent.error);
                }}
              />
            </View>

            {/* Details */}
            <View style={styles.detailsContainer}>
              <Text style={styles.userName}>{booking.userName}</Text>
              <View style={{ flexDirection: 'column' }}>
                <Text style={[styles.priceText, { marginBottom: 2 }]}>₹ {(Number(booking.price) * 1.05).toFixed(2)}</Text>
                <Text style={{ fontSize: 12, color: '#666' }}>
                  ₹{Number(booking.price).toFixed(2)} + ₹{(Number(booking.price) * 0.05).toFixed(2)} GST
                </Text>
              </View>
              <Text style={styles.serviceText}>
                Service: {serviceNames.join(', ')}
              </Text>
              {/* Gender and Service Type Badges */}
              <View style={styles.badgesContainer}>
                {booking.gender && (
                  <View style={[
                    styles.badge,
                    booking.gender === 'Male' && styles.genderBadgeMale,
                    booking.gender === 'Female' && styles.genderBadgeFemale,
                    booking.gender === 'Other' && styles.genderBadgeOther,
                  ]}>
                    <Icon
                      name={booking.gender === 'Male' ? 'male' : booking.gender === 'Female' ? 'female' : 'person'}
                      size={12}
                      color="#fff"
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.badgeText}>{booking.gender}</Text>
                  </View>
                )}
                {booking.serviceType && (
                  <View style={[
                    styles.badge,
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
                    <Text style={styles.badgeText}>{booking.serviceType}</Text>
                  </View>
                )}
              </View>

            </View>

          </View>

        </View>

        {/* Second Card - Address Details */}
        {(hasSalonAddress || hasHomeAddress) && (
          <View style={styles.addressCard}>
            <View style={styles.addressHeader}>
              <View style={styles.addressHeaderLeft}>
                <Text style={styles.addressTitle}>Address Details</Text>
                <Text style={styles.customerId}>{customerId}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setAddressExpanded(!addressExpanded)}
                style={styles.expandButton}>
                <Icon
                  name={addressExpanded ? 'expand-less' : 'expand-more'}
                  size={24}
                  color="#666"
                />
              </TouchableOpacity>
            </View>

            {addressExpanded && (
              <View style={styles.addressContent}>
                {/* For Salon service: Show "Client is coming soon" message */}
                {booking.serviceType === 'Salon' && salonAddress ? (
                  <View style={styles.clientComingSoonContainer}>
                    <Icon name="store" size={32} color="#FD8B36" />
                    <Text style={styles.clientComingSoonTitle}>Client is coming soon</Text>
                    <Text style={styles.clientComingSoonSubtitle}>
                      The client will arrive at your location
                    </Text>
                    {salonAddress && (
                      <View style={styles.salonAddressContainer}>
                        <Icon name="place" size={16} color="#666" />
                        <Text style={styles.salonAddressText}>{salonAddress}</Text>
                      </View>
                    )}
                  </View>
                ) : booking.serviceType === 'Home' && (hasHomeAddress || hasSalonAddress) ? (
                  <>
                    {/* For Home service: Show "From" (salon/stylist location) and "To" (home) */}
                    {salonAddress && (
                      <View style={styles.addressItem}>
                        <View style={styles.addressDotContainer}>
                          <View style={[styles.addressDot, styles.greenDot]}>
                            <EvilIcon name="location" size={12} color="#fff" />
                          </View>
                          {homeAddress && <View style={styles.addressLine} />}
                        </View>
                        <View style={styles.addressTextContainer}>
                          <Text style={styles.addressLabel}>FROM</Text>
                          <Text style={styles.addressPrimary} numberOfLines={1}>
                            {salonAddress.split(',')[0] || salonAddress}
                          </Text>
                          <Text style={styles.addressSecondary} numberOfLines={3}>
                            {salonAddress}
                          </Text>
                        </View>
                      </View>
                    )}

                    {homeAddress && (
                      <View style={styles.addressItem}>
                        <View style={styles.addressDotContainer}>
                          <View style={[styles.addressDot, styles.orangeDot]}>
                            <EvilIcon name="location" size={12} color="#fff" />
                          </View>
                        </View>
                        <View style={styles.addressTextContainer}>
                          <Text style={styles.addressLabel}>TO</Text>
                          <Text style={styles.addressPrimary} numberOfLines={1}>
                            {homeAddress.split(',')[0] || homeAddress}
                          </Text>
                          <Text style={styles.addressSecondary} numberOfLines={3}>
                            {homeAddress}
                          </Text>
                        </View>
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    {/* Fallback: Show addresses if available */}
                    {firstAddress && (
                      <View style={styles.addressItem}>
                        <View style={styles.addressDotContainer}>
                          <View style={[styles.addressDotRing, styles.greenDotRing]}>
                            <EvilIcon name="location" size={20} color="#4CAF50" />
                          </View>
                          {secondAddress && <View style={styles.addressLine} />}
                        </View>
                        <View style={styles.addressTextContainer}>
                          <Text style={styles.addressPrimary} numberOfLines={1}>
                            {firstAddress.address.split(',')[0] || firstAddress.address}
                          </Text>
                          <Text style={styles.addressSecondary} numberOfLines={3}>
                            {firstAddress.address}
                          </Text>
                        </View>
                      </View>
                    )}

                    {secondAddress && (
                      <View style={styles.addressItem}>
                        <View style={styles.addressDotContainer}>
                          <View style={[styles.addressDotRing, styles.orangeDotRing]}>
                            <EvilIcon name="location" size={20} color="#FD8B36" />
                          </View>
                        </View>
                        <View style={styles.addressTextContainer}>
                          <Text style={styles.addressPrimary} numberOfLines={1}>
                            {secondAddress.address.split(',')[0] || secondAddress.address}
                          </Text>
                          <Text style={styles.addressSecondary} numberOfLines={3}>
                            {secondAddress.address}
                          </Text>
                        </View>
                      </View>
                    )}

                    {!firstAddress && !secondAddress && (
                      <Text style={styles.addressSecondary}>Address not available</Text>
                    )}
                  </>
                )}
              </View>
            )}
          </View>
        )}

        <TouchableOpacity
          style={styles.chatSection}
          activeOpacity={0.7}
          onPress={onOpenChat}>
          <Icon name="chat" size={24} color="#FD8B36" />
          <View style={styles.helpTextContainer}>
            <Text style={styles.helpTitle}>Chat With Client</Text>
            <Text style={styles.helpSubtitle}>Share quick booking updates</Text>
          </View>
          <Icon name="chevron-right" size={24} color="#FD8B36" />
        </TouchableOpacity>

        {/* Need Help Section */}
        <TouchableOpacity
          style={styles.helpSection}
          activeOpacity={0.7}
          onPress={() => {
            if (onHelp) {
              onHelp();
            }
          }}>
          <Icon name="headset-mic" size={24} color="#FD8B36" />
          <View style={styles.helpTextContainer}>
            <Text style={styles.helpTitle}>Need Help?</Text>
            <Text style={styles.helpSubtitle}>We're a tap away</Text>
          </View>
          <Icon name="chevron-right" size={24} color="#FD8B36" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF3E8',
    paddingTop: compactTopPadding(20),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: compactTopPadding(12),
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '500',
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
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  dateTimeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  imageContainer: {
    marginRight: 12,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
  },
  profileImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsContainer: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  serviceText: {
    fontSize: 14,
    color: '#FD8B36',
    marginTop: 4,
    marginBottom: 8,
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,

  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#666',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  genderBadgeMale: {
    backgroundColor: 'rgba(33, 150, 243, 0.5)',
  },
  genderBadgeFemale: {
    backgroundColor: 'rgba(233, 30, 99, 0.5)',
  },
  genderBadgeOther: {
    backgroundColor: 'rgba(156, 39, 176, 0.5)',
  },
  serviceTypeBadgeHome: {
    backgroundColor: 'rgba(76, 175, 80, 0.5)',
  },
  serviceTypeBadgeSalon: {
    backgroundColor: 'rgba(33, 150, 243, 0.5)',
  },
  serviceTypeBadgeBoth: {
    backgroundColor: 'rgba(255, 152, 0, 0.5)',
  },
  addressCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  addressHeaderLeft: {
    flex: 1,
  },
  addressTitle: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  customerId: {
    fontSize: 12,
    color: '#999',
  },
  expandButton: {
    padding: 4,
  },
  addressContent: {
    marginTop: 8,
  },
  addressItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  addressDotContainer: {
    alignItems: 'center',
    marginRight: 12,
    minWidth: 24,
  },
  addressDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressDotRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  greenDotRing: {
    borderColor: '#4CAF50',
  },
  orangeDotRing: {
    borderColor: '#FD8B36',
  },
  greenDot: {
    backgroundColor: '#4CAF50',
  },
  orangeDot: {
    backgroundColor: '#FD8B36',
  },
  addressLine: {
    width: 2,
    height: 50,
    marginTop: 4,
    marginBottom: 4,
    borderLeftWidth: 2,
    borderLeftColor: '#E0E0E0',
    borderStyle: 'dashed',
  },
  addressTextContainer: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  addressPrimary: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
    lineHeight: 20,
  },
  addressSecondary: {
    fontSize: 13,
    color: '#999',
    lineHeight: 18,
  },
  clientComingSoonContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  clientComingSoonTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
    marginBottom: 8,
  },
  clientComingSoonSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  salonAddressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    width: '100%',
    gap: 8,
  },
  salonAddressText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  chatSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0E4',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFD3B5',
  },
  helpSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FD8B3661',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  helpTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  helpSubtitle: {
    fontSize: 14,
    color: '#666',
  },
});

export default UpcomingBookingDetailsScreen;
