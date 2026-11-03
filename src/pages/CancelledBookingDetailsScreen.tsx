import React, { useState, useEffect } from 'react';
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
import { toCloudFrontUrl } from '../utils/cdnUrl';
import { API_BASE_URL_WITH_API } from '../config/api';

interface CancelledBookingDetailsScreenProps {
  bookingId: string;
  booking: {
    bookingId: string;
    userId: string;
    userName: string;
    stylistId?: string;
    serviceName: string;
    date: string;
    startTime: string;
    endTime: string;
    period: string;
    price: number;
    status: 'confirmed' | 'completed' | 'cancelled';
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
    stylistRating?: number;
    stylistRatingComment?: string;
    stylistRatedAt?: string;
  };
  stylistId?: string; // Stylist's own ID (for fetching stylist profile image)
  onBack: () => void;
  onHelp?: () => void;
}

// Helper function to get the appropriate service image based on booking gender and images object
const getServiceImageForBooking = (booking: CancelledBookingDetailsScreenProps['booking'], defaultImage: string = 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=200&h=200&fit=crop'): string => {
  // If serviceImages object exists, try to get image for the booking gender
  if (booking.serviceImages && typeof booking.serviceImages === 'object') {
    const targetGender = booking.gender === 'Female' ? 'Female' : 
                        booking.gender === 'Male' ? 'Male' : 
                        null;
    
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
        return keyLower === targetLower || 
               (keyLower === 'female' && targetLower === 'female') ||
               (keyLower === 'male' && targetLower === 'male') ||
               (keyLower === 'women' && targetLower === 'female') ||
               (keyLower === 'men' && targetLower === 'male');
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

const CancelledBookingDetailsScreen: React.FC<CancelledBookingDetailsScreenProps> = ({
  booking,
  stylistId,
  onBack,
  onHelp,
}) => {
  const [addressExpanded, setAddressExpanded] = useState(false);
  const [fareExpanded, setFareExpanded] = useState(false);
  const [stylistImage, setStylistImage] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(true);
  const [stylistData, setStylistData] = useState<any>(null);
  const [loadingStylistData, setLoadingStylistData] = useState(true);
  const [rating, setRating] = useState<number>(0);
  const [ratingComment, setRatingComment] = useState<string>('');
  
  // Log booking data and extract rating
  useEffect(() => {
    const customerRatingOfStylist = (booking as any).rating || 0;
    const customerComment = (booking as any).ratingComment || '';

    setRating(customerRatingOfStylist);
    setRatingComment(customerComment);
  }, [booking]);

  // Fetch stylist profile data (image and all details from API)
  useEffect(() => {
    const fetchStylistData = async () => {
      // Priority: stylistId prop > booking.stylistId > booking.userId (fallback)
      // In Glammefy Partner, the logged-in user IS the stylist, so stylistId prop should be passed
      const idToUse = stylistId || booking.stylistId;
      
      if (!idToUse) {
        setLoadingImage(false);
        setLoadingStylistData(false);
        return;
      }

      try {
        console.log('📡 Fetching stylist data for ID:', idToUse);
        const apiUrl = `${API_BASE_URL_WITH_API}/profile/stylist/${idToUse}`;
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        if (response.ok) {
          const result = await response.json();
          console.log('✅ Stylist API response:', JSON.stringify(result, null, 2));
          
          if (result.success && result.data) {
            // Store complete stylist data
            setStylistData(result.data);
     
            
            // Get profile image from stylist profile (check multiple possible fields)
            const profileImage = result.data.profileImage || result.data.image || result.data.profileImageUrl;
            if (profileImage) {
              console.log('✅ Stylist profile image found:', profileImage);
              setStylistImage(toCloudFrontUrl(profileImage));
            } else {
              console.log('⚠️ No profile image found in API response');
              console.log('   Available fields:', Object.keys(result.data));
            }
          } else {
            console.log('⚠️ API response not successful:', result);
          }
        } else {
          const errorText = await response.text();
          console.error('❌ Failed to fetch stylist data:', response.status, errorText);
        }
      } catch (error) {
        console.error('❌ Error fetching stylist data:', error);
      } finally {
        setLoadingImage(false);
        setLoadingStylistData(false);
      }
    };

    fetchStylistData();
  }, [stylistId, booking.stylistId]);

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

  // Generate customer ID from booking ID
  const customerId = `#R${booking.bookingId.slice(-8).toUpperCase()}`;

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cancelled</Text>
     
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        
        {/* Booking Details Card */}
        <View style={styles.bookingCard}>
          <Text style={styles.serviceName}>{booking.serviceName}</Text>
          
          {/* Gender and Service Type Badges */}
          {(booking.gender || booking.serviceType) && (
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
          )}
          
          <View style={styles.headerRight}>
          {/* Service Image */}
          <Image
            source={{ uri: getServiceImageForBooking(booking) }}
            style={styles.serviceImage}
            resizeMode="cover"
            onError={(e) => {
              console.error('❌ Error loading service image:', e.nativeEvent.error);
            }}
          />
         
          <View style={styles.cancelledTag}>
            <Text style={styles.cancelledTagText}>Cancelled</Text>
          </View>
        </View>
          <View style={styles.bookingInfoRow}>
            <Text style={styles.bookingInfoText}>{formatDateShort(booking.date)}</Text>
            <Text style={styles.bookingInfoText}>
              {calculateDuration(booking.startTime, booking.endTime, booking.period)}
            </Text>
          </View>
          <Text style={styles.price}>₹ {booking.price}</Text>
          <View style={styles.addressCard}>
          <TouchableOpacity
            style={styles.addressHeader}
            onPress={() => setAddressExpanded(!addressExpanded)}
            activeOpacity={0.7}>
            <View>
              <Text style={styles.addressTitle}>Address Details</Text>
              <Text style={styles.customerId}>Customer ID {customerId}</Text>
            </View>
            <Icon
              name={addressExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
              size={24}
              color="#666"
            />
          </TouchableOpacity>

          {addressExpanded && (
            <View style={styles.addressContent}>
              {/* Pickup Location (Green Pin) */}
              {/* Show Salon Location if available */}
              {booking.salonLocation?.address && (
                <>
                  <View style={styles.locationItem}>
                    <View style={styles.locationPinGreen}>
                      <Icon name="place" size={16} color="#fff" />
                    </View>
                    <View style={styles.locationDetails}>
                      <Text style={styles.locationLabel} numberOfLines={1}>
                        {booking.salonLocation.address.split(',')[0] || booking.salonLocation.address}
                      </Text>
                      <Text style={styles.locationAddress} numberOfLines={2}>
                        {booking.salonLocation.address}
                      </Text>
                    </View>
                  </View>
                  {/* Dashed Line - Only show if there's also a home location */}
                  {booking.homeLocation?.address && <View style={styles.dashedLine} />}
                </>
              )}

              {/* Show Home Location if available */}
              {booking.homeLocation?.address && (
                <View style={styles.locationItem}>
                  <View style={styles.locationPinOrange}>
                    <Icon name="place" size={16} color="#fff" />
                  </View>
                  <View style={styles.locationDetails}>
                    <Text style={styles.locationLabel} numberOfLines={1}>
                      {booking.homeLocation.address.split(',')[0] || booking.homeLocation.address}
                    </Text>
                    <Text style={styles.locationAddress} numberOfLines={2}>
                      {booking.homeLocation.address}
                    </Text>
                  </View>
                </View>
              )}

              {/* Fallback if no address available */}
              {!booking.salonLocation?.address && !booking.homeLocation?.address && (
                <Text style={styles.locationAddress}>Address not available</Text>
              )}
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.helpCard}
          activeOpacity={0.7}
          onPress={() => {
            if (onHelp) {
              onHelp();
            }
          }}>
          <View style={styles.helpContent}>
            <Icon name="headset-mic" size={24} color="#333" />
            <View style={styles.helpTextContainer}>
              <Text style={styles.helpTitle}>Need Help?</Text>
              <Text style={styles.helpSubtitle}>We're a tap away</Text>
            </View>
          </View>
          <Icon name="chevron-right" size={24} color="#333" />
        </TouchableOpacity>
        </View>

        {/* Address Details Section */}
    

        {/* Need Help Section */}
    

        {/* Your Rating Section - Shows rating given by customer to stylist */}
        {/* <View style={styles.ratingCard}>
          {loadingImage ? (
            <View style={[styles.ratingProfileImage, styles.ratingProfileImagePlaceholder]}>
              <Icon name="hourglass-empty" size={30} color="#999" />
            </View>
          ) : stylistImage ? (
            <Image
              source={{ uri: stylistImage }}
              style={styles.ratingProfileImage}
              onError={(e) => {
                console.error('❌ Error loading stylist image:', e.nativeEvent.error);
                setStylistImage(null);
              }}
            />
          ) : (
            <View style={[styles.ratingProfileImage, styles.ratingProfileImagePlaceholder]}>
              <Icon name="person" size={30} color="#999" />
            </View>
          )}
          <View style={styles.ratingContent}>
            <Text style={styles.ratingTitle}>Your Rating</Text>
            {loadingStylistData ? (
              <Text style={styles.loadingText}>Loading rating...</Text>
            ) : (
              <>
                {rating > 0 ? (
                  <>
                    <View style={styles.starsContainer}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Icon
                          key={star}
                          name={star <= rating ? 'star' : 'star-border'}
                          size={24}
                          color="#FFD700"
                        />
                      ))}
                    </View>
                    {ratingComment && (
                      <Text style={styles.ratingComment}>{ratingComment}</Text>
                    )}
                  </>
                ) : (
                  <Text style={styles.noRatingText}>No rating provided yet</Text>
                )}
            
              </>
            )}
          </View>
        </View> */}

        {/* Service Summary Section */}
        {/* <View style={styles.summarySection}>
          <View style={styles.summaryHeader}>
            <Icon name="description" size={20} color="#333" />
            <Text style={styles.summaryTitle}>Service Summary</Text>
          </View>

        
          <View style={styles.fareCard}>
            <TouchableOpacity
              style={styles.fareHeader}
              onPress={() => setFareExpanded(!fareExpanded)}
              activeOpacity={0.7}>
              <Text style={styles.fareLabel}>Suggested Fare</Text>
              <View style={styles.fareValueContainer}>
                <Text style={styles.fareValue}>₹ {booking.price}</Text>
                <Icon
                  name={fareExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                  size={20}
                  color="#666"
                />
              </View>
            </TouchableOpacity>

            {fareExpanded && (
              <View style={styles.fareDetails}>
                <Text style={styles.fareDetailText}>
                  Base fare: ₹ {booking.price}
                </Text>
                <Text style={styles.fareDetailText}>
                  Service charge: ₹ 0
                </Text>
              </View>
            )}


            <View style={styles.fareDivider} />

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalValue}>₹ {booking.price.toFixed(2)}</Text>
            </View>
          </View>
        </View> */}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingTop: compactTopPadding(20),
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
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    alignItems: 'center',
    gap: 8,
    position: 'absolute',
    top: 20,
    right: 20,
  },
  serviceImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFA778',
    borderWidth: 1,
    borderColor: '#333',
  },
  headerProfileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0E0E0',
  },
  headerProfileImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelledTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#F44336',
    borderRadius: 44,
  },
  cancelledTagText: {
    fontSize: 8,
    fontWeight: '500',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: compactTopPadding(16),
    paddingBottom: 100,
    gap: 16,
  },
  bookingCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'black',
  },
  serviceName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
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
  bookingInfoRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  bookingInfoText: {
    fontSize: 14,
    color: '#666',
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  addressCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  customerId: {
    fontSize: 14,
    color: '#666',
  },
  addressContent: {
    marginTop: 16,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  locationPinGreen: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  locationPinOrange: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FD8B36',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  locationDetails: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  dashedLine: {
    borderTopWidth: 1,
    borderTopColor: '#999',
    borderStyle: 'dashed',
    marginVertical: 12,
    marginLeft: 44,
  },
  helpCard: {
    backgroundColor: '#FFB885',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  helpContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  helpTextContainer: {
    gap: 2,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  helpSubtitle: {
    fontSize: 12,
    color: '#333',
    opacity: 0.9,
  },
  ratingCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  ratingProfileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E0E0E0',
  },
  ratingProfileImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingComment: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  loadingText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  noRatingText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    fontStyle: 'italic',
  },
  ratingContent: {
    flex: 1,
  },
  ratingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  summarySection: {
    marginBottom: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  fareCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
  },
  fareHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  fareLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  fareValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fareValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  fareDetails: {
    marginBottom: 12,
    paddingLeft: 8,
  },
  fareDetailText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  fareDivider: {
    borderTopWidth: 1,
    borderTopColor: '#999',
    borderStyle: 'dashed',
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
});

export default CancelledBookingDetailsScreen;
