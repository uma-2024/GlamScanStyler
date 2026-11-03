import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Animated, Easing, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from './AppLinearGradient';

interface ProfileRedirectModalProps {
  visible: boolean;
  title?: string;
  message?: string;
  stepName?: string;
  icon?: string;
}

const ProfileRedirectModal: React.FC<ProfileRedirectModalProps> = ({
  visible,
  title = 'Setting Up Your Profile',
  message = 'Preparing to complete your profile details...',
  stepName,
  icon = 'person',
}) => {
  const scaleAnim = useRef(new Animated.Value(0.4)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Entrance bounce
      scaleAnim.setValue(0.4);
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      }).start();

      // Continuous subtle pulse
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      pulseLoop.start();

      // Subtle rotation for loader
      const rotateLoop = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      rotateLoop.start();

      return () => {
        pulseLoop.stop();
        rotateLoop.stop();
      };
    }
  }, [visible, scaleAnim, pulseAnim, rotateAnim]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Animated Done / Check Icon with Glowing Ring */}
          <View style={styles.iconOuterRing}>
            <Animated.View
              style={[
                styles.iconGlow,
                {
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            >
              <LinearGradient
                colors={['#FD8B36', '#f7bb2c']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconGradient}
              >
                <Icon name={icon} size={36} color="#FFFFFF" />
              </LinearGradient>
            </Animated.View>
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Subtitle / Description */}
          <Text style={styles.message}>{message}</Text>

          {stepName ? (
            <View style={styles.stepPill}>
              <Icon name="arrow-forward" size={14} color="#D86815" />
              <Text style={styles.stepPillText}>Next: {stepName}</Text>
            </View>
          ) : null}

          {/* Spinner & Progress Indicator */}
          <View style={styles.spinnerRow}>
            <ActivityIndicator size="small" color="#FD8B36" />
            <Text style={styles.spinnerText}>Opening in a moment...</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default React.memo(ProfileRedirectModal);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(20, 14, 10, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    zIndex: 9999,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 26,
    paddingTop: 32,
    paddingBottom: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 14,
    borderWidth: 1,
    borderColor: 'rgba(253, 139, 54, 0.15)',
  },
  iconOuterRing: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: 'rgba(253, 139, 54, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconGlow: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconGradient: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FD8B36',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2F2118',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: '#7A6253',
    textAlign: 'center',
    marginBottom: 16,
  },
  stepPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(253, 139, 54, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(253, 139, 54, 0.2)',
  },
  stepPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D86815',
  },
  spinnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  spinnerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9C8170',
  },
});
