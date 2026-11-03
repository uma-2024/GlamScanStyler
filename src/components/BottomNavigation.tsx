import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Icons from 'react-native-vector-icons/FontAwesome5';
import LinearGradient from './AppLinearGradient';

interface BottomNavigationProps {
  activeTab: 'home' | 'bookings' | 'alerts' | 'account';
  onTabChange: (tab: 'home' | 'bookings' | 'alerts' | 'account') => void;
  userId?: string;
}

import { useUnreadNotifications } from '../hooks/useUnreadNotifications';

const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onTabChange,
  userId,
}) => {
  const insets = useSafeAreaInsets();
  const hasUnread = useUnreadNotifications(userId, activeTab);

  // Get screen width to apply responsive styles
  const { width } = Dimensions.get('window');

  const isSmallScreen = width <= 390;
  const isLargeScreen = width >= 430;
  const bottomSpacing = isLargeScreen
    ? Math.max(insets.bottom + 6, 24)
    : Math.max(insets.bottom, 8);
  const navWidth = Math.min(width - (isSmallScreen ? 24 : 32), 430);
  const iconSize = isSmallScreen ? 20 : 24;
  const fontSize = isSmallScreen ? 12 : 13;
  const accountIconSize = iconSize + 2;
  const navHeight = isLargeScreen ? 82 : 76;

  return (
    <View style={[styles.bottomNavContainer, { paddingBottom: bottomSpacing }]}>
      <LinearGradient
        colors={['#FD8B36', '#f7bb2c']}
        locations={[0, 0.7]}
        start={{ x: 0.5, y: 0.5 }}
        end={{ x: 0.5, y: 0 }}
        style={[
          styles.bottomNav,
          {
            width: navWidth,
            height: navHeight,
            paddingVertical: isLargeScreen ? 9 : 8,
          },
        ]}>
        <TouchableOpacity
          style={[styles.navItem, isLargeScreen && styles.navItemLarge]}
          onPress={() => onTabChange('home')}
          activeOpacity={0.7}>
          <View style={styles.navContent}>
            <Icon
              name="home"
              size={iconSize}
              color={activeTab === 'home' ? '#fff' : 'rgba(255,255,255,0.85)'}
            />
            <Text
              style={[
                styles.navLabel,
                isLargeScreen && styles.navLabelLarge,
                { fontSize },
                activeTab === 'home' && styles.activeNavLabel,
              ]}>
              Home
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, isLargeScreen && styles.navItemLarge]}
          onPress={() => onTabChange('bookings')}
          activeOpacity={0.7}>
          <View style={styles.navContent}>
            <Icons
              name="calendar-alt"
              size={iconSize}
              color={activeTab === 'bookings' ? '#fff' : 'rgba(255,255,255,0.85)'}
            />
            <Text
              style={[
                styles.navLabel,
                isLargeScreen && styles.navLabelLarge,
                { fontSize },
                activeTab === 'bookings' && styles.activeNavLabel,
              ]}>
              Bookings
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, isLargeScreen && styles.navItemLarge]}
          onPress={() => onTabChange('alerts')}
          activeOpacity={0.7}>
          <View style={styles.navContent}>
            <View>
              <Icon
                name="notifications"
                size={iconSize}
                color={activeTab === 'alerts' ? '#fff' : 'rgba(255,255,255,0.85)'}
              />
              {hasUnread && (
                <View style={styles.redDot} />
              )}
            </View>
            <Text
              style={[
                styles.navLabel,
                isLargeScreen && styles.navLabelLarge,
                { fontSize },
                activeTab === 'alerts' && styles.activeNavLabel,
              ]}>
              Alerts
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, isLargeScreen && styles.navItemLarge]}
          onPress={() => onTabChange('account')}
          activeOpacity={0.7}>
          <View style={styles.navContent}>
            <Icon
              name="account-circle"
              size={accountIconSize}
              color={activeTab === 'account' ? '#fff' : 'rgba(255,255,255,0.85)'}
            />
            <Text
              style={[
                styles.navLabel,
                isLargeScreen && styles.navLabelLarge,
                { fontSize },
                activeTab === 'account' && styles.activeNavLabel,
              ]}>
              Account
            </Text>
          </View>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  bottomNavContainer: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingTop: 10,
  },
  bottomNav: {
    borderRadius: 38,
    overflow: 'hidden',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 0,
    height: '100%',
  },
  navItemLarge: {
    paddingVertical: 0,
  },
  navContent: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  navLabel: {
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
    fontWeight: '500',
    lineHeight: 16,
    textAlign: 'center',
  },
  navLabelLarge: {
    marginTop: 5,
  },
  activeNavLabel: {
    color: '#fff',
    fontWeight: '700',
  },
  redDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FD8B36',
  },
});

export default BottomNavigation;
