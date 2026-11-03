import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SafeAreaView from '../components/SafeAreaView';
import { compactTopPadding } from '../utils/responsiveLayout';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from '../components/AppLinearGradient';
import { launchImageLibrary, ImagePickerResponse, ImageLibraryOptions } from 'react-native-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { API_BASE_URL_WITH_API } from '../config/api';
import CustomModal from '../components/CustomModal';
import { useModal } from '../hooks/useModal';
import { buildImageDataUri } from '../utils/imageDataUri';

interface EditProfileScreenProps {
  userId: string;
  onBack: () => void;
  onUpdateSuccess?: () => void;
}

interface UserProfile {
  _id?: string;
  userId?: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
  profileImage?: string;
  age?: number;
  gender?: string;
  about?: string;
  dateOfBirth?: string;
  location?: {
    latitude?: number;
    longitude?: number;
    address?: string;
  };
  workLocations?: Array<{
    _id?: string;
    address: string;
    city?: string;
    zipCode?: string;
    latitude?: number;
    longitude?: number;
  }>;
  activeWorkLocationId?: string;
}

const PRIMARY_COLOR = '#FD8B36';

const EditProfileScreen: React.FC<EditProfileScreenProps> = ({
  userId,
  onBack,
  onUpdateSuccess,
}) => {
  const insets = useSafeAreaInsets();
  console.log('EditProfileScreen rendered with userId:', userId);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  
  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [about, setAbout] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [uploadingProfileImage, setUploadingProfileImage] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const modal = useModal();

  // Fetch user profile data
  useEffect(() => {
    const fetchProfile = async () => {
      console.log('EditProfileScreen: fetchProfile called with userId:', userId);
      if (!userId) {
        console.log('EditProfileScreen: No userId provided, stopping fetch');
        setLoading(false);
        modal.showAlert('Error', 'User ID is missing. Please try again.', 'error');
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL_WITH_API}/profile/${userId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Fetch profile error:', errorText);
          throw new Error(`Failed to fetch profile: ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ User profile fetched successfully:', result);

        if (result.success && result.data) {
          const data = result.data;
          setUserProfile(data);
          
          // Pre-fill form fields
          setFullName(data.name || '');
          setEmail(data.email || '');
          setAbout(data.about || '');
	          setGender((data.gender as 'Male' | 'Female' | 'Other') || 'Male');
	          setProfileImage(data.profileImage || null);
	          setProfileImageUrl(data.profileImage || null);
          
          // Handle date of birth
          if (data.dateOfBirth) {
            setDateOfBirth(new Date(data.dateOfBirth));
          } else if (data.age) {
            // Calculate approximate date of birth from age
            const currentYear = new Date().getFullYear();
            const birthYear = currentYear - data.age;
            setDateOfBirth(new Date(birthYear, 0, 1));
          }

          
          // Set loading to false after successfully loading data
          setLoading(false);
        } else {
          console.warn('⚠️ API response missing data:', result);
          setLoading(false);
        }
      } catch (error) {
        console.error('❌ Error fetching user profile:', error);
        modal.showAlert('Error', 'Failed to load profile data. Please try again.', 'error');
        setLoading(false);
      }
    };

    if (userId) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [userId]);

  const handleImagePicker = () => {
    const options: ImageLibraryOptions = {
      mediaType: 'photo',
      includeBase64: true,
      includeExtra: true,
      assetRepresentationMode: 'compatible',
      maxHeight: 900,
      maxWidth: 900,
      quality: 0.4,
    };

    launchImageLibrary(options, async (response: ImagePickerResponse) => {
      if (response.didCancel) {
        console.log('User cancelled image picker');
      } else if (response.errorMessage) {
        console.error('ImagePicker Error: ', response.errorMessage);
        modal.showAlert('Error', 'Failed to pick image. Please try again.', 'error');
      } else if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        const imageData = buildImageDataUri(asset);

        if (imageData) {
          console.log('🖼️ Selected profile image:', {
            uri: asset.uri,
            originalPath: asset.originalPath,
            type: asset.type,
            fileName: asset.fileName,
            fileSize: asset.fileSize,
          });
          setProfileImage(imageData);
          setProfileImageUrl(imageData);
          setUploadingProfileImage(true);
          try {
            modal.showAlert('Selected', 'Profile image selected successfully.', 'success');
          } catch (error) {
            console.error('❌ Profile image selection failed:', error);
            setProfileImage(userProfile?.profileImage || null);
            setProfileImageUrl(userProfile?.profileImage || null);
            modal.showAlert(
              'Selection Failed',
              error instanceof Error ? error.message : 'Failed to select image. Please try again.',
              'error',
            );
          } finally {
            setUploadingProfileImage(false);
          }
        } else {
          modal.showAlert('Error', 'Selected image is missing. Please choose it again.', 'error');
        }
      }
    });
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setDateOfBirth(selectedDate);
    }
  };

  const handleDoneDatePicker = () => {
    if (!dateOfBirth) {
      setDateOfBirth(new Date(2000, 0, 1));
    }
    setShowDatePicker(false);
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return '';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleUpdateProfile = async () => {
    // Validation
    if (!fullName.trim()) {
      modal.showAlert('Validation Error', 'Full Name is required', 'warning');
      return;
    }

    if (!gender) {
      modal.showAlert('Validation Error', 'Gender is required', 'warning');
      return;
    }
    if (uploadingProfileImage) {
      modal.showAlert('Please wait', 'Profile image is still uploading.', 'warning');
      return;
    }

    setUpdating(true);

    try {
      // Calculate age from date of birth if available
      let age: number | undefined;
      if (dateOfBirth) {
        const today = new Date();
        age = today.getFullYear() - dateOfBirth.getFullYear();
        const monthDiff = today.getMonth() - dateOfBirth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
          age--;
        }
      }

      const updateData: any = {
        name: fullName.trim(),
        email: email.trim() || undefined,
        about: about.trim() || undefined,
        gender,
        profileImage: profileImageUrl || undefined,
      };

      if (age) {
        updateData.age = age;
      }

      if (dateOfBirth) {
        updateData.dateOfBirth = dateOfBirth.toISOString();
      }
      


      const response = await fetch(`${API_BASE_URL_WITH_API}/profile/update-profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          userId,
          ...updateData,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to update profile. Please try again.';
        try {
          const errData = await response.json();
          if (errData && errData.message) {
            errorMessage = errData.message;
          }
        } catch (_) {
          const errorText = await response.text();
          console.error('❌ Update profile raw error:', errorText);
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('✅ Profile updated successfully:', result);

      modal.showModal(
        'Success',
        'Profile updated successfully!',
        'success',
        [
        {
          text: 'OK',
          onPress: () => {
              modal.hideModal();
            if (onUpdateSuccess) {
              onUpdateSuccess();
            }
            onBack();
          },
            style: 'default',
        },
        ]
      );
    } catch (error: any) {
      console.error('❌ Error updating profile:', error);
      modal.showAlert('Error', error?.message || 'Failed to update profile. Please try again.', 'error');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.container}>
       
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
            <Icon name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Your Profile</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.container}>
   
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Your Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 24, 40) },
        ]}
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={20}
      >
        {/* Profile Picture */}
        <View style={styles.profileImageSection}>
        
          <View style={styles.profileImageContainer}>
            {profileImage ? (
              <Image
                source={{ uri: profileImage }}
                style={styles.profileImage}
                resizeMode="contain"
              />
            ) : (
                <View style={styles.profileImagePlaceholder}>
                  <Icon name="person" size={50} color={PRIMARY_COLOR} />
                </View>
            )}
            <TouchableOpacity
              style={styles.cameraButton}
              onPress={handleImagePicker}
              activeOpacity={0.7}>
              <Icon name="camera-alt" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Full Name */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>
            Full Name<Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your full name"
            placeholderTextColor="#999"
            value={fullName}
            onChangeText={setFullName}
          />
        </View>

        {/* Email */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        {/* About / Bio */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>About Me (Bio)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Tell us a little about yourself and your services..."
            placeholderTextColor="#999"
            value={about}
            onChangeText={setAbout}
            multiline={true}
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Date of Birth */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>Date of Birth</Text>
          <TouchableOpacity
            style={styles.input}
            onPress={() => setShowDatePicker(prev => !prev)}
            activeOpacity={0.7}>
            <Text style={[styles.inputText, !dateOfBirth && styles.placeholderText]}>
              {dateOfBirth ? formatDate(dateOfBirth) : 'Select date of birth'}
            </Text>
            <Icon name="calendar-today" size={20} color="#999" />
          </TouchableOpacity>
          {showDatePicker && (
            Platform.OS === 'ios' ? (
              <View style={styles.iosDatePickerContainer}>
                <View style={styles.iosDatePickerHeader}>
                  <Text style={styles.iosDatePickerHeaderTitle}>Select Date of Birth</Text>
                  <TouchableOpacity
                    onPress={handleDoneDatePicker}
                    style={styles.iosDatePickerDoneButton}
                    activeOpacity={0.7}>
                    <Text style={styles.iosDatePickerDoneText}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={dateOfBirth || new Date(2000, 0, 1)}
                  mode="date"
                  display="spinner"
                  onChange={handleDateChange}
                  maximumDate={new Date()}
                  textColor="#000000"
                  themeVariant="light"
                  style={styles.iosDatePicker}
                />
              </View>
            ) : (
              <DateTimePicker
                value={dateOfBirth || new Date(2000, 0, 1)}
                mode="date"
                display="default"
                onChange={handleDateChange}
                maximumDate={new Date()}
              />
            )
          )}
        </View>

        {/* Gender */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>
            Gender<Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.genderContainer}>
            {(['Male', 'Female', 'Other'] as const).map((option) => (
              <TouchableOpacity
                key={option}
                style={styles.genderOption}
                onPress={() => setGender(option)}
                activeOpacity={0.7}>
                <View
                  style={[
                    styles.radioButton,
                    gender === option && styles.radioButtonSelected,
                  ]}>
                  {gender === option && <View style={styles.radioButtonInner} />}
                </View>
                <Text style={styles.genderText}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Update Profile Button */}
        <TouchableOpacity
          style={[styles.updateButton, updating && styles.updateButtonDisabled]}
          onPress={handleUpdateProfile}
          disabled={updating}
          activeOpacity={0.8}>
          <LinearGradient
            colors={['#FD8B36', '#f7bb2c']}
        locations={[0, 0.7]}
        start={{ x: 0.5, y: 0.5 }}
        end={{ x: 0.5, y: 0 }}
            style={styles.updateButtonGradient}>
            {updating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.updateButtonText}>Update Profile</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </KeyboardAwareScrollView>

      {/* Custom Modal */}
      <CustomModal
        visible={modal.visible}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        buttons={modal.buttons}
        onClose={modal.hideModal}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF3E8',
    position: 'relative',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  iosDatePickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 10,
    marginBottom: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  iosDatePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  iosDatePickerHeaderTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  iosDatePickerDoneButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: PRIMARY_COLOR,
  },
  iosDatePickerDoneText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  iosDatePicker: {
    backgroundColor: '#FFFFFF',
    height: 180,
  },
 
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: compactTopPadding(4),
    paddingBottom: 12,
    minHeight: 56,
    justifyContent:'space-between'
    // backgroundColor: '#F5F5F5',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
    // flex: 1,
    textAlign: 'left',
  
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
    paddingTop: 12,
    paddingBottom: 100,
  },
  profileImageSection: {
    alignItems: 'center',
    marginBottom: 32,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    paddingVertical: 12,
  },
  profileImageContainer: {
    position: 'relative',
  },
  profileGradient: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.6,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFE5CC',
  },
  profileImagePlaceholder: {
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
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  inputSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  required: {
    color: PRIMARY_COLOR,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  placeholderText: {
    color: '#999',
  },
  genderContainer: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  genderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: PRIMARY_COLOR,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PRIMARY_COLOR,
  },
  genderText: {
    fontSize: 16,
    color: '#333',
  },
  updateButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 32,
    overflow: 'hidden',
  },
  updateButtonDisabled: {
    opacity: 0.6,
  },
  updateButtonGradient: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  addLocationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  addLocationInput: {
    flex: 1,
    marginBottom: 0,
  },
  addLocationBtn: {
    backgroundColor: PRIMARY_COLOR,
    width: 52,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  workLocationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E8D8CA',
  },
  workLocationItemSelected: {
    borderColor: PRIMARY_COLOR,
    backgroundColor: '#FFF8F2',
  },
  workLocationRadioBtn: {
    marginRight: 12,
  },
  workLocationText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  deleteLocationBtn: {
    padding: 4,
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
});

export default EditProfileScreen;
