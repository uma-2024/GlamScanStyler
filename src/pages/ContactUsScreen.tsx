import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import SafeAreaView from '../components/SafeAreaView';
import { compactTopPadding } from '../utils/responsiveLayout';
import LinearGradient from '../components/AppLinearGradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { PARTNER_CONTACT } from '../constants/legalContent';

interface ContactUsScreenProps {
  onBack?: () => void;
}

const PRIMARY_COLOR = '#FD8B36';

const contactDetails = [
  {
    id: 'phone',
    icon: 'call',
    title: 'Phone Support',
    value: PARTNER_CONTACT.phonePrimary,
    detail: 'Daily · 09:00 - 21:00 IST',
  },
  {
    id: 'whatsapp',
    icon: 'chat',
    title: 'WhatsApp Support',
    value: PARTNER_CONTACT.phonePrimary,
    detail: 'Live support 09:00 - 21:00 IST',
  },
  {
    id: 'email',
    icon: 'email',
    title: 'Email Support',
    value: PARTNER_CONTACT.emailPrimary,
    detail: 'Replies within 6 hours',
  },
  {
    id: 'email-secondary',
    icon: 'alternate-email',
    title: 'Alternate Email',
    value: PARTNER_CONTACT.emailSecondary,
    detail: 'Use for ongoing support threads',
  },
  {
    id: 'office',
    icon: 'location-on',
    title: 'Head Office',
    value: PARTNER_CONTACT.address,
    detail: 'Visits by appointment only',
  },
];

const quickHighlights = [
  {
    label: 'Response guarantee',
    description: 'Phone & WhatsApp replies in under 1 hour, email within 6 hours.',
  },
  {
    label: 'Dedicated case owner',
    description: 'Every inquiry gets tracked, so you always know what stage it is in.',
  },
  {
    label: 'Resource library',
    description: 'Access how-to guides, payout FAQs, and onboarding checklists.',
  },
];

const quickActions = [
  'Report a technical issue',
  'Request a callback',
  'Share feedback or feature ideas',
];

const ContactUsScreen: React.FC<ContactUsScreenProps> = ({ onBack }) => {
  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
            <Icon name="arrow-back" size={22} color={PRIMARY_COLOR} />
          </TouchableOpacity>
        )}
        <Text pointerEvents="none" style={styles.headerTitle}>Contact Us</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.sectionTitle}>Need assistance?</Text>
              <Text style={styles.sectionSubtitle}>
                Our team is available every day to help you run your Glammefy Partner business with confidence.
              </Text>
            </View>
            <LinearGradient
              colors={['#FD8B36', '#f7bb2c']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroIconWrap}
            >
              <Icon name="support-agent" size={26} color="#fff" />
            </LinearGradient>
          </View>

          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaChip}>
              <Icon name="schedule" size={15} color={PRIMARY_COLOR} />
              <Text style={styles.heroMetaText}>Daily support</Text>
            </View>
            <View style={styles.heroMetaChip}>
              <Icon name="bolt" size={15} color={PRIMARY_COLOR} />
              <Text style={styles.heroMetaText}>Fast replies</Text>
            </View>
          </View>
        </View>

        <View style={styles.contactList}>
          {contactDetails.map((item) => (
            <TouchableOpacity key={item.id} style={styles.contactCard} activeOpacity={0.8}>
              <View style={styles.contactIconContainer}>
                <Icon name={item.icon} size={24} color={PRIMARY_COLOR} />
              </View>
              <View style={styles.contactText}>
                <Text style={styles.contactTitle}>{item.title}</Text>
                <Text style={styles.contactValue}>{item.value}</Text>
                <Text style={styles.contactDetail}>{item.detail}</Text>
              </View>
              <Icon name="arrow-forward-ios" size={16} color="#C79A78" />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeading}>More ways we help</Text>
          {quickHighlights.map((item) => (
            <View key={item.label} style={styles.highlightRow}>
              <Icon name="check-circle" size={20} color="#2F855A" style={styles.highlightIcon} />
              <View style={styles.highlightText}>
                <Text style={styles.highlightLabel}>{item.label}</Text>
                <Text style={styles.highlightDescription}>{item.description}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.sectionBlock}> 
          <Text style={styles.sectionHeading}>Still need more?</Text>
          {quickActions.map((action) => (
            <View key={action} style={styles.actionRow}>
              <Text style={styles.actionText}>{action}</Text>
              <Icon name="arrow-forward-ios" size={18} color={PRIMARY_COLOR} />
            </View>
          ))}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: compactTopPadding(4),
    paddingBottom: 12,
    minHeight: 56,
    marginBottom: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    // elevation: 2,
    position: 'absolute',
    left: 24,
    zIndex: 2,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: "#000",
   
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 36,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 12,
  },
  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
    // width: '100%',
    
    // borderWidth: 1,
    // borderColor: '#F5DECB',
    // shadowColor: '#000',
    // shadowOpacity: 0.04,
    // shadowRadius: 12,
    // elevation: 3,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    //  backgroundColor:'blue',
     width:'75%'
    // maxWidth:'100%'
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroMetaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    flexWrap: 'wrap',
   
  },
  heroMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF4EA',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroMetaText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#7A5A43',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: '#171717',
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6E5C50',
    lineHeight: 20,
    maxWidth: 250,
  },
  contactList: {
    marginBottom: 24,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#fff',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F2E1D3',
    shadowColor: '#000',
    shadowOpacity: 0.035,
    shadowRadius: 10,
    elevation: 2,
  },
  contactIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FEEDD8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  contactText: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1C',
  },
  contactValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#503C2E',
    marginTop: 3,
  },
  contactDetail: {
    fontSize: 12,
    color: '#8B7567',
    marginTop: 4,
  },
  sectionBlock: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#fff',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F2E1D3',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E1E1E',
    marginBottom: 14,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  highlightIcon: {
    marginTop: 2,
    marginRight: 10,
  },
  highlightText: {
    flex: 1,
  },
  highlightLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2B2B2B',
  },
  highlightDescription: {
    fontSize: 12,
    color: '#7A6A60',
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  actionText: {
    fontSize: 14,
    color: '#2D2D2D',
    fontWeight: '600',
  },
});

export default ContactUsScreen;
