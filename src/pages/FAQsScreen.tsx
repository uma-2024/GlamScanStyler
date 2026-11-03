import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import SafeAreaView from '../components/SafeAreaView';
import { compactTopPadding } from '../utils/responsiveLayout';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from '../components/AppLinearGradient';

interface FAQsScreenProps {
  onBack?: () => void;
  onContactSupport?: () => void;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: 'earnings' | 'withdraw' | 'eligibility';
}

const PRIMARY_COLOR = '#FD8B36';
const BACKGROUND_COLOR = '#FFF3E8';
const PRIMARY_GRADIENT = ['#FD8B36', '#f7bb2c'];
const PRIMARY_GRADIENT_LOCATIONS = [0, 0.7];
const PRIMARY_GRADIENT_START = { x: 0.5, y: 0.5 };
const PRIMARY_GRADIENT_END = { x: 0.5, y: 0 };

const faqs: FAQ[] = [
  {
    id: '1',
    category: 'earnings',
    question: 'How do I refer a stylist?',
    answer:
      'Open the app, tap "Refer & Earn," and you will see your personal invite link. Share it on WhatsApp, Instagram, or anywhere you want. When a stylist signs up through that link, we automatically tag them as your referral.',
  },
  {
    id: '2',
    category: 'earnings',
    question: 'When exactly do I get my ₹200 coupon?',
    answer:
      'You get it right after your friend completes their profile. Sign-up alone is not enough. Once they add a photo, bio, services, and 2 portfolio pics, your ₹200 coupon unlocks instantly and appears in "My Glam Wallet."',
  },
  {
    id: '3',
    category: 'earnings',
    question: 'What counts as a "complete profile" for my friend?',
    answer:
      'A complete profile needs 4 things: a profile photo, a short bio, at least 3 services with prices, and 2 portfolio images. It usually takes about 5 minutes. Until all 4 are done, the profile is not marked complete.',
  },
  {
    id: '4',
    category: 'earnings',
    question: 'Where can I see my earned coupons and how much I\'ve saved?',
    answer:
      'Go to your wallet. You will see all active ₹200 coupons there, along with the total amount you have saved so far through referrals.',
  },
  {
    id: '5',
    category: 'earnings',
    question: 'Can I use multiple ₹200 coupons at once on my plan?',
    answer:
      'Yes, you can stack them. If your renewal is ₹600 and you have 3 coupons, you pay ₹0. There is no cap on how many coupons you can use in one go.',
  },
  {
    id: '6',
    category: 'earnings',
    question: 'Do my coupons expire if I don\'t renew my plan soon? Is there a validity?',
    answer:
      'No. Your coupons do not expire until you use them.',
  },
  {
    id: '7',
    category: 'earnings',
    question: 'Can I refer stylists from other cities, or only my area?',
    answer:
      'You can refer stylists from any city in India. As long as they sign up with your link and complete their profile, you get the ₹200 coupon. Location does not matter.',
  },
  {
    id: '8',
    category: 'eligibility',
    question: 'Do I need an active paid plan to refer other stylists?',
    answer:
      'No. Any stylist with a GlamMefy account can refer. Free plan, trial, or paid, your invite link works the same. You just need to be logged in to access "Refer & Earn."',
  },
  {
    id: '9',
    category: 'eligibility',
    question: 'Can new stylists refer others immediately after signing up?',
    answer:
      'Yes. There is no waiting period. As soon as your account is created, you get a referral link. Many new stylists refer friends during onboarding itself.',
  },
  {
    id: '10',
    category: 'eligibility',
    question: 'Can I refer someone if I\'m a freelancer vs working in a salon?',
    answer:
      'Yes. Employment type does not matter. Freelancers, salon staff, salon owners, and home-based stylists can all refer and be referred.',
  },
  {
    id: '11',
    category: 'eligibility',
    question: 'Is there a minimum level I need to reach before I can refer?',
    answer:
      'No minimum level. Level 1, 2, and 3 all can refer. Your level does not change who you can invite.',
  },
  {
    id: '12',
    category: 'eligibility',
    question: 'Can I refer a stylist who already deleted their old GlamMefy account?',
    answer:
      'Yes, if their account is fully deleted for 30+ days. If they just uninstalled the app or are inactive, they count as existing users and will not tag to you.',
  },
  {
    id: '13',
    category: 'eligibility',
    question: 'Can I refer stylists outside India?',
    answer:
      'Not yet. Right now GlamMefy onboarding is only open for stylists based in India. If your link is used abroad, sign-up will not complete.',
  },
  {
    id: '14',
    category: 'eligibility',
    question: 'Will I lose eligibility if I take a break from GlamMefy?',
    answer:
      'No. If your account exists, your referral link stays active. Paused plans or inactive profiles can still refer. Only deleted accounts lose access.',
  },
  {
    id: '15',
    category: 'eligibility',
    question: 'Can two stylists refer each other?',
    answer:
      'Yes, but timing matters. Whoever clicks the other\'s link first and completes profile gets tagged as the referral. You cannot both earn from each other for the same sign-up.',
  },
  {
    id: '16',
    category: 'eligibility',
    question: 'Can I refer a makeup artist if I\'m a hair stylist?',
    answer:
      'Yes. All beauty categories count: hair, makeup, nails, skin, and mehndi. You can refer across categories.',
  },
  {
    id: '17',
    category: 'withdraw',
    question: 'Can I withdraw my referral earnings to my bank account?',
    answer:
      'Not right now. Current referral rewards are ₹200 OFF coupons for plan renewals. Cash withdrawals are coming soon. We\'ll notify you in the app when it\'s live.',
  },
  {
    id: '18',
    category: 'withdraw',
    question: 'How do I apply my coupons when renewing my plan?',
    answer:
      'You do not have to do anything. On the payment screen, all active coupons are applied automatically. You will see the final amount after discount before you pay.',
  },
  {
    id: '19',
    category: 'withdraw',
    question: 'Can I choose which coupon to use first?',
    answer:
      'No. The app auto-applies the coupons, so you do not lose savings. If you have 3 coupons, all 3 will stack.',
  },
  {
    id: '20',
    category: 'withdraw',
    question: 'Can I use part of a coupon and save the rest?',
    answer:
      'No. Each coupon is ₹200 flat. If your renewal is ₹150, you use one full coupon and pay ₹0. The extra ₹50 does not carry over.',
  },
  {
    id: '21',
    category: 'withdraw',
    question: 'What happens to my coupons if I pause my GlamMefy subscription?',
    answer:
      'They stay in your wallet for 60 days. If you reactivate before that period, you can still use them. If your account is deleted, coupons are removed.',
  },
  {
    id: '22',
    category: 'withdraw',
    question: 'Can I gift my coupon to another stylist who needs it more?',
    answer:
      'No. Coupons are locked to your account for security reasons. You can refer that stylist instead so they earn their own by referring other artists.',
  },
];

