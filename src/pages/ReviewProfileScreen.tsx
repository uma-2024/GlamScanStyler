import { QueuedAlert as Alert } from '../popup/QueuedAlert';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import SafeAreaView from '../components/SafeAreaView';
import { compactTopPadding } from '../utils/responsiveLayout';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from '../components/AppLinearGradient';
// import BottomNavigation from '../components/BottomNavigation';
import { API_BASE_URL_WITH_API } from '../config/api';
import { updateOnboardingStep } from '../utils/onboardingSteps';

interface ProfileData {
  name: string;
  age: string;
  gender: 'Male' | 'Female' | 'Other';
  about: string;
  phoneNumber: string;
  instagram: string;
  yearsOfExperience: string;
  profileImage: string | null;
  profileImageUrl?: string | null;
  location: string;
}

interface ReviewProfileScreenProps {
  onBack?: () => void;
  onConfirm?: (isVerified: boolean) => void;
  onSkip?: () => void;
  userId?: string;
  profileData: ProfileData;
  selectedMainCategoryIds?: string[];
}

const isUploadedImageReference = (value?: string | null) => {
  const image = value?.trim();
  if (!image) {
    return false;
  }

  return /^https?:\/\//i.test(image) || /^data:image\/(jpeg|jpg|png|gif|webp);base64,/i.test(image);
};

const ReviewProfileScreen: React.FC<ReviewProfileScreenProps> = ({
  onBack,
  onConfirm,
  onSkip,
  userId,
  profileData,
}) => {
  const [saving, setSaving] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'home' | 'scan' | 'bookings' | 'account'
  >('home');

  const handleConfirm = async () => {
    if (!userId) {
      Alert.alert('Error', 'User ID is missing. Please login again.');
      return;
    }

    try {
      setSaving(true);

      const profileImageToSend =
        profileData.profileImageUrl ||
        (isUploadedImageReference(profileData.profileImage)
          ? profileData.profileImage
          : null);

      const requestBody = {
        userId,
        name: profileData.name,
        age: parseInt(profileData.age) || 0,
        gender: profileData.gender,
        about: profileData.about,
        phoneNumber: profileData.phoneNumber,
        instagram: profileData.instagram,
        yearsOfExperience: parseInt(profileData.yearsOfExperience) || 0,
        profileImage: profileImageToSend,
        location: profileData.location,
      };

      const apiUrl = `${API_BASE_URL_WITH_API}/profile/complete`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.message ||
          result?.error ||
          `Failed to save profile: ${response.status}`,
        );
      }

      // Mark reviewProfile step as completed
      if (userId) {
        await updateOnboardingStep(userId, 'reviewProfile', true);
      }

      // Navigate to next screen after successful save
      // Pass isVerified status to determine which screen to show
      // Handle both string "true"/"false" and boolean true/false
      const isVerified = result.data?.isVerified;
      const isVerifiedBool =
        isVerified === true || isVerified === 'true' || isVerified === 'True';

      if (onConfirm) {
        onConfirm(isVerifiedBool);
      }
    } catch (error) {
      console.error('❌ Error saving profile:', error);
      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Failed to save profile. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Profile</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Picture Section */}
        <View style={styles.profileSection}>
          <View style={styles.profileImageContainer}>
            {profileData.profileImage ? (
              <Image
                source={{ uri: profileData.profileImage }}
                style={styles.profileImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.profilePlaceholder}>
                <Icon name="person" size={60} color="#FD8B36" />
              </View>
            )}
          </View>
          <Text style={styles.profileName}>
            {profileData.name || 'Not provided'}
          </Text>
        </View>

        {/* Personal Information Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name:</Text>
            <Text style={styles.infoValue}>
              {profileData.name || 'Not provided'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Age:</Text>
            <Text style={styles.infoValue}>
              {profileData.age || 'Not provided'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Gender:</Text>
            <Text style={styles.infoValue}>
              {profileData.gender || 'Not provided'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone:</Text>
            <Text style={styles.infoValue}>
              {profileData.phoneNumber || 'Not provided'}
            </Text>
          </View>
         {profileData.instagram ? (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>Instagram:</Text>
    <Text style={styles.infoValue}>
      {profileData.instagram}
    </Text>
  </View>
) : null}
          {profileData.yearsOfExperience ? (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>Professional Experience:</Text>
    <Text style={styles.infoValue}>
      {profileData.yearsOfExperience} years
    </Text>
  </View>
) : null}
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About Yourself</Text>
          <Text style={styles.aboutText}>
            {profileData.about || 'Not provided'}
          </Text>
        </View>

        {/* Location Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <View style={styles.locationContainer}>
            <Icon
              name="location-on"
              size={24}
              color="#FD8B36"
              style={styles.locationIcon}
            />
            <Text style={styles.locationText}>
              {profileData.location || 'Not provided'}
            </Text>
          </View>
        </View>

        {/* Confirm Button */}
        <View style={styles.confirmButtonContainer}>
          <TouchableOpacity
            style={[
              styles.confirmButton,
              saving && styles.confirmButtonDisabled,
            ]}
            onPress={handleConfirm}
            activeOpacity={0.8}
            disabled={saving}
          >
            <LinearGradient
              colors={['#FD8B36', '#f7bb2c']}
              start={{ x: 0.5, y: 0.5 }}
              end={{ x: 0.5, y: 0 }}
              style={styles.confirmButtonGradient}>
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.confirmButtonText}>Confirm</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
          {onSkip && (
            <TouchableOpacity
              style={[styles.skipButton, (saving || skipping) && { opacity: 0.6 }]}
              onPress={async () => {
                if (saving || skipping) return;
                try {
                  setSkipping(true);
                  await onSkip();
                } finally {
                  setSkipping(false);
                }
              }}
              disabled={saving || skipping}
              activeOpacity={0.8}>
              {skipping ? (
                <ActivityIndicator size="small" color="#FD8B36" />
              ) : (
                <Text style={styles.skipButtonText}>Skip</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      {/* <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} /> */}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
     backgroundColor: '#FFF3E8',
    paddingTop: compactTopPadding(20),
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: compactTopPadding(20),
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 100, // Space for bottom nav
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
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  section: {
    marginBottom: 32,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    flex: 1,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  aboutText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  locationIcon: {
    marginRight: 12,
  },
  locationText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    lineHeight: 24,
  },
  confirmButtonContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  confirmButton: {
    borderRadius: 52,
    width: '100%',
    overflow: 'hidden',
  },
  confirmButtonGradient: {
    width: '100%',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 52,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
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
});

export default ReviewProfileScreen;
