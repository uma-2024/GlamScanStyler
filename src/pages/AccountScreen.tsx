import { QueuedModal as Modal } from '../popup/PopupProvider';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  StatusBar,
} from 'react-native';
import SafeAreaView from '../components/SafeAreaView';
import { compactTopPadding } from '../utils/responsiveLayout';
import Icon from 'react-native-vector-icons/MaterialIcons';
import CustomModal from '../components/CustomModal';
import LevelAnalyticsModal from '../components/LevelAnalyticsModal';
import { useModal } from '../hooks/useModal';
import LinearGradient from '../components/AppLinearGradient';
import { API_BASE_URL_WITH_API } from '../config/api';
import { useQuery } from '@tanstack/react-query';
import {
  accountQueryKeys,
  EarningsPeriod,
  fetchCurrentSubscription,
  fetchStylistEarnings,
  fetchStylistLevel,
  fetchStylistProfile,
  fetchStylistSpecialServices,
  StylistAccountProfile,
  StylistEarnings,
  StylistLevel,
} from '../services/stylistAccountApi';

interface AccountScreenProps {
  userId?: string;
  onBack?: () => void;
  onSignIn?: () => void;
  onLogout?: () => void;
  onEditProfile?: () => void;
  onPayments?: () => void;
  onMyAccount?: () => void;
  onWallet?: () => void;
  onSubscription?: () => void;
  onAds?: () => void;
  onCurrentBooking?: () => void;
  onHistory?: () => void;
  onHelp?: () => void;
  onMyService?: () => void;
  onSpecialService?: () => void;
  onLocation?: () => void;
  onMySlots?: () => void;
  onAccountSettings?: () => void;
  onNotifications?: () => void;
  onPaymentDetails?: () => void;
}

interface MenuItem {
  id: string;
  icon: string;
  label: string;
  onPress: () => void;
}

const BADGE_META: Record<number, { icon: string; color: string; requirement: string; description: string; performance: { successScore: string; clientRating: string; responseRate: string; serviceCount: string; uniqueClients: string; earnings: string } }> = {
  1: {
    icon: 'military-tech',
    color: '#CD7F32',
    requirement: 'Starting Level',
    description: 'Welcome to Glammefy! You have started your stylist journey.',
    performance: {
      successScore: '5/10',
      clientRating: '4.3',
      responseRate: '70%',
      serviceCount: '15',
      uniqueClients: '5',
      earnings: '₹40,000 - ₹60,000',
    },
  },
  2: {
    icon: 'verified',
    color: '#5C8FA8',
    requirement: '5 services with 5-star rating',
    description: 'Complete 5 services successfully with 5-star ratings to unlock this badge.',
    performance: {
      successScore: '7/10',
      clientRating: '4.6',
      responseRate: '80%',
      serviceCount: '25',
      uniqueClients: '10',
      earnings: '₹70,000 - ₹90,000',
    },
  },
  3: {
    icon: 'workspace-premium',
    color: '#F4B400',
    requirement: '20 services with 5-star rating',
    description: 'Complete 20 services successfully with 5-star ratings to unlock this badge.',
    performance: {
      successScore: '9/10',
      clientRating: '4.8',
      responseRate: '90%',
      serviceCount: '35',
      uniqueClients: '15',
      earnings: '₹100,000 - ₹150,000',
    },
  },
};

const PRIMARY_COLOR = '#FD8B36';
const BACKGROUND_COLOR = '#FFF3E8';
const SAFE_AREA_TOP_PADDING = Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0;

const EMPTY_EARNINGS: StylistEarnings = {
  toBePaidOut: 0,
  unreconciledServices: 0,
  alreadyPaidByUser: 0,
  paidOut: 0,
  heldForReview: 0,
  totalEarnings: 0,
  totalServices: 0,
  monthEarning: 0,
};

const EMPTY_LEVEL: StylistLevel = {
  level: 0,
  completedServicesWith5Star: 0,
  totalCompletedServices: 0,
  totalUniqueClients: 0,
  totalEarnings: 0,
  successScore: 0,
  clientRating: 0,
  responseRate: 0,
  nextTargetLevel: 1,
  nextLevelRequirement: 6,
  progressToNextLevel: 0,
  progressPercentage: 0,
  criteriaMetCount: 0,
  totalCriteriaCount: 6,
  isMaxLevel: false,
};

