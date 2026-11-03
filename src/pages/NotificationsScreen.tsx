import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { API_BASE_URL_WITH_API } from '../config/api';
import { compactTopPadding } from '../utils/responsiveLayout';
import LinearGradient from '../components/AppLinearGradient';

const APP_BACKGROUND = '#FFF3E8';
const APP_SURFACE = '#FFFFFF';
const APP_SURFACE_ALT = '#FFF8F2';
const APP_ACCENT = '#FD8B36';
const APP_GREEN = '#69B943';
const APP_BORDER = '#F5D9C8';
const APP_TEXT = '#1F1917';
const APP_MUTED = '#75665F';

interface NotificationsScreenProps {
  onBack: () => void;
  userId?: string | null;
  onOpenChat?: (booking: {
    bookingId: string;
    counterpartName?: string;
    serviceName?: string;
  }) => void;
}

interface NotificationItem {
  _id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  couponCode?: string;
  validTill?: string;
  bookingId?: string;
  serviceName?: string;
  counterpartName?: string;
}

interface NotificationGroup {
  title: string;
  items: NotificationItem[];
}

const formatDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const formatTime = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(date)
    .toUpperCase();
};

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const startOfWeek = (date: Date) => {
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const weekStart = startOfDay(date);
  weekStart.setDate(weekStart.getDate() + mondayOffset);
  return weekStart;
};

const getNotificationGroupTitle = (createdAt: string) => {
  const createdDate = new Date(createdAt);
  if (Number.isNaN(createdDate.getTime())) {
    return 'Older';
  }

  const today = startOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const notificationDay = startOfDay(createdDate);

  if (notificationDay.getTime() === today.getTime()) {
    return 'Today';
  }

  if (notificationDay.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  }

  if (notificationDay >= startOfWeek(today)) {
    return 'This week';
  }

  if (
    notificationDay.getFullYear() === today.getFullYear() &&
    notificationDay.getMonth() === today.getMonth()
  ) {
    return 'This month';
  }

  return 'Older';
};

