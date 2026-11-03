import { QueuedModal as Modal } from '../popup/PopupProvider';
import { QueuedAlert as Alert } from '../popup/QueuedAlert';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SafeAreaView from '../components/SafeAreaView';
import { compactTopPadding } from '../utils/responsiveLayout';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as ImagePicker from 'react-native-image-picker';
// import BottomNavigation from '../components/BottomNavigation';
import {
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import LinearGradient from '../components/AppLinearGradient';
import { buildImageDataUri } from '../utils/imageDataUri';

interface ProfileData {
  name: string;
  age: string;
  gender: 'Male' | 'Female' | 'Other';
  about: string;
  phoneNumber: string;
  instagram: string;
  yearsOfExperience: string;
  profileImage: string | null;
  profileImageUrl: string | null;
}

interface CompleteProfileScreenProps {
  onBack?: () => void;
  onNext?: (profileData: ProfileData) => void;
  onSkip?: () => void;
  userId?: string;
  initialData?: Partial<ProfileData>;
  onDataChange?: (profileData: ProfileData) => void;
}

const normalizeProfilePhoneNumber = (value?: string | null) => {
  const digits = (value || '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
};

const normalizeInstagramHandle = (value?: string | null) => {
  const handle = (value || '').trim().replace(/^@+/, '');
  return `@${handle}`;
};

type ProfileFeedbackType = 'error' | 'warning';

const CompleteProfileScreen: React.FC<CompleteProfileScreenProps> = ({
  onBack,
  onNext,
  onSkip,
  userId,
  initialData,
  onDataChange,
}) => {
  const insets = useSafeAreaInsets();
  const [feedbackModal, setFeedbackModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: ProfileFeedbackType;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'error',
  });
  const [name, setName] = useState(initialData?.name || '');
  const [age, setAge] = useState(initialData?.age || '');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>(
    initialData?.gender || 'Male',
  );
  const [about, setAbout] = useState(initialData?.about || '');
  const [phoneNumber, setPhoneNumber] = useState(
    normalizeProfilePhoneNumber(initialData?.phoneNumber),
  );
  const [instagram, setInstagram] = useState(
    normalizeInstagramHandle(initialData?.instagram),
  );
  const [yearsOfExperience, setYearsOfExperience] = useState(initialData?.yearsOfExperience || '');
  const [profileImage, setProfileImage] = useState<string | null>(initialData?.profileImage || null);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(initialData?.profileImageUrl || null);
  const [uploadingProfileImage, setUploadingProfileImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'scan' | 'bookings' | 'account'>('home');

  const showFeedbackModal = (
    title: string,
    message: string,
    type: ProfileFeedbackType = 'error',
  ) => {
    setFeedbackModal({ visible: true, title, message, type });
  };

  const hideFeedbackModal = () => {
    setFeedbackModal(prev => ({ ...prev, visible: false }));
  };

  useEffect(() => {
    if (initialData?.name && !name) setName(initialData.name);
    if (initialData?.age && !age) setAge(String(initialData.age));
    if (initialData?.gender && initialData.gender !== gender) setGender(initialData.gender);
    if (initialData?.about && !about) setAbout(initialData.about);
    if (initialData?.yearsOfExperience && !yearsOfExperience) setYearsOfExperience(String(initialData.yearsOfExperience));
    if (initialData?.profileImage && !profileImage) {
      setProfileImage(initialData.profileImage);
      setProfileImageUrl(initialData.profileImageUrl || initialData.profileImage);
    }
    const initialPhoneNumber = normalizeProfilePhoneNumber(initialData?.phoneNumber);
    if (initialPhoneNumber) {
      setPhoneNumber(currentPhoneNumber => currentPhoneNumber || initialPhoneNumber);
    }
    if (initialData?.instagram && (!instagram || instagram === '@')) {
      setInstagram(normalizeInstagramHandle(initialData.instagram));
    }
  }, [initialData]);

  useEffect(() => {
    onDataChange?.({
      name,
      age,
      gender,
      phoneNumber,
      instagram,
      yearsOfExperience,
      about,
      profileImage,
      profileImageUrl,
    });
  }, [
    name,
    age,
    gender,
    phoneNumber,
    instagram,
    yearsOfExperience,
    about,
    profileImage,
    profileImageUrl,
    onDataChange,
  ]);

  const handleSelectedAsset = async (asset: ImagePicker.Asset) => {
    const imageData = buildImageDataUri(asset);
    if (!imageData) {
      showFeedbackModal('Error', 'Selected image is missing. Please try again.');
      return;
    }
    if (!userId) {
      showFeedbackModal('Error', 'User ID is missing. Please login again.');
      return;
    }

    setProfileImage(imageData);
    setProfileImageUrl(imageData);
    setUploadingProfileImage(true);
    try {
      showFeedbackModal('Selected', 'Profile image selected successfully.', 'warning');
    } catch (error) {
      console.error('❌ Profile image selection failed:', error);
      setProfileImage(null);
      setProfileImageUrl(null);
      showFeedbackModal(
        'Selection Failed',
        error instanceof Error ? error.message : 'Failed to select profile image. Please try again.',
      );
    } finally {
      setUploadingProfileImage(false);
    }
  };

  const handleImagePicker = () => {
    const options: ImagePicker.CameraOptions = {
      mediaType: 'photo',
      quality: 0.4,
      maxWidth: 900,
      maxHeight: 900,
      includeBase64: true,
    };

    Alert.alert(
      'Select Profile Picture',
      'Choose an option',
      [
        {
          text: 'Camera',
          onPress: () => {
            ImagePicker.launchCamera(options, (response) => {
              if (response.errorMessage) {
                showFeedbackModal('Error', response.errorMessage);
                return;
              }
              if (response.assets && response.assets[0]) {
                handleSelectedAsset(response.assets[0]);
              }
            });
          },
        },
        {
          text: 'Gallery',
          onPress: () => {
            ImagePicker.launchImageLibrary(options, (response) => {
              if (response.errorMessage) {
                showFeedbackModal('Error', response.errorMessage);
                return;
              }
              if (response.assets && response.assets[0]) {
                handleSelectedAsset(response.assets[0]);
              }
            });
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const handleNext = async () => {
    const trimmedName = name.trim();
    const trimmedAge = age.trim();
    const trimmedPhoneNumber = normalizeProfilePhoneNumber(phoneNumber);
    const trimmedYearsOfExperience = yearsOfExperience.trim();
    const ageValue = Number(trimmedAge);
    const experienceValue = Number(trimmedYearsOfExperience);

    if (!trimmedName) {
      showFeedbackModal('Error', 'Please enter your name');
      return;
    }
    if (!trimmedAge) {
      showFeedbackModal('Error', 'Please enter your age');
      return;
    }
    if (!Number.isFinite(ageValue) || ageValue <= 0) {
      showFeedbackModal('Error', 'Please enter a valid age');
      return;
    }
    if (!gender) {
      showFeedbackModal('Error', 'Please select your gender');
      return;
    }
    if (!trimmedPhoneNumber) {
      showFeedbackModal('Error', 'Please enter your phone number');
      return;
    }
    if (trimmedPhoneNumber.length !== 10) {
      showFeedbackModal('Error', 'Please enter a valid 10 digit phone number');
      return;
    }
    if (!trimmedYearsOfExperience) {
      showFeedbackModal('Error', 'Please enter your experience');
      return;
    }
    if (!Number.isFinite(experienceValue) || experienceValue < 0) {
      showFeedbackModal('Error', 'Please enter valid experience');
      return;
    }
    if (uploadingProfileImage) {
      showFeedbackModal('Please wait', 'Profile image is still uploading.', 'warning');
      return;
    }
    if (onNext) {
      try {
        setSubmitting(true);
        await onNext({
          name: trimmedName,
          age: trimmedAge,
          gender,
          phoneNumber: trimmedPhoneNumber,
          instagram: instagram.trim(),
          yearsOfExperience: trimmedYearsOfExperience,
          about: about.trim(),
          profileImage,
          profileImageUrl,
        });
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleSkip = async () => {
    if (!onSkip || skipping || submitting) return;
    try {
      setSkipping(true);
      await onSkip();
    } catch (error) {
      console.error('❌ Error skipping profile:', error);
    } finally {
      setSkipping(false);
    }
  };

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.7}>
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complete Profile</Text>
        <View style={{ width: 40 }} /> {/* Placeholder for right side of header */}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(insets.bottom + 24, 40) },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {/* Profile Picture Section */}
            <View style={styles.profileSection}>
              <View style={styles.profileImageContainer}>
                {profileImage ? (
                  <Image
                    source={{ uri: profileImage }}
                    style={styles.profileImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.profilePlaceholder}>
                    <Icon name="person" size={60} color="#FD8B36" />
                  </View>
                )}
                <TouchableOpacity
                  style={styles.cameraButton}
                  onPress={handleImagePicker}
                  disabled={uploadingProfileImage}
                  activeOpacity={0.7}>
                  {uploadingProfileImage ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Icon name="camera-alt" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
              <Text style={styles.profileName}>{name || 'Your Name'}</Text>
            </View>

            {/* Contact Information Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contact Information</Text>

              {/* Name Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Name <Text style={styles.requiredMark}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your name"
                  placeholderTextColor="#999"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              {/* Age Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Age <Text style={styles.requiredMark}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your age"
                  placeholderTextColor="#999"
                  value={age}
                  onChangeText={setAge}
                  keyboardType="numeric"
                />
              </View>

              {/* Gender Selection */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Gender <Text style={styles.requiredMark}>*</Text>
                </Text>
                <View style={styles.radioButtonContainer}>
                  <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => setGender('Male')}
                    activeOpacity={0.7}>
                    <View
                      style={[
                        styles.radioButton,
                        gender === 'Male' && styles.radioButtonSelected,
                      ]}>
                      {gender === 'Male' && <View style={styles.radioButtonInner} />}
                    </View>
                    <Text style={styles.radioLabel}>Male</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => setGender('Female')}
                    activeOpacity={0.7}>
                    <View
                      style={[
                        styles.radioButton,
                        gender === 'Female' && styles.radioButtonSelected,
                      ]}>
                      {gender === 'Female' && (
                        <View style={styles.radioButtonInner} />
                      )}
                    </View>
                    <Text style={styles.radioLabel}>Female</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => setGender('Other')}
                    activeOpacity={0.7}>
                    <View
                      style={[
                        styles.radioButton,
                        gender === 'Other' && styles.radioButtonSelected,
                      ]}>
                      {gender === 'Other' && <View style={styles.radioButtonInner} />}
                    </View>
                    <Text style={styles.radioLabel}>Other</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Phone Number <Text style={styles.requiredMark}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Enter phone number"
                placeholderTextColor="#999"
                value={phoneNumber}
                onChangeText={(value) => setPhoneNumber(normalizeProfilePhoneNumber(value))}
                keyboardType="phone-pad"
                maxLength={10}
              />
            </View>

            {/* Instagram Handle */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Instagram Handle</Text>
              <TextInput
                style={styles.input}
                placeholder="@yourhandle"
                placeholderTextColor="#999"
                value={instagram}
                onChangeText={(value) => setInstagram(normalizeInstagramHandle(value))}
                autoCapitalize="none"
              />
            </View>

            {/* Total Year of Professional Experience */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Total Year of Professional Experience <Text style={styles.requiredMark}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Enter years of experience"
                placeholderTextColor="#999"
                value={yearsOfExperience}
                onChangeText={setYearsOfExperience}
                keyboardType="numeric"
              />
            </View>

            {/* About Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Tell clients about yourself and your expertise"
                accessibilityLabel="About"
                placeholderTextColor="#999"
                value={about}
                onChangeText={setAbout}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>

            {/* Next Button */}
            <View style={styles.nextButtonContainer}>
              <TouchableOpacity
                style={[styles.nextButton, (submitting || skipping) && { opacity: 0.7 }]}
                onPress={handleNext}
                disabled={submitting || skipping}
                activeOpacity={0.8}
                hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
                <LinearGradient
                  colors={['#FD8B36', '#f7bb2c']}
                  start={{ x: 0.5, y: 0.5 }}
                  end={{ x: 0.5, y: 0 }}
                  style={styles.nextButtonGradient}>
                  {submitting ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                      <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.nextButtonText}>Saving Profile...</Text>
                    </View>
                  ) : (
                    <Text style={styles.nextButtonText}>Next</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {onSkip && (
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.skipButton, (submitting || skipping) && { opacity: 0.6 }]}
                  onPress={handleSkip}
                  disabled={submitting || skipping}
                  activeOpacity={0.8}
                  hitSlop={{ top: 12, bottom: 12, left: 24, right: 24 }}>
                  {skipping ? (
                    <ActivityIndicator size="small" color="#FD8B36" />
                  ) : (
                    <Text style={styles.skipButtonText}>Skip</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      <Modal
        visible={feedbackModal.visible}
        transparent
        animationType="fade"
        onRequestClose={hideFeedbackModal}>
        <View style={styles.feedbackModalOverlay}>
          <View style={styles.feedbackModalCard}>
            <LinearGradient
              colors={['#FD8B36', '#f7bb2c']}
              start={{ x: 0.5, y: 0.5 }}
              end={{ x: 0.5, y: 0 }}
              style={styles.feedbackModalGradient}>
              <Icon
                name={feedbackModal.type === 'warning' ? 'hourglass-empty' : 'error-outline'}
                size={38}
                color="#fff"
              />
            </LinearGradient>
            <View style={styles.feedbackModalBody}>
              <Text style={styles.feedbackModalTitle}>{feedbackModal.title}</Text>
              <Text style={styles.feedbackModalMessage}>{feedbackModal.message}</Text>
              <TouchableOpacity
                style={styles.feedbackModalButton}
                onPress={hideFeedbackModal}
                activeOpacity={0.8}>
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
    // paddingTop: compactTopPadding(20),
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: compactTopPadding(30),
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: '#333',
    // flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    // paddingBottom: 100, // Space for bottom nav
  },
  profileSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 32,
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFE5CC',
  },
  profilePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFE5CC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FD8B36',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  requiredMark: {
    color: '#E53935',
  },
  input: {
    backgroundColor: '#FFE5CC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
    borderWidth: 0,
  },
  radioButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 8,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  radioButtonSelected: {
    borderColor: '#FD8B36',
    backgroundColor: '#FD8B36',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  radioLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  textArea: {
    backgroundColor: '#FFE5CC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  nextButtonContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  nextButton: {
    borderRadius: 52,
    width: '100%',
    overflow: 'hidden',
  },
  nextButtonGradient: {
    width: '100%',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 52,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
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
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
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
    textAlign: 'center',
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
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  skipButton: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FD8B36',
  },
});

export default CompleteProfileScreen;
