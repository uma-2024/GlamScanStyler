import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Clipboard,
} from 'react-native';
import SafeAreaView from '../components/SafeAreaView';
import { compactTopPadding } from '../utils/responsiveLayout';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from '../components/AppLinearGradient';
import { API_BASE_URL_WITH_API } from '../config/api';

interface ReferAndEarnScreenProps {
  onBack?: () => void;
  onFAQs?: () => void;
  userId?: string;
}

const PRIMARY_COLOR = '#FD8B36';
const BACKGROUND_COLOR = '#FFF3E8';
const PRIMARY_GRADIENT = ['#FD8B36', '#f7bb2c'];
const PRIMARY_GRADIENT_LOCATIONS = [0, 0.7];
const PRIMARY_GRADIENT_START = { x: 0.5, y: 0.5 };
const PRIMARY_GRADIENT_END = { x: 0.5, y: 0 };

const benefits = [
  {
    icon: 'card-giftcard',
    title: 'You Get ₹200',
    description: 'Earn ₹200 for each referral who signs up',
  },
  {
    icon: 'people',
    title: 'Friends Get ₹100',
    description: 'Your friend receives ₹100 as welcome bonus',
  },
  {
    icon: 'trending-up',
    title: 'Unlimited Earnings',
    description: 'No cap on referrals. Keep earning!',
  },
  {
    icon: 'verified',
    title: 'Instant Credits',
    description: 'Earnings credited to wallet instantly',
  },
];

const referralSteps = [
  {
    number: '1',
    title: 'Copy Your Code',
    description: 'Click the button below to copy your unique referral code',
  },
  {
    number: '2',
    title: 'Share with Friends',
    description: 'Share the code with stylists you know via WhatsApp, email, or social media',
  },
  {
    number: '3',
    title: 'They Sign Up',
    description: 'Your friend uses the code when registering on Glammefy and complete profile',
  },
  {
    number: '4',
    title: 'You Both Earn',
    description: 'Get ₹200 instantly to your wallet, and they get ₹100 bonus',
  },
];

