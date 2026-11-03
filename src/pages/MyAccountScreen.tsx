import { QueuedModal as Modal } from '../popup/PopupProvider';
import { QueuedAlert as Alert } from '../popup/QueuedAlert';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  FlatList,
  TextInput,
} from 'react-native';
import SafeAreaView from '../components/SafeAreaView';
import { compactTopPadding } from '../utils/responsiveLayout';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { API_BASE_URL_WITH_API } from '../config/api';
import ImageCropPicker from 'react-native-image-crop-picker';
import { toCloudFrontUrl } from '../utils/cdnUrl';
import { buildImageDataUri } from '../utils/imageDataUri';

interface MyAccountScreenProps {
  userId?: string;
  onBack?: () => void;
  onHelp?: () => void;
  onCurrentBooking?: () => void;
  onHistory?: () => void;
}

interface StylistProfile {
  _id?: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
  profileImage?: string;
  experience?: number;
  rating?: number;
  totalBookings?: number;
  specialization?: string[];
  about?: string;
  location?: {
    address?: string;
    latitude?: number;
    longitude?: number;
  };
}

interface ServiceImage {
  _id?: string;
  imageUrl: string;
  title: string;
  description: string;
  date: string;
}

interface MenuItem {
  id: string;
  label: string;
  onPress: () => void;
}

const PRIMARY_COLOR = '#FD8B36';
const ICON_COLOR = PRIMARY_COLOR;
const BACKGROUND_COLOR = '#FFF3E8';
const PRIMARY_TEXT_COLOR = '#333333';
const SECONDARY_TEXT_COLOR = '#666666';
const MUTED_TEXT_COLOR = '#999999';

