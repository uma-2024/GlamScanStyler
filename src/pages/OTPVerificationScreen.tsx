import { QueuedAlert as Alert } from '../popup/QueuedAlert';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import SafeAreaView from '../components/SafeAreaView';
import { compactTopPadding } from '../utils/responsiveLayout';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { API_BASE_URL_WITH_API } from '../config/api';
import { authenticatedFetch } from '../services/apiClient';
import { showServiceCompletedNotification } from '../utils/notificationService';

interface OTPVerificationScreenProps {
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
  };
  stylistId: string; // The stylist's userId
  phoneNumber?: string;
  onOTPVerified: () => void;
  onBack: () => void;
  actionType: 'start' | 'end'; // 'start' for starting service, 'end' for ending service
}

// Helper function to get the appropriate service image based on booking gender and images object
const getServiceImageForBooking = (booking: OTPVerificationScreenProps['booking'], defaultImage: string = 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=200&h=200&fit=crop'): string => {
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

const OTPVerificationScreen: React.FC<OTPVerificationScreenProps> = ({
  booking,
  stylistId,
  phoneNumber = '9554515485',
  onOTPVerified,
  onBack,
  actionType,
}) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']); // 6-digit OTP
  const [retryCountdown, setRetryCountdown] = useState(30);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedOTP, setGeneratedOTP] = useState<string | null>(null);
  const [otpExpiresAt, setOtpExpiresAt] = useState<Date | null>(null);
  const verificationInFlight = useRef(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [retryEndTime, setRetryEndTime] = useState<number | null>(null);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Handle countdown timer using absolute target time to handle app backgrounding
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (retryEndTime && retryEndTime > Date.now()) {
      setRetryCountdown(Math.ceil((retryEndTime - Date.now()) / 1000));
      interval = setInterval(() => {
        const remaining = Math.ceil((retryEndTime - Date.now()) / 1000);
        if (remaining <= 0) {
          setRetryCountdown(0);
          setRetryEndTime(null);
          clearInterval(interval);
        } else {
          setRetryCountdown(remaining);
        }
      }, 1000);
    } else {
      setRetryCountdown(0);
    }
    return () => clearInterval(interval);
  }, [retryEndTime]);

  // Generate OTP when screen loads for 'start' or 'end' action
  useEffect(() => {
    if (actionType === 'start' || actionType === 'end') {
      generateOTP();
    }
  }, [actionType]);

  // Generate OTP API call
  const generateOTP = async () => {
    setIsGenerating(true);
    try {
      // Use different endpoint based on action type
      const endpoint = actionType === 'start' 
        ? `${API_BASE_URL_WITH_API}/bookings/${booking.bookingId}/generate-start-otp`
        : `${API_BASE_URL_WITH_API}/bookings/${booking.bookingId}/generate-end-otp`;
      
      const response = await authenticatedFetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          stylistId: stylistId,
          userId: booking.userId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to generate OTP' }));
        throw new Error(errorData.message || 'Failed to generate OTP');
      }

      const result = await response.json();
      if (result.success) {
        setOtpError(null);
        setRetryEndTime(Date.now() + 60000); // Start 60-second countdown based on target time
        if (result.data && result.data.expiresAt) {
          setOtpExpiresAt(new Date(result.data.expiresAt));
        }
      }
    } catch (error) {
      console.error('❌ Error generating OTP:', error);
      const msg = error instanceof Error ? error.message : 'Failed to generate OTP';
      if (msg.toLowerCase().includes('wait')) {
        setOtpError(msg);
        // Start countdown based on typical 60s wait using absolute time
        setRetryEndTime(Date.now() + 60000);
      } else {
        setOtpError(msg);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOTPChange = (value: string, index: number) => {
    if (value.length > 1) {
      // Handle paste
      const pastedOTP = value.slice(0, 6).split('');
      const newOtp = [...otp];
      pastedOTP.forEach((char, i) => {
        if (index + i < 6) {
          newOtp[index + i] = char;
        }
      });
      setOtp(newOtp);
      
      // Focus next empty input or last input
      const nextIndex = Math.min(index + pastedOTP.length, 5);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all 6 digits are entered
    if (newOtp.every((digit) => digit !== '') && newOtp.join('').length === 6) {
      handleVerifyOTP(newOtp.join(''));
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async (otpValue?: string) => {
    const otpToVerify = otpValue || otp.join('');
    
    if (otpToVerify.length !== 6) {
      Alert.alert('Error', 'Please enter a 6-digit OTP');
      return;
    }

    if (verificationInFlight.current) return;
    verificationInFlight.current = true;
    setIsVerifying(true);

    try {
      if (actionType === 'start') {
        // Verify start OTP using new API
        const response = await authenticatedFetch(`${API_BASE_URL_WITH_API}/bookings/${booking.bookingId}/verify-start-otp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            stylistId: stylistId,
            userId: booking.userId,
            otp: otpToVerify,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Failed to verify OTP' }));
          throw new Error(errorData.message || 'Failed to verify OTP');
        }

        const result = await response.json();
        console.log('✅ OTP verified and status updated to ongoing:', result);

        // Automatically navigate to next step - no alert needed
        console.log('✅ Service started successfully, navigating to next step...');
        onOTPVerified();
      } else {
        // Verify end OTP using new API
        const response = await authenticatedFetch(`${API_BASE_URL_WITH_API}/bookings/${booking.bookingId}/verify-end-otp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            stylistId: stylistId,
            userId: booking.userId,
            otp: otpToVerify,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Failed to verify OTP' }));
          throw new Error(errorData.message || 'Failed to verify OTP');
        }

        const result = await response.json();
        console.log('✅ End OTP verified and status updated to completed:', result);

        // Return immediately; notification delivery cannot hold the OTP screen open.
        onOTPVerified();
        void showServiceCompletedNotification(booking.serviceName, booking.userName)
          .catch(error => console.warn('Completion notification failed', error));
      }
    } catch (error) {
      console.error('❌ Error verifying OTP:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to verify OTP');
    } finally {
      verificationInFlight.current = false;
      setIsVerifying(false);
    }
  };

  const formatDateTime = (dateString: string, startTime: string, period: string): string => {
    const date = new Date(dateString);
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
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}, ${formattedTime}`;
  };

  // Get service location based on service type
  const getServiceLocation = (): string => {
    // Check service type to determine which location to show
    if (booking.serviceType === 'Salon' && booking.salonLocation?.address) {
      return booking.salonLocation.address;
    } else if (booking.serviceType === 'Home' && booking.homeLocation?.address) {
      return booking.homeLocation.address;
    } else if (booking.serviceType === 'Both') {
      // Show both locations if available
      const locations: string[] = [];
      if (booking.salonLocation?.address) {
        locations.push(`Salon: ${booking.salonLocation.address}`);
      }
      if (booking.homeLocation?.address) {
        locations.push(`Home: ${booking.homeLocation.address}`);
      }
      return locations.length > 0 ? locations.join('\n') : 'Location not available';
    } else {
      // Fallback: try any available location
      if (booking.salonLocation?.address) {
        return booking.salonLocation.address;
      }
      if (booking.homeLocation?.address) {
        return booking.homeLocation.address;
      }
      return 'Location not available';
    }
  };

  // Format location to show city, state, country (short format)
  const getLocationShort = (address: string): string => {
    if (!address) return 'Location not available';
    
    // Split address by comma
    const parts = address.split(',').map(part => part.trim()).filter(part => part.length > 0);
    
    // Usually address format: street, area, city, state, country
    // We want the last 3 parts (city, state, country) if available
    if (parts.length >= 3) {
      // Take last 3 parts (city, state, country)
      return parts.slice(-3).join(', ');
    } else if (parts.length === 2) {
      // Take last 2 parts
      return parts.slice(-2).join(', ');
    } else if (parts.length === 1) {
      // If only one part, return it
      return parts[0];
    } else {
      return 'Location not available';
    }
  };

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ongoing</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        {/* Date and Time */}
        <Text style={styles.dateTimeText}>
          {formatDateTime(booking.date, booking.startTime, booking.period)}
        </Text>

        {/* OTP Section */}
        <View style={styles.otpSection}>
          <Text style={styles.otpTitle}>
            {actionType === 'start' ? 'Enter OTP to Start Service' : 'Enter OTP to End Service'}
          </Text>
          <Text style={styles.otpSubtitle}>
            {actionType === 'start' 
              ? 'A 6-digit OTP has been generated and sent to the customer. Please enter it below to start the service.'
              : `We've Sent A 6 Digit Verification Code To ${booking.userName}`}
          </Text>

          {/* Generated OTP is intentionally not shown in the stylist UI for production. */}

          {/* Loading indicator for OTP generation */}
          {isGenerating && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#FD8B36" />
              <Text style={styles.loadingText}>Generating OTP...</Text>
            </View>
          )}

          {/* OTP Input Fields */}
          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                style={styles.otpInput}
                value={digit}
                onChangeText={(value) => handleOTPChange(value, index)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                editable={!isGenerating && !isVerifying}
              />
            ))}
          </View>

          {/* Verifying Status */}
          {isVerifying && (
            <View style={styles.autoVerifyContainer}>
              <ActivityIndicator size="small" color="#FD8B36" />
              <Text style={[styles.autoVerifyText, { color: '#FD8B36', fontWeight: '700' }]}>
                Verifying OTP & Updating Status...
              </Text>
            </View>
          )}

          <Text style={styles.instructionText}>
            Enter The 6-Digit OTP And {actionType === 'start' ? 'Start' : 'End'} The Salon Service Instantly
          </Text>

          {/* OTP Error Message */}
          {otpError && (
            <Text style={styles.errorText}>{otpError}</Text>
          )}

          {/* Regenerate OTP button */}
          {!isVerifying && (
            <TouchableOpacity
              style={[styles.regenerateButton, retryCountdown > 0 && styles.regenerateButtonDisabled]}
              onPress={generateOTP}
              disabled={isGenerating || retryCountdown > 0}>
              <Icon name="refresh" size={20} color={retryCountdown > 0 ? "#999" : "#FD8B36"} />
              <Text style={[styles.regenerateButtonText, retryCountdown > 0 && styles.regenerateButtonTextDisabled]}>
                {retryCountdown > 0 ? `Resend OTP in ${retryCountdown}s` : 'Resend OTP'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Booking Details Card */}
        <View style={styles.bookingCard}>
          <Image
            source={{
              uri: getServiceImageForBooking(booking),
            }}
            style={styles.stylistImage}
          />
          <View style={styles.bookingDetails}>
            <Text style={styles.stylistName}>{booking.userName}</Text>
            <View style={styles.locationRow}>
              <Icon name="place" size={16} color="#666" style={styles.locationIcon} />
              <Text style={styles.locationText} numberOfLines={2}>
                {getLocationShort(getServiceLocation())}
              </Text>
            </View>
            <Text style={styles.serviceText}>
              Service: {booking.serviceName}
            </Text>
            {/* {booking.serviceType && (
              <View style={styles.serviceTypeRow}>
                <Icon 
                  name={booking.serviceType === 'Home' ? 'home' : booking.serviceType === 'Salon' ? 'store' : 'swap-horiz'} 
                  size={14} 
                  color="#FD8B36" 
                />
                <Text style={styles.serviceTypeText}>{booking.serviceType}</Text>
              </View>
            )} */}
          </View>
          <View style={styles.priceContainer}>
            <Text style={styles.priceText}>₹{booking.price}</Text>
          </View>
        </View>
      </View>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: compactTopPadding(20),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: compactTopPadding(24),
  },
  dateTimeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 32,
  },
  otpSection: {
    marginBottom: 32,
  },
  otpTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  otpSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  otpInput: {
    flex: 1,
    height: 56,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
  },
  autoVerifyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  autoVerifyText: {
    fontSize: 14,
    color: '#333',
  },
  retryText: {
    fontSize: 14,
    color: '#999',
  },
  instructionText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  generatedOtpContainer: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FD8B36',
  },
  generatedOtpLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  generatedOtpValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    letterSpacing: 4,
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '500',
  },
  regenerateButtonDisabled: {
    opacity: 0.7,
  },
  regenerateButtonTextDisabled: {
    color: '#999',
  },
  expiryText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FD8B36',
    gap: 8,
  },
  regenerateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FD8B36',
  },
  bookingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
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
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 3,
    marginBottom: 4,
  },
  locationIcon: {
    marginTop: 2,
  },
  locationText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    lineHeight: 20,
  },
  serviceText: {
    fontSize: 14,
    color: '#FD8B36',
    marginTop: 4,
  },
  serviceTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  serviceTypeText: {
    fontSize: 12,
    color: '#FD8B36',
    fontWeight: '600',
  },
  priceContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 12,
  },
  priceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
});

export default OTPVerificationScreen;

