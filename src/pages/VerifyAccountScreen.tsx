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
import { API_BASE_URL, API_BASE_URL_WITH_API } from '../config/api';
import CustomModal from '../components/CustomModal';
import { useModal } from '../hooks/useModal';
import { updateOnboardingStep } from '../utils/onboardingSteps';
import { buildImageDataUri } from '../utils/imageDataUri';

interface VerifyAccountScreenProps {
  onBack?: () => void;
  onContinue?: () => void;
  onSkip?: () => void;
  documentType?: string;
  documentCategory?: 'identity' | 'address'; // Proof of Identity or Proof of Address
  userId?: string; // User ID for saving verification documents
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  aadhar: 'Aadhaar Card',
  aadhaar: 'Aadhaar Card',
  'aadhar card': 'Aadhaar Card',
  'aadhaar card': 'Aadhaar Card',
  pan: 'PAN Card',
  'pan card': 'PAN Card',
  drivers: "Driver's Licence",
  driver: "Driver's Licence",
  'driver licence': "Driver's Licence",
  "driver's licence": "Driver's Licence",
  'driving licence': "Driver's Licence",
  'driver license': "Driver's Licence",
  "driver's license": "Driver's Licence",
  'driving license': "Driver's Licence",
  passport: 'Passport',
  'id card': 'ID Card',
};

const DOCUMENT_TYPE_API_VALUES: Record<string, string> = {
  aadhar: 'aadhar',
  aadhaar: 'aadhar',
  'aadhar card': 'aadhar',
  'aadhaar card': 'aadhar',
  pan: 'pan',
  'pan card': 'pan',
  drivers: 'drivers',
  driver: 'drivers',
  'driver licence': 'drivers',
  "driver's licence": 'drivers',
  'driving licence': 'drivers',
  'driver license': 'drivers',
  "driver's license": 'drivers',
  'driving license': 'drivers',
  passport: 'passport',
};

const normalizeDocumentTypeKey = (value?: string): string => value?.trim().toLowerCase() || '';

const getDocumentTypeLabel = (value?: string): string => {
  const normalizedValue = normalizeDocumentTypeKey(value);
  return DOCUMENT_TYPE_LABELS[normalizedValue] || value?.trim() || 'ID Card';
};

const getDocumentTypeApiValue = (value?: string): string => {
  const normalizedValue = normalizeDocumentTypeKey(value);
  return DOCUMENT_TYPE_API_VALUES[normalizedValue] || 'aadhar';
};

