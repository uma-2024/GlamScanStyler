import { QueuedAlert as Alert } from '../popup/QueuedAlert';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
  ActionSheetIOS,
  ActivityIndicator,
} from 'react-native';
import SafeAreaView from '../components/SafeAreaView';
import { compactTopPadding } from '../utils/responsiveLayout';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as ImagePicker from 'react-native-image-picker';
import LinearGradient from '../components/AppLinearGradient';
import { API_BASE_URL_WITH_API } from '../config/api';
import { updateOnboardingStep } from '../utils/onboardingSteps';
import { buildImageDataUri } from '../utils/imageDataUri';

interface CertificateUploadScreenProps {
  onBack?: () => void;
  onSkip?: () => void;
  onContinue?: () => void;
  onPrivacyPolicy?: () => void;
  userId?: string;
}

const CertificateUploadScreen: React.FC<CertificateUploadScreenProps> = ({
  onBack,
  onSkip,
  onContinue,
  onPrivacyPolicy,
  userId,
}) => {
  const [frontImage, setFrontImage] = useState<ImagePicker.Asset | null>(null);
  const [backImage, setBackImage] = useState<ImagePicker.Asset | null>(null);
  const [currentStep, setCurrentStep] = useState<'select' | 'upload'>('select');
  const [loading, setLoading] = useState(false);
  const [skipping, setSkipping] = useState(false);

  const showImagePickerOptions = (onSelect: (asset: ImagePicker.Asset) => void) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Add Certificate',
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          setTimeout(() => {
            if (buttonIndex === 1) {
              openCamera(onSelect);
            } else if (buttonIndex === 2) {
              openImageLibrary(onSelect);
            }
          }, 250);
        }
      );
      return;
    }

    Alert.alert(
      'Select Image',
      'Choose an option',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: () => openCamera(onSelect) },
        { text: 'Choose from Library', onPress: () => openImageLibrary(onSelect) },
      ]
    );
  };

  const openCamera = (onSelect: (asset: ImagePicker.Asset) => void) => {
    if (!ImagePicker || !ImagePicker.launchCamera) {
      Alert.alert('Error', 'Image picker is not available. Please rebuild the app.');
      return;
    }

    const options: ImagePicker.CameraOptions = {
      mediaType: 'photo',
      quality: 0.4,
      maxWidth: 900,
      maxHeight: 900,
      saveToPhotos: false,
      includeBase64: true,
    };

    ImagePicker.launchCamera(options, (response) => {
      if (response.didCancel) {
        return;
      } else if (response.errorMessage) {
        Alert.alert('Error', response.errorMessage);
        return;
      } else if (response.assets && response.assets[0]) {
        onSelect(response.assets[0]);
      }
    });
  };

  const openImageLibrary = (onSelect: (asset: ImagePicker.Asset) => void) => {
    if (!ImagePicker || !ImagePicker.launchImageLibrary) {
      Alert.alert('Error', 'Image picker is not available. Please rebuild the app.');
      return;
    }

    const options: ImagePicker.ImageLibraryOptions = {
      mediaType: 'photo',
      quality: 0.4,
      maxWidth: 900,
      maxHeight: 900,
      includeBase64: true,
    };

    ImagePicker.launchImageLibrary(options, (response) => {
      if (response.didCancel) {
        return;
      } else if (response.errorMessage) {
        Alert.alert('Error', response.errorMessage);
        return;
      } else if (response.assets && response.assets[0]) {
        onSelect(response.assets[0]);
      }
    });
  };

  const handleSelectCertificate = () => {
    setCurrentStep('upload');
  };

  const handleFrontImageSelect = () => {
    showImagePickerOptions((asset) => {
      setFrontImage(asset);
    });
  };

  const handleBackImageSelect = () => {
    showImagePickerOptions((asset) => {
      setBackImage(asset);
    });
  };

  const handleRetake = (step: 'front' | 'back') => {
    if (step === 'front') {
      setFrontImage(null);
    } else {
      setBackImage(null);
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

  const handleContinue = async () => {
    if (!userId) {
      Alert.alert('Error', 'User ID is missing. Please login again.');
      return;
    }

    // Front side is mandatory
    if (!frontImage) {
      Alert.alert('Error', 'Please upload the front side of the certificate.');
      return;
    }

    const frontImageData = buildImageDataUri(frontImage);
    const backImageData = backImage ? buildImageDataUri(backImage) : null;

    if (!frontImageData) {
      Alert.alert('Error', 'Selected front image is missing. Please retake or choose it again.');
      return;
    }

    try {
      setLoading(true);

      const apiUrl = `${API_BASE_URL_WITH_API}/profile/save-certificate`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
		        body: JSON.stringify({
		          userId,
		          frontImage: frontImageData,
		          backImage: backImageData,
		        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to save certificate' }));
        throw new Error(errorData.message || 'Failed to save certificate');
      }

      const result = await response.json();
      console.log('✅ Certificate saved:', result);

      // Mark certificateUploaded step as completed
      await updateOnboardingStep(userId, 'certificateUploaded', true);

      if (onContinue) {
        onContinue();
      }
    } catch (error) {
      console.error('❌ Error saving certificate:', error);
      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Failed to save certificate. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Render select screen
  if (currentStep === 'select') {
    return (
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* Header with Close Button */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onBack} style={styles.closeButton} activeOpacity={0.7}>
              <Icon name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Illustration */}
          <View style={styles.illustrationContainer}>
            <View style={styles.idCardIllustration}>
              <View style={styles.idCardFace}>
                <View style={styles.faceOutline} />
              </View>
              <View style={styles.idCardLines}>
                <View style={styles.idCardLine} />
                <View style={styles.idCardLine} />
                <View style={styles.idCardLineShort} />
              </View>
              <View style={styles.idCardSignature}>
                <View style={styles.signatureLine} />
              </View>
            </View>
          </View>

          {/* Title Section */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>Certificate Upload</Text>
            <Text style={styles.optionalText}>(Optional)</Text>
            <Text style={styles.subtitle}>
              We Need To See Your Name Clearly Printed On An Official Document.
            </Text>
          </View>

          {/* Certificate Button */}
          <View style={styles.certificateSection}>
            <Text style={styles.certificateHeading}>TYPES OF ID YOU CAN UPLOAD</Text>
            <TouchableOpacity
              style={styles.certificateButton}
              onPress={handleSelectCertificate}
              activeOpacity={0.8}>
             
                <Text style={styles.certificateButtonText}>Certificate</Text>
                <Icon name="chevron-right" size={20} color="#FD8B36" />
            
            </TouchableOpacity>
          </View>

          {/* Skip Button */}
          <TouchableOpacity
            style={[styles.skipButton, (loading || skipping) && { opacity: 0.6 }]}
            onPress={handleSkip}
            disabled={loading || skipping}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 20, right: 20 }}>
            {skipping ? (
              <ActivityIndicator size="small" color="#FD8B36" />
            ) : (
              <Text style={styles.skipButtonText}>Skip</Text>
            )}
          </TouchableOpacity>

          {/* Footer inside ScrollView so it never overlays or intercepts button clicks */}
          <View style={styles.footerInline}>
            <Icon name="lock" size={16} color="#333" />
            <Text style={styles.footerText}>
              Processes your personal data in accordance with our{' '}
              <Text style={styles.privacyLink} onPress={onPrivacyPolicy}>
                Privacy Policy
              </Text>
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Render upload screen (front and back on same page)
  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setCurrentStep('select')}
            style={styles.backButton}
            activeOpacity={0.7}>
            <Icon name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.uploadTitle}>Upload Certificate</Text>
          {onSkip ? (
            <TouchableOpacity
              onPress={handleSkip}
              disabled={loading || skipping}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
              style={styles.headerSkipButton}>
              {skipping ? (
                <ActivityIndicator size="small" color="#FD8B36" />
              ) : (
                <Text style={styles.headerSkipButtonText}>Skip</Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>
        <Text style={styles.uploadSubtitle}>Upload both front and back sides of your certificate</Text>

        {/* Front Image Upload */}
        <View style={styles.imageUploadSection}>
          <View style={styles.labelContainer}>
            <Text style={styles.imageSectionLabel}>Front Side</Text>
            <Text style={styles.requiredLabel}>* Required</Text>
          </View>
          <View style={styles.imagePreviewWrapper}>
            {frontImage ? (
              <>
                <Image source={{ uri: frontImage.uri }} style={styles.previewImage} resizeMode="contain" />
                <TouchableOpacity
                  style={styles.retakeButton}
                  onPress={() => handleRetake('front')}
                  activeOpacity={0.8}>
                  <LinearGradient
                    colors={['#FD8B36', '#f7bb2c']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.retakeButtonGradient}>
                    <Icon name="refresh" size={16} color="#fff" />
                    <Text style={styles.retakeButtonText}>Retake</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.uploadPlaceholder}
                onPress={handleFrontImageSelect}
                activeOpacity={0.8}>
                <Icon name="add-a-photo" size={48} color="#FD8B36" />
                <Text style={styles.uploadPlaceholderText}>Tap to Upload Front Image</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Back Image Upload */}
        <View style={styles.imageUploadSection}>
          <View style={styles.labelContainer}>
            <Text style={styles.imageSectionLabel}>Back Side</Text>
            <Text style={styles.optionalLabel}>(Optional)</Text>
          </View>
          <View style={styles.imagePreviewWrapper}>
            {backImage ? (
              <>
                <Image source={{ uri: backImage.uri }} style={styles.previewImage} resizeMode="contain" />
                <TouchableOpacity
                  style={styles.retakeButton}
                  onPress={() => handleRetake('back')}
                  activeOpacity={0.8}>
                  <LinearGradient
                    colors={['#FD8B36', '#f7bb2c']}
                    start={{ x: 0.5, y: 0.5 }}
                    end={{ x: 0.5, y: 0 }}
                    style={styles.retakeButtonGradient}>
                    <Icon name="refresh" size={16} color="#fff" />
                    <Text style={styles.retakeButtonText}>Retake</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.uploadPlaceholder}
                onPress={handleBackImageSelect}
                activeOpacity={0.8}>
                <Icon name="add-a-photo" size={48} color="#FD8B36" />
                <Text style={styles.uploadPlaceholderText}>Tap to Upload Back Image (Optional)</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Continue Button */}
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
                <Text style={styles.continueButtonText}>Continue</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {onSkip && (
          <TouchableOpacity
            style={[styles.uploadSkipButton, (loading || skipping) && { opacity: 0.6 }]}
            onPress={handleSkip}
            disabled={loading || skipping}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 20, right: 20 }}>
            {skipping ? (
              <ActivityIndicator size="small" color="#FD8B36" />
            ) : (
              <Text style={styles.skipButtonText}>Skip Certificate</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF3E8',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: Math.max(16, compactTopPadding(28)),
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  illustrationContainer: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 20,
  },
  idCardIllustration: {
    width: 200,
    height: 140,
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    transform: [{ rotate: '-5deg' }],
  },
  idCardFace: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#1976D2',
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceOutline: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#1976D2',
  },
  idCardLines: {
    marginBottom: 8,
  },
  idCardLine: {
    height: 2,
    backgroundColor: '#1976D2',
    marginBottom: 4,
    borderRadius: 1,
  },
  idCardLineShort: {
    height: 2,
    width: '60%',
    backgroundColor: '#1976D2',
    borderRadius: 1,
  },
  idCardSignature: {
    marginTop: 8,
  },
  signatureLine: {
    height: 3,
    width: '70%',
    backgroundColor: '#1976D2',
    borderRadius: 2,
  },
  titleSection: {
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  optionalText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  certificateSection: {
    marginBottom: 32,
  },
  certificateHeading: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  certificateButton: {
    backgroundColor: '#FFF8F0',
    borderRadius: 52,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#FFE5CC',

  },
 
  certificateButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  skipButton: {
    alignItems: 'center',
    marginBottom: 24,
    borderBottomColor: '#FFE5CC',
    borderBottomWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'center',
  },
  uploadSkipButton: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
    paddingVertical: 12,
    alignSelf: 'center',
  },
  skipButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FD8B36',
  },
  footerInline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 16,
    paddingBottom: 24,
    marginHorizontal: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: compactTopPadding(20),
    position: 'absolute',
    bottom: '5%',
    left: '10%',
    right: '10%',
  },
  footerText: {
    flex: 1,
    fontSize: 12,
    color: '#333',
    marginLeft: 8,
    lineHeight: 18,
  },
  privacyLink: {
    color: '#FD8B36',
    fontWeight: '500',
  },
  uploadTitleSection: {
    marginBottom: 32,
  },
  uploadTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  headerSkipButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(253, 139, 54, 0.1)',
  },
  headerSkipButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FD8B36',
  },
  uploadSubtitle: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 32,
  },
  imageUploadSection: {
    marginBottom: 24,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  imageSectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  requiredLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FD8B36',
  },
  optionalLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
    fontStyle: 'italic',
  },
  imagePreviewWrapper: {
    width: '100%',
    minHeight: 250,
    marginBottom: 8,
  },
  previewImage: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  uploadPlaceholder: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    backgroundColor: '#FFF8F0',
    borderWidth: 2,
    borderColor: '#FFE5CC',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadPlaceholderText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  retakeButton: {
    marginTop: 12,
    borderRadius: 8,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  retakeButtonGradient: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  retakeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonContainer: {
    marginTop: 8,
    marginBottom: 24,
  },
  continueButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  continueButtonGradient: {
    width: '100%',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  continueButtonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CertificateUploadScreen;
