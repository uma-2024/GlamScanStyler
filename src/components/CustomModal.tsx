import { QueuedModal as Modal } from '../popup/PopupProvider';
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from './AppLinearGradient';

export interface ModalButton {
  text: string;
  onPress: () => void;
  style?: 'default' | 'cancel' | 'destructive';
  loading?: boolean;
  gradient?: boolean;
}

export interface CustomModalProps {
  visible: boolean;
  title: string;
  message: string;
  type?: 'error' | 'success' | 'info' | 'warning';
  buttons?: ModalButton[];
  onClose?: () => void;
  showCloseButton?: boolean;
}

const CustomModal: React.FC<CustomModalProps> = ({
  visible,
  title,
  message,
  type = 'info',
  buttons,
  onClose,
  showCloseButton = true,
}) => {
  const insets = useSafeAreaInsets();
  // Default button if none provided
  const defaultButtons: ModalButton[] = buttons || [
    {
      text: 'OK',
      onPress: () => {
        if (onClose) {
          onClose();
        }
      },
      style: 'default',
    },
  ];

  // Get icon and colors based on type
  const getTypeStyles = () => {
    switch (type) {
      case 'error':
        return {
          icon: 'error',
          iconColor: '#F44336',
          iconBg: '#FFEBEE',
          titleColor: '#D32F2F',
        };
      case 'success':
        return {
          icon: 'check-circle',
          iconColor: '#4CAF50',
          iconBg: '#E8F5E9',
          titleColor: '#388E3C',
        };
      case 'warning':
        return {
          icon: 'warning',
          iconColor: '#FF9800',
          iconBg: '#FFF3E0',
          titleColor: '#F57C00',
        };
      case 'info':
      default:
        return {
          icon: 'info',
          iconColor: '#2196F3',
          iconBg: '#E3F2FD',
          titleColor: '#1976D2',
        };
    }
  };

  const typeStyles = getTypeStyles();

  const getButtonStyle = (buttonStyle?: 'default' | 'cancel' | 'destructive') => {
    switch (buttonStyle) {
      case 'destructive':
        return styles.buttonDestructive;
      case 'cancel':
        return styles.buttonCancel;
      default:
        return styles.buttonDefault;
    }
  };

  const getButtonTextStyle = (buttonStyle?: 'default' | 'cancel' | 'destructive') => {
    switch (buttonStyle) {
      case 'destructive':
        return styles.buttonTextDestructive;
      case 'cancel':
        return styles.buttonTextCancel;
      default:
        return styles.buttonTextDefault;
    }
  };

  const renderButtonContent = (button: ModalButton) => {
    if (button.loading) {
      return (
        <ActivityIndicator
          size="small"
          color={button.style === 'destructive' || button.gradient ? '#fff' : '#FD8B36'}
        />
      );
    }

    return <Text style={getButtonTextStyle(button.style)}>{button.text}</Text>;
  };

  const shouldUseGradient = (button: ModalButton) =>
    button.gradient ?? (button.style !== 'cancel' && button.style !== 'destructive');

  return (
    <Modal
      feedback
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}>
      <View
        style={[
          styles.overlay,
          {
            paddingTop: Math.max(insets.top + 16, 24),
            paddingBottom: Math.max(insets.bottom + 16, 24),
          },
        ]}>
        <View style={styles.modalContainer}>
          {/* Close Button */}
          {showCloseButton && onClose && (
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.7}>
              <Icon name="close" size={24} color="#666" />
            </TouchableOpacity>
          )}

          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: typeStyles.iconBg }]}>
            <Icon name={typeStyles.icon} size={48} color={typeStyles.iconColor} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: typeStyles.titleColor }]}>{title}</Text>

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* Buttons */}
          <View style={defaultButtons.length > 2 ? styles.buttonContainerVertical : styles.buttonContainer}>
            {defaultButtons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.button,
                  shouldUseGradient(button) ? styles.buttonGradientTouchable : getButtonStyle(button.style),
                  (defaultButtons.length === 1 || defaultButtons.length > 2) && styles.buttonFullWidth,
                  defaultButtons.length === 2 && styles.buttonHalfWidth,
                ]}
                onPress={button.onPress}
                disabled={button.loading}
                activeOpacity={0.7}>
                {shouldUseGradient(button) ? (
                  <LinearGradient
                    colors={['#FD8B36', '#f7bb2c']}
                    start={{ x: 0.5, y: 0.5 }}
                    end={{ x: 0.5, y: 0 }}
                    style={styles.buttonGradient}>
                    {renderButtonContent(button)}
                  </LinearGradient>
                ) : (
                  renderButtonContent(button)
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  buttonContainerVertical: {
    flexDirection: 'column',
    width: '100%',
    gap: 10,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    overflow: 'hidden',
  },
  buttonFullWidth: {
    width: '100%',
  },
  buttonHalfWidth: {
    flex: 1,
  },
  buttonDefault: {
    backgroundColor: '#FD8B36',
  },
  buttonCancel: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  buttonDestructive: {
    backgroundColor: '#F44336',
  },
  buttonGradientTouchable: {
    width: '100%',
    paddingVertical: 0,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  buttonGradient: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    minHeight: 48,
  },
  buttonTextDefault: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonTextCancel: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonTextDestructive: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default CustomModal;
