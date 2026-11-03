import { QueuedModal as Modal } from '../popup/PopupProvider';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import SafeAreaView from '../components/SafeAreaView';
import { compactTopPadding } from '../utils/responsiveLayout';
import { storeLoginSession } from '../utils/authStorage';

import Icon from 'react-native-vector-icons/MaterialIcons';
import { API_BASE_URL } from '../config/api';
import Svg from '../assets/google.svg';
import LinearGradient from '../components/AppLinearGradient';
import {
  PARTNER_PRIVACY_TEXT,
  PARTNER_TERMS_TEXT,
} from '../constants/legalContent';

const cleanErrorMessage = (text: string, status?: number): string => {
  if (!text) return 'An unexpected error occurred. Please try again.';

  if (status === 403 || /403\s*forbidden|cloudflare|waf|access denied/i.test(text)) {
    return 'Access Forbidden (403): Request was blocked by network security policy. Please try again.';
  }
  if (status === 413 || /413\s*payload/i.test(text)) {
    return 'Payload Too Large (413): Data exceeds maximum server size limit.';
  }
  if (status === 502 || /502\s*bad gateway/i.test(text)) {
    return 'Server Unavailable (502): The backend server is temporarily unreachable.';
  }
  if (status === 504 || /504\s*gateway timeout/i.test(text)) {
    return 'Gateway Timeout (504): Server took too long to respond.';
  }

  // Strip HTML tags if HTML string is detected
  if (/<[a-z][\s\S]*>/i.test(text)) {
    const stripped = text
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return stripped.slice(0, 180) || `Server Error (${status || '403'})`;
  }

  return text.slice(0, 250);
};

const parseJsonOrText = async (response: Response) => {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    console.warn('LoginScreen: failed to parse JSON response', {
      status: response.status,
      statusText: response.statusText,
      body: text?.substring(0, 100),
    });
    const friendlyMsg = cleanErrorMessage(text, response.status);
    throw new Error(friendlyMsg);
  }
};

const { width: screenWidth } = Dimensions.get('window');
const topOrbSize = Math.min(Math.max(screenWidth * 0.58, 220), 290);
const bottomOrbSize = Math.min(Math.max(screenWidth * 0.7, 260), 350);

interface LoginScreenProps {
  onLogin?: (phoneNumber: string, userId?: string) => void;
  onContinueWithGoogle?: () => void;
  onContinueWithApple?: () => void;
  onForgotPassword?: () => void;
  onSkip?: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({
  onLogin,
  onContinueWithGoogle,
  onContinueWithApple,
  onSkip,
}) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [otpError, setOtpError] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [errorModal, setErrorModal] = useState({
    visible: false,
    title: '',
    message: '',
  });
  const [policyModal, setPolicyModal] = useState({
    visible: false,
    title: '',
    message: '',
  });
  const showErrorModal = (title: string, message: string) => {
    setErrorModal({ visible: true, title, message });
  };

  const hideErrorModal = () => {
    setErrorModal(prev => ({ ...prev, visible: false }));
  };

  const showPolicyModal = (title: string, message: string) => {
    setPolicyModal({ visible: true, title, message });
  };

  const hidePolicyModal = () => {
    setPolicyModal(prev => ({ ...prev, visible: false }));
  };

  const getNormalizedPhoneNumber = () => phoneNumber.replace(/\D/g, '');

  const validatePhoneNumber = () => {
    const normalizedPhoneNumber = getNormalizedPhoneNumber();
    setPhoneError('');

    if (!normalizedPhoneNumber) {
      setPhoneError('Please enter your mobile number');
      return null;
    }

    if (normalizedPhoneNumber.length < 10) {
      setPhoneError('Please enter a valid mobile number');
      return null;
    }

    return normalizedPhoneNumber;
  };

