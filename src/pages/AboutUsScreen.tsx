import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import SafeAreaView from '../components/SafeAreaView';
import { compactTopPadding } from '../utils/responsiveLayout';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface AboutUsScreenProps {
  onBack: () => void;
}

const AboutUsScreen: React.FC<AboutUsScreenProps> = ({ onBack }) => {
  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About Us</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Glammefy Partner — Grow Your Beauty Business</Text>
        <Text style={styles.paragraph}>
          Glammefy Partner is a professional business and booking management platform designed to help beauty professionals grow their client base, manage bookings, showcase their work, and build stronger relationships with their customers.
        </Text>
        <Text style={styles.paragraph}>
          Whether you are an independent professional, freelancer, studio professional, or part of a larger beauty business, Glammefy Partner gives you the tools to manage your services and connect with clients looking for your expertise.
        </Text>
        
        <Text style={styles.subtitle}>Grow Your Client Base</Text>
        <Text style={styles.paragraph}>
          Get discovered by customers actively searching for beauty professionals based on their preferred service, desired look, location, availability, and budget.
        </Text>
        <Text style={styles.paragraph}>
          Showcase your expertise through a professional portfolio and let potential clients discover the quality of your work before making a booking.
        </Text>

        <Text style={styles.subtitle}>Manage Your Business</Text>
        <View style={styles.bulletList}>
          <Text style={styles.bulletItem}>• Receive and manage new booking requests</Text>
          <Text style={styles.bulletItem}>• Manage your availability and schedule</Text>
          <Text style={styles.bulletItem}>• Showcase your services, pricing, and portfolio</Text>
          <Text style={styles.bulletItem}>• Keep track of upcoming and completed appointments</Text>
          <Text style={styles.bulletItem}>• Manage customer information and booking history</Text>
          <Text style={styles.bulletItem}>• Communicate with clients through the platform</Text>
          <Text style={styles.bulletItem}>• Build repeat business through client engagement tools</Text>
          <Text style={styles.bulletItem}>• Track your performance and business activity</Text>
          <Text style={styles.bulletItem}>• Manage your professional profile and presence on Glammefy</Text>
        </View>

        <Text style={styles.subtitle}>Turn Your Expertise Into More Business</Text>
        <Text style={styles.paragraph}>
          Glammefy connects your expertise with customers who are already looking for the services you offer. Instead of relying only on walk-ins, referrals, or social media, you can build an additional digital channel for discovering and acquiring new clients.
        </Text>
        <Text style={styles.paragraph}>
          The more complete your profile, portfolio, availability, and services are, the easier it becomes for the right customers to find and book you.
        </Text>

        <Text style={styles.subtitle}>Built for Professional Growth</Text>
        <Text style={styles.paragraph}>
          Glammefy Partner is designed to go beyond appointment management. It brings client acquisition, booking management, portfolio presentation, customer engagement, and business insights together in one professional platform.
        </Text>
        <Text style={styles.highlight}>
          Get discovered. Get booked. Grow your business with Glammefy.
        </Text>
      </ScrollView>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:'space-between',
    paddingHorizontal: 24,
    paddingTop: compactTopPadding(20),
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: '#333',
  
  },
  headerSpacer: {
    width: 40,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 18,
    fontWeight: '500',
    color: '#2F2118',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2F2118',
    marginTop: 24,
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    color: '#555',
    marginBottom: 16,
  },
  bulletList: {
    marginBottom: 16,
    paddingLeft: 8,
  },
  bulletItem: {
    fontSize: 15,
    lineHeight: 24,
    color: '#555',
    marginBottom: 8,
  },
  highlight: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FD8B36',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  }
});

export default AboutUsScreen;