const AccountScreen: React.FC<AccountScreenProps> = ({ userId, onBack, onSignIn, onLogout, onEditProfile,
  onPayments, onPaymentDetails, onMyAccount, onWallet, onSubscription, onAds, onCurrentBooking, onHistory, onHelp, onMyService, onSpecialService, onLocation, onMySlots, onAccountSettings, onNotifications }) => {
  const [earningsPeriod, setEarningsPeriod] = useState<EarningsPeriod>('allTime');
  const [showImageModal, setShowImageModal] = useState(false);
  const [showEarningsDropdown, setShowEarningsDropdown] = useState(false);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const modal = useModal();
  const hasUserId = Boolean(userId);

  const profileQuery = useQuery({
    queryKey: accountQueryKeys.profile(userId),
    queryFn: () => fetchStylistProfile(userId as string),
    enabled: hasUserId,
    staleTime: 5 * 60 * 1000,
  });

  const earningsQuery = useQuery({
    queryKey: accountQueryKeys.earnings(userId, earningsPeriod),
    queryFn: () => fetchStylistEarnings(userId as string, earningsPeriod),
    enabled: hasUserId,
    staleTime: earningsPeriod === 'today' ? 60 * 1000 : 5 * 60 * 1000,
  });

  const levelQuery = useQuery({
    queryKey: accountQueryKeys.level(userId),
    queryFn: () => fetchStylistLevel(userId as string),
    enabled: hasUserId,
    staleTime: 5 * 60 * 1000,
  });

  const specialServicesQuery = useQuery({
    queryKey: accountQueryKeys.specialServices(userId),
    queryFn: () => fetchStylistSpecialServices(userId as string),
    enabled: hasUserId,
    staleTime: 10 * 60 * 1000,
  });

  const subscriptionQuery = useQuery({
    queryKey: accountQueryKeys.subscription(userId),
    queryFn: () => fetchCurrentSubscription(userId as string),
    enabled: hasUserId,
    staleTime: 5 * 60 * 1000,
  });

  const userProfile: StylistAccountProfile | null = profileQuery.data || null;
  const earningsData = earningsQuery.data || EMPTY_EARNINGS;
  const levelData = levelQuery.data || EMPTY_LEVEL;
  const specialServices = specialServicesQuery.data || [];
  const currentPlanBadgeImage = subscriptionQuery.data?.badgeImage || null;

  const getBadgeProgressForLevel = (targetLevel: number) => {
    if (levelData.level >= targetLevel) {
      return {
        percentage: 100,
        label: 'Unlocked',
      };
    }

    if (levelData.nextTargetLevel === targetLevel) {
      return {
        percentage: levelData.progressPercentage,
        label: `${levelData.progressToNextLevel}/${levelData.nextLevelRequirement}`,
      };
    }

    return {
      percentage: 0,
      label: 'Locked',
    };
  };

  const handleLogout = () => {
    modal.showConfirm(
      'Logout',
      'Are you sure you want to logout?',
      () => {
        if (onLogout) {
          onLogout();
        }
      },
      undefined,
      'Logout',
      'Cancel',
      true
    );
  };



  const menuItems: MenuItem[] = [
    {
      id: 'notifications',
      icon: 'notifications-none',
      label: 'Notifications',
      onPress: () => {
        if (onNotifications) {
          onNotifications();
        }
      },
    },
    {
      id: 'currentBooking',
      icon: 'event',
      label: 'Current Bookings',
      onPress: () => {
        console.log('Current Booking pressed');
        if (onCurrentBooking) {
          onCurrentBooking();
        }
      },
    },
    {
      id: 'history',
      icon: 'history',
      label: 'History',
      onPress: () => {
        console.log('History pressed');
        if (onHistory) {
          onHistory();
        }
      },
    },
    {
      id: 'payments',
      icon: 'payment',
      label: 'Payments',
      onPress: () => {
        if (onPayments) onPayments();
      },
    },
    {
      id: 'bankDetails',
      icon: 'account-balance',
      label: 'Bank & UPI Details',
      onPress: () => {
        if (onPaymentDetails) {
          onPaymentDetails();
        } else {
          console.log('Bank & UPI Details pressed');
        }
      },
    },
    {
      id: 'myAccount',
      icon: 'person-outline',
      label: 'Portfolio',
      onPress: () => {
        if (onMyAccount) {
          onMyAccount();
        } else {
          console.log('Portfolio pressed');
        }
      },
    },
    {
      id: 'myWallet',
      icon: 'account-balance-wallet',
      label: 'My Glam Wallet',
      onPress: () => {
        if (onWallet) {
          onWallet();
        } else {
          console.log('My Wallet pressed');
        }
      },
    },
    {
      id: 'subscription',
      icon: 'workspace-premium',
      label: 'Upgrade Plan',
      onPress: () => {
        if (onSubscription) {
          onSubscription();
        } else {
          console.log('Subscription pressed');
        }
      },
    },
    {
      id: 'ads',
      icon: 'campaign',
      label: 'Ads & Promotions',
      onPress: () => {
        if (onAds) {
          onAds();
        } else {
          modal.showAlert('Ads', 'Ads feature coming soon', 'info');
        }
      },
    },
    // {
    //   id: 'referAndEarn',
    //   icon: 'loop',
    //   label: 'Refer and Earn',
    //   onPress: () => console.log('Refer and Earn pressed'),
    // },
    {
      id: 'help',
      icon: 'help-outline',
      label: 'Help',
      onPress: () => {
        console.log('Help pressed');
        if (onHelp) {
          onHelp();
        }
      },
    },
    {
      id: 'location',
      icon: 'place',
      label: 'Location',
      onPress: () => {
        console.log('Location pressed');
        if (onLocation) {
          onLocation();
        }
      },
    },
    {
      id: 'myService',
      icon: 'list',
      label: 'My Services',
      onPress: () => {
        console.log('My service pressed');
        if (onMyService) {
          onMyService();
        }
      },
    },
    {
      id: 'mySlots',
      icon: 'schedule',
      label: 'My Slots',
      onPress: () => {
        console.log('My Slots pressed');
        if (onMySlots) {
          onMySlots();
        }
      },
    },
    {
      id: 'accountSettings',
      icon: 'settings',
      label: 'Account Settings',
      onPress: () => {
        if (onAccountSettings) {
          onAccountSettings();
        }
      },
    },
  ];

  // Format earnings for display
  const formatEarnings = (amount?: number | null): string => {
    return `₹${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  };

  const formatEarningsShort = (amount?: number | null): string => {
    const value = Number(amount || 0);
    if (value >= 100000) {
      return `₹${(value / 100000).toFixed(1)}L`;
    } else if (value >= 1000) {
      return `₹${(value / 1000).toFixed(1)}K`;
    }
    return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  const periodOptions = [
    { value: 'allTime', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'lastWeek', label: 'Last Week' },
    { value: 'lastMonth', label: 'Last Month' },
    { value: 'last6Months', label: 'Last 6 Months' },
    { value: 'lastYear', label: 'Last Year' },
  ];

  const getPeriodLabel = (value: string): string => {
    const option = periodOptions.find(opt => opt.value === value);
    return option ? option.label : 'All Time';
  };

  if (!hasUserId) {
    return (
      <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
        <View style={styles.header}>
          {onBack && (
            <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
              <Icon name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>Your Profile</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.guestContainer}>
          <View style={styles.profileSection}>
            <View style={styles.profileImagePlaceholder}>
              <Icon name="person" size={40} color={PRIMARY_COLOR} />
            </View>
            <Text style={styles.userName}>Guest</Text>
            <Text style={styles.phoneNumber}>Please sign in to view your profile</Text>
          </View>

          <View style={styles.guestCard}>
            <Text style={styles.guestCardTitle}>Sign in to access</Text>
            <Text style={styles.guestCardText}>
              Your bookings, earnings, badges, services, slots, and account settings will appear here after login.
            </Text>

            <TouchableOpacity
              style={styles.guestCtaButton}
              onPress={onSignIn}
              activeOpacity={0.8}>
              <LinearGradient
                colors={['#FD8B36', '#f7bb2c']}
                locations={[0, 0.7]}
                start={{ x: 0.5, y: 0.5 }}
                end={{ x: 0.5, y: 0 }}
                style={styles.guestCtaGradient}>
                <Text style={styles.guestCtaText}>Sign In</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
            <Icon name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
        )}
        {/* <Text style={{ textAlign: 'center', paddingTop: 8 }}>
  Safe area top: {SAFE_AREA_TOP_PADDING}
</Text> */}

        <Text style={styles.headerTitle}>Your Profile</Text>
        <TouchableOpacity
          onPress={() => {
            console.log('Edit button pressed');
            if (onEditProfile) {
              onEditProfile();
            } else {
              console.error('onEditProfile is not defined');
              modal.showAlert('Error', 'Edit profile function is not available', 'error');
            }
          }}
          activeOpacity={0.7}>
          <LinearGradient
            colors={['#FD8B36', '#f7bb2c']}
            locations={[0, 0.7]}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 0.5, y: 0 }}
            style={styles.editButton}>
            <Icon name="edit" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <TouchableOpacity
            style={styles.profileImageContainer}
            onPress={() => {
              if (userProfile?.profileImage) {
                setShowImageModal(true);
              }
            }}
            activeOpacity={userProfile?.profileImage ? 0.7 : 1}>
            {userProfile?.profileImage ? (
              <Image
                source={{ uri: userProfile.profileImage }}
                style={styles.profileImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <Icon name="person" size={40} color={PRIMARY_COLOR} />
              </View>
            )}
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={styles.userName}>
              {!userId ? 'Guest' : (userProfile?.name || 'User Name')}
            </Text>

            {currentPlanBadgeImage && (
              <Image
                source={{ uri: currentPlanBadgeImage }}
                style={styles.profileBadgeImage}
                resizeMode="contain"
              />
            )}
          </View>
          <Text style={styles.phoneNumber}>
            {!userId ? 'Please sign in to view details' : (userProfile?.email || '')}
          </Text>
          <View style={styles.profileInfoBlock}>
            <View style={styles.serviceToastsWrap}>
              {(specialServices.length > 0 ? specialServices : ['Expert']).slice(0, 4).map((service, index) => (
                <View
                  key={`${service}-${index}`}
                  style={styles.serviceToastChip}>
                  <Text style={styles.serviceToastText}>{service}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Language Tags */}
          {/* <View style={styles.languageTags}>
              {languages.map((lang, index) => (
                <View key={index} style={styles.languageTag}>
                  <Text style={styles.languageTagText}>{lang}</Text>
                </View>
              ))}
            </View> */}
        </View>

        {/* Earning & Service Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Earning & Service</Text>
            <TouchableOpacity
              style={styles.dropdownButton}
              activeOpacity={0.7}
              onPress={() => setShowEarningsDropdown(true)}>
              <Text style={styles.dropdownText}>{getPeriodLabel(earningsPeriod)}</Text>
              <Icon name="arrow-drop-down" size={20} color="#666" />
            </TouchableOpacity>
          </View>
          {earningsData.unreconciledServices > 0 && (
            <Text style={styles.statLabel}>{earningsData.unreconciledServices} completed services await payment verification and are excluded below.</Text>
          )}
          <Text style={styles.statLabel}>Total earnings</Text>
          <Text style={styles.totalEarnings}>{formatEarnings(earningsData.totalEarnings)}</Text>



          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Total service</Text>
              <Text style={styles.statValue}>{earningsData.totalServices}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Month Earning</Text>
              <Text style={styles.statValue}>{formatEarningsShort(earningsData.monthEarning)}</Text>
            </View>
          </View>
        </View>

        {/* Badges Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Badges</Text>
          </View>
          <>
            <View style={styles.badgesRow}>
              {/* Level 1 Badge */}
              {(() => {
                const progress = getBadgeProgressForLevel(1);
                return (
                  <TouchableOpacity
                    style={[
                      styles.badgeCard,
                      levelData.level >= 1 ? styles.badgeCardUnlocked : styles.badgeCardLocked,
                      levelData.level === 1 && styles.badgeCardActive
                    ]}
                    onPress={() => {
                      setShowBadgeModal(true);
                    }}
                    activeOpacity={0.7}>
                    <View
                      style={[
                        styles.badgeAccent,
                        levelData.level >= 1 ? styles.badgeAccentBronze : styles.badgeAccentLocked,
                      ]}
                    />
                    {levelData.level >= 1 ? (
                      <View style={styles.badgeIconWrap}>
                        <Icon name={BADGE_META[1].icon} size={24} color={BADGE_META[1].color} />
                      </View>
                    ) : (
                      <View style={styles.badgeIconWrapLocked}>
                        <Icon name="lock" size={22} color="#999" />
                      </View>
                    )}
                    <Text style={[
                      styles.badgeText,
                      levelData.level >= 1 ? styles.badgeTextUnlocked : styles.badgeTextLocked,
                    ]}>
                      Level 1
                    </Text>
                    {/* <Text style={styles.badgeTierText}>Bronze</Text> */}
                    <View style={styles.badgeMiniProgressWrap}>
                      <View style={styles.badgeMiniProgressTrack}>
                        <View
                          style={[
                            styles.badgeMiniProgressFill,
                            { width: `${Math.max(0, Math.min(progress.percentage, 100))}%` },
                          ]}
                        />
                      </View>
                      <Text
                        style={[
                          styles.badgeMiniProgressText,
                          levelData.level >= 1 && styles.badgeMiniProgressTextUnlocked,
                        ]}
                      >
                        {progress.label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })()}

              {/* Level 2 Badge */}
              {(() => {
                const progress = getBadgeProgressForLevel(2);
                return (
                  <TouchableOpacity
                    style={[
                      styles.badgeCard,
                      levelData.level >= 2 ? styles.badgeCardUnlocked : styles.badgeCardLocked,
                      levelData.level === 2 && styles.badgeCardActive,
                      levelData.level === 1 && levelData.progressToNextLevel >= levelData.nextLevelRequirement && styles.badgeCardReadyToUnlock
                    ]}
                    onPress={() => {
                      setShowBadgeModal(true);
                    }}
                    activeOpacity={0.7}>
                    <View
                      style={[
                        styles.badgeAccent,
                        levelData.level >= 2 ? styles.badgeAccentSilver : styles.badgeAccentLocked,
                      ]}
                    />
                    {levelData.level >= 2 ? (
                      <View style={styles.badgeIconWrap}>
                        <Icon name={BADGE_META[2].icon} size={24} color={BADGE_META[2].color} />
                      </View>
                    ) : (
                      <View style={styles.badgeIconWrapLocked}>
                        <Icon name="lock" size={22} color="#999" />
                      </View>
                    )}
                    <Text style={[
                      styles.badgeText,
                      levelData.level >= 2 ? styles.badgeTextUnlocked : styles.badgeTextLocked
                    ]}>
                      Level 2
                    </Text>
                    {/* <Text style={styles.badgeTierText}>Silver</Text> */}
                    <View style={styles.badgeMiniProgressWrap}>
                      <View style={styles.badgeMiniProgressTrack}>
                        <View
                          style={[
                            styles.badgeMiniProgressFill,
                            { width: `${Math.max(0, Math.min(progress.percentage, 100))}%` },
                          ]}
                        />
                      </View>
                      <Text
                        style={[
                          styles.badgeMiniProgressText,
                          levelData.level >= 2 && styles.badgeMiniProgressTextUnlocked,
                        ]}
                      >
                        {progress.label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })()}

              {/* Level 3 Badge */}
              {(() => {
                const progress = getBadgeProgressForLevel(3);
                return (
                  <TouchableOpacity
                    style={[
                      styles.badgeCard,
                      levelData.level >= 3 ? styles.badgeCardUnlocked : styles.badgeCardLocked,
                      levelData.level === 3 && styles.badgeCardActive,
                      levelData.level === 2 && levelData.progressToNextLevel >= levelData.nextLevelRequirement && styles.badgeCardReadyToUnlock
                    ]}
                    onPress={() => {
                      setShowBadgeModal(true);
                    }}
                    activeOpacity={0.7}>
                    <View
                      style={[
                        styles.badgeAccent,
                        levelData.level >= 3 ? styles.badgeAccentGold : styles.badgeAccentLocked,
                      ]}
                    />
                    {levelData.level >= 3 ? (
                      <View style={styles.badgeIconWrap}>
                        <Icon name={BADGE_META[3].icon} size={24} color={BADGE_META[3].color} />
                      </View>
                    ) : (
                      <View style={styles.badgeIconWrapLocked}>
                        <Icon name="lock" size={22} color="#999" />
                      </View>
                    )}
                    <Text style={[
                      styles.badgeText,
                      levelData.level >= 3 ? styles.badgeTextUnlocked : styles.badgeTextLocked
                    ]}>
                      Level 3
                    </Text>
                    {/* <Text style={styles.badgeTierText}>Gold</Text> */}
                    <View style={styles.badgeMiniProgressWrap}>
                      <View style={styles.badgeMiniProgressTrack}>
                        <View
                          style={[
                            styles.badgeMiniProgressFill,
                            { width: `${Math.max(0, Math.min(progress.percentage, 100))}%` },
                          ]}
                        />
                      </View>
                      <Text
                        style={[
                          styles.badgeMiniProgressText,
                          levelData.level >= 3 && styles.badgeMiniProgressTextUnlocked,
                        ]}
                      >
                        {progress.label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })()}
            </View>

            {/* Progress Bar for Current Level */}
            {/* {!levelData.isMaxLevel && (
                  <View style={styles.levelProgressContainer}>
                    <View style={styles.levelProgressHeader}>
                      <Text style={styles.levelProgressText}>
                        Progress to Level {levelData.nextTargetLevel}
                      </Text>
                      <Text style={styles.levelProgressCount}>
                        {levelData.progressToNextLevel}/{levelData.nextLevelRequirement}
                      </Text>
                    </View>
                    <View style={styles.levelProgressBarContainer}>
                      <View 
                        style={[
                          styles.levelProgressBar,
                          { width: `${levelData.progressPercentage}%` }
                        ]} 
                      />
                    </View>
                    <View style={styles.levelProgressMetaRow}>
                      <Text style={styles.levelProgressMetaText}>Keep going</Text>
                      <Text style={styles.levelProgressMetaPercent}>
                        {Math.round(levelData.progressPercentage)}%
                      </Text>
                    </View>
                  </View>
                )} */}
          </>
        </View>

        {/* Menu List */}
        <View style={styles.menuSection}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuItem}
              onPress={item.onPress}
              activeOpacity={0.7}>
              <View style={styles.menuItemLeft}>
                <Icon name={item.icon} size={24} color={PRIMARY_COLOR} />
                <Text style={styles.menuItemText}>{item.label}</Text>
              </View>
              <Icon name="chevron-right" size={24} color={PRIMARY_COLOR} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={[styles.logoutButton, { marginTop: 24 }]}
          onPress={handleLogout}
          activeOpacity={0.7}>
          <Icon name="exit-to-app" size={20} color={PRIMARY_COLOR} />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>

        <View style={styles.brandFooter}>
          <View style={styles.brandLogoWrap}>
            <Image
              source={require('../assets/logo.png')}
              style={styles.brandLogo}
              resizeMode="contain"
            />
          </View>
          <View style={styles.brandTextWrap}>
            <Text style={styles.brandName}>GlamMefy</Text>

          </View>
        </View>
      </ScrollView>

      {/* Profile Image Modal */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}>
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity
            style={styles.imageModalCloseButton}
            onPress={() => setShowImageModal(false)}
            activeOpacity={0.7}>
            <Icon name="close" size={30} color="#fff" />
          </TouchableOpacity>
          {userProfile?.profileImage && (
            <Image
              source={{ uri: userProfile.profileImage }}
              style={styles.imageModalImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Earnings Period Dropdown Modal */}
      <Modal
        visible={showEarningsDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEarningsDropdown(false)}>
        <TouchableOpacity
          style={styles.dropdownModalOverlay}
          activeOpacity={1}
          onPress={() => setShowEarningsDropdown(false)}>
          <View style={styles.dropdownModalContent}>
            {periodOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.dropdownOption,
                  earningsPeriod === option.value && styles.dropdownOptionSelected,
                ]}
                onPress={() => {
                  setEarningsPeriod(option.value as 'today' | 'lastWeek' | 'lastMonth' | 'last6Months' | 'lastYear');
                  setShowEarningsDropdown(false);
                }}
                activeOpacity={0.7}>
                <Text
                  style={[
                    styles.dropdownOptionText,
                    earningsPeriod === option.value && styles.dropdownOptionTextSelected,
                  ]}>
                  {option.label}
                </Text>
                {earningsPeriod === option.value && (
                  <Icon name="check" size={20} color={PRIMARY_COLOR} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Level Analytics Modal */}
      <LevelAnalyticsModal
        visible={showBadgeModal}
        onClose={() => setShowBadgeModal(false)}
        currentLevel={levelData.level}
        criteriaMetCount={levelData.criteriaMetCount}
        nextLevelRequirement={levelData.nextLevelRequirement}
        progressPercentage={levelData.progressPercentage}
        isMaxLevel={levelData.isMaxLevel}
        successScore={levelData.successScore}
        rating={levelData.clientRating}
        responseRate={levelData.responseRate}
        serviceCount={levelData.totalCompletedServices}
        uniqueClients={levelData.totalUniqueClients}
        earnings={levelData.totalEarnings}
      />

      {/* Custom Modal */}
      <CustomModal
        visible={modal.visible}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        buttons={modal.buttons}
        onClose={modal.hideModal}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
    paddingTop: compactTopPadding(20),
    // paddingTop:-38
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: compactTopPadding(20),
    paddingBottom: 16,
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
    height: 40,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
    backgroundColor: BACKGROUND_COLOR,
  },
  guestContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: compactTopPadding(20),
  },
  profileSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 32,
  },
  profileImageContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFE5CC',
  },
  profileImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFE5CC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  phoneNumber: {
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
  },
  guestCard: {
    backgroundColor: '#FFF9F4',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1E2D8',
    padding: 20,
    alignItems: 'center',
  },
  guestCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#132235',
    marginBottom: 8,
    textAlign: 'center',
  },
  guestCardText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
    textAlign: 'center',
    marginBottom: 18,
  },
  guestCtaButton: {
    width: '100%',
  },
  guestCtaGradient: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  guestCtaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  profileInfoValueMuted: {
    fontSize: 13,
    color: '#777',
    fontWeight: '500',
  },
  profileInfoBlock: {
    width: '100%',
    marginBottom: 8,
  },
  serviceToastsWrap: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  serviceToastChip: {
    backgroundColor: '#FFF2EA',
    borderWidth: 1,
    borderColor: '#FFD9C8',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  serviceToastText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
  },
  profileImagePlanBadge: {
    position: 'absolute',
    bottom: -10,
    right: -12,
    backgroundColor: '#FFE6D5',
    borderWidth: 1,
    borderColor: '#FFC9A8',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: 110,
    elevation: 2,
  },
  profileImagePlanBadgeText: {
    fontSize: 11,
    color: '#A54500',
    fontWeight: '700',
    textAlign: 'center',
  },
  profileBadgeImage: {
    // position: 'absolute',
    // bottom: -10,
    // right:-10,
    width: 25,
    height: 25,
    // borderRadius: 50,
    // backgroundColor: '#fff',
    // borderWidth: 2,
    // borderColor: '#FFC9A8',
  },
  languageTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  languageTag: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  languageTagText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#132235',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    // backgroundColor: '#F5F5F5',
    borderWidth: 1.3,
    borderColor: PRIMARY_COLOR,

    padding: 12,
    gap: 4,
  },
  dropdownText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '400',
  },
  totalEarnings: {
    fontSize: 28,
    fontWeight: '600',
    color: '#333',
    marginBottom: 36,

    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    // backgroundColor: '#F5F5F5',
    borderWidth: 1.3,
    borderColor: '#E1E6EF',
    borderRadius: 21,
    padding: 12,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  badgeCard: {
    flex: 1,
    backgroundColor: '#FFF9F4',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#F1E2D8',
    overflow: 'hidden',
  },
  badgeAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  badgeAccentBronze: {
    backgroundColor: '#CD7F32',
  },
  badgeAccentSilver: {
    backgroundColor: '#5C8FA8',
  },
  badgeAccentGold: {
    backgroundColor: '#F4B400',
  },
  badgeAccentLocked: {
    backgroundColor: '#DADADA',
  },
  badgeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#F0D6C7',
  },
  badgeIconWrapLocked: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  badgeText: {
    fontSize: 14,
    color: '#222',
    fontWeight: '700',
    textAlign: 'center',
  },
  badgeTierText: {
    fontSize: 11,
    color: '#6A6A6A',
    fontWeight: '600',
    marginTop: -2,
  },
  badgeMiniProgressWrap: {
    width: '100%',
    marginTop: 8,
    alignItems: 'center',
  },
  badgeMiniProgressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 999,
    backgroundColor: '#E8DDD5',
    overflow: 'hidden',
  },
  badgeMiniProgressFill: {
    height: '100%',
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 999,
  },
  badgeMiniProgressText: {
    marginTop: 6,
    fontSize: 11,
    color: '#7A7A7A',
    fontWeight: '700',
  },
  badgeMiniProgressTextUnlocked: {
    color: '#196B2D',
  },
  badgeTextBlue: {
    color: '#2196F3',
  },
  badgeCardUnlocked: {
    backgroundColor: '#FFE2BA40',
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
  },
  badgeCardLocked: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  badgeTextUnlocked: {
    color: '#1F1F1F',
    fontWeight: '700',
  },
  badgeTextLocked: {
    color: '#9A9A9A',
  },
  badgeSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  levelProgressContainer: {
    marginTop: 16,
    padding: 14,
    backgroundColor: '#FFF9F4',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F0DED1',
  },
  levelProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  levelProgressText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  levelProgressCount: {
    fontSize: 13,
    fontWeight: '700',
    color: PRIMARY_COLOR,
    backgroundColor: '#FFF2E8',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  levelProgressBarContainer: {
    height: 10,
    backgroundColor: '#F1E6DE',
    borderRadius: 999,
    overflow: 'hidden',
  },
  levelProgressBar: {
    height: '100%',
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 999,
  },
  levelProgressMetaRow: {
    marginTop: 9,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  levelProgressMetaText: {
    fontSize: 11,
    color: '#757575',
    fontWeight: '600',
  },
  levelProgressMetaPercent: {
    fontSize: 12,
    color: '#1E1E1E',
    fontWeight: '800',
  },
  menuSection: {
    marginBottom: 32,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
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
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: PRIMARY_COLOR,
    gap: 8,
    marginBottom: 32,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },
  brandFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,

  },
  brandLogoWrap: {

    alignItems: 'center',
    justifyContent: 'center',

  },
  brandLogo: {
    width: 34,
    height: 34,
  },
  brandTextWrap: {
    flexDirection: 'column',
  },
  brandName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F1F1F',
    letterSpacing: 0.3,
  },
  brandTagline: {
    marginTop: 2,
    fontSize: 12,
    color: '#7A7A7A',
    fontWeight: '500',
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalImage: {
    width: '100%',
    height: '100%',
  },
  dropdownModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  dropdownOptionSelected: {
    backgroundColor: '#FFF4E6',
  },
  dropdownOptionText: {
    fontSize: 16,
    color: '#333',
  },
  dropdownOptionTextSelected: {
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
  badgeCardActive: {
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
    // transform: [{ scale: 1.05 }],
  },
  badgeCardReadyToUnlock: {
    borderWidth: 2,
    borderColor: '#4CAF50',
    backgroundColor: '#F0FFF4',
  },
  badgeStatusText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
    marginTop: 4,
  },
  badgeStatusPill: {
    marginTop: 4,
    minWidth: 74,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeStatusPillUnlocked: {
    backgroundColor: '#E8F8EA',
    borderWidth: 1,
    borderColor: '#B7E0BE',
  },
  badgeStatusPillReady: {
    backgroundColor: '#FFF3E6',
    borderWidth: 1,
    borderColor: '#FFD1AD',
  },
  badgeStatusPillLocked: {
    backgroundColor: '#F3F3F3',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  badgeStatusPillText: {
    fontSize: 11,
    color: '#196B2D',
    fontWeight: '700',
  },
  badgeStatusPillTextMuted: {
    fontSize: 11,
    color: '#7A7A7A',
    fontWeight: '700',
  },
  unlockNowContainer: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
  },
  unlockNowText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  badgeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  badgeModalContent: {
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
    elevation: 10,
  },
  badgeModalCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeModalIconContainer: {
    marginTop: 20,
    marginBottom: 24,
  },
  badgeModalIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  badgeModalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  badgeModalDetailsContainer: {
    width: '100%',
    marginBottom: 24,
  },
  badgeModalDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  badgeModalDetailText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  badgeModalDetailLabel: {
    fontWeight: '600',
    color: '#333',
  },
  badgeModalButton: {
    width: '100%',
    paddingVertical: 14,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 12,
    alignItems: 'center',
  },
  badgeModalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  performanceMetricsContainer: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    borderLeftWidth: 4,
    borderLeftColor: PRIMARY_COLOR,
  },
  performanceMetricsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    gap: 10,
  },
  metricContent: {
    flex: 1,
    flexDirection: 'column',
  },
  metricLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  detailedMetricBlock: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B84',
  },
  detailedMetricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  detailedMetricTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  detailedMetricValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  detailedMetricDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
    marginBottom: 10,
  },
  progressBarContainer: {
    gap: 6,
  },
  progressBar: {
    height: 10,
    backgroundColor: '#E8E8E8',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  progressText: {
    fontSize: 11,
    color: '#999',
    fontWeight: '500',
  },
});

export default AccountScreen;
