import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import SafeAreaView from '../components/SafeAreaView';
import { compactTopPadding } from '../utils/responsiveLayout';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Icons from 'react-native-vector-icons/FontAwesome5';
import { GlamLoader } from '../components/GlamLoader';

const { width } = Dimensions.get('window');

interface VerificationScreenProps {
  onBack?: () => void;
  onProofOfIdentity?: () => void;
  onPrivacyPolicy?: () => void;
  onSkip?: () => void | Promise<void>;
}

const VerificationScreen: React.FC<VerificationScreenProps> = ({
  onBack,
  onProofOfIdentity,
  onPrivacyPolicy,
  onSkip,
}) => {
  const [skipping, setSkipping] = useState(false);

  const handleSkip = async () => {
    if (!onSkip || skipping) return;
    try {
      setSkipping(true);
      await onSkip();
    } catch (error) {
      console.error('Error skipping verification:', error);
      setSkipping(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.container}>
      {skipping && (
        <View style={styles.loaderOverlay}>
          <GlamLoader
            title="Saving your progress..."
            subtitle="Setting up your stylist account"
            size="large"
          />
        </View>
      )}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Top Navigation */}
        <View style={styles.navRow}>
          {onBack && (
            <TouchableOpacity
              onPress={onBack}
              disabled={skipping}
              style={[styles.backButton, skipping && { opacity: 0.5 }]}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Icon name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
          )}
          <View style={styles.navFiller} />
          {onSkip && (
            <TouchableOpacity
              onPress={handleSkip}
              disabled={skipping}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
              style={[styles.skipButton, skipping && { opacity: 0.7 }]}>
              {skipping ? (
                <ActivityIndicator size="small" color="#FD8B36" />
              ) : (
                <Text style={styles.skipButtonText}>Skip</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Header Section */}
        <View style={styles.header}>
          <Text style={styles.title}>
            Before You Take Card Payments{'\n'}Let's Get You Verified
          </Text>
          <Text style={styles.subtitle}>
            We Need To Check That You're Really You It Helps Us Fight Fraud And Your Business Secure.
          </Text>
        </View>

        {/* Verification Cards */}
        <View style={styles.cardsContainer}>
          {/* Proof Of Identity Card */}
          <TouchableOpacity
            style={styles.verificationCard}
            onPress={onProofOfIdentity}
            activeOpacity={0.8}>
            <View style={styles.cardContent}>
              <View style={styles.iconContainer}>
                <Icons name="address-card" size={20} color="#FD8B36" />
              </View>
              <View style={styles.cardTextContainer}>
                <Text style={styles.cardTitle}>Proof Of Identity</Text>
                <Text style={styles.cardDescription}>
                  Upload A Passport Driver's Licence National Id Card...
                </Text>
              </View>
              <Icon name="chevron-right" size={24} color="#FD8B36" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Footer inside ScrollView */}
        <View style={styles.footerInline}>
          <Icon name="lock" size={20} color="#333" />
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
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF3E8',
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 243, 232, 0.92)',
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: compactTopPadding(16),
    paddingBottom: 40,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  navFiller: {
    flex: 1,
  },
  skipButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(253, 139, 54, 0.1)',
  },
  skipButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FD8B36',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '500',
    color: '#333',
    marginBottom: 16,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  cardsContainer: {
    marginBottom: 40,
  },
  verificationCard: {
    backgroundColor: '#FFF8F0',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFE5CC',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFE5CC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    position: 'relative',
  },
  lockIconOverlay: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FD8B36',
  },
  cardTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  footerInline: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: compactTopPadding(20),
    paddingBottom: 24,
    marginHorizontal: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: compactTopPadding(20),
    position: 'absolute',
    bottom: '5%',
    left: '10%',
    right: '10%',
  },
  footerText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    lineHeight: 18,
  },
  privacyLink: {
    color: '#FD8B36',
    fontWeight: '500',
  },
});

export default VerificationScreen;