const VerifyAccountScreen: React.FC<VerifyAccountScreenProps> = ({
  onBack,
  onContinue,
  onSkip,
  documentType = 'ID Card',
  documentCategory = 'identity',
  userId,
}) => {
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [showMediaConsentModal, setShowMediaConsentModal] = useState(false);
  const [showImageSourceModal, setShowImageSourceModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const modal = useModal();
  const selectedDocumentLabel = getDocumentTypeLabel(documentType);
  const pendingPickerCallbackRef = React.useRef<((asset: ImagePicker.Asset) => void) | null>(null);

  const parseApiResponse = async (response: Response): Promise<any> => {
    const responseText = await response.text();
    if (!responseText) {
      return null;
    }

    try {
      return JSON.parse(responseText);
    } catch {
      if (/<html|403\s+forbidden|413\s+payload/i.test(responseText)) {
        const errorType = response.status === 413 ? 'Payload Too Large' : 'Forbidden';
        return {
          success: false,
          message: `Server Error (${response.status} ${errorType}). Please try uploading a smaller image or check network connection.`,
        };
      }
      return {
        success: false,
        message: responseText.slice(0, 220),
      };
    }
  };

  const saveVerificationDocument = async ({
    userId,
    documentType,
    documentCategory,
    frontImage,
    backImage,
  }: {
    userId: string;
    documentType: string;
    documentCategory: 'identity' | 'address';
    frontImage: string;
    backImage: string;
  }): Promise<any> => {
    const payload = {
      userId,
      documentType,
      documentCategory,
      frontImage,
      backImage,
    };
    const urls = [
      `${API_BASE_URL_WITH_API}/verification/save`,
      `${API_BASE_URL}/api/verification/save`,
      `${API_BASE_URL}/verification/save`,
    ];

    let lastErrorMessage = 'Failed to save verification document';

    for (const apiUrl of urls) {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await parseApiResponse(response);
      if (response.ok && result?.success !== false) {
        return result;
      }

      lastErrorMessage =
        result?.message ||
        result?.error ||
        `Failed to save verification document: ${response.status}`;

      const shouldTryNextUrl =
        response.status === 404 ||
        response.status === 403 ||
        /cannot\s+(post|get)/i.test(lastErrorMessage);

      if (!shouldTryNextUrl) {
        break;
      }
    }

    throw new Error(lastErrorMessage);
  };

  // Check if image picker is available
  React.useEffect(() => {
    if (!ImagePicker || !ImagePicker.launchImageLibrary || !ImagePicker.launchCamera) {
      console.warn('Image picker module not available. Please rebuild the app.');
    }
  }, []);

  const launchImagePickerOptions = (onSelect: (asset: ImagePicker.Asset) => void) => {
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

  const showImagePickerOptions = (onSelect: (asset: ImagePicker.Asset) => void) => {
    pendingPickerCallbackRef.current = onSelect;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Add Document',
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          const cb = pendingPickerCallbackRef.current;
          pendingPickerCallbackRef.current = null;
          if (!cb) return;

          setTimeout(() => {
            if (buttonIndex === 1) {
              openCamera(cb);
            } else if (buttonIndex === 2) {
              openImageLibrary(cb);
            }
          }, 250);
        }
      );
      return;
    }

    setShowImageSourceModal(true);
  };

  const handleMediaConsentContinue = () => {
    setShowMediaConsentModal(false);
    setShowImageSourceModal(true);
  };

  const handleMediaConsentCancel = () => {
    setShowMediaConsentModal(false);
    pendingPickerCallbackRef.current = null;
  };

  const handleImageSourceContinue = (mode: 'camera' | 'library') => {
    setShowImageSourceModal(false);
    const onSelect = pendingPickerCallbackRef.current;
    pendingPickerCallbackRef.current = null;
    if (!onSelect) {
      return;
    }

    setTimeout(() => {
      if (mode === 'camera') {
        openCamera(onSelect);
      } else {
        openImageLibrary(onSelect);
      }
    }, Platform.OS === 'ios' ? 350 : 50);
  };

  const handleImageSourceCancel = () => {
    setShowImageSourceModal(false);
    pendingPickerCallbackRef.current = null;
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
      selectionLimit: 1,
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

  const handleUploadFront = () => {
    showImagePickerOptions((asset) => {
      const imageData = buildImageDataUri(asset);
      if (!imageData) {
        Alert.alert('Error', 'Selected image is missing. Please choose it again.');
        return;
      }
      setFrontImage(imageData);
    });
  };

  const handleUploadBack = () => {
    showImagePickerOptions((asset) => {
      const imageData = buildImageDataUri(asset);
      if (!imageData) {
        Alert.alert('Error', 'Selected image is missing. Please choose it again.');
        return;
      }
      setBackImage(imageData);
    });
  };

  const handleRemoveFront = () => {
    setFrontImage(null);
  };

  const handleRemoveBack = () => {
    setBackImage(null);
  };

  const handleContinue = async () => {
    if (!frontImage || !backImage) {
      modal.showAlert('Required', 'Please upload both front and back pages', 'warning');
      return;
    }
    if (!privacyChecked) {
      Alert.alert('Required', 'Please accept the privacy policy');
      return;
    }
    // Validate userId is present (required for verification API)
    if (!userId) {
      console.error('Error: userId is missing');
      Alert.alert(
        'Error',
        'User ID is missing. Please login again to continue with verification.',
        [{
          text: 'OK', onPress: () => {
            // Optionally navigate back to login
            if (onBack) onBack();
          }
        }]
      );
      return;
    }

    try {
      setLoading(true);

      const finalDocType = getDocumentTypeApiValue(documentType);

      await saveVerificationDocument({
        userId,
        documentType: finalDocType,
        documentCategory,
        frontImage,
        backImage,
      });
      // Mark proofOfIdentity step as completed
      if (documentCategory === 'identity') {
        await updateOnboardingStep(userId, 'proofOfIdentity', true);
      }

      // Navigate to next screen
      if (onContinue) {
        onContinue();
      }
    } catch (error) {
      console.error('❌ Error in verification:', error);
      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Failed to save verification document. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!userId) {
      if (onSkip) onSkip();
      return;
    }

    try {
      setSkipping(true);
      if (documentCategory === 'identity') {
        await updateOnboardingStep(userId, 'proofOfIdentity', true);
      }
      if (onSkip) {
        onSkip();
      }
    } catch (error) {
      console.error('❌ Error skipping verification:', error);
      if (onSkip) onSkip();
    } finally {
      setSkipping(false);
    }
  };

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
      <CustomModal
        visible={showMediaConsentModal}
        title="Allow Document Capture"
        message="We use your camera or photo library only to capture identity documents and certificates for verification. Your uploads are encrypted and used only for onboarding and compliance."
        type="info"
        buttons={[
          {
            text: 'Not Now',
            onPress: handleMediaConsentCancel,
            style: 'cancel',
          },
          {
            text: 'Continue',
            onPress: handleMediaConsentContinue,
            style: 'default',
            gradient: true,
          },
        ]}
        onClose={handleMediaConsentCancel}
      />
      <CustomModal
        visible={showImageSourceModal}
        title="Add Document"
        message="Choose how you want to upload your document image."
        type="info"
        buttons={[
          {
            text: 'Take Photo',
            onPress: () => handleImageSourceContinue('camera'),
            style: 'default',
            gradient: true,
          },
          {
            text: 'Choose Library',
            onPress: () => handleImageSourceContinue('library'),
            style: 'default',
            gradient: true,
          },

        ]}
        onClose={handleImageSourceCancel}
      />
      <CustomModal
        visible={modal.visible}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        buttons={modal.buttons}
        onClose={modal.hideModal}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
            <Icon name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Verify Account</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={styles.subtitle}>Upload {selectedDocumentLabel} Images</Text>

        {/* Upload Cards */}
        <View style={styles.uploadSection}>
          {/* Front Page Upload */}
          <View style={styles.uploadCardContainer}>
            <TouchableOpacity
              style={styles.uploadCard}
              onPress={handleUploadFront}
              activeOpacity={0.8}>
              {frontImage ? (
                <>
                  <Image source={{ uri: frontImage }} style={styles.uploadedImage} />
                  <View style={styles.imageOverlay}>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleRemoveFront();
                      }}
                      activeOpacity={0.8}>
                      <Icon name="close" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <Icon name="camera-alt" size={48} color="#999" />
                  <Text style={styles.uploadText}>Upload Front Page</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Back Page Upload */}
          <View style={styles.uploadCardContainer}>
            <TouchableOpacity
              style={styles.uploadCard}
              onPress={handleUploadBack}
              activeOpacity={0.8}>
              {backImage ? (
                <>
                  <Image source={{ uri: backImage }} style={styles.uploadedImage} />
                  <View style={styles.imageOverlay}>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleRemoveBack();
                      }}
                      activeOpacity={0.8}>
                      <Icon name="close" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <Icon name="camera-alt" size={48} color="#999" />
                  <Text style={styles.uploadText}>Upload Back Page</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Verification Guidelines */}
        <View style={styles.guidelinesSection}>
          <View style={styles.guidelineItem}>
            <Icon name="check-circle" size={20} color="#4CAF50" />
            <Text style={styles.guidelineText}>Government- Issued</Text>
          </View>
          <View style={styles.guidelineItem}>
            <Icon name="check-circle" size={20} color="#4CAF50" />
            <Text style={styles.guidelineText}>Original Full Size Unedited Document</Text>
          </View>
          <View style={styles.guidelineItem}>
            <Icon name="check-circle" size={20} color="#4CAF50" />
            <Text style={styles.guidelineText}>Place Document Against A Single Coloured Background</Text>
          </View>
          <View style={styles.guidelineItem}>
            <Icon name="check-circle" size={20} color="#4CAF50" />
            <Text style={styles.guidelineText}>Readable Well- Lit Colour Images</Text>
          </View>
          <View style={styles.guidelineItem}>
            <Icon name="cancel" size={20} color="#F44336" />
            <Text style={styles.guidelineText}>No Black And White Images</Text>
          </View>
          <View style={styles.guidelineItem}>
            <Icon name="cancel" size={20} color="#F44336" />
            <Text style={styles.guidelineText}>No Edited Or Expired Documents</Text>
          </View>
        </View>

        {/* Privacy Disclaimer */}
        <View style={styles.privacySection}>
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setPrivacyChecked(!privacyChecked)}
            activeOpacity={0.7}>
            <LinearGradient
              colors={['#FD8B36', '#f7bb2c']}
              start={{ x: 0.5, y: 0.5 }}
              end={{ x: 0.5, y: 0 }}
              style={styles.checkboxGradientOuter}>
              {privacyChecked ? (
                <View style={styles.checkboxCheckedContent}>
                  <Icon name="check" size={16} color="#fff" />
                </View>
              ) : (
                <View style={styles.checkboxInnerUnchecked} />
              )}
            </LinearGradient>
            <Text style={styles.privacyText}>
              This Information Is Used For Identity Verification Only And Will Be Kept Secure
            </Text>
          </TouchableOpacity>
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          style={[styles.continueButton, (loading || !privacyChecked) && styles.buttonDisabled]}
          onPress={handleContinue}
          activeOpacity={0.8}
          disabled={loading || !privacyChecked}>
          <LinearGradient
            colors={['#FD8B36', '#f7bb2c']}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 0.5, y: 0 }}
            style={styles.continueButtonGradient}>
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.continueButtonText}>Continue</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Skip Button */}
        {onSkip && (
          <TouchableOpacity
            style={[styles.skipButton, (loading || skipping) && { opacity: 0.6 }]}
            onPress={handleSkip}
            activeOpacity={0.8}
            disabled={loading || skipping}>
            {skipping ? (
              <ActivityIndicator size="small" color="#FD8B36" />
            ) : (
              <Text style={styles.skipButtonText}>Skip</Text>
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
    paddingTop: compactTopPadding(30),
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '500',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 32,
  },
  uploadSection: {
    marginBottom: 32,
    gap: 16,
  },
  uploadCardContainer: {
    position: 'relative',
  },
  uploadCard: {
    width: '100%',
    height: 200,
    backgroundColor: '#FFF8F0',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFE5CC',
    overflow: 'hidden',
  },
  uploadPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    padding: 8,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guidelinesSection: {
    marginBottom: 24,
    gap: 12,
  },
  guidelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  guidelineText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  privacySection: {
    marginBottom: 24,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxGradientOuter: {
    width: 24,
    height: 24,
    borderRadius: 6,
    padding: 2,
    marginTop: 2,
  },
  checkboxInner: {
    flex: 1,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF3E8',
  },
  checkboxCheckedContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxInnerUnchecked: {
    flex: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 243, 232, 0.9)',
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  continueButton: {
    width: '100%',
    borderRadius: 52,
    overflow: 'hidden',
  },
  continueButtonGradient: {
    width: '100%',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  skipButton: {
    width: '100%',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FD8B36',
  },
});

export default VerifyAccountScreen;
