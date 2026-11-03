import { QueuedAlert as Alert } from '../popup/QueuedAlert';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
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
import CustomModal from '../components/CustomModal';
import { useModal } from '../hooks/useModal';
import { updateOnboardingStep } from '../utils/onboardingSteps';

interface PaymentDetailsScreenProps {
  onBack?: () => void;
  onContinue?: () => void;
  onSkip?: () => void;
  userId?: string;
  initialData?: PaymentDetailsData;
  onDataChange?: (data: PaymentDetailsData) => void;
  isEditMode?: boolean;
}

export interface PaymentDetailsData {
  bankAccountNumber?: string;
  bankAccountHolderName?: string;
  ifscCode?: string;
  bankName?: string;
  branchName?: string;
  upiId?: string;
}

const PaymentDetailsScreen: React.FC<PaymentDetailsScreenProps> = ({
  onBack,
  onContinue,
  onSkip,
  userId,
  initialData,
  onDataChange,
  isEditMode = false,
}) => {
  const [bankAccountNumber, setBankAccountNumber] = useState(initialData?.bankAccountNumber || '');
  const [bankAccountHolderName, setBankAccountHolderName] = useState(initialData?.bankAccountHolderName || '');
  const [ifscCode, setIfscCode] = useState(initialData?.ifscCode || '');
  const [bankName, setBankName] = useState(initialData?.bankName || '');
  const [branchName, setBranchName] = useState(initialData?.branchName || '');
  const [upiId, setUpiId] = useState(initialData?.upiId || '');
  const [loading, setLoading] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [fetching, setFetching] = useState(false);
  const modal = useModal();

  // If initialData updates from outside, sync state
  useEffect(() => {
    if (initialData?.bankAccountNumber) setBankAccountNumber(initialData.bankAccountNumber);
    if (initialData?.bankAccountHolderName) setBankAccountHolderName(initialData.bankAccountHolderName);
    if (initialData?.ifscCode) setIfscCode(initialData.ifscCode);
    if (initialData?.bankName) setBankName(initialData.bankName);
    if (initialData?.branchName) setBranchName(initialData.branchName);
    if (initialData?.upiId) setUpiId(initialData.upiId);
  }, [initialData]);

  // Fetch current payment details from profile if not yet populated
  useEffect(() => {
    if (!userId) return;

    const fetchCurrentDetails = async () => {
      try {
        setFetching(true);
        const res = await fetch(`${API_BASE_URL_WITH_API}/profile/user/${userId}`);
        if (!res.ok) return;
        const result = await res.json();
        const pDetails = result?.data?.paymentDetails;
        if (pDetails) {
          if (pDetails.bankAccountNumber) setBankAccountNumber(pDetails.bankAccountNumber);
          if (pDetails.bankAccountHolderName) setBankAccountHolderName(pDetails.bankAccountHolderName);
          if (pDetails.ifscCode) setIfscCode(pDetails.ifscCode);
          if (pDetails.bankName) setBankName(pDetails.bankName);
          if (pDetails.branchName) setBranchName(pDetails.branchName);
          if (pDetails.upiId) setUpiId(pDetails.upiId);

          onDataChange?.({
            bankAccountNumber: pDetails.bankAccountNumber || '',
            bankAccountHolderName: pDetails.bankAccountHolderName || '',
            ifscCode: pDetails.ifscCode || '',
            bankName: pDetails.bankName || '',
            branchName: pDetails.branchName || '',
            upiId: pDetails.upiId || '',
          });
        }
      } catch (err) {
        console.warn('Could not pre-fetch payment details:', err);
      } finally {
        setFetching(false);
      }
    };

    fetchCurrentDetails();
  }, [userId]);

  useEffect(() => {
    onDataChange?.({
      bankAccountNumber,
      bankAccountHolderName,
      ifscCode,
      bankName,
      branchName,
      upiId,
    });
  }, [
    bankAccountNumber,
    bankAccountHolderName,
    ifscCode,
    bankName,
    branchName,
    upiId,
    onDataChange,
  ]);

  // Validate IFSC code format (11 characters: 4 letters + 0 + 6 alphanumeric)
  const validateIFSC = (ifsc: string): boolean => {
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    return ifscRegex.test(ifsc.toUpperCase());
  };

  // Validate account number (should be numeric and 9-18 digits)
  const validateAccountNumber = (accountNumber: string): boolean => {
    const accountRegex = /^\d{9,18}$/;
    return accountRegex.test(accountNumber);
  };

  // Validate UPI ID (e.g., name@okaxis, 9876543210@paytm)
  const validateUPI = (upi: string): boolean => {
    const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
    return upiRegex.test(upi.trim());
  };

  const handleContinue = async () => {
    const trimmedBankAcc = bankAccountNumber.trim();
    const trimmedHolder = bankAccountHolderName.trim();
    const trimmedIfsc = ifscCode.trim().toUpperCase();
    const trimmedUpi = upiId.trim();

    const hasAnyBankField = Boolean(trimmedBankAcc || trimmedHolder || trimmedIfsc);

    // Require either bank details OR UPI ID
    if (!hasAnyBankField && !trimmedUpi) {
      modal.showAlert(
        'Information Required',
        'Please enter either your Bank Account details or your UPI ID to receive payouts.',
        'warning'
      );
      return;
    }

    // If bank details are partially filled, ensure required bank fields are valid
    if (hasAnyBankField) {
      if (!trimmedBankAcc) {
        Alert.alert('Error', 'Please enter your bank account number.');
        return;
      }
      if (!validateAccountNumber(trimmedBankAcc)) {
        Alert.alert('Error', 'Please enter a valid bank account number (9-18 digits).');
        return;
      }
      if (!trimmedHolder) {
        Alert.alert('Error', 'Please enter the account holder name.');
        return;
      }
      if (!trimmedIfsc) {
        Alert.alert('Error', 'Please enter the IFSC code.');
        return;
      }
      if (!validateIFSC(trimmedIfsc)) {
        Alert.alert('Error', 'Please enter a valid IFSC code (e.g., HDFC0001234).');
        return;
      }
    }

    // Validate UPI ID if provided
    if (trimmedUpi && !validateUPI(trimmedUpi)) {
      Alert.alert('Error', 'Please enter a valid UPI ID (e.g. mobile@upi or username@okaxis).');
      return;
    }

    try {
      setLoading(true);

      const apiUrl = `${API_BASE_URL_WITH_API}/profile/payment-details`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          userId,
          bankAccountNumber: trimmedBankAcc || undefined,
          bankAccountHolderName: trimmedHolder || undefined,
          ifscCode: trimmedIfsc || undefined,
          bankName: bankName.trim() || undefined,
          branchName: branchName.trim() || undefined,
          upiId: trimmedUpi || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to save payment details' }));
        throw new Error(errorData.message || 'Failed to save payment details');
      }

      const result = await response.json();
      console.log('✅ Payment details saved:', result);

      // Mark paymentDetails step as completed
      if (userId) {
        await updateOnboardingStep(userId, 'paymentDetails', true);
      }

      modal.showAlert('Success', 'Bank & UPI details saved successfully!', 'success');

      setTimeout(() => {
        if (onContinue) {
          onContinue();
        } else if (onBack) {
          onBack();
        }
      }, 700);
    } catch (error) {
      console.error('❌ Error saving payment details:', error);
      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Failed to save payment details. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!onSkip || skipping) return;
    try {
      setSkipping(true);
      await onSkip();
    } finally {
      setSkipping(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}>
      <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
        <CustomModal
          visible={modal.visible}
          title={modal.title}
          message={modal.message}
          type={modal.type}
          buttons={modal.buttons}
          onClose={modal.hideModal}
        />

        {/* Fixed Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onBack}
            style={styles.backButton}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Icon name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditMode ? 'Bank & UPI Details' : 'Payment Details'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            bounces={false}
            alwaysBounceVertical={false}
            overScrollMode="never">

            {/* Title Section */}
            <View style={styles.titleSection}>
              <Text style={styles.title}>
                {isEditMode ? 'Manage Payout & Bank Details' : 'Bank & UPI Information'}
              </Text>
              <Text style={styles.subtitle}>
                Add or edit your Bank Account or UPI ID to receive service payouts directly.
              </Text>
            </View>

            {fetching && (
              <View style={styles.loadingBanner}>
                <ActivityIndicator size="small" color="#FD8B36" />
                <Text style={styles.loadingBannerText}>Loading your saved details...</Text>
              </View>
            )}

            {/* UPI Section */}
            <View style={styles.formSection}>
              <View style={styles.sectionHeaderWrap}>
                <Icon name="qr-code" size={18} color="#FD8B36" />
                <Text style={styles.sectionHeading}>UPI Details (Instant Transfer)</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  UPI ID <Text style={styles.optional}>(e.g. mobile@upi, name@okaxis)</Text>
                </Text>
                <View style={styles.inputWrapper}>
                  <Icon name="payment" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter UPI ID (e.g. 9876543210@paytm)"
                    placeholderTextColor="#999"
                    value={upiId}
                    onChangeText={setUpiId}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {upiId ? (
                    <TouchableOpacity onPress={() => setUpiId('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Icon name="cancel" size={18} color="#B9B9B9" />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <Text style={styles.helperText}>
                  Receive payments directly to your UPI ID without needing account numbers.
                </Text>
              </View>

              {/* Divider */}
              <View style={styles.orDividerWrap}>
                <View style={styles.dividerLine} />
                <Text style={styles.orDividerText}>OR BANK ACCOUNT</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.sectionHeaderWrap}>
                <Icon name="account-balance" size={18} color="#FD8B36" />
                <Text style={styles.sectionHeading}>Bank Account Details</Text>
              </View>

              {/* Account Number */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Bank Account Number</Text>
                <View style={styles.inputWrapper}>
                  <Icon name="account-balance" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter account number"
                    placeholderTextColor="#999"
                    value={bankAccountNumber}
                    onChangeText={setBankAccountNumber}
                    keyboardType="numeric"
                    maxLength={18}
                  />
                  {bankAccountNumber ? (
                    <TouchableOpacity onPress={() => setBankAccountNumber('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Icon name="cancel" size={18} color="#B9B9B9" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              {/* Account Holder Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Account Holder Name</Text>
                <View style={styles.inputWrapper}>
                  <Icon name="person" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter account holder name"
                    placeholderTextColor="#999"
                    value={bankAccountHolderName}
                    onChangeText={setBankAccountHolderName}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* IFSC Code */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>IFSC Code</Text>
                <View style={styles.inputWrapper}>
                  <Icon name="code" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., HDFC0001234"
                    placeholderTextColor="#999"
                    value={ifscCode}
                    onChangeText={(text) => setIfscCode(text.toUpperCase())}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={11}
                  />
                </View>
              </View>

              {/* Bank Name (Optional) */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Bank Name <Text style={styles.optional}>(Optional)</Text>
                </Text>
                <View style={styles.inputWrapper}>
                  <Icon name="account-balance-wallet" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter bank name"
                    placeholderTextColor="#999"
                    value={bankName}
                    onChangeText={setBankName}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* Branch Name (Optional) */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Branch Name <Text style={styles.optional}>(Optional)</Text>
                </Text>
                <View style={styles.inputWrapper}>
                  <Icon name="location-on" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter branch name"
                    placeholderTextColor="#999"
                    value={branchName}
                    onChangeText={setBranchName}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>
              </View>
            </View>

          </ScrollView>
        </TouchableWithoutFeedback>

        <View style={styles.footer}>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.continueButton, loading && styles.continueButtonDisabled]}
              onPress={handleContinue}
              disabled={loading}
              activeOpacity={0.8}>
              <LinearGradient
                colors={['#FD8B36', '#f7bb2c']}
                start={{ x: 0.5, y: 0.5 }}
                end={{ x: 0.5, y: 0 }}
                style={styles.continueButtonGradient}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.continueButtonText}>
                    {isEditMode ? 'Save Bank & UPI Details' : 'Continue'}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {onSkip && !isEditMode && (
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.skipButton, (loading || skipping) && { opacity: 0.6 }]}
                onPress={handleSkip}
                disabled={loading || skipping}
                activeOpacity={0.8}
                hitSlop={{ top: 12, bottom: 12, left: 20, right: 20 }}>
                {skipping ? (
                  <ActivityIndicator size="small" color="#FD8B36" />
                ) : (
                  <Text style={styles.skipButtonText}>Skip</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.securityNote}>
            <Icon name="lock" size={16} color="#666" />
            <Text style={styles.securityNoteText}>
              Your bank and UPI details are encrypted and secure. We use industry-standard security measures to protect your information.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFF3E8',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF3E8',
    paddingTop: compactTopPadding(20),
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#FFF3E8',
    paddingBottom: 24,
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#FFF3E8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0E0D0',
    backgroundColor: '#FFF3E8',
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerSpacer: {
    width: 40,
  },
  titleSection: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    marginHorizontal: 24,
    marginVertical: 8,
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  loadingBannerText: {
    fontSize: 12,
    color: '#666',
  },
  formSection: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  sectionHeaderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
  },
  orDividerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2D5C8',
  },
  orDividerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8A7A70',
    letterSpacing: 0.8,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  optional: {
    fontSize: 11,
    fontWeight: '400',
    color: '#888',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8DED4',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    paddingVertical: 12,
  },
  helperText: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
    marginLeft: 4,
  },
  footer: {
    backgroundColor: '#FFF3E8',
    paddingTop: 8,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 10,
  },
  continueButton: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  continueButtonGradient: {
    width: '100%',
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  continueButtonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 8,
  },
  securityNoteText: {
    flex: 1,
    fontSize: 11,
    color: '#666',
    lineHeight: 16,
  },
  skipButton: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FD8B36',
  },
});

export default PaymentDetailsScreen;
