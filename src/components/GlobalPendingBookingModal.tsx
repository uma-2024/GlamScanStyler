import { QueuedModal as Modal } from '../popup/PopupProvider';
import { QueuedAlert as Alert } from '../popup/QueuedAlert';
import React, { useEffect, useRef, useState } from 'react';
import { usePendingBookingRequests } from '../hooks/usePendingBookingRequests';
import {
  ActivityIndicator,
  Animated,
  Image,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from './AppLinearGradient';
import { API_BASE_URL_WITH_API } from '../config/api';
import {
  cancelBookingNotification,
} from '../utils/notificationService';
import { notifyBookingRefresh } from '../utils/bookingRefresh';
import { compactTopPadding } from '../utils/responsiveLayout';
import { toCloudFrontUrl } from '../utils/cdnUrl';

interface Booking {
  bookingId: string;
  userId: string;
  userName?: string;
  serviceName?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  period?: string;
  price?: number;
  status?: string;
  serviceType?: string;
  gender?: string;
  serviceImages?: Record<string, string>;
  homeLocation?: { address?: string } | string;
  address?: string;
}

interface GlobalPendingBookingModalProps {
  stylistId?: string;
  enabled?: boolean;
}

const CONFIRM_SWIPE_TRIGGER_RATIO = 0.8;

const formatDateShort = (dateString?: string): string => {
  if (!dateString) {
    return 'Date N/A';
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return 'Date N/A';
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatTimeTo12Hour = (time?: string): string => {
  if (!time) {
    return 'N/A';
  }

  const [hourPart, minutePart = '00'] = time.split(':');
  const hour = Number(hourPart);
  if (Number.isNaN(hour)) {
    return time;
  }

  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutePart.padStart(2, '0')} ${period}`;
};

const calculateDuration = (startTime?: string, endTime?: string): string => {
  if (!startTime || !endTime) {
    return 'Duration N/A';
  }

  const toMinutes = (value: string) => {
    const [hours = 0, minutes = 0] = value.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  };

  const duration = Math.max(0, toMinutes(endTime) - toMinutes(startTime));
  if (duration <= 0) {
    return 'Duration N/A';
  }

  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;

  if (hours && minutes) {
    return `${hours}h ${minutes}m`;
  }

  return hours ? `${hours}h` : `${minutes}m`;
};

const getServiceImageForBooking = (
  booking?: Booking | null,
  defaultImage = '',
): string => {
  if (!booking?.serviceImages || typeof booking.serviceImages !== 'object') {
    return defaultImage;
  }

  const targetGender =
    booking.gender === 'Female' ? 'Female' : booking.gender === 'Male' ? 'Male' : null;
  const imageKeys = Object.keys(booking.serviceImages);

  if (targetGender) {
    const exactImage = booking.serviceImages[targetGender];
    if (exactImage) {
      return toCloudFrontUrl(exactImage) || defaultImage;
    }

    const matchingKey = imageKeys.find((key) => {
      const keyLower = key.toLowerCase();
      const targetLower = targetGender.toLowerCase();
      return (
        keyLower === targetLower ||
        (keyLower === 'women' && targetLower === 'female') ||
        (keyLower === 'men' && targetLower === 'male')
      );
    });

    if (matchingKey && booking.serviceImages[matchingKey]) {
      return toCloudFrontUrl(booking.serviceImages[matchingKey]) || defaultImage;
    }
  }

  if (imageKeys.length > 0 && booking.serviceImages[imageKeys[0]]) {
    return toCloudFrontUrl(booking.serviceImages[imageKeys[0]]) || defaultImage;
  }

  return defaultImage;
};

const GlobalPendingBookingModal: React.FC<GlobalPendingBookingModalProps> = ({
  stylistId,
  enabled = true,
}) => {
  const insets = useSafeAreaInsets();
  const { pendingBookings, visible, setVisible, removeBooking } = usePendingBookingRequests<Booking>(stylistId, enabled);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingAction, setLoadingAction] = useState<'confirm' | 'cancel' | null>(null);
  const [serviceImages, setServiceImages] = useState<Record<string, string>>({});

  // Slide animation state for confirm button
  const slideAnim = useRef(new Animated.Value(0)).current;
  const slideWidth = useRef(0);
  const currentSlideValue = useRef(0);
  const maxSlideRef = useRef(0);
  const triggerPointRef = useRef(0);
  const triggeredRef = useRef(false);
  const slideValueRef = useRef(0);

  const loadingActionRef = useRef<'confirm' | 'cancel' | null>(null);
  loadingActionRef.current = loadingAction;

  const currentBooking =
    pendingBookings.length > 0 && currentIndex < pendingBookings.length
      ? pendingBookings[currentIndex]
      : null;

  const currentBookingRef = useRef(currentBooking);
  currentBookingRef.current = currentBooking;

  const stylistIdRef = useRef(stylistId);
  stylistIdRef.current = stylistId;

  // Track slideAnim value
  useEffect(() => {
    const listenerId = slideAnim.addListener(({ value }) => {
      slideValueRef.current = value;
      currentSlideValue.current = value;
    });

    return () => {
      slideAnim.removeListener(listenerId);
    };
  }, [slideAnim]);

  // Reset slide animation when current booking changes
  useEffect(() => {
    slideAnim.setValue(0);
    triggeredRef.current = false;
  }, [currentIndex, currentBooking?.bookingId, pendingBookings.length]);

  useEffect(() => {
    setCurrentIndex(index => Math.min(index, Math.max(pendingBookings.length - 1, 0)));
  }, [pendingBookings.length]);

  useEffect(() => {
    if (pendingBookings.length === 0) {
      return;
    }

    const fetchServiceImages = async () => {
      try {
        const response = await fetch(`${API_BASE_URL_WITH_API}/services/categories`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          return;
        }

        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          const imageMap: Record<string, string> = {};
          result.data.forEach((service: any) => {
            const serviceName = service.name || service.serviceName;
            if (serviceName && service.image) {
              imageMap[serviceName] = toCloudFrontUrl(service.image);
            }
          });
          setServiceImages(imageMap);
        }
      } catch (error) {
        console.error('Error fetching global pending service images:', error);
      }
    };

    fetchServiceImages();
  }, [pendingBookings.length]);

  const handleConfirm = async () => {
    const booking = currentBookingRef.current;
    const currentStylist = stylistIdRef.current;

    if (!booking || !currentStylist) {
      slideAnim.setValue(0);
      triggeredRef.current = false;
      return;
    }

    setLoadingAction('confirm');
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
          stylistId: currentStylist,
          status: 'confirmed',
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      await cancelBookingNotification(booking.bookingId);
      removeBooking(booking.bookingId);
      notifyBookingRefresh();
    } catch (error) {
      console.error('❌ Error confirming global pending booking:', error);
      Alert.alert('Error', 'Failed to confirm booking. Please try again.');
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: false,
        tension: 50,
        friction: 7,
      }).start(() => {
        triggeredRef.current = false;
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleConfirmRef = useRef(handleConfirm);
  handleConfirmRef.current = handleConfirm;

  // PanResponder for swipe gesture - triggers API when slider reaches 80%
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        return !loadingActionRef.current && !triggeredRef.current;
      },
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          !loadingActionRef.current &&
          !triggeredRef.current &&
          Math.abs(gestureState.dx) > 1
        );
      },
      onPanResponderGrant: () => {
        slideAnim.setOffset(currentSlideValue.current);
        slideAnim.setValue(0);
        triggeredRef.current = false;
      },
      onPanResponderMove: (_, gestureState) => {
        if (loadingActionRef.current || triggeredRef.current) {
          return;
        }

        const dx = Math.max(0, gestureState.dx);
        const newValue = Math.min(dx, maxSlideRef.current);
        slideAnim.setValue(newValue);

        // When slider reaches 80%, hit the API
        if (newValue >= triggerPointRef.current && !triggeredRef.current) {
          triggeredRef.current = true;
          Animated.spring(slideAnim, {
            toValue: maxSlideRef.current,
            useNativeDriver: false,
            tension: 50,
            friction: 7,
          }).start();
          handleConfirmRef.current();
        }
      },
      onPanResponderRelease: () => {
        if (loadingActionRef.current) {
          slideAnim.flattenOffset();
          return;
        }

        slideAnim.flattenOffset();
        const current = slideValueRef.current;
        const threshold = triggerPointRef.current;

        if (triggeredRef.current) {
          Animated.spring(slideAnim, {
            toValue: maxSlideRef.current,
            useNativeDriver: false,
            tension: 50,
            friction: 7,
          }).start();
        } else if (current >= threshold) {
          triggeredRef.current = true;
          Animated.spring(slideAnim, {
            toValue: maxSlideRef.current,
            useNativeDriver: false,
            tension: 50,
            friction: 7,
          }).start();
          handleConfirmRef.current();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: false,
            tension: 50,
            friction: 7,
          }).start(() => {
            triggeredRef.current = false;
          });
        }
      },
      onPanResponderTerminate: () => {
        slideAnim.flattenOffset();
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: false,
          tension: 50,
          friction: 7,
        }).start(() => {
          triggeredRef.current = false;
        });
      },
    }),
  ).current;

  const handleCancel = async () => {
    slideAnim.setValue(0);
    triggeredRef.current = false;
    if (!currentBooking || !stylistId) {
      return;
    }

    setLoadingAction('cancel');
    try {
      const statusResponse = await fetch(
        `${API_BASE_URL_WITH_API}/bookings/${currentBooking.bookingId}/cancel-status`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            bookingId: currentBooking.bookingId,
            userId: currentBooking.userId,
            stylistId,
          }),
        },
      );

      if (!statusResponse.ok) {
        throw new Error(await statusResponse.text());
      }

      await fetch(`${API_BASE_URL_WITH_API}/bookings/${currentBooking.bookingId}/save-cancellation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          userId: currentBooking.userId,
          stylistId,
          reason: 'Styler declined the Booking request.',
          cancelledBy: 'stylist',
        }),
      });

      await cancelBookingNotification(currentBooking.bookingId);
      removeBooking(currentBooking.bookingId);
      notifyBookingRefresh();
    } catch (error) {
      console.error('❌ Error cancelling global pending booking:', error);
      Alert.alert('Error', 'Failed to cancel booking. Please try again.');
    } finally {
      setLoadingAction(null);
    }
  };

  const goPrevious = () => setCurrentIndex((index) => Math.max(0, index - 1));
  const goNext = () =>
    setCurrentIndex((index) => Math.min(pendingBookings.length - 1, index + 1));

  const serviceName = currentBooking?.serviceName || 'Service Name';
  const userName = currentBooking?.userName || 'Unknown User';
  const date = formatDateShort(currentBooking?.date);
  const startTime = formatTimeTo12Hour(currentBooking?.startTime);
  const endTime = formatTimeTo12Hour(currentBooking?.endTime);
  const duration = calculateDuration(currentBooking?.startTime, currentBooking?.endTime);
  const price = Number(currentBooking?.price || 0);
  const gstAmount = +(price * 0.05).toFixed(2);
  const totalPriceWithGst = +(price + gstAmount).toFixed(2);
  const serviceImage = getServiceImageForBooking(
    currentBooking,
    serviceImages[serviceName] || '',
  );
  const normalizedServiceType = (currentBooking?.serviceType || 'Salon').toString().trim().toLowerCase();
  const isHomeService =
    normalizedServiceType === 'home' ||
    normalizedServiceType === 'at home' ||
    normalizedServiceType === 'both';
  const displayServiceType =
    normalizedServiceType === 'home' || normalizedServiceType === 'at home'
      ? 'Home'
      : normalizedServiceType === 'both'
        ? 'Both'
        : 'Salon';
  const customerAddress =
    (typeof currentBooking?.homeLocation === 'object' && currentBooking.homeLocation?.address) ||
    (typeof currentBooking?.homeLocation === 'string' ? currentBooking.homeLocation : '') ||
    currentBooking?.address ||
    '';

  return (
    <Modal
      visible={enabled && visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => setVisible(false)}
    >
      <View style={[styles.modalOverlay, { paddingTop: insets.top + 10 }]}>
        <View style={styles.modalContent}>
          <View style={styles.swipeIndicator} />
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setVisible(false)}
              style={styles.modalCloseButton}
              activeOpacity={0.7}
            >
              <View style={styles.closeButtonCircle}>
                <Icon name="close" size={20} color="#333" />
              </View>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Upcoming Glam Sessions</Text>
            <View style={styles.grabNowButton}>
              <Icon name="flash-on" size={18} color="#fff" />
              <Text style={styles.grabNowText}>Grab now</Text>
            </View>
          </View>

          {pendingBookings.length > 1 && (
            <View style={styles.bookingPagerRow}>
              <TouchableOpacity
                style={[
                  styles.bookingPagerButton,
                  currentIndex === 0 && styles.bookingPagerButtonDisabled,
                ]}
                onPress={goPrevious}
                disabled={currentIndex === 0}
              >
                <Icon name="chevron-left" size={22} color={currentIndex === 0 ? '#BFBFBF' : '#FD8B36'} />
              </TouchableOpacity>
              <Text style={styles.bookingCounterText}>
                {currentIndex + 1} of {pendingBookings.length}
              </Text>
              <TouchableOpacity
                style={[
                  styles.bookingPagerButton,
                  currentIndex === pendingBookings.length - 1 && styles.bookingPagerButtonDisabled,
                ]}
                onPress={goNext}
                disabled={currentIndex === pendingBookings.length - 1}
              >
                <Icon
                  name="chevron-right"
                  size={22}
                  color={currentIndex === pendingBookings.length - 1 ? '#BFBFBF' : '#FD8B36'}
                />
              </TouchableOpacity>
            </View>
          )}

          {currentBooking ? (
            <ScrollView
              style={styles.pendingBookingContainer}
              contentContainerStyle={styles.pendingBookingContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.bookingInfoCard}>
                <View style={styles.bookingInfoHeader}>
                  {serviceImage ? (
                    <Image
                      source={{ uri: serviceImage }}
                      style={styles.serviceImageIcon}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.serviceImagePlaceholder}>
                      <Icon name="spa" size={20} color="#FD8B36" />
                    </View>
                  )}
                  <View style={styles.bookingInfoHeaderText}>
                    <Text style={styles.bookingServiceName}>{serviceName}</Text>
                    <View style={styles.bookingMetaRow}>
                      <Text style={styles.bookingMetaText}>{date}</Text>
                      <View style={styles.bookingMetaDivider} />
                      <Text style={styles.bookingMetaText}>{duration}</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.bookingAddress}>Customer: {userName}</Text>
                <View style={styles.bookingTagsRow}>
                  <View style={styles.bookingTag}>
                    <Text style={styles.bookingTagText}>{displayServiceType}</Text>
                  </View>
                  {!!currentBooking.gender && (
                    <View style={styles.bookingTag}>
                      <Text style={styles.bookingTagText}>{currentBooking.gender}</Text>
                    </View>
                  )}
                </View>
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
                <Text style={styles.bookingTime}>{startTime} - {endTime}</Text>
              </View>

              <View style={styles.earningsCard}>
                <View style={styles.earningsLeft}>
                  <Text style={styles.earningsAmount}>₹ {totalPriceWithGst.toFixed(2)}</Text>
                  <Text style={styles.priceWithGstSubtext}>
                    ₹{price.toFixed(2)} + ₹{gstAmount.toFixed(2)} (5% GST)
                  </Text>
                </View>
                <View style={styles.earningsRight}>
                  <Text style={styles.totalPriceBadge}>Total with GST</Text>
                  <Text style={styles.earningsLabel}>Est. Earnings: ₹{price.toFixed(2)}</Text>
                </View>
              </View>

              <View style={styles.bookingActions}>
                <Animated.View
                  style={[
                    styles.confirmButtonContainer,
                    !!loadingAction && styles.buttonDisabled,
                  ]}
                  onLayout={(event) => {
                    const width = event.nativeEvent.layout.width;
                    slideWidth.current = width;
                    const ARROW_WIDTH = 40;
                    const PADDING = 8;
                    maxSlideRef.current = Math.max(0, width - ARROW_WIDTH - (PADDING * 2));
                    triggerPointRef.current = maxSlideRef.current * CONFIRM_SWIPE_TRIGGER_RATIO;
                  }}
                  {...(!loadingAction ? panResponder.panHandlers : {})}
                >
                  {loadingAction === 'confirm' ? (
                    <LinearGradient
                      colors={['#FD8B36', '#f7bb2c']}
                      start={{ x: 0.5, y: 0.5 }}
                      end={{ x: 0.5, y: 0 }}
                      style={styles.confirmButton}
                    >
                      <ActivityIndicator size="small" color="#fff" />
                    </LinearGradient>
                  ) : (
                    <View style={{ flex: 1, position: 'relative' }}>
                      <LinearGradient
                        colors={['#FD8B36', '#f7bb2c']}
                        start={{ x: 0.5, y: 0.5 }}
                        end={{ x: 0.5, y: 0 }}
                        style={styles.confirmButton}
                      >
                        <View style={styles.confirmButtonInner}>
                          <Text style={styles.confirmButtonText}>Confirm</Text>
                        </View>
                      </LinearGradient>

                      <Animated.View
                        style={[
                          styles.slideProgressBar,
                          {
                            width: slideAnim.interpolate({
                              inputRange: [0, Math.max(maxSlideRef.current || 100, 100)],
                              outputRange: ['0%', '100%'],
                              extrapolate: 'clamp',
                            }),
                          },
                        ]}
                      />

                      <Animated.View
                        style={[
                          styles.slideArrowContainer,
                          {
                            transform: [{ translateX: slideAnim }],
                          },
                        ]}
                      >
                        <View style={styles.slideArrow}>
                          <Icon name="arrow-forward" size={20} color="#fff" />
                        </View>
                      </Animated.View>
                    </View>
                  )}
                </Animated.View>

                <TouchableOpacity
                  style={[styles.cancelButton, !!loadingAction && styles.buttonDisabled]}
                  onPress={handleCancel}
                  disabled={!!loadingAction}
                  activeOpacity={0.7}
                >
                  {loadingAction === 'cancel' ? (
                    <ActivityIndicator size="small" color="#666" />
                  ) : (
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : (
            <View style={styles.noPendingContainer}>
              <Text style={styles.noPendingText}>No booking data available</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
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
    minHeight: 400,
    paddingBottom: 20,
  },
  swipeIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginVertical: 4,
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
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
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
  bookingCounterText: {
    fontSize: 10,
    color: '#B4562C',
    fontWeight: '500',
  },
  pendingBookingContainer: {
    flex: 1,
    paddingHorizontal: 20,
    minHeight: 300,
  },
  pendingBookingContent: {
    paddingBottom: 20,
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
    overflow: 'hidden',
  },
  serviceImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#FFF3E8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookingInfoHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
  bookingServiceName: {
    fontSize: 18,
    fontWeight: '700',
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
  earningsAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
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
  bookingActions: {
    gap: 12,
  },
  confirmButtonContainer: {
    position: 'relative',
    borderRadius: 30,
    overflow: 'hidden',
    minHeight: 56,
  },
  confirmButton: {
    width: '100%',
    minHeight: 56,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  confirmButtonInner: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
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
    pointerEvents: 'box-none',
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
    borderRadius: 30,
  },
  cancelButton: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 22,
    overflow: 'hidden',
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
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
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default GlobalPendingBookingModal;