  const handleSendOtp = async () => {
    if (loading) {
      return;
    }

    const normalizedPhoneNumber = validatePhoneNumber();
    if (!normalizedPhoneNumber) {
      return;
    }

    try {
      setLoading(true);
      setPhoneError('');
      setUserId(null);
      setOtp('');
      setOtpError('');

      const apiUrl = `${API_BASE_URL}/send-otp`;
      console.log('📲 Sending OTP to:', normalizedPhoneNumber);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: normalizedPhoneNumber,
          role: 'stylist',
        }),
      });

      const result = await parseJsonOrText(response);
      if (__DEV__) {
        console.log('🟢 Send OTP response:', result);
      }

      if (!response.ok) {
        throw new Error(result?.message || `Failed to send OTP: ${response.status}`);
      }

      setOtpSent(true);
      showErrorModal(
        'OTP Sent',
        __DEV__ && result?.data?.otp
          ? `OTP sent successfully.\nTest OTP: ${result.data.otp}`
          : 'OTP sent successfully to your phone number.',
      );
    } catch (error) {
      console.error('❌ Error sending OTP:', error);
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to send OTP. Please try again.';
      if (/phone|mobile|number/i.test(message)) {
        setPhoneError(message);
      } else {
        showErrorModal('Error', message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (loading) {
      return;
    }

    const normalizedPhoneNumber = validatePhoneNumber();
    if (!normalizedPhoneNumber) {
      return;
    }

    const normalizedOtp = otp.replace(/\D/g, '');

    if (!normalizedOtp) {
      setOtpError('Please enter the OTP');
      return;
    }

    if (normalizedOtp.length !== 6) {
      setOtpError('Please enter a 6-digit OTP');
      return;
    }

    try {
      setLoading(true);
      setOtpError('');
      const apiUrl = `${API_BASE_URL}/verify-otp`;

      console.log('🔐 Verifying OTP for user:', { phoneNumber: normalizedPhoneNumber });

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: normalizedPhoneNumber,
          otp: normalizedOtp,
          role: 'stylist',
          referralCode: referralCode.trim().toUpperCase() || undefined,
        }),
      });

      if (__DEV__) {
        console.log('🟢 Verify OTP response status:', response.status);
      }

      const result = await parseJsonOrText(response);
      if (__DEV__) {
        console.log('✅ OTP verification response:', result);
      }

      if (!response.ok) {
        throw new Error(result.message || `OTP verification failed: ${response.status}`);
      }

      // Extract user ID from response (try multiple possible locations)
      const userIdFromResponse =
        result.data?.userId ||
        result.data?.user?._id ||
        result.data?.user?.id ||
        result.data?.user?._id?.toString?.();
      const finalUserId = userIdFromResponse || userId;
      if (__DEV__) {
        console.log('📝 Extracted userId:', finalUserId);
        console.log('📝 Full response data:', JSON.stringify(result.data, null, 2));
      }

      // Call onLogin immediately - App.tsx will handle modal display
      if (onLogin) {
        onLogin(normalizedPhoneNumber, finalUserId);
      }

      // Store token if needed (you can use AsyncStorage or context)
      if (result.data?.token) {
        await storeLoginSession(finalUserId, result.data.token);
        if (__DEV__) {
          console.log('Token received:', result.data.token);
        }
      }
    } catch (error) {
      console.error('❌ Error logging in:', error);
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to login. Please try again.';
      if (/otp|code/i.test(message)) {
        setOtpError(message);
      } else if (/phone|mobile|number/i.test(message)) {
        setPhoneError(message);
      } else {
        showErrorModal('Error', message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
      <View style={styles.background}>
        <LinearGradient
          colors={['#FD8B36', '#F7BB2C']}
          start={{ x: 0.1, y: 0.1 }}
          end={{ x: 0.9, y: 0.9 }}
          style={styles.topOrb}
        />
        <LinearGradient
          colors={['#FD8B36', '#F7BB2C']}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 0.5, y: 0 }}
          style={styles.bottomOrb}
        />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoWrap}>
            <Image
              source={require('../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>
            Log <Text style={styles.titleOrange}>In</Text>
          </Text>
          <Text style={styles.tagline}>Login with your phone number and OTP</Text>
        </View>

        <View style={styles.formCard}>
        {/* Phone Number Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Phone Number</Text>
          <View style={styles.inputWrapper}>
            <Icon
              name="phone"
              size={20}
              color="#999"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Enter your phone number"
              placeholderTextColor="#999"
              value={phoneNumber}
              onChangeText={(value) => {
                setPhoneNumber(value);
                if (phoneError) {
                  setPhoneError('');
                }
              }}
              keyboardType="phone-pad"
              maxLength={15}
              autoCorrect={false}
            />
          </View>
          {!!phoneError && <Text style={styles.fieldErrorText}>{phoneError}</Text>}
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Referral Code (Optional)</Text>
          <View style={styles.inputWrapper}>
            <Icon name="redeem" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter referral code"
              placeholderTextColor="#999"
              value={referralCode}
              onChangeText={(value) => setReferralCode(value.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
            />
          </View>
          <Text style={styles.helperText}>
            Use a referral code only if you are joining for the first time.
          </Text>
        </View>

        {otpSent && (
          <View style={styles.inputContainer}>
            <Text style={styles.label}>OTP</Text>
            <View style={styles.inputWrapper}>
              <Icon
                name="password"
                size={20}
                color="#999"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Enter OTP"
                placeholderTextColor="#999"
                value={otp}
                onChangeText={(value) => {
                  setOtp(value.replace(/\D/g, '').slice(0, 6));
                  if (otpError) {
                    setOtpError('');
                  }
                }}
                keyboardType="number-pad"
                maxLength={6}
                autoCorrect={false}
              />
            </View>
            {!!otpError && <Text style={styles.fieldErrorText}>{otpError}</Text>}
            <TouchableOpacity
              onPress={handleSendOtp}
              activeOpacity={0.7}
              style={styles.resendOtpContainer}
              disabled={loading}
            >
              <Text style={styles.resendOtpText}>Resend OTP</Text>
            </TouchableOpacity>
          </View>
        )}

        {!otpSent ? (
          <TouchableOpacity
            style={styles.loginButtonWrapper}
            onPress={handleSendOtp}
            activeOpacity={0.8}
            disabled={loading}
          >
            <LinearGradient
              colors={['#FD8B36', '#F7BB2C']}
              locations={[0, 1]}
              start={{ x: 0.5, y: 0.5 }}
              end={{ x: 0.5, y: 0 }}
              style={[styles.loginButtonGradient, loading && styles.buttonDisabled]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>Send OTP</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.loginButtonWrapper}
            onPress={handleLogin}
            activeOpacity={0.8}
            disabled={loading}
          >
            <LinearGradient
              colors={['#FD8B36', '#F7BB2C']}
              locations={[0, 1]}
              start={{ x: 0.5, y: 0.5 }}
              end={{ x: 0.5, y: 0 }}
              style={[styles.loginButtonGradient, loading && styles.buttonDisabled]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>Log In</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Or Separator */}
        <View style={styles.separatorContainer}>
          <View style={styles.separatorLine} />
          <Text style={styles.separatorText}>Or</Text>
          <View style={styles.separatorLine} />
        </View>

        <View style={styles.socialButtonRow}>
          <TouchableOpacity
            style={styles.socialButton}
            onPress={onContinueWithGoogle}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
          >
            <Svg width="26" height="26" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.socialButton}
            onPress={onContinueWithApple}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Continue with Apple"
          >
            <Icon name="apple" size={28} color="#000" />
          </TouchableOpacity>
        </View>

        <View style={styles.termsContainer}>
          <Text style={styles.termsText}>By continuing, you agree to our </Text>
          <TouchableOpacity
            onPress={() => showPolicyModal('Terms & Conditions', PARTNER_TERMS_TEXT)}
            activeOpacity={0.7}
          >
            <Text style={[styles.termsText, styles.termsLink]}>Terms & Conditions</Text>
          </TouchableOpacity>
          <Text style={styles.termsText}> and </Text>
          <TouchableOpacity
            onPress={() => showPolicyModal('Privacy Policy', PARTNER_PRIVACY_TEXT)}
            activeOpacity={0.7}
          >
            <Text style={[styles.termsText, styles.termsLink]}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>


        
        </View>
      </ScrollView>
      </View>

      <Modal
        visible={errorModal.visible}
        transparent
        animationType="fade"
        onRequestClose={hideErrorModal}
      >
        <View style={styles.feedbackModalOverlay}>
          <View style={styles.feedbackModalCard}>
            <LinearGradient
              colors={['#FD8B36', '#f7bb2c']}
              start={{ x: 0.5, y: 0.5 }}
              end={{ x: 0.5, y: 0 }}
              style={styles.feedbackModalGradient}
            >
              <Icon name="error-outline" size={38} color="#fff" />
            </LinearGradient>
            <View style={styles.feedbackModalBody}>
              <Text style={styles.feedbackModalTitle}>{errorModal.title}</Text>
              <Text style={styles.feedbackModalMessage}>{errorModal.message}</Text>
              <TouchableOpacity
                style={styles.feedbackModalButton}
                onPress={hideErrorModal}
                activeOpacity={0.8}
              >
                <Text style={styles.feedbackModalButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={policyModal.visible}
        transparent
        animationType="fade"
        onRequestClose={hidePolicyModal}
      >
        <View style={styles.feedbackModalOverlay}>
          <View style={styles.policyModalCard}>
            <View style={styles.policyModalHeader}>
              <Text style={styles.feedbackModalTitle}>{policyModal.title}</Text>
              <TouchableOpacity
                onPress={hidePolicyModal}
                activeOpacity={0.7}
                style={styles.policyCloseButton}
              >
                <Icon name="close" size={22} color="#6F3F20" />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.policyScroll}
              showsVerticalScrollIndicator
            >
              <Text style={styles.policyText}>{policyModal.message}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF3E8',
  },
  background: {
    flex: 1,
  },
  topOrb: {
    position: 'absolute',
    top: -topOrbSize * 0.38,
    right: -topOrbSize * 0.28,
    width: topOrbSize,
    height: topOrbSize,
    borderRadius: topOrbSize / 2,
  },
  bottomOrb: {
    position: 'absolute',
    left: -bottomOrbSize * 0.4,
    bottom: -bottomOrbSize * 0.26,
    width: bottomOrbSize,
    height: bottomOrbSize,
    borderRadius: bottomOrbSize / 2,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: compactTopPadding(32),
    paddingBottom: 28,
  },
  header: {
    marginBottom: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  logoWrap: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  logo: {
    width: 58,
    height: 58,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#14110A',
    marginBottom: 8,
  },
  titleOrange: {
    color: '#14110A',
  },
  tagline: {
    width: '82%',
    fontSize: 13,
    lineHeight: 18,
    color: '#6F3F20',
    fontWeight: '500',
    textAlign: 'center',
  },
  formCard: {
    width: '100%',
    borderRadius: 28,
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.13,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 9,
  },
  inputContainer: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6F3F20',
    marginBottom: 8,
    marginLeft: 4,
  },
  helperText: {
    marginTop: 8,
    marginLeft: 6,
    fontSize: 12,
    color: '#9A6A4E',
  },
  fieldErrorText: {
    marginTop: 7,
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#D12F1F',
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  forgotPasswordContainer: {
    marginTop: 10,
    alignItems: 'flex-end',
  },
  forgotPassword: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FD8B36',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0,
    borderColor: '#F3E4D2',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 15,
    backgroundColor: '#FFF3E8',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    paddingVertical: 0,
  },
  resendOtpContainer: {
    marginTop: 10,
    alignItems: 'flex-end',
  },
  resendOtpText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FD8B36',
  },
  loginButtonWrapper: {
    width: '100%',
    borderRadius: 999,
    marginTop: 8,
    marginBottom: 22,
  },
  loginButtonGradient: {
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 18,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#F3D7C2',
  },
  separatorText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#9A6A4E',
  },
  socialButtonRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    marginBottom: 6,
  },
  socialButton: {
    width: 52,
    height: 52,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FFD0AD',
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  termsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingHorizontal: 8,
  },
  termsText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#7A5A43',
    textAlign: 'center',
  },
  termsLink: {
    color: '#FD8B36',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  skipButtonContainer: {
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  authSkipButtonText: {
    color: '#FD8B36',
    fontSize: 15,
    fontWeight: '600',
  },
  feedbackModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  feedbackModalCard: {
    width: '82%',
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 0,
    borderColor: '#FD8B36',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 16,
  },
  policyModalCard: {
    width: '88%',
    maxHeight: '82%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 16,
  },
  policyModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  policyCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFF3E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  policyScroll: {
    maxHeight: 420,
  },
  policyText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#555',
  },
  feedbackModalGradient: {
    height: 70,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackModalBody: {
    padding: 24,
    alignItems: 'center',
  },
  feedbackModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    color: '#333',
  },
  feedbackModalMessage: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 20,
  },
  feedbackModalButton: {
    marginTop: 20,
    paddingVertical: 8,
    paddingHorizontal: 28,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1.4,
    borderColor: '#FD8B36',
  },
  feedbackModalButtonText: {
    color: '#FD8B36',
    fontWeight: '600',
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  skipButton: {
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    textDecorationLine: 'underline',
  },
  // Welcome Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingVertical: 60,
    paddingHorizontal: 40,
    alignItems: 'center',
    width: '85%',
    // shadowColor: '#000',
    // shadowOffset: { width: 0, height: 10 },
    // shadowOpacity: 0.3,
    // shadowRadius: 20,
    // elevation: 10,
  },
  celebrationEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: '400',
    color: '#666',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  glammefy: {
    fontSize: 42,
    fontWeight: '800',
    marginBottom: 16,
    letterSpacing: -1,
  },
  glam: {
    color: '#333',
  },
  mefy: {
    color: '#FD8B36',
  },
  welcomeSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  star: {
    fontSize: 28,
  },
  welcomeMessage: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
  },
});

export default LoginScreen;
