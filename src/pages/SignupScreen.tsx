import { QueuedModal as Modal } from '../popup/PopupProvider';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Dimensions,
  ActivityIndicator,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import SafeAreaView from '../components/SafeAreaView';
import { compactTopPadding } from '../utils/responsiveLayout';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { API_BASE_URL } from '../config/api';
import Svg from '../assets/google.svg'
import LinearGradient from '../components/AppLinearGradient';
const { width } = Dimensions.get('window');

interface SignupScreenProps {
  onSignup?: (name: string, phoneNumber: string, userId?: string) => void;
  onContinueWithGoogle?: () => void;
  onContinueWithApple?: () => void;
  onLogin?: () => void; // Navigate to login screen
}
const SignupScreen: React.FC<SignupScreenProps> = ({
  onSignup,
  onContinueWithGoogle,
  onContinueWithApple,
  onLogin,
}) => {
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successPresented, setSuccessPresented] = useState(false);
  const [createdUserId, setCreatedUserId] = useState<string | undefined>(undefined);
  const [errorModal, setErrorModal] = useState({
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

  const handleSuccessConfirm = () => {
    setShowSuccessModal(false);
    if (onSignup) {
      onSignup(name, phoneNumber, createdUserId);
    } else if (onLogin) {
      onLogin();
    }
  };

  useEffect(() => {
    if (!showSuccessModal) {
      setSuccessPresented(false);
      return;
    }
    if (!successPresented) return;

    const timer = setTimeout(() => {
      setShowSuccessModal(false);
      if (onSignup) {
        onSignup(name, phoneNumber, createdUserId);
      } else if (onLogin) {
        onLogin();
      }
    }, 1600);

    return () => clearTimeout(timer);
  }, [showSuccessModal, successPresented, createdUserId, name, phoneNumber, onSignup, onLogin]);

  const handleSignup = async () => {
    // Validation
    if (!name.trim()) {
      showErrorModal('Error', 'Please enter your name');
      return;
    }

    const normalizedPhoneNumber = phoneNumber.replace(/\D/g, '');

    if (!normalizedPhoneNumber) {
      showErrorModal('Error', 'Please enter your phone number');
      return;
    }

    if (normalizedPhoneNumber.length < 10) {
      showErrorModal('Error', 'Please enter a valid phone number');
      return;
    }

    try {
      setLoading(true);
      const apiUrl = `${API_BASE_URL}/styler-signup`;

      console.log('📝 Signing up user:', { name, phoneNumber: normalizedPhoneNumber });
      console.log('🌐 API URL:', apiUrl);
      console.log('📱 Platform:', Platform.OS);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          name,
          phoneNumber: normalizedPhoneNumber,
          referralCode: referralCode.trim().toUpperCase() || undefined,
        }),
        signal: controller.signal,
      }).catch((error) => {
        clearTimeout(timeoutId);
        console.error('❌ Network error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack,
        });
        
        if (error.name === 'AbortError') {
          throw new Error('Request timeout. Please check your connection and try again.');
        } else if (error.message.includes('Network request failed')) {
          throw new Error(`Cannot connect to server at ${apiUrl}. Please ensure:\n1. Backend server is running\n2. You're using the correct IP address\n3. Firewall is not blocking the connection`);
        } else {
          throw new Error(error.message || 'Network request failed. Please check your internet connection.');
        }
      });

      clearTimeout(timeoutId);

      console.log('🟢 Signup response status:', response.status);

      const text = await response.text();
      let result: any = {};
      try {
        result = text ? JSON.parse(text) : {};
      } catch {
        if (response.status === 403 || /403\s*forbidden|cloudflare|waf/i.test(text)) {
          throw new Error('Access Forbidden (403): Request was blocked by network firewall. Please try again.');
        }
        if (/<[a-z][\s\S]*>/i.test(text)) {
          const stripped = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          throw new Error(stripped.slice(0, 180) || `Server Error (${response.status})`);
        }
        throw new Error(text.slice(0, 220));
      }

      if (!response.ok) {
        console.error('❌ Signup error:', result);
        throw new Error(result.message || `Signup failed: ${response.status}`);
      }

      console.log('✅ Signup successful:', result);

      // Extract userId from signup response (try multiple possible locations)
      const userId = result.data?.userId || result.data?.user?._id || result.data?.user?.id;
      console.log('📝 Signup - Extracted userId:', userId);
      console.log('📝 Signup - Full response data:', JSON.stringify(result.data, null, 2));

      // Validate that userId was received
      if (!userId) {
        console.error('❌ Error: userId not found in signup response');
        showErrorModal('Error', 'User ID not received from server. Please try again.');
        return;
      }

      setCreatedUserId(userId);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('❌ Error signing up:', error);
      showErrorModal(
        'Error',
        error instanceof Error
          ? error.message
          : 'Failed to create account. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
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
            Sign <Text style={styles.titleOrange}>Up</Text>
          </Text>
          <Text style={styles.tagline}>Create Your Glammefy Account</Text>
        </View>

        {/* Name Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Name</Text>
          <View style={styles.inputWrapper}>
            <Icon name="person" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter your name"
              placeholderTextColor="#999"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Phone Number Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Phone Number</Text>
          <View style={styles.inputWrapper}>
            <Icon name="phone" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter your phone number"
              placeholderTextColor="#999"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              maxLength={15}
              autoCorrect={false}
            />
          </View>
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
            Use a referral code only if this is your first stylist account.
          </Text>
        </View>

        {/* Sign Up Button */}
        <TouchableOpacity
          style={[styles.signupButton, loading && styles.buttonDisabled]}
          onPress={handleSignup}
          activeOpacity={0.8}
          disabled={loading}>
          <LinearGradient
            colors={['#FD8B36', '#f7bb2c']}
            locations={[0, 0.7]}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 0.5, y: 0 }}
            style={styles.signupButtonGradient}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.signupButtonText}>Sign Up</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>Or Continue With</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Social Login Buttons */}
        <View style={styles.socialButtons}>
          <TouchableOpacity
            style={styles.socialButton}
            onPress={onContinueWithGoogle}
            activeOpacity={0.8}>
            <Svg width="20" height="20" />
            <Text style={styles.socialButtonText}>Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.socialButton}
            onPress={onContinueWithApple}
            activeOpacity={0.8}>
            <Icon name="apple" size={24} color="#000" />
            <Text style={styles.socialButtonText}>Apple</Text>
          </TouchableOpacity>
        </View>

        {/* Login Link */}
        <View style={styles.loginLink}>
          <Text style={styles.loginLinkText}>Already Have An Account? </Text>
          <TouchableOpacity onPress={onLogin} activeOpacity={0.7}>
            <Text style={styles.loginLinkButton}>Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={showSuccessModal}
        onActiveChange={setSuccessPresented}
        transparent
        animationType="fade"
        onRequestClose={() => {}}>
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalCard}>
            <View style={styles.successIconWrap}>
              <Icon name="check-circle" size={36} color="#FD8B36" />
            </View>
            <Text style={styles.successModalTitle}>Success</Text>
            <Text style={styles.successModalText}>
              Account created successfully! Please login to continue.
            </Text>

          </View>
        </View>
      </Modal>
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF3E8',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: compactTopPadding(40),
    paddingBottom: 24,
  },
  header: {
    marginBottom: 32,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    width: 96,
    height: 96,
    borderRadius: 26,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  logo: {
    width: 72,
    height: 72,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  titleOrange: {
    color: '#FD8B36',
  },
  tagline: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  helperText: {
    marginTop: 8,
    marginLeft: 14,
    fontSize: 12,
    color: '#8A6B57',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.4,
    borderColor: '#FD8B36',
    borderRadius: 48,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 14,
  },
  inputIcon: {
    marginRight: 8,
  },
  signupButton: {
    width: '100%',
    borderRadius: 48,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  signupButtonGradient: {
    width: '100%',
    borderRadius: 48,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  signupButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#999',
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FD8B36',
    borderRadius: 48,
    paddingVertical: 14,
    marginHorizontal: 8,
    backgroundColor: '#fff',
  },
  socialButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  loginLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  loginLinkText: {
    fontSize: 14,
    color: '#666',
  },
  loginLinkButton: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FD8B36',
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
    borderWidth: 1,
    borderColor: '#FD8B36',
    backgroundColor: '#fff',
  },
  feedbackModalButtonText: {
    color: '#FD8B36',
    fontWeight: '600',
    fontSize: 15,
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  successModalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FD8B36',
  },
  successIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF2EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
    marginBottom: 8,
  },
  successModalText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 2,
  },
});

export default SignupScreen;
