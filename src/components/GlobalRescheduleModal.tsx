import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  DeviceEventEmitter,
  Platform,
} from 'react-native';
import { QueuedModal as Modal } from '../popup/PopupProvider';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from './AppLinearGradient';

export interface RescheduleModalPayload {
  type: 'reschedule_request' | 'reschedule_counter' | 'reschedule_accepted' | 'reschedule_declined' | string;
  bookingId: string;
  serviceName?: string;
  senderName?: string;
  declinerName?: string;
  proposedDate?: string;
  proposedTime?: string;
  title?: string;
  body?: string;
  reason?: string;
}

interface GlobalRescheduleModalProps {
  stylistId?: string | null;
  enabled?: boolean;
}

const GlobalRescheduleModal: React.FC<GlobalRescheduleModalProps> = ({ stylistId, enabled = true }) => {
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState<RescheduleModalPayload | null>(null);
  const dismissedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      'global_reschedule_modal',
      (payload: RescheduleModalPayload) => {
        if (!payload || !payload.bookingId) return;

        const dedupeKey = `${payload.bookingId}_${payload.type}_${payload.proposedDate || ''}_${payload.proposedTime || ''}`;
        if (dismissedKeysRef.current.has(dedupeKey)) {
          return;
        }

        setData(payload);
        setVisible(true);
      }
    );

    return () => {
      sub.remove();
    };
  }, []);

  if (!enabled || !visible || !data) {
    return null;
  }

  const isAccepted = data.type === 'reschedule_accepted';
  const isDeclined = data.type === 'reschedule_declined';
  const isCounter = data.type === 'reschedule_counter';

  const getHeaderInfo = () => {
    if (isAccepted) {
      return {
        badge: 'Reschedule Confirmed',
        icon: 'check-circle',
        badgeBg: '#E8F5E9',
        badgeColor: '#2E7D32',
        headline: 'Appointment Rescheduled! 🎉',
      };
    }
    if (isDeclined) {
      return {
        badge: 'Reschedule Declined',
        icon: 'cancel',
        badgeBg: '#FFEBEE',
        badgeColor: '#C62828',
        headline: 'Request Declined',
      };
    }
    if (isCounter) {
      return {
        badge: 'Customer Counter-Proposal',
        icon: 'swap-horiz',
        badgeBg: '#FFF3E0',
        badgeColor: '#E65100',
        headline: `${data.senderName || 'Customer'} Proposed a New Slot`,
      };
    }
    return {
      badge: 'Reschedule Request',
      icon: 'event-repeat',
      badgeBg: '#FFF3E0',
      badgeColor: '#E65100',
      headline: `${data.senderName || 'Customer'} Requested Reschedule`,
    };
  };

  const header = getHeaderInfo();

  const handleClose = () => {
    if (data) {
      const dedupeKey = `${data.bookingId}_${data.type}_${data.proposedDate || ''}_${data.proposedTime || ''}`;
      dismissedKeysRef.current.add(dedupeKey);
    }
    setVisible(false);
  };

  const handleViewDetails = () => {
    const bookingId = data.bookingId;
    handleClose();
    // Emit events to switch screen and open this booking
    DeviceEventEmitter.emit('open_upcoming_booking', { bookingId });
    DeviceEventEmitter.emit('select_booking', { bookingId });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={[styles.badge, { backgroundColor: header.badgeBg }]}>
              <Icon name={header.icon} size={15} color={header.badgeColor} />
              <Text style={[styles.badgeText, { color: header.badgeColor }]}>
                {header.badge}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Icon name="close" size={20} color="#777" />
            </TouchableOpacity>
          </View>

          {/* Headline */}
          <Text style={styles.headline}>{header.headline}</Text>

          {/* Subtitle / Service */}
          {data.serviceName ? (
            <View style={styles.serviceRow}>
              <Icon name="content-cut" size={16} color="#FD8B36" />
              <Text style={styles.serviceText} numberOfLines={1}>
                {data.serviceName}
              </Text>
            </View>
          ) : null}

          {/* Body message if custom */}
          {data.body ? (
            <Text style={styles.bodyText} numberOfLines={3}>
              {data.body}
            </Text>
          ) : null}

          {/* Proposed Slot Details Card */}
          {(data.proposedDate || data.proposedTime) && (
            <View style={styles.slotCard}>
              <Text style={styles.slotCardLabel}>
                {isAccepted ? 'Confirmed Appointment Time:' : 'Proposed Appointment Time:'}
              </Text>
              <View style={styles.slotDetailRow}>
                {data.proposedDate ? (
                  <View style={styles.slotChip}>
                    <Icon name="calendar-today" size={14} color="#E65100" />
                    <Text style={styles.slotChipText}>{data.proposedDate}</Text>
                  </View>
                ) : null}
                {data.proposedTime ? (
                  <View style={styles.slotChip}>
                    <Icon name="access-time" size={14} color="#E65100" />
                    <Text style={styles.slotChipText}>{data.proposedTime}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.dismissBtn}
              onPress={handleClose}
              activeOpacity={0.7}>
              <Text style={styles.dismissBtnText}>Dismiss</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleViewDetails}
              activeOpacity={0.85}>
              <LinearGradient
                colors={['#FD8B36', '#F7BB2C']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientBtn}>
                <Text style={styles.primaryBtnText}>
                  {isAccepted || isDeclined ? 'View Booking' : 'Review & Respond'}
                </Text>
                <Icon name="arrow-forward" size={16} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  closeBtn: {
    padding: 4,
  },
  headline: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  serviceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FD8B36',
  },
  bodyText: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
    marginBottom: 12,
  },
  slotCard: {
    backgroundColor: '#FFF8F0',
    borderWidth: 1,
    borderColor: '#FFE0B2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
  },
  slotCardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9E9E9E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  slotDetailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFD59E',
    gap: 6,
  },
  slotChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dismissBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  primaryBtn: {
    flex: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 6,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default GlobalRescheduleModal;

