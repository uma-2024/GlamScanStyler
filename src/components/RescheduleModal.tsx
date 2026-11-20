import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { getApiBaseUrl } from '../config/api';
import { getLoginSession } from '../utils/authStorage';

interface TimeSlot {
  startTime: string;
  endTime: string;
  period: 'Am' | 'Pm' | 'AM' | 'PM' | string;
}

interface AvailableSlot {
  dayRange: string;
  timeSlots: TimeSlot[];
}

interface RescheduleModalProps {
  visible: boolean;
  onClose: () => void;
  bookingId: string;
  stylistId: string;
  userName?: string;
  mode: 'request' | 'counter';
  role: 'user' | 'stylist';
  onSuccess: (updatedBooking?: any) => void;
}

const APP_ACCENT = '#FD8B36';

export const RescheduleModal: React.FC<RescheduleModalProps> = ({
  visible,
  onClose,
  bookingId,
  stylistId,
  userName,
  mode,
  role,
  onSuccess,
}) => {
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [allSlots, setAllSlots] = useState<AvailableSlot[]>([]);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [timeSlotsForDate, setTimeSlotsForDate] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [reason, setReason] = useState('');
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && stylistId) {
      loadStylistAvailability();
    } else {
      setSelectedSlot(null);
      setReason('');
      setFetchError(null);
    }
  }, [visible, stylistId]);

  const loadStylistAvailability = async () => {
    setLoadingSlots(true);
    setFetchError(null);
    try {
      const session = await getLoginSession();
      const token = session?.loginId;
      const baseUrl = getApiBaseUrl(true);
      const res = await fetch(
        `${baseUrl}/profile/stylist/${stylistId}?includeSlots=true`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      if (!res.ok) {
        throw new Error(`Failed to load schedule: ${res.status}`);
      }

      const result = await res.json();
      const slots: AvailableSlot[] = result?.data?.availableSlots || [];
      setAllSlots(slots);

      if (!slots || slots.length === 0) {
        setFetchError('No available working slots found in your profile.');
        setLoadingSlots(false);
        return;
      }

      // Generate next 14 days
      const dates: Date[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let i = 0; i < 14; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const dayOfWeek = d.getDay(); // 0 = Sun, 1 = Mon ...

        const hasSlotForDay = slots.some((s) => {
          switch (s.dayRange?.toLowerCase()) {
            case 'mon-fri':
              return dayOfWeek >= 1 && dayOfWeek <= 5;
            case 'sat-sun':
              return dayOfWeek === 0 || dayOfWeek === 6;
            case 'mon-sun':
            case 'all-week':
              return true;
            default:
              return true;
          }
        });

        if (hasSlotForDay) {
          dates.push(d);
        }
      }

      setAvailableDates(dates);
      if (dates.length > 0) {
        setSelectedDate(dates[0]);
        filterTimeSlotsForDate(dates[0], slots);
      }
    } catch (err: any) {
      console.error('Error loading stylist availability:', err);
      setFetchError(err.message || 'Could not load slots');
    } finally {
      setLoadingSlots(false);
    }
  };

  const filterTimeSlotsForDate = (date: Date, slots: AvailableSlot[]) => {
    const dayOfWeek = date.getDay();
    const result: TimeSlot[] = [];
    const now = new Date();

    slots.forEach((s) => {
      let match = false;
      switch (s.dayRange?.toLowerCase()) {
        case 'mon-fri':
          match = dayOfWeek >= 1 && dayOfWeek <= 5;
          break;
        case 'sat-sun':
          match = dayOfWeek === 0 || dayOfWeek === 6;
          break;
        case 'mon-sun':
        case 'all-week':
          match = true;
          break;
        default:
          match = true;
      }

      if (match && s.timeSlots) {
        s.timeSlots.forEach((ts) => {
          const isToday =
            date.getFullYear() === now.getFullYear() &&
            date.getMonth() === now.getMonth() &&
            date.getDate() === now.getDate();

          if (isToday) {
            const [hours, minutes] = (ts.startTime || '0:0').split(':').map(Number);
            let hour24 = hours;
            const periodUpper = (ts.period || '').toUpperCase();
            if (periodUpper === 'PM' && hours < 12) hour24 += 12;
            if (periodUpper === 'AM' && hours === 12) hour24 = 0;

            const slotDate = new Date(date);
            slotDate.setHours(hour24, minutes, 0, 0);

            if (slotDate.getTime() - now.getTime() < 30 * 60 * 1000) {
              return;
            }
          }

          if (
            !result.some(
              (x) =>
                x.startTime === ts.startTime &&
                x.endTime === ts.endTime &&
                x.period === ts.period
            )
          ) {
            result.push(ts);
          }
        });
      }
    });

    setTimeSlotsForDate(result);
    setSelectedSlot(result.length > 0 ? result[0] : null);
  };

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
    filterTimeSlotsForDate(date, allSlots);
  };

  const handleSubmit = async () => {
    if (!selectedDate || !selectedSlot) {
      Alert.alert('Selection Required', 'Please select a date and an available time slot.');
      return;
    }

    setSubmitting(true);
    try {
      const session = await getLoginSession();
      const token = session?.loginId;
      const baseUrl = getApiBaseUrl(true);

      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;

      let url = '';
      let body: any = {};

      if (mode === 'request') {
        url = `${baseUrl}/bookings/${bookingId}/reschedule/request`;
        body = {
          requestedBy: role,
          stylistId,
          newDate: formattedDate,
          newStartTime: selectedSlot.startTime,
          newEndTime: selectedSlot.endTime,
          newPeriod: selectedSlot.period,
          reason: reason.trim() || undefined,
        };
      } else {
        url = `${baseUrl}/bookings/${bookingId}/reschedule/respond`;
        body = {
          action: 'counter',
          respondedBy: role,
          stylistId,
          counterDate: formattedDate,
          counterStartTime: selectedSlot.startTime,
          counterEndTime: selectedSlot.endTime,
          counterPeriod: selectedSlot.period,
          reason: reason.trim() || undefined,
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to submit reschedule request');
      }

      Alert.alert(
        'Request Sent! 🗓️',
        mode === 'request'
          ? `Reschedule request has been sent to ${userName || 'the customer'}. They will be notified to accept or suggest another slot.`
          : 'Your proposed alternative time has been sent to the customer.',
        [
          {
            text: 'OK',
            onPress: () => {
              onClose();
              onSuccess(data.data);
            },
          },
        ]
      );
    } catch (err: any) {
      console.error('Submit reschedule error:', err);
      Alert.alert('Error', err.message || 'Failed to submit reschedule request.');
    } finally {
      setSubmitting(false);
    }
  };

  const getDayLabel = (d: Date) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[d.getDay()];
  };

  const getMonthLabel = (d: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[d.getMonth()];
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>
                {mode === 'request' ? 'Reschedule Appointment' : 'Suggest Another Time Slot'}
              </Text>
              <Text style={styles.subtitle}>
                {userName ? `For ${userName}` : 'Select a new date & time slot'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {loadingSlots ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={APP_ACCENT} />
              <Text style={styles.loadingText}>Loading your schedule...</Text>
            </View>
          ) : fetchError ? (
            <View style={styles.emptyContainer}>
              <Icon name="event-busy" size={48} color="#FF6B6B" />
              <Text style={styles.emptyText}>{fetchError}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={loadStylistAvailability}>
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
              {/* Date Selector */}
              <Text style={styles.sectionTitle}>Select Date</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dateList}
              >
                {availableDates.map((d, index) => {
                  const isSelected =
                    selectedDate &&
                    d.getFullYear() === selectedDate.getFullYear() &&
                    d.getMonth() === selectedDate.getMonth() &&
                    d.getDate() === selectedDate.getDate();

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[styles.dateChip, isSelected && styles.dateChipSelected]}
                      onPress={() => handleSelectDate(d)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.dayText, isSelected && styles.dateTextSelected]}>
                        {getDayLabel(d)}
                      </Text>
                      <Text style={[styles.dateNumber, isSelected && styles.dateTextSelected]}>
                        {d.getDate()}
                      </Text>
                      <Text style={[styles.monthText, isSelected && styles.dateTextSelected]}>
                        {getMonthLabel(d)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Time Slots */}
              <Text style={styles.sectionTitle}>Available Slots</Text>
              {timeSlotsForDate.length === 0 ? (
                <View style={styles.noSlotsBox}>
                  <Icon name="schedule" size={28} color="#999" />
                  <Text style={styles.noSlotsText}>No slots remaining for this date</Text>
                </View>
              ) : (
                <View style={styles.slotGrid}>
                  {timeSlotsForDate.map((slot, index) => {
                    const isSelected =
                      selectedSlot &&
                      selectedSlot.startTime === slot.startTime &&
                      selectedSlot.endTime === slot.endTime &&
                      selectedSlot.period === slot.period;

                    return (
                      <TouchableOpacity
                        key={index}
                        style={[styles.slotChip, isSelected && styles.slotChipSelected]}
                        onPress={() => setSelectedSlot(slot)}
                        activeOpacity={0.7}
                      >
                        <Icon
                          name="access-time"
                          size={16}
                          color={isSelected ? '#fff' : APP_ACCENT}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={[styles.slotText, isSelected && styles.slotTextSelected]}>
                          {slot.startTime} {slot.period} - {slot.endTime} {slot.period}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Reason Input */}
              <Text style={styles.sectionTitle}>Reason for Rescheduling (Optional)</Text>
              <TextInput
                style={styles.reasonInput}
                placeholder="e.g. Prior commitment, emergency, salon maintenance..."
                placeholderTextColor="#999"
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={3}
                maxLength={200}
              />

              <View style={styles.noticeBox}>
                <Icon name="info-outline" size={18} color="#E65100" style={{ marginRight: 6 }} />
                <Text style={styles.noticeText}>
                  The booking stays at its current schedule until the customer confirms your request.
                </Text>
              </View>
            </ScrollView>
          )}

          {/* Footer Submit Button */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!selectedSlot || submitting) && styles.submitButtonDisabled,
              ]}
              disabled={!selectedSlot || submitting}
              onPress={handleSubmit}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {mode === 'request' ? 'Submit Reschedule Request' : 'Send Proposed Time'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0E5DC',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2F241D',
  },
  subtitle: {
    fontSize: 13,
    color: '#7A6758',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  scrollArea: {
    paddingHorizontal: 20,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: APP_ACCENT,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2F241D',
    marginTop: 16,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateList: {
    paddingVertical: 4,
    gap: 8,
  },
  dateChip: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#FFF6EF',
    borderWidth: 1.5,
    borderColor: '#F1D9C6',
    alignItems: 'center',
    minWidth: 70,
  },
  dateChipSelected: {
    backgroundColor: APP_ACCENT,
    borderColor: APP_ACCENT,
  },
  dayText: {
    fontSize: 12,
    color: '#7A6758',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  dateNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2F241D',
    marginVertical: 2,
  },
  monthText: {
    fontSize: 11,
    color: '#7A6758',
    fontWeight: '500',
  },
  dateTextSelected: {
    color: '#fff',
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  slotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#FFF6EF',
    borderWidth: 1.5,
    borderColor: '#F1D9C6',
  },
  slotChipSelected: {
    backgroundColor: APP_ACCENT,
    borderColor: APP_ACCENT,
  },
  slotText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2F241D',
  },
  slotTextSelected: {
    color: '#fff',
  },
  noSlotsBox: {
    padding: 20,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noSlotsText: {
    marginTop: 6,
    fontSize: 13,
    color: '#888',
  },
  reasonInput: {
    backgroundColor: '#FFF8F2',
    borderWidth: 1,
    borderColor: '#F1D9C6',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#2F241D',
    textAlignVertical: 'top',
    minHeight: 70,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
    marginBottom: 10,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    color: '#E65100',
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0E5DC',
  },
  submitButton: {
    backgroundColor: APP_ACCENT,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: APP_ACCENT,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  submitButtonDisabled: {
    backgroundColor: '#D1C4BC',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});

export default RescheduleModal;