const MyAccountScreen: React.FC<MyAccountScreenProps> = ({ userId, onBack, onHelp, onCurrentBooking, onHistory }) => {
  const [stylistProfile, setStylistProfile] = useState<StylistProfile | null>(null);
  const [serviceImages, setServiceImages] = useState<ServiceImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImageUploadModal, setShowImageUploadModal] = useState(false);
  const [showImagePreviewModal, setShowImagePreviewModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ServiceImage | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [totalBalance] = useState('₹2,430.00');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [selectedImageUri, setSelectedImageUri] = useState<string>('');

  const resetImageUploadForm = () => {
    setUploadTitle('');
    setUploadDescription('');
    setSelectedImageUri('');
  };

  // Fetch stylist profile
  useEffect(() => {
    const fetchStylistProfile = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL_WITH_API}/profile/stylist/${userId}?includeSlots=true`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch stylist profile');
        }

        const result = await response.json();
        console.log('✅ Stylist profile fetched successfully:', result);
        const profileData = result.success && result.data ? result.data : (result._id ? result : null);
        
        if (profileData) {
          setStylistProfile(profileData);
        }
      } catch (error) {
        console.error('Error fetching stylist profile:', error);
      }
    };

    fetchStylistProfile();
  }, [userId]);

  // Fetch service images
  useEffect(() => {
    const fetchServiceImages = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL_WITH_API}/stylist/service-images/${userId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch service images');
        }

        const result = await response.json();
        const imagesData = Array.isArray(result) ? result : (result.success && Array.isArray(result.data) ? result.data : []);
        
        if (imagesData.length > 0) {
          setServiceImages(
            imagesData.map((image) => ({
              ...image,
              imageUrl: toCloudFrontUrl(image.imageUrl),
            }))
          );
        }
      } catch (error) {
        console.error('Error fetching service images:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchServiceImages();
  }, [userId]);

  // Handle image upload
  const handleUploadImage = async () => {
    try {
      const image = await ImageCropPicker.openPicker({
        width: 900,
        height: 900,
        cropping: true,
        mediaType: 'photo',
        includeBase64: true,
        compressImageQuality: 0.8,
      });

      if (image && image.data) {
        const imageData = `data:${image.mime};base64,${image.data}`;
        setSelectedImageUri(imageData);
      } else {
        Alert.alert('Error', 'Selected image is missing. Please choose it again.');
      }
    } catch (error: any) {
      if (error.message !== 'User cancelled image selection') {
        Alert.alert('Error', `Image picker error: ${error.message}`);
      } else {
        console.log('Image selection cancelled');
      }
    }
  };

  const handleConfirmUpload = async () => {
    if (!selectedImageUri || !uploadTitle.trim()) {
      Alert.alert('Error', 'Please select an image and enter a title');
      return;
    }

    if (!userId) {
      Alert.alert('Error', 'User ID not available');
      return;
    }

    setUploadingImage(true);

    try {
      const response = await fetch(`${API_BASE_URL_WITH_API}/stylist/service-images`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          stylistId: userId,
          title: uploadTitle,
          description: uploadDescription,
          imageUrl: selectedImageUri,
          category: 'General',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const result = await response.json();
      console.log('✅ Image uploaded successfully:', result);

      // Refresh images list
      await fetchServiceImages();

      // Reset form
      resetImageUploadForm();
      setShowImageUploadModal(false);

      Alert.alert('Success', 'Image uploaded successfully!');
    } catch (error) {
      console.error('❌ Error uploading image:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const fetchServiceImages = async () => {
    if (!userId) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL_WITH_API}/stylist/service-images/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch service images');
      }

        const result = await response.json();
        const imagesData = Array.isArray(result) ? result : (result.success && Array.isArray(result.data) ? result.data : []);
        
        if (imagesData.length > 0) {
          setServiceImages(
            imagesData.map((image) => ({
              ...image,
              imageUrl: toCloudFrontUrl(image.imageUrl),
            }))
          );
        }
    } catch (error) {
      console.error('Error fetching service images:', error);
    }
  };

  const handleDeleteImage = (imageId?: string) => {
    Alert.alert(
      'Delete Image',
      'Are you sure you want to delete this image?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!userId || !imageId) {
                Alert.alert('Error', 'Missing required information');
                return;
              }

              const response = await fetch(
                `${API_BASE_URL_WITH_API}/stylist/service-images/${imageId}`,
                {
                  method: 'DELETE',
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                  },
                  body: JSON.stringify({ stylistId: userId }),
                }
              );

              if (!response.ok) {
                throw new Error('Failed to delete image');
              }

              // Remove from local state
              setServiceImages(prev => prev.filter(img => img._id !== imageId));
              setShowImagePreviewModal(false);
              Alert.alert('Success', 'Image deleted successfully!');
            } catch (error) {
              console.error('❌ Error deleting image:', error);
              Alert.alert('Error', 'Failed to delete image');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
            <Icon name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Portfolio</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          </View>
        ) : (
          <>
            {/* Stylist Profile Section */}
            {stylistProfile && (
              <View style={styles.profileCard}>
                <View style={styles.profileHeader}>
                  {stylistProfile.profileImage ? (
                    <Image
                      source={{ uri: stylistProfile.profileImage }}
                      style={styles.profileImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.profileImagePlaceholder}>
                      <Icon name="person" size={40} color={ICON_COLOR} />
                    </View>
                  )}
                  <View style={styles.profileInfo}>
                    <Text style={styles.profileName}>{stylistProfile.name || 'Expert Name'}</Text>
                    <Text style={styles.profileEmail}>{stylistProfile.email}</Text>
                  </View>
                </View>

                <View style={styles.profileStats}>
                  <View style={styles.statItem}>
                    <View style={styles.ratingRow}>
                      <Text style={styles.statValue}>{stylistProfile.rating ? stylistProfile.rating.toFixed(1) : '0.0'}</Text>
                      <Icon name="star" size={16} color="#FFD700" />
                    </View>
                    <Text style={styles.statLabel}>Rating</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stylistProfile.totalBookings || 0}</Text>
                    <Text style={styles.statLabel}>Bookings</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stylistProfile.experience || 0}</Text>
                    <Text style={styles.statLabel}>Years Exp.</Text>
                  </View>
                </View>

                {stylistProfile.about && (
                  <View style={styles.bioSection}>
                    <Text style={styles.bioText}>{stylistProfile.about}</Text>
                  </View>
                )}

                {stylistProfile.specialization && stylistProfile.specialization.length > 0 && (
                  <View style={styles.specializationSection}>
                    <Text style={styles.sectionLabel}>Specializations</Text>
                    <View style={styles.specializationTags}>
                      {stylistProfile.specialization.map((spec, index) => (
                        <View key={index} style={styles.tag}>
                          <Text style={styles.tagText}>{spec}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {stylistProfile.location?.address && (
                  <View style={styles.locationSection}>
                    <Icon name="place" size={18} color={ICON_COLOR} />
                    <Text style={styles.locationText}>{stylistProfile.location.address}</Text>
                  </View>
                )}
              </View>
            )}

          
            {/* Service Images Section */}
            <View style={styles.serviceImagesSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Service Gallery</Text>
                <TouchableOpacity
                  onPress={() => setShowImageUploadModal(true)}
                  activeOpacity={0.7}>
                  <Icon name="add-a-photo" size={24} color={ICON_COLOR} />
                </TouchableOpacity>
              </View>

              {serviceImages.length > 0 ? (
                <View style={serviceImages.length === 1 ? styles.singleImageContainer : undefined}>
                  <FlatList
                    data={serviceImages}
                    keyExtractor={(item) => item._id || Math.random().toString()}
                    numColumns={serviceImages.length === 1 ? 1 : 3}
                    scrollEnabled={false}
                    columnWrapperStyle={serviceImages.length === 1 ? undefined : styles.imageGrid}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[styles.imageCard, serviceImages.length === 1 ? styles.singleImageCard : undefined]}
                        onPress={() => {
                          setSelectedImage(item);
                          setShowImagePreviewModal(true);
                        }}
                        activeOpacity={0.7}>
                        <Image
                          source={{ uri: toCloudFrontUrl(item.imageUrl) }}
                          style={styles.serviceImage}
                        />
                        <View style={styles.imageOverlay}>
                          <Text style={styles.imageTitle} numberOfLines={1}>
                            {item.title}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  />
                </View>
              ) : (
                <View style={styles.emptyGallery}>
                  <Icon name="image" size={48} color={ICON_COLOR} />
                  <Text style={styles.emptyGalleryText}>No service images yet</Text>
                  <Text style={styles.emptyGallerySubtext}>
                    Upload images of your successful services to showcase your work
                  </Text>
                </View>
              )}
            </View>

            {/* Menu List */}
           
          </>
        )}
      </ScrollView>

      {/* Upload Image Modal */}
      <Modal
        visible={showImageUploadModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowImageUploadModal(false);
          resetImageUploadForm();
        }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Upload Service Image</Text>
	              <TouchableOpacity
	                onPress={() => {
	                  setShowImageUploadModal(false);
	                  resetImageUploadForm();
	                }}
                activeOpacity={0.7}>
                <Icon name="close" size={24} color={PRIMARY_TEXT_COLOR} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.uploadModalScroll}>
	              {!selectedImageUri ? (
                <View style={styles.uploadOptions}>
                  <TouchableOpacity
                    style={styles.uploadButton}
                    onPress={handleUploadImage}
                    activeOpacity={0.7}>
                    <Icon name="image" size={48} color={ICON_COLOR} />
                    <Text style={styles.uploadButtonText}>Choose from Gallery</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.uploadFormContainer}>
                  {/* Image Preview */}
                  <View style={styles.imagePreviewContainer}>
	                    <Image
	                      source={{ uri: selectedImageUri }}
                      style={styles.uploadPreviewImage}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      style={styles.changeImageButton}
                      onPress={handleUploadImage}
                      activeOpacity={0.7}>
                      <Icon name="edit" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>

                  {/* Title Input */}
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Service Title *</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="e.g., Trendy Haircut, Bridal Makeup"
                      value={uploadTitle}
                      onChangeText={setUploadTitle}
                      placeholderTextColor="#999"
                    />
                  </View>

                  {/* Description Input */}
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Description (Optional)</Text>
                    <TextInput
                      style={[styles.formInput, styles.formTextArea]}
                      placeholder="Describe the service, products used, etc."
                      value={uploadDescription}
                      onChangeText={setUploadDescription}
                      placeholderTextColor="#999"
                      multiline
                      numberOfLines={4}
                    />
                  </View>

                  {/* Upload Button */}
                  <TouchableOpacity
	                    style={styles.confirmUploadButton}
	                    onPress={handleConfirmUpload}
	                    disabled={uploadingImage || !uploadTitle.trim() || !selectedImageUri}
                    activeOpacity={0.8}>
                    {uploadingImage ? (
                      <>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={styles.confirmUploadButtonText}>Uploading...</Text>
                      </>
                    ) : (
                      <Text style={styles.confirmUploadButtonText}>Upload Image</Text>
                    )}
                  </TouchableOpacity>

                  {/* Change Image Button */}
	                  <TouchableOpacity
	                    style={styles.changeImageButtonSecondary}
	                    onPress={() => {
	                      setSelectedImageUri('');
	                      handleUploadImage();
	                    }}
                    disabled={uploadingImage}
                    activeOpacity={0.7}>
                    <Text style={styles.changeImageButtonText}>Choose Different Image</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Image Preview Modal */}
      <Modal
        visible={showImagePreviewModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImagePreviewModal(false)}>
        <View style={styles.previewOverlay}>
          <TouchableOpacity
            style={styles.previewCloseButton}
            onPress={() => setShowImagePreviewModal(false)}
            activeOpacity={0.7}>
            <Icon name="close" size={28} color="#fff" />
          </TouchableOpacity>

          {selectedImage && (
            <View style={styles.previewContent}>
              <Image
                source={{ uri: toCloudFrontUrl(selectedImage.imageUrl) }}
                style={styles.previewImage}
                resizeMode="contain"
              />
              <View style={styles.previewInfo}>
                <Text style={styles.previewTitle}>{selectedImage.title}</Text>
                <Text style={styles.previewDescription}>{selectedImage.description}</Text>
                <Text style={styles.previewDate}>
                  {new Date(selectedImage.date).toLocaleDateString()}
                </Text>
                 <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => {
                  setShowImagePreviewModal(false);
                  handleDeleteImage(selectedImage._id);
                }}
                activeOpacity={0.7}>
                <Icon name="delete" size={20} color="#fff" />
              
              </TouchableOpacity>
              </View>

            
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
    paddingTop: compactTopPadding(20),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    fontWeight: '500',
    color: PRIMARY_TEXT_COLOR,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  balanceCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    backgroundColor: PRIMARY_COLOR,
 
  },
  balanceTopSection: {
    backgroundColor: PRIMARY_COLOR,
    padding: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  balanceLabel: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 8,
    fontWeight: '500',
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  decorativePattern: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  iconsSection: {
    backgroundColor: '#000',
    flexDirection: 'row',
    paddingVertical: 20,
    paddingHorizontal: 16,
    justifyContent: 'space-around',
    flexWrap: 'wrap',
  },
  iconButton: {
    alignItems: 'center',
    width: '25%',
    minWidth: 70,
    marginBottom: 16,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconLabel: {
    fontSize: 11,
    color: '#fff',
    textAlign: 'center',
    fontWeight: '500',
  },
  serviceImagesSection: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: PRIMARY_TEXT_COLOR,
  },
  imageGrid: {
    justifyContent: 'flex-start',
    gap: 12,
  },
  singleImageContainer: {
    width: '33.33%',
  },
  imageCard: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
    marginBottom: 12,
  },
  singleImageCard: {
    width: '100%',
    flex: undefined,
  },
  serviceImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 8,
  },
  imageTitle: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  emptyGallery: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
  },
  emptyGalleryText: {
    fontSize: 16,
    fontWeight: '600',
    color: MUTED_TEXT_COLOR,
    marginTop: 12,
  },
  emptyGallerySubtext: {
    fontSize: 12,
    color: MUTED_TEXT_COLOR,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  menuSection: {
    marginTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 8,
  },
  menuItemText: {
    fontSize: 16,
    color: PRIMARY_TEXT_COLOR,
    fontWeight: '500',
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
 
    padding: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFE5CC',
    marginRight: 16,
  },
  profileImagePlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFE5CC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: PRIMARY_TEXT_COLOR,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: SECONDARY_TEXT_COLOR,
  },
  profileStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F5F5F5',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: SECONDARY_TEXT_COLOR,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
  },
  bioSection: {
    marginBottom: 16,
  },
  bioText: {
    fontSize: 14,
    color: SECONDARY_TEXT_COLOR,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  specializationSection: {
    marginBottom: 16,
  },
  locationSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: compactTopPadding(12),
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  locationText: {
    marginLeft: 8,
    fontSize: 14,
    color: SECONDARY_TEXT_COLOR,
    flex: 1,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY_TEXT_COLOR,
    marginBottom: 8,
  },
  specializationTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#FFE2BA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
  },
  tagText: {
    fontSize: 12,
    color: PRIMARY_COLOR,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: PRIMARY_TEXT_COLOR,
  },
  uploadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  uploadingText: {
    marginTop: 16,
    fontSize: 16,
    color: SECONDARY_TEXT_COLOR,
  },
  uploadOptions: {
    paddingVertical: 20,
  },
  uploadButton: {
    alignItems: 'center',
    paddingVertical: 24,
    // backgroundColor: '#FFF4E6',
    // borderRadius: 12,
    // borderWidth: 2,
    // borderColor: '#FD8B36',
  },
  uploadButtonText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  previewImage: {
    width: '100%',
    height: '60%',
  },
  previewInfo: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: PRIMARY_TEXT_COLOR,
    marginBottom: 8,
  },
  previewDescription: {
    fontSize: 14,
    color: SECONDARY_TEXT_COLOR,
    lineHeight: 20,
    marginBottom: 8,
  },
  previewDate: {
    fontSize: 12,
    color: MUTED_TEXT_COLOR,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 12,
    paddingVertical: 8,
    marginTop: 16,
    gap: 8,
    width: '10%',
    position: 'absolute',
    right: 10,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  uploadModalScroll: {
    maxHeight: 600,
  },
  uploadFormContainer: {
    padding: 16,
  },
  imagePreviewContainer: {
    position: 'relative',
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
  },
  uploadPreviewImage: {
    width: '100%',
    height: 240,
  },
  changeImageButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY_TEXT_COLOR,
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: PRIMARY_TEXT_COLOR,
    backgroundColor: '#F9F9F9',
  },
  formTextArea: {
    textAlignVertical: 'top',
    minHeight: 100,
  },
  confirmUploadButton: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 12,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  confirmUploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  changeImageButtonSecondary: {
    borderWidth: 2,
    borderColor: PRIMARY_COLOR,
    borderRadius: 12,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changeImageButtonText: {
    color: PRIMARY_COLOR,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default MyAccountScreen;
