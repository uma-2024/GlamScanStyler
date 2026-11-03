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
import LinearGradient from '../components/AppLinearGradient';

const { width } = Dimensions.get('window');

export type ProfessionalType = 'freelancer' | 'working_professional';

interface ProfessionalTypeScreenProps {
  initialType?: ProfessionalType;
  onContinue: (type: ProfessionalType) => void;
  onBack?: () => void;
  onSkip?: () => void;
}

const ProfessionalTypeScreen: React.FC<ProfessionalTypeScreenProps> = ({
  initialType = 'freelancer',
  onContinue,
  onBack,
  onSkip,
}) => {
  const [selectedType, setSelectedType] = useState<ProfessionalType>(initialType);
  const [submitting, setSubmitting] = useState(false);
  const [skipping, setSkipping] = useState(false);

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Top Navigation */}
        <View style={styles.navRow}>
          {onBack && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBack}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Icon name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
          )}
          <View style={styles.navFiller} />
          {onSkip && (
            <TouchableOpacity
              onPress={async () => {
                if (submitting || skipping) return;
                try {
                  setSkipping(true);
                  await onSkip();
                } finally {
                  setSkipping(false);
                }
              }}
              disabled={submitting || skipping}
              activeOpacity={0.7}
              style={[styles.skipButton, (submitting || skipping) && { opacity: 0.6 }]}>
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
          <Text style={styles.badgeText}>PROFESSIONAL PROFILE</Text>
          <Text style={styles.title}>
            How will you work on{'\n'}
            <Text style={styles.titleHighlight}>GlamMefy</Text>?
          </Text>
          <Text style={styles.subtitle}>
            Tell us whether you're joining as an independent freelancer or a working professional in a salon.
          </Text>
        </View>

        {/* Option Cards */}
        <View style={styles.cardsContainer}>
          {/* Freelancer Card */}
          <TouchableOpacity
            style={[
              styles.optionCard,
              selectedType === 'freelancer' && styles.optionCardSelected,
            ]}
            onPress={() => setSelectedType('freelancer')}
            activeOpacity={0.88}>
            <View style={styles.cardHeaderRow}>
              <View
                style={[
                  styles.iconWrap,
                  selectedType === 'freelancer' && styles.iconWrapSelected,
                ]}>
                <Icons
                  name="user-tie"
                  size={24}
                  color={selectedType === 'freelancer' ? '#FD8B36' : '#777'}
                />
              </View>

              <View
                style={[
                  styles.radioOuter,
                  selectedType === 'freelancer' && styles.radioOuterSelected,
                ]}>
                {selectedType === 'freelancer' && <View style={styles.radioInner} />}
              </View>
            </View>

            <Text style={styles.cardTitle}>Freelancer</Text>
            <Text style={styles.cardSubtitle}>
              Independent beautician / stylist serving clients at their home or your studio.
            </Text>

            <View style={styles.locationPill}>
              <Icon name="place" size={16} color="#FD8B36" />
              <Text style={styles.locationPillText}>Current Service Location only</Text>
            </View>
          </TouchableOpacity>

          {/* Working Professional Card */}
          <TouchableOpacity
            style={[
              styles.optionCard,
              selectedType === 'working_professional' && styles.optionCardSelected,
            ]}
            onPress={() => setSelectedType('working_professional')}
            activeOpacity={0.88}>
            <View style={styles.cardHeaderRow}>
              <View
                style={[
                  styles.iconWrap,
                  selectedType === 'working_professional' && styles.iconWrapSelected,
                ]}>
                <Icons
                  name="store-alt"
                  size={22}
                  color={selectedType === 'working_professional' ? '#FD8B36' : '#777'}
                />
              </View>

              <View
                style={[
                  styles.radioOuter,
                  selectedType === 'working_professional' && styles.radioOuterSelected,
                ]}>
                {selectedType === 'working_professional' && (
                  <View style={styles.radioInner} />
                )}
              </View>
            </View>

            <Text style={styles.cardTitle}>Working Professional</Text>
            <Text style={styles.cardSubtitle}>
              Working at an established salon or parlour, or managing client appointments at work.
            </Text>

            <View style={styles.locationPill}>
              <Icon name="place" size={16} color="#FD8B36" />
              <Text style={styles.locationPillText}>Current Service Location only</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          style={[styles.continueButton, (submitting || skipping) && { opacity: 0.7 }]}
          onPress={async () => {
            if (submitting || skipping) return;
            try {
              setSubmitting(true);
              await onContinue(selectedType);
            } finally {
              setSubmitting(false);
            }
          }}
          disabled={submitting || skipping}
          activeOpacity={0.85}>
          <LinearGradient
            colors={['#FD8B36', '#F7BB2C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.continueButtonGradient}>
            {submitting ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.continueButtonText}>Saving & Continuing...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.continueButtonText}>Continue</Text>
                <Icon name="arrow-forward" size={20} color="#fff" />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
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
    paddingHorizontal: 22,
    paddingTop: Math.max(16, compactTopPadding(24)),
    paddingBottom: 32,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
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
    marginBottom: 28,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FD8B36',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#222',
    lineHeight: 34,
    marginBottom: 10,
  },
  titleHighlight: {
    color: '#FD8B36',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 21,
  },
  cardsContainer: {
    gap: 16,
    marginBottom: 32,
  },
  optionCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    borderWidth: 2,
    borderColor: '#F0E5D8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  optionCardSelected: {
    borderColor: '#FD8B36',
    backgroundColor: '#FFFDF9',
    shadowColor: '#FD8B36',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F7F7F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapSelected: {
    backgroundColor: '#FFF1E5',
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#C7C7C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: '#FD8B36',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FD8B36',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#666',
    lineHeight: 19,
    marginBottom: 14,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5EC',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  locationPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FD8B36',
  },
  continueButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#FD8B36',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default ProfessionalTypeScreen;
