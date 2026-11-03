import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface GlamLoaderProps {
  title?: string;
  subtitle?: string;
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
}

export const GlamLoader: React.FC<GlamLoaderProps> = ({
  title = 'Setting up your workspace...',
  subtitle = 'Saving your preferences & redirecting',
  size = 'medium',
  style,
}) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 360 Continuous Rotation for outer sparkle ring
    const rotateLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // Subtle gentle breathing pulse
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    // Shimmer effect across subtitle
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ])
    );

    // Floating text dot animation
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -4,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    rotateLoop.start();
    pulseLoop.start();
    shimmerLoop.start();
    floatLoop.start();

    return () => {
      rotateLoop.stop();
      pulseLoop.stop();
      shimmerLoop.stop();
      floatLoop.stop();
    };
  }, [rotateAnim, pulseAnim, shimmerAnim, floatAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.6, 1, 0.6],
  });

  const isSmall = size === 'small';
  const iconWrapSize = isSmall ? 48 : 64;

  return (
    <View style={[styles.container, isSmall && styles.containerSmall, style]}>
      {/* Animated Glowing Ring & Icon */}
      <View style={{ width: iconWrapSize + 16, height: iconWrapSize + 16, alignItems: 'center', justifyContent: 'center' }}>
        {/* Outer Rotating Glow Ring */}
        <Animated.View
          style={[
            styles.glowRing,
            {
              width: iconWrapSize + 12,
              height: iconWrapSize + 12,
              borderRadius: (iconWrapSize + 12) / 2,
              transform: [{ rotate: spin }],
            },
          ]}
        >
          <LinearGradient
            colors={['#FD8B36', '#F7BB2C', 'transparent', '#FD8B36']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Center Pulsing Orb with Icon */}
        <Animated.View
          style={[
            styles.centerOrb,
            {
              width: iconWrapSize,
              height: iconWrapSize,
              borderRadius: iconWrapSize / 2,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={['#FD8B36', '#F78426']}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={styles.orbGradient}
          >
            <Icon name="auto-awesome" size={isSmall ? 22 : 30} color="#FFFFFF" />
          </LinearGradient>
        </Animated.View>
      </View>

      {/* Interactive Title & Subtitle */}
      {title ? (
        <Animated.View style={[styles.textBlock, { transform: [{ translateY: floatAnim }] }]}>
          <Text style={styles.titleText}>{title}</Text>
          {subtitle ? (
            <Animated.Text style={[styles.subtitleText, { opacity: shimmerOpacity }]}>
              {subtitle}
            </Animated.Text>
          ) : null}
        </Animated.View>
      ) : null}

      {/* Elegant Dot Wave Indicator */}
      <View style={styles.dotsRow}>
        <View style={[styles.dot, styles.dotActive]} />
        <View style={[styles.dot, styles.dotMiddle]} />
        <View style={styles.dot} />
      </View>
    </View>
  );
};

interface GlamEmptyStateProps {
  icon?: string;
  title: string;
  subtitle: string;
  actionText?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export const GlamEmptyState: React.FC<GlamEmptyStateProps> = ({
  icon = 'search-off',
  title,
  subtitle,
  actionText,
  onAction,
  style,
}) => {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1400,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const scale = pulseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.04, 1],
  });

  return (
    <View style={[styles.emptyContainer, style]}>
      {/* Icon with Soft Background Rings */}
      <Animated.View style={[styles.emptyIconCircle, { transform: [{ scale }] }]}>
        <LinearGradient
          colors={['#FFF5EB', '#FFE6D1']}
          style={styles.emptyIconGradient}
        >
          <View style={styles.emptyIconInner}>
            <Icon name={icon} size={32} color="#FD8B36" />
          </View>
        </LinearGradient>
      </Animated.View>

      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>

      {actionText && onAction ? (
        <Animated.View style={styles.actionBtnWrap}>
          <LinearGradient
            colors={['#FD8B36', '#F7BB2C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.actionGradient}
          >
            <Text onPress={onAction} style={styles.actionText}>
              {actionText}
            </Text>
          </LinearGradient>
        </Animated.View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#F3E5D8',
    shadowColor: '#FD8B36',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    marginVertical: 10,
  },
  containerSmall: {
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  glowRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#FD8B36',
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  centerOrb: {
    backgroundColor: '#FD8B36',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FD8B36',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
    overflow: 'hidden',
  },
  orbGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textBlock: {
    marginTop: 16,
    alignItems: 'center',
  },
  titleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#241D17',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  subtitleText: {
    fontSize: 13,
    color: '#8D7B6D',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '500',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F3C59D',
  },
  dotMiddle: {
    backgroundColor: '#FD8B36',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: '#E66F17',
  },
  // Empty State Styles
  emptyContainer: {
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#F3E5D8',
    shadowColor: '#FD8B36',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginVertical: 12,
  },
  emptyIconCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyIconGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 37,
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIconInner: {
    width: '100%',
    height: '100%',
    borderRadius: 31,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FD8B36',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#291F18',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: '#8A7768',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  actionBtnWrap: {
    marginTop: 18,
    borderRadius: 14,
    overflow: 'hidden',
  },
  actionGradient: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