const categories = [
  { id: 'all', label: 'All', icon: 'all-inbox' },
  { id: 'earnings', label: 'Refer & Earnings', icon: 'attach-money' },
  { id: 'withdraw', label: 'Withdraw', icon: 'account-balance-wallet' },
  { id: 'eligibility', label: 'Eligibility', icon: 'verified-user' },
];

const FAQsScreen: React.FC<FAQsScreenProps> = ({ onBack, onContactSupport }) => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredFAQs =
    selectedCategory === 'all'
      ? faqs
      : faqs.filter((faq) => faq.category === selectedCategory);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
            <Icon name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>FAQs</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Title Section */}
        <LinearGradient
          colors={['#FFF6EF', '#FFE5D1', '#FFD7B6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.titleSection}>
          <Text style={styles.titleText}>Referral Program FAQs</Text>
          <Text style={styles.subtitleText}>
            Find answers to common questions about our referral and earning program
          </Text>
        </LinearGradient>

        {/* Category Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              onPress={() => {
                setSelectedCategory(category.id);
                setExpandedId(null);
              }}
              activeOpacity={0.7}>
              {selectedCategory === category.id ? (
                <LinearGradient
                  colors={PRIMARY_GRADIENT}
                  locations={PRIMARY_GRADIENT_LOCATIONS}
                  start={PRIMARY_GRADIENT_START}
                  end={PRIMARY_GRADIENT_END}
                  style={[styles.categoryButton, styles.categoryButtonActive]}>
                  <Icon
                    name={category.icon}
                    size={16}
                    color="#fff"
                  />
                  <Text style={[styles.categoryText, styles.categoryTextActive]}>
                    {category.label}
                  </Text>
                </LinearGradient>
              ) : (
                <View style={styles.categoryButton}>
                  <Icon
                    name={category.icon}
                    size={16}
                    color={PRIMARY_COLOR}
                  />
                  <Text style={styles.categoryText}>
                    {category.label}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* FAQ List */}
        <View style={styles.faqList}>
          {filteredFAQs.length > 0 ? (
            filteredFAQs.map((faq, index) => (
              <View key={faq.id}>
                <TouchableOpacity
                  style={[
                    styles.faqItemHeader,
                    expandedId === faq.id && styles.faqItemHeaderExpanded,
                  ]}
                  onPress={() => toggleExpand(faq.id)}
                  activeOpacity={0.7}>
                  <View style={styles.questionContainer}>
                    <Text style={styles.faqNumber}>{index + 1}.</Text>
                    <Text style={styles.faqQuestion}>{faq.question}</Text>
                  </View>
                  <Icon
                    name={expandedId === faq.id ? 'expand-less' : 'expand-more'}
                    size={24}
                    color={expandedId === faq.id ? PRIMARY_COLOR : '#999'}
                  />
                </TouchableOpacity>

                {expandedId === faq.id && (
                  <View style={styles.faqItemContent}>
                    <Text style={styles.faqAnswer}>{faq.answer}</Text>
                  </View>
                )}

                {index < filteredFAQs.length - 1 && <View style={styles.separator} />}
              </View>
            ))
          ) : (
            <Text style={styles.noResultsText}>No FAQs found for this category</Text>
          )}
        </View>

        {/* Contact Section */}
        <LinearGradient
          colors={['#FFFFFF', '#FFF1E4', '#FFE6D1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.contactSection}>
          <View style={styles.contactIconContainer}>
            <Icon name="help" size={28} color={PRIMARY_COLOR} />
          </View>
          <Text style={styles.contactTitle}>Still have questions?</Text>
          <Text style={styles.contactSubtitle}>
            Our support team is ready to help. Contact us anytime.
          </Text>
          <TouchableOpacity activeOpacity={0.7} onPress={onContactSupport} disabled={!onContactSupport}>
            <LinearGradient
              colors={PRIMARY_GRADIENT}
              locations={PRIMARY_GRADIENT_LOCATIONS}
              start={PRIMARY_GRADIENT_START}
              end={PRIMARY_GRADIENT_END}
              style={styles.contactButton}>
              <Icon name="email" size={18} color="#fff" />
              <Text style={styles.contactButtonText}>Contact Support</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>

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
  titleSection: {
    marginBottom: 20,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#FD8B36',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 14,
    color: '#7A4A26',
    lineHeight: 20,
  },
  categoriesContainer: {
    paddingVertical: 12,
    marginBottom: 20,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    marginRight: 8,
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
    gap: 6,
  },
  categoryButtonActive: {
    backgroundColor: PRIMARY_COLOR,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },
  categoryTextActive: {
    color: '#fff',
  },
  faqList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  faqItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    justifyContent: 'space-between',
  },
  faqItemHeaderExpanded: {
    backgroundColor: `${PRIMARY_COLOR}08`,
  },
  questionContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  faqNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY_COLOR,
    marginRight: 8,
    minWidth: 20,
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    lineHeight: 20,
  },
  faqItemContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: `${PRIMARY_COLOR}05`,
  },
  faqAnswer: {
    fontSize: 13,
    color: '#555',
    lineHeight: 20,
  },
  separator: {
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  noResultsText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 32,
  },
  contactSection: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  contactIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${PRIMARY_COLOR}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  contactSubtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  contactButton: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    gap: 8,
  },
  contactButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  bottomSpacer: {
    height: 20,
  },
});

export default FAQsScreen;