const NotificationsScreen: React.FC<NotificationsScreenProps> = ({
  onBack,
  userId,
  onOpenChat,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedNotification, setSelectedNotification] =
    useState<NotificationItem | null>(null);

  const unreadCount = useMemo(
    () => notifications.filter(notification => !notification.isRead).length,
    [notifications],
  );

  const groupedNotifications = useMemo<NotificationGroup[]>(() => {
    const sectionOrder = [
      'Today',
      'Yesterday',
      'This week',
      'This month',
      'Older',
    ];
    const sections = new Map(
      sectionOrder.map(title => [title, [] as NotificationItem[]]),
    );

    notifications.forEach(notification => {
      const groupTitle = getNotificationGroupTitle(notification.createdAt);
      sections.get(groupTitle)?.push(notification);
    });

    return sectionOrder
      .map(title => ({
        title,
        items: sections.get(title) ?? [],
      }))
      .filter(section => section.items.length > 0);
  }, [notifications]);

  const getNotificationIconName = (type: string) => {
    if (type === 'chat_message') {
      return 'chat';
    }

    if (type === 'offer') {
      return 'local-offer';
    }

    if (type === 'booking_confirmation' || type.startsWith('booking_')) {
      return 'event-available';
    }

    if (type === 'order_confirmation') {
      return 'inventory';
    }

    return 'notifications';
  };

  const getNotificationTone = (notification: NotificationItem) => {
    if (notification.type === 'chat_message') {
      return {
        color: APP_ACCENT,
        backgroundColor: '#FFF0E6',
        borderColor: APP_ACCENT,
      };
    }

    const isBooking =
      notification.type === 'booking_confirmation' ||
      notification.type.startsWith('booking_');

    if (!notification.isRead || notification.type === 'booking_started') {
      return {
        color: APP_ACCENT,
        backgroundColor: '#FFF0E6',
        borderColor: '#FF8B45',
      };
    }

    if (isBooking) {
      return {
        color: APP_GREEN,
        backgroundColor: '#F0FAEA',
        borderColor: APP_GREEN,
      };
    }

    return {
      color: APP_ACCENT,
      backgroundColor: '#FFF0E6',
      borderColor: APP_ACCENT,
    };
  };

  const fetchNotifications = useCallback(
    async (refresh = false) => {
      if (!userId) {
        setNotifications([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      try {
        if (refresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        const response = await fetch(
          `${API_BASE_URL_WITH_API}/notifications/stylist/${userId}`,
        );
        const result = await response.json();
        if (response.ok && result.success && Array.isArray(result.data)) {
          setNotifications(result.data);
        } else {
          setNotifications([]);
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
        setNotifications([]);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(
        `${API_BASE_URL_WITH_API}/notifications/${notificationId}/read`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        },
      );

      setNotifications(current =>
        current.map(notification =>
          notification._id === notificationId
            ? { ...notification, isRead: true }
            : notification,
        ),
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const openNotification = async (notification: NotificationItem) => {
    setSelectedNotification(notification);

    if (!notification.isRead) {
      await markAsRead(notification._id);
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Icon name="arrow-back" size={24} color={APP_TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerBellButton}>
          <Icon name="notifications-none" size={21} color={APP_ACCENT} />
          {unreadCount > 0 ? (
            <View style={styles.headerUnreadBadge}>
              <Text style={styles.headerUnreadBadgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryIconWrap}>
          <Icon name="campaign" size={33} color={APP_ACCENT} />
        </View>
        <View style={styles.summaryTextWrap}>
          <Text style={styles.summaryTitle}>Offers and updates</Text>
          <Text style={styles.summarySubtitle}>
            Save more! Discover tips, coupon codes, flash deals and shop better.
          </Text>
        </View>
        <Icon name="chevron-right" size={23} color={APP_ACCENT} />
      </View>

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="small" color={APP_ACCENT} />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchNotifications(true)}
              tintColor={APP_ACCENT}
            />
          }
        >
          {notifications.length > 0 ? (
            groupedNotifications.map(section => (
              <View key={section.title} style={styles.notificationSection}>
                <Text style={styles.sectionLabel}>{section.title}</Text>
                {section.items.map((notification, index) => {
                  const isBooking = notification.type === 'booking_confirmation' || notification.type.startsWith('booking_');

                  const statusColor = notification.isRead ? APP_GREEN : APP_ACCENT;
                  const gradientColors = notification.isRead
                    ? ['#FFFFFF', '#F7FCF5']
                    : ['#FFFFFF', '#FFF5EC'];

                  let statusTag = "Notification";
                  let tagBg = "#F5F3F1";
                  let tagTextCol = "#7A6253";

                  if (notification.type === 'chat_message') {
                    statusTag = "New Message";
                    tagBg = "#FFF0E6";
                    tagTextCol = APP_ACCENT;
                  } else if (notification.type === 'offer') {
                    statusTag = "Promo Offer";
                    tagBg = "#FFF0DE";
                    tagTextCol = "#C96A1B";
                  } else if (notification.type === 'booking_cancelled' || notification.type === 'booking_declined') {
                    statusTag = "Cancelled";
                    tagBg = "#FDF0F0";
                    tagTextCol = "#D93838";
                  } else if (notification.type === 'booking_started') {
                    statusTag = "Started";
                    tagBg = "#EBF5FF";
                    tagTextCol = "#0066CC";
                  } else if (isBooking) {
                    statusTag = "Confirmed";
                    tagBg = "#EBF9EB";
                    tagTextCol = "#2E7D32";
                  }

                  const cleanTitle = notification.title
                    .replace(/[❌✅🔥]/g, '')
                    .trim();

                  return (
                    <TouchableOpacity
                      key={notification._id}
                      style={styles.cardContainer}
                      activeOpacity={0.88}
                      onPress={() => openNotification(notification)}
                    >
                      <LinearGradient
                        colors={gradientColors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.notificationItemCard, { borderLeftColor: statusColor }]}
                      >
                        <View style={[styles.iconContainer, { backgroundColor: notification.isRead ? '#EBF9EB' : '#FFF0E6' }]}>
                          <Icon
                            name={getNotificationIconName(notification.type)}
                            size={20}
                            color={statusColor}
                          />
                        </View>

                        <View style={styles.contentContainer}>
                          <View style={styles.contentHeader}>
                            <View style={[styles.statusTagPill, { backgroundColor: tagBg }]}>
                              <Text style={[styles.statusTagText, { color: tagTextCol }]}>{statusTag}</Text>
                            </View>

                            <Text style={styles.notificationTime}>
                              {formatTime(notification.createdAt)}
                            </Text>
                          </View>

                          <Text style={[styles.notificationTitle, !notification.isRead && styles.notificationTitleBold]} numberOfLines={1}>
                            {cleanTitle}
                          </Text>

                          <Text style={styles.notificationMessage} numberOfLines={3}>
                            {notification.message}
                          </Text>

                          {notification.couponCode && (
                            <View style={styles.couponCodeBlock}>
                              <Text style={styles.couponLabel}>USE PROMO CODE</Text>
                              <View style={styles.couponDashedBox}>
                                <Text style={styles.couponValue}>{notification.couponCode}</Text>
                              </View>
                              {notification.validTill && (
                                <Text style={styles.couponExpiry}>
                                  Expires: {formatDate(notification.validTill)}
                                </Text>
                              )}
                            </View>
                          )}

                          {!notification.couponCode && notification.validTill && (
                            <View style={styles.validityRow}>
                              <Icon name="event" size={14} color={APP_MUTED} />
                              <Text style={styles.validityText}>
                                Valid till: {formatDate(notification.validTill)}
                              </Text>
                            </View>
                          )}
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Icon name="notifications-none" size={54} color="#D2BCA9" />
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptySubtitle}>
                New offers and updates will appear here when the admin sends
                them.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      <Modal
        visible={!!selectedNotification}
        transparent
        statusBarTranslucent={true}
        animationType="fade"
        onRequestClose={() => setSelectedNotification(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderIcon}>
                <Icon
                  name={
                    selectedNotification?.type === 'offer'
                      ? 'local-offer'
                      : 'notifications'
                  }
                  size={22}
                  color={APP_ACCENT}
                />
              </View>
              <TouchableOpacity
                onPress={() => setSelectedNotification(null)}
                style={styles.modalCloseButton}
                activeOpacity={0.7}
              >
                <Icon name="close" size={22} color={APP_TEXT} />
              </TouchableOpacity>
            </View>

            {selectedNotification && (
              <>
                <Text style={styles.modalTitle}>
                  {selectedNotification.type === 'offer' ? '🔥 ' : ''}
                  {selectedNotification.title}
                </Text>
                <Text style={styles.modalTime}>
                  {formatDate(selectedNotification.createdAt)}
                </Text>

                <ScrollView
                  style={styles.modalBody}
                  contentContainerStyle={styles.modalBodyContent}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.modalMessage}>
                    {selectedNotification.message}
                  </Text>

                  {selectedNotification.couponCode ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Coupon Code</Text>
                      <Text style={styles.detailValue}>
                        {selectedNotification.couponCode}
                      </Text>
                    </View>
                  ) : null}

                  {selectedNotification.validTill ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Valid Till</Text>
                      <Text style={styles.detailValue}>
                        {formatDate(selectedNotification.validTill)}
                      </Text>
                    </View>
                  ) : null}

                  {(selectedNotification.bookingId || selectedNotification.type === 'chat_message') && onOpenChat ? (
                    <TouchableOpacity
                      style={styles.startChatButton}
                      activeOpacity={0.85}
                      onPress={() => {
                        const bookingId = selectedNotification.bookingId;
                        if (!bookingId) return;
                        const counterpartName = selectedNotification.counterpartName;
                        const serviceName = selectedNotification.serviceName;
                        setSelectedNotification(null);
                        onOpenChat({
                          bookingId,
                          counterpartName,
                          serviceName,
                        });
                      }}
                    >
                      <Icon name="chat" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.startChatButtonText}>Start Chat</Text>
                    </TouchableOpacity>
                  ) : null}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_BACKGROUND,
    paddingTop: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 13,
  },
  backButton: {
    width: 37,
    height: 37,
    borderRadius: 18.5,
    backgroundColor: APP_SURFACE,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F5DFD2',
    shadowColor: '#C47A4A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: APP_TEXT,
  },
  headerBellButton: {
    width: 37,
    height: 37,
    borderRadius: 18.5,
    backgroundColor: APP_SURFACE,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F5DFD2',
    shadowColor: '#C47A4A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  headerUnreadBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: APP_ACCENT,
    borderWidth: 1,
    borderColor: APP_SURFACE,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  headerUnreadBadgeText: {
    color: APP_SURFACE,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
  },
  summaryCard: {
    marginHorizontal: 16,
    minHeight: 86,
    marginBottom: 13,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: APP_SURFACE,
    borderWidth: 1,
    borderColor: APP_BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#D17840',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.11,
    shadowRadius: 11,
    elevation: 3,
  },
  summaryIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFF0DE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryTextWrap: {
    flex: 1,
    marginLeft: 13,
    marginRight: 6,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: APP_TEXT,
  },
  summarySubtitle: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 18,
    color: APP_MUTED,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: APP_MUTED,
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  notificationSection: {
    marginBottom: 2,
  },
  sectionLabel: {
    marginBottom: 12,
    marginTop: 4,
    fontSize: 15,
    lineHeight: 18,
    color: '#8D8079',
    fontWeight: '500',
  },
  cardContainer: {
    marginBottom: 14,
    borderRadius: 20,
    shadowColor: '#C47A4A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
    backgroundColor: 'transparent',
    width: '100%',
  },
  notificationItemCard: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 16,
    borderLeftWidth: 5,
    overflow: 'hidden',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  contentContainer: {
    flex: 1,
    minWidth: 0,
  },
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusTagPill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusTagText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notificationTime: {
    fontSize: 11,
    lineHeight: 14,
    color: APP_MUTED,
    fontWeight: '600',
  },
  notificationTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    color: APP_TEXT,
    marginBottom: 6,
  },
  notificationTitleBold: {
    fontWeight: '800',
  },
  unreadPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: APP_ACCENT,
    position: 'absolute',
    top: 16,
    right: 16,
  },
  notificationMessage: {
    fontSize: 13,
    lineHeight: 19,
    color: '#4E3E37',
  },
  couponCodeBlock: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFFDFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F2E5DD',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  couponLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: APP_MUTED,
    letterSpacing: 0.5,
  },
  couponDashedBox: {
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: APP_ACCENT,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: '#FFF9F4',
  },
  couponValue: {
    fontSize: 13,
    fontWeight: '800',
    color: APP_ACCENT,
    letterSpacing: 1,
  },
  couponExpiry: {
    fontSize: 10,
    color: APP_MUTED,
    fontWeight: '600',
  },
  validityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 4,
  },
  validityText: {
    fontSize: 11,
    color: APP_MUTED,
    fontWeight: '600',
  },
  offerMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 11,
    gap: 10,
  },
  metaPill: {
    backgroundColor: APP_SURFACE_ALT,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: APP_BORDER,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  metaPillLabel: {
    fontSize: 11,
    color: APP_MUTED,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  metaPillValue: {
    marginTop: 2,
    fontSize: 13,
    color: APP_ACCENT,
    fontWeight: '500',
  },
  emptyState: {
    marginTop: 80,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '500',
    color: APP_TEXT,
  },
  emptySubtitle: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    color: APP_MUTED,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: APP_BACKGROUND,
    borderRadius: 24,
    padding: 18,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: APP_BORDER,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: APP_SURFACE,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: APP_BORDER,
  },
  modalCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: APP_SURFACE,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: APP_BORDER,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: APP_TEXT,
  },
  modalTime: {
    marginTop: 6,
    fontSize: 13,
    color: APP_MUTED,
  },
  modalBody: {
    marginTop: 16,
  },
  modalBodyContent: {
    paddingBottom: 4,
  },
  modalMessage: {
    fontSize: 15,
    lineHeight: 22,
    color: APP_TEXT,
    marginBottom: 16,
  },
  detailRow: {
    backgroundColor: APP_SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: APP_BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 11,
    color: APP_MUTED,
    textTransform: 'uppercase',
    fontWeight: '500',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: APP_TEXT,
    fontWeight: '500',
  },
  startChatButton: {
    backgroundColor: APP_ACCENT,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 6,
    shadowColor: APP_ACCENT,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  startChatButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

export default NotificationsScreen;