const ReferAndEarnScreen: React.FC<ReferAndEarnScreenProps> = ({ onBack, onFAQs, userId }) => {
  const [copied, setCopied] = useState(false);
  const [referralCode, setReferralCode] = useState(`GLAM${userId?.slice(-6).toUpperCase() || 'XXXXXX'}`);
  const [referralStats, setReferralStats] = useState({
    totalReferrals: 0,
    successfullyJoined: 0,
    totalEarned: 0,
  });

  useEffect(() => {
    if (!userId) {
      return;
    }

    const fetchReferralDetails = async () => {
      try {
        const response = await fetch(`${API_BASE_URL_WITH_API}/stylist/referral/${userId}`);
        const result = await response.json();

        if (!response.ok || !result?.success || !result?.data) {
          throw new Error(result?.message || 'Failed to fetch referral details');
        }

        setReferralCode(result.data.referralCode || `GLAM${userId.slice(-6).toUpperCase()}`);
        setReferralStats({
          totalReferrals: Number(result.data.stats?.totalReferrals || 0),
          successfullyJoined: Number(result.data.stats?.successfullyJoined || 0),
          totalEarned: Number(result.data.stats?.totalEarned || 0),
        });
      } catch (error) {
        console.error('Failed to load referral details:', error);
      }
    };

    fetchReferralDetails();
  }, [userId]);

  const stats = [
    {
      label: 'Total Referrals',
      value: String(referralStats.totalReferrals),
      icon: 'people-outline',
    },
    {
      label: 'Successfully Joined',
      value: String(referralStats.successfullyJoined),
      icon: 'check-circle-outline',
    },
    {
      label: 'Total Earned',
      value: `₹${Number(referralStats.totalEarned || 0).toLocaleString('en-IN')}`,
      icon: 'account-balance-wallet',
    },
  ];

  const handleCopyCode = async () => {
    try {
      await Clipboard.setString(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  const handleShareCode = async () => {
    try {
      await Share.share({
        message: `Join Glammefy with my referral code "${referralCode}" and get ₹200 bonus! Download the app and start earning as a stylist. https://glammefy.app`,
        title: 'Refer and Earn',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
            <Icon name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Refer & Earn</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroIconContainer}>
            <Icon name="card-giftcard" size={64} color={PRIMARY_COLOR} />
          </View>
          <Text style={styles.heroTitle}>Earn Extra Income</Text>
          <Text style={styles.heroSubtitle}>
            Share your unique code with stylists you know and earn ₹200 per referral
          </Text>
        </View>

        {/* Referral Code Section */}
        <View style={styles.codeSection}>
          <Text style={styles.codeSectionTitle}>Your Referral Code</Text>
          <View style={styles.codeContainer}>
            <Text style={styles.codeText}>{referralCode}</Text>
            <TouchableOpacity
              style={styles.copyButton}
              onPress={handleCopyCode}
              activeOpacity={0.7}>
              <Icon
                name={copied ? 'check' : 'content-copy'}
                size={20}
                color={copied ? '#4CAF50' : PRIMARY_COLOR}
              />
            </TouchableOpacity>
          </View>
          {copied && <Text style={styles.copiedText}>✓ Copied to clipboard!</Text>}

          <TouchableOpacity onPress={handleShareCode} activeOpacity={0.7}>
            <LinearGradient
              colors={PRIMARY_GRADIENT}
              locations={PRIMARY_GRADIENT_LOCATIONS}
              start={PRIMARY_GRADIENT_START}
              end={PRIMARY_GRADIENT_END}
              style={styles.shareButton}>
              <Icon name="share" size={20} color="#fff" />
              <Text style={styles.shareButtonText}>Share Code</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Benefits Section */}
        <View style={styles.benefitsSection}>
          <Text style={styles.sectionTitle}>What You Get</Text>
          <View style={styles.benefitsGrid}>
            {benefits.map((benefit, index) => (
              <View key={index} style={styles.benefitCard}>
                <View style={styles.benefitIconContainer}>
                  <Icon name={benefit.icon} size={28} color={PRIMARY_COLOR} />
                </View>
                <Text style={styles.benefitTitle}>{benefit.title}</Text>
                <Text style={styles.benefitDescription}>{benefit.description}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Visibility Section */}
        <View style={styles.visibilitySection}>
          <View style={styles.visibilityHeader}>
            <Icon name="visibility" size={28} color={PRIMARY_COLOR} />
            <Text style={styles.visibilityTitle}>EARN YOUR VISIBILITY, WITHOUT PAYING FOR IT!!</Text>
          </View>
          <Text style={styles.visibilityDescription}>
            Refer clients to grow your "Client Demand" meter. Higher demand = Priority listing & more visibility.
          </Text>
        </View>
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Your Referral Stats</Text>
          <View style={styles.statsGrid}>
            {stats.map((stat, index) => (
              <View key={index} style={styles.statCard}>
                <Icon name={stat.icon} size={32} color={PRIMARY_COLOR} />
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* How It Works Section */}
        <View style={styles.stepsSection}>
          <Text style={styles.sectionTitle}>How It Works</Text>
          {referralSteps.map((step, index) => (
            <View key={index} style={styles.stepCard}>
              <LinearGradient
                colors={PRIMARY_GRADIENT}
                locations={PRIMARY_GRADIENT_LOCATIONS}
                start={PRIMARY_GRADIENT_START}
                end={PRIMARY_GRADIENT_END}
                style={styles.stepNumberContainer}>
                <Text style={styles.stepNumber}>{step.number}</Text>
              </LinearGradient>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepDescription}>{step.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* FAQ Link */}
        <TouchableOpacity
          onPress={onFAQs}
          activeOpacity={0.7}>
          <LinearGradient
            colors={['#FFFFFF', '#FFF5EC']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.faqLink}>
            <View style={styles.faqLinkContent}>
              <Icon name="help-outline" size={20} color={PRIMARY_COLOR} style={styles.faqIcon} />
              <View style={styles.faqTextContainer}>
                <Text style={styles.faqTitle}>Have questions?</Text>
                <Text style={styles.faqSubtitle}>Check our FAQs about referral program</Text>
              </View>
            </View>
            <Icon name="arrow-forward-ios" size={18} color={PRIMARY_COLOR} />
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
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
    paddingHorizontal: 24,
    paddingTop: compactTopPadding(16),
    paddingBottom: 12,
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
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
    paddingVertical: 20,
  },
  heroIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${PRIMARY_COLOR}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#7A4A26',
    textAlign: 'center',
    lineHeight: 20,
  },
  codeSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  codeSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: `${PRIMARY_COLOR}30`,
  },
  codeText: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: PRIMARY_COLOR,
    letterSpacing: 2,
  },
  copyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${PRIMARY_COLOR}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  copiedText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
    marginBottom: 12,
  },
  shareButton: {
    flexDirection: 'row',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  benefitsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  visibilitySection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 32,
    borderLeftWidth: 4,
    borderLeftColor: PRIMARY_COLOR,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  visibilityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  visibilityTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: PRIMARY_COLOR,
    flex: 1,
    lineHeight: 22,
  },
  visibilityDescription: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    fontWeight: '500',
  },
  benefitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  benefitCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  benefitIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${PRIMARY_COLOR}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  benefitDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
  },
  statsSection: {
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: PRIMARY_COLOR,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  stepsSection: {
    marginBottom: 24,
  },
  stepCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  stepNumberContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  faqLink: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: PRIMARY_COLOR,
  },
  faqLinkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  faqIcon: {
    marginRight: 12,
  },
  faqTextContainer: {
    flex: 1,
  },
  faqTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  faqSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  bottomSpacer: {
    height: 20,
  },
});

export default ReferAndEarnScreen;
