import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import LinearGradient from './AppLinearGradient';

interface Props {
  visible: boolean;
  isOnline: boolean;
  onClose: () => void;
}

const StatusChangeModal: React.FC<Props> = ({ visible, isOnline, onClose }) => {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {isOnline ? (
            <LinearGradient
              colors={['#4CAF50', '#81C784']}
              style={styles.iconContainer}
            >
              <Text style={styles.iconText}>✓</Text>
            </LinearGradient>
          ) : (
            <LinearGradient
              colors={['#FD8B36', '#f7bb2c']}
              style={styles.iconContainer}
            >
              <Text style={styles.iconText}>✕</Text>
            </LinearGradient>
          )}
          
          <Text style={styles.title}>
            {isOnline ? 'You are Online' : 'You are Offline'}
          </Text>
          
          <Text style={styles.description}>
            {isOnline 
              ? 'Welcome back! You are now able to receive service requests and notifications from customers.'
              : 'You are now offline. You will not be able to receive new service requests or appear in search results.'}
          </Text>

          <TouchableOpacity style={styles.button} onPress={onClose} activeOpacity={0.8}>
            <LinearGradient
              colors={['#FD8B36', '#f7bb2c']}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.buttonText}>Got it</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconText: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  button: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonGradient: {
    width: '100%',
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    includeFontPadding: false,
  },
});

export default StatusChangeModal;
