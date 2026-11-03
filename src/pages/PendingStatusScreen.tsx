import { QueuedModal as Modal } from '../popup/PopupProvider';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import SafeAreaView from '../components/SafeAreaView';
import LinearGradient from '../components/AppLinearGradient';
// import BottomNavigation from '../components/BottomNavigation';
import { API_BASE_URL_WITH_API } from '../config/api';
import PendingStatusImage from '../assets/pending.svg';
interface PendingStatusScreenProps {
  onVerified?: () => void;
  onSkip?: () => void;
  userId?: string;
}

type StatusDetail = {
  label: string;
  value: string;
};

type StatusModalState = {
  visible: boolean;
  isVerified: boolean;
  title: string;
  message: string;
  details: StatusDetail[];
};

const PendingStatusScreen: React.FC<PendingStatusScreenProps> = ({
  onVerified,
  onSkip,
  userId,
}) => {
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState('We will contact you shortly via phone.');
  const [statusModal, setStatusModal] = useState<StatusModalState>({
    visible: false,
    isVerified: false,
    title: '',
    message: '',
    details: [],
  });

  const checkVerificationStatus = useCallback(async (showModal = false) => {
    if (!userId) {
      if (showModal) {
        setStatusModal({
          visible: true,
          isVerified: false,
          title: 'Status Unavailable',
          message: 'User ID is missing. Please login again.',
          details: [],
        });
      }
      return;
    }

    try {
      if (showModal) {
        setCheckingStatus(true);
      }

      const [profileResponse, onboardingResponse] = await Promise.all([
        fetch(`${API_BASE_URL_WITH_API}/profile/${userId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }),
        fetch(`${API_BASE_URL_WITH_API}/profile/onboarding-steps/${userId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }),
      ]);

      if (!profileResponse.ok) {
        setStatusMessage('Your profile is still under review.');
        if (showModal) {
          setStatusModal({
            visible: true,
            isVerified: false,
            title: 'Status Unavailable',
            message: 'We could not fetch your verification status right now.',
            details: [
              { label: 'Last checked', value: new Date().toLocaleString() },
            ],
          });
        }
        return;
      }

      const profileResult = await profileResponse.json();
      const onboardingResult = onboardingResponse.ok
        ? await onboardingResponse.json()
        : null;
      const profile = profileResult?.data || {};
      const steps = onboardingResult?.data?.steps || {};
      const stepKeys = Object.keys(steps);
      const completedSteps = stepKeys.filter((key) => steps[key] === true).length;
      const certificateImages = profile?.certificateImages || {};
      const certificateStatus = certificateImages?.status || 'pending';
      const isVerified = profile?.isVerified;
      const isVerifiedBool =
        isVerified === true || String(isVerified).toLowerCase() === 'true';

      const details: StatusDetail[] = [
        {
          label: 'Verification Status',
          value: isVerifiedBool ? 'Verified' : 'Pending',
        },
        {
          label: 'Profile Name',
          value: profile?.name || 'Not added',
        },
        {
          label: 'Phone Number',
          value: profile?.phoneNumber || 'Not added',
        },
        {
          label: 'Profile Image',
          value: profile?.profileImage ? 'Uploaded' : 'Not uploaded',
        },
        {
          label: 'Certificate',
          value: certificateImages?.frontImage
            ? `Uploaded (${certificateStatus})`
            : 'Not uploaded',
        },
        {
          label: 'Onboarding',
          value: stepKeys.length > 0
            ? `${completedSteps}/${stepKeys.length} completed`
            : 'Not available',
        },
        {
          label: 'Last Checked',
          value: new Date().toLocaleString(),
        },
      ];

      if (showModal) {
        setStatusModal({
          visible: true,
          isVerified: isVerifiedBool,
          title: isVerifiedBool ? 'Profile Verified' : 'Verification Pending',
          message: isVerifiedBool
            ? 'Your profile is approved. You can continue to your dashboard.'
            : 'Your profile is still under review. We will contact you shortly via phone.',
          details,
        });
      }

      if (isVerifiedBool && !showModal) {
        onVerified?.();
        return;
      }

      setStatusMessage(
        isVerifiedBool
          ? 'Your profile is verified.'
          : 'Your profile is still under review.',
      );
    } catch (error) {
      console.error('❌ Error checking verification status:', error);
      setStatusMessage('Your profile is still under review.');
      if (showModal) {
        setStatusModal({
          visible: true,
          isVerified: false,
          title: 'Status Unavailable',
          message: 'Unable to check your status right now. Please try again.',
          details: [
            { label: 'Last checked', value: new Date().toLocaleString() },
          ],
        });
      }
    } finally {
      if (showModal) {
        setCheckingStatus(false);
      }
    }
  }, [onVerified, userId]);

  useEffect(() => {
    checkVerificationStatus();
    const intervalId = setInterval(checkVerificationStatus, 15000);

    return () => clearInterval(intervalId);
  }, [checkVerificationStatus]);

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
      {/* Content */}
      <View style={styles.content}>
        {/* Illustration Section */}
        <View style={styles.illustrationContainer}>
          <PendingStatusImage 
            width={312} 
            height={282} 
            style={styles.pendingStatusImage} 
          />
        </View>

        {/* Text Content */}
        <View style={styles.textContainer}>
          <Text style={styles.heading}>Awaiting Confirmation</Text>
          {/* <Text style={styles.subtitle}>
          In Progress
          ✨ Just a Little More Time
          </Text> */}
          <Text style={styles.statusMessage}>{statusMessage}</Text>
        </View>

        {/* Check Status Button */}
        {userId && (
          <TouchableOpacity
            style={styles.checkStatusButton}
            onPress={() => checkVerificationStatus(true)}
            disabled={checkingStatus}
            activeOpacity={0.8}>
            <LinearGradient
              colors={['#FD8B36', '#f7bb2c']}
              start={{ x: 0.5, y: 0.5 }}
              end={{ x: 0.5, y: 0 }}
              style={styles.checkStatusButtonGradient}>
              {checkingStatus ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.checkStatusButtonText}>Check Status</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}
        
        {onSkip && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={onSkip}
            activeOpacity={0.8}>
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal
        visible={statusModal.visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setStatusModal(prev => ({ ...prev, visible: false }))}>
        <View style={styles.statusModalOverlay}>
          <View style={styles.statusModalCard}>
            <View
              style={[
                styles.statusBadge,
                statusModal.isVerified ? styles.statusBadgeVerified : styles.statusBadgePending,
              ]}>
              <Text
                style={[
                  styles.statusBadgeText,
                  statusModal.isVerified
                    ? styles.statusBadgeTextVerified
                    : styles.statusBadgeTextPending,
                ]}>
                {statusModal.isVerified ? 'Verified' : 'Pending'}
              </Text>
            </View>

            <Text style={styles.statusModalTitle}>{statusModal.title}</Text>
            <Text style={styles.statusModalMessage}>{statusModal.message}</Text>

            <View style={styles.statusDetailsCard}>
              {statusModal.details.map((detail, index) => (
                <View
                  key={`${detail.label}-${index}`}
                  style={[
                    styles.statusDetailRow,
                    index === statusModal.details.length - 1 && styles.statusDetailRowLast,
                  ]}>
                  <Text style={styles.statusDetailLabel}>{detail.label}</Text>
                  <Text style={styles.statusDetailValue}>{detail.value}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.statusModalButton}
              activeOpacity={0.85}
              onPress={() => {
                setStatusModal(prev => ({ ...prev, visible: false }));
                if (statusModal.isVerified) {
                  onVerified?.();
                }
              }}>
              <LinearGradient
                colors={['#FD8B36', '#f7bb2c']}
                start={{ x: 0.5, y: 0.5 }}
                end={{ x: 0.5, y: 0 }}
                style={styles.statusModalButtonGradient}>
                <Text style={styles.statusModalButtonText}>
                  {statusModal.isVerified ? 'Continue' : 'Close'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Bottom Navigation */}
      {/* <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} /> */}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
     backgroundColor: '#FFF3E8',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 100, // Space for bottom nav
  },
  illustrationContainer: {
    width: '100%',
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    position: 'relative',
  },
  pendingStatusImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  clockContainer: {
    position: 'absolute',
    right: '20%',
    top: '20%',
  },
  clock: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#333',
    backgroundColor: '#F5F5F5',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockFace: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  clockMarker: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 4,
    height: 12,
    backgroundColor: '#333',
    borderRadius: 2,
  },
  personContainer: {
    position: 'absolute',
    bottom: -20,
    left: '50%',
    transform: [{ translateX: -20 }],
  },
  personHead: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#333',
    marginBottom: 4,
  },
  personBody: {
    width: 32,
    height: 40,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
  },
  laptop: {
    width: 40,
    height: 24,
    backgroundColor: '#666',
    borderRadius: 2,
    position: 'absolute',
    top: 20,
    left: -4,
  },
  speechBubble: {
    position: 'absolute',
    top: -30,
    right: -10,
    width: 40,
    height: 40,
    backgroundColor: '#fff',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  calendarContainer: {
    position: 'absolute',
    left: '10%',
    top: '30%',
  },
  calendar: {
    width: 100,
    height: 120,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#333',
    padding: 8,
    position: 'relative',
  },
  calendarSpiral: {
    position: 'absolute',
    top: -8,
    left: '50%',
    transform: [{ translateX: -8 }],
    width: 16,
    height: 16,
    borderWidth: 2,
    borderColor: '#333',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    justifyContent: 'space-between',
  },
  calendarDay: {
    width: 24,
    height: 24,
    backgroundColor: '#fff',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    margin: 2,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarCheck: {
    position: 'absolute',
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  heading: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  statusMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 21,
  },
  checkStatusButton: {
    marginTop: 32,
    borderRadius: 12,
    overflow: 'hidden',
  },
  checkStatusButtonGradient: {
    minWidth: 140,
    minHeight: 46,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkStatusButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  skipButton: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  skipButtonText: {
    color: '#FD8B36',
    fontSize: 15,
    fontWeight: '600',
  },
  statusModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  statusModalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F2E2D8',
  },
  statusBadge: {
    alignSelf: 'center',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  statusBadgeVerified: {
    backgroundColor: '#E7F8ED',
  },
  statusBadgePending: {
    backgroundColor: '#FFF1E8',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  statusBadgeTextVerified: {
    color: '#16833A',
  },
  statusBadgeTextPending: {
    color: '#C65A00',
  },
  statusModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#222',
    textAlign: 'center',
    marginBottom: 8,
  },
  statusModalMessage: {
    fontSize: 13,
    lineHeight: 19,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  statusDetailsCard: {
    backgroundColor: '#FFF9F5',
    borderWidth: 1,
    borderColor: '#F4E2D7',
    borderRadius: 14,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  statusDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1E1D6',
  },
  statusDetailRowLast: {
    borderBottomWidth: 0,
  },
  statusDetailLabel: {
    flex: 1,
    fontSize: 12,
    color: '#666',
    fontWeight: '700',
  },
  statusDetailValue: {
    flex: 1,
    fontSize: 12,
    color: '#222',
    fontWeight: '800',
    textAlign: 'right',
  },
  statusModalButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  statusModalButtonGradient: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  statusModalButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '800',
  },
});

export default PendingStatusScreen;
