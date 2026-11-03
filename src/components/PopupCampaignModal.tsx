import React, { useEffect, useState } from 'react';
import { Modal, View, Image, TouchableOpacity, StyleSheet, Dimensions, Linking, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { API_BASE_URL_WITH_API } from '../config/api';

const { width, height } = Dimensions.get('window');

let hasShownSessionPopup = false;

interface PopupCampaign {
  _id: string;
  imageUrl: string;
  linkUrl?: string;
}

interface Props {
  appType: 'user' | 'partner';
  city?: string;
}

const PopupCampaignModal: React.FC<Props> = ({ appType, city }) => {
  const [popups, setPopups] = useState<PopupCampaign[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    fetchPopups();
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        fetchPopups();
      }
    });
    return () => subscription.remove();
  }, [city]);

  const fetchPopups = async () => {
    if (hasShownSessionPopup) return;
    try {
      const params = new URLSearchParams({ app: appType, t: Date.now().toString() });
      if (city) params.append('city', city);

      const response = await fetch(`${API_BASE_URL_WITH_API}/settings/media/active?${params.toString()}`);
      if (!response.ok) return;

      const data = await response.json();
      if (data.success && data.data && data.data.popups && data.data.popups.length > 0) {
        const activePopups = data.data.popups;
        setPopups(activePopups);
        setCurrentIndex(0);
        setVisible(true);
        hasShownSessionPopup = true;
      } else {
        setVisible(false);
      }
    } catch (err) {
      console.log('Error fetching popups:', err);
    }
  };

  const handleClose = () => {
    if (currentIndex < popups.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setVisible(false);
    }
  };

  const handlePress = () => {
    const popup = popups[currentIndex];
    if (popup?.linkUrl) {
      Linking.openURL(popup.linkUrl).catch(() => {});
    }
    // Optionally close after press
    handleClose();
  };

  if (!visible || popups.length === 0) return null;

  const currentPopup = popups[currentIndex];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.popupContainer}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Icon name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.9} onPress={handlePress}>
            <Image
              source={{ uri: currentPopup.imageUrl }}
              style={styles.image}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupContainer: {
    width: width * 0.85,
    maxHeight: height * 0.7,
    backgroundColor: 'transparent',
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButton: {
    alignSelf: 'flex-end',
    marginBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 4,
  },
  image: {
    width: width * 0.85,
    height: width * 0.85 * 1.2, // Arbitrary aspect ratio
    borderRadius: 12,
  },
});

export default PopupCampaignModal;
