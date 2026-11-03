import { QueuedModal as Modal } from '../popup/PopupProvider';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import SafeAreaView from '../components/SafeAreaView';
import { compactTopPadding } from '../utils/responsiveLayout';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface HelpScreenProps {
  onBack?: () => void;
  onTermsPress?: () => void;
  onContactPress?: () => void;
  onReferEarn?: () => void;
  onFAQs?: () => void;
  onAboutUs?: () => void;
}

interface HelpMenuItem {
  id: string;
  icon: string;
  label: string;
  onPress: () => void;
}

const HelpScreen: React.FC<HelpScreenProps> = ({ onBack, onTermsPress, onContactPress, onReferEarn, onFAQs, onAboutUs }) => {
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [modalAnimation] = useState(new Animated.Value(0));

  const openRatingModal = () => {
    setShowRatingModal(true);
    setSelectedRating(0);
    Animated.spring(modalAnimation, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();
  };

  const closeRatingModal = () => {
    Animated.timing(modalAnimation, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowRatingModal(false);
      setSelectedRating(0);
    });
  };

  const handleStarPress = (rating: number) => {
    setSelectedRating(rating);
    console.log('Rating selected:', rating);
    // TODO: Submit rating to backend
    // After a delay, close the modal
    setTimeout(() => {
      closeRatingModal();
    }, 1000);
  };

  const menuItems: HelpMenuItem[] = [
    {
      id: 'contact',
      icon: 'contact-support',
      label: 'Contact Us',
      onPress: () => {
        console.log('Contact Us pressed');
        if (onContactPress) {
          onContactPress();
        }
      },
    },
    // {
    //   id: 'rate',
    //   icon: 'rate-review',
    //   label: 'Rate the app',
    //   onPress: openRatingModal,
    // },
    {
      id: 'faqs',
      icon: 'help-outline',
      label: 'FAQs',
      onPress: () => {
        console.log('FAQs pressed');
        if (onFAQs) {
          onFAQs();
        }
      },
    },
    {
      id: 'referEarn',
      icon: 'card-giftcard',
      label: 'Refer and Earn',
      onPress: () => {
        console.log('Refer and Earn pressed');
        if (onReferEarn) {
          onReferEarn();
        }
      },
    },
    {
      id: 'aboutUs',
      icon: 'info-outline',
      label: 'About Us',
      onPress: () => {
        console.log('About Us pressed');
        if (onAboutUs) {
          onAboutUs();
        }
      },
    },
    {
      id: 'terms',
      icon: 'description',
      label: 'Terms and Privacy Policy',
      onPress: () => {
        if (onTermsPress) {
          onTermsPress();
        }
      },
    },
  ];

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
            <Icon name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Help And Feedback</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Menu Items */}
      <View style={styles.menuContainer}>
        {menuItems.map((item, index) => (
          <React.Fragment key={item.id}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={item.onPress}
              activeOpacity={0.7}>
              <View style={styles.menuItemLeft}>
                <Icon name={item.icon} size={24} color="#333" />
                <Text style={styles.menuItemText}>{item.label}</Text>
              </View>
              <Icon name="chevron-right" size={24} color="#999" />
            </TouchableOpacity>
            {index < menuItems.length - 1 && <View style={styles.separator} />}
          </React.Fragment>
        ))}
      </View>

      {/* Rating Modal */}
      <Modal
        visible={showRatingModal}
        transparent={true}
        animationType="none"
        onRequestClose={closeRatingModal}>
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalContent,
              {
                transform: [
                  {
                    scale: modalAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ],
                opacity: modalAnimation,
              },
            ]}>
            {/* Close Button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={closeRatingModal}
              activeOpacity={0.7}>
              <Icon name="close" size={20} color="#666" />
            </TouchableOpacity>

            {/* Heading */}
            <Text style={styles.modalHeading}>
              How many stars would you give to them?
            </Text>

            {/* Sub-text */}
            <Text style={styles.modalSubtext}>
              Rate the service to help us improve your experience
            </Text>

            {/* Star Rating */}
            <View style={styles.starContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => handleStarPress(star)}
                  activeOpacity={0.7}
                  style={styles.starButton}>
                  <Icon
                    name={star <= selectedRating ? 'star' : 'star-border'}
                    size={40}
                    color="#FD8B36"
                  />
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        </View>
      </Modal>
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
    paddingHorizontal: 24,
    paddingTop: compactTopPadding(20),
    paddingBottom: 16,
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
    flex: 1,
  },
  headerSpacer: {
    width: 40,
  },
  menuContainer: {
    paddingHorizontal: 24,
    marginTop: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  separator: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginLeft: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeading: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  modalSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  starContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  starButton: {
    padding: 4,
  },
});

export default HelpScreen;
