import { QueuedAlert as Alert } from '../popup/QueuedAlert';



import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import SafeAreaView from '../components/SafeAreaView';
import { compactTopPadding } from '../utils/responsiveLayout';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from '../components/AppLinearGradient';
import { API_BASE_URL_WITH_API } from '../config/api';
import { updateOnboardingStep } from '../utils/onboardingSteps';

interface SelectAvailableSlotsScreenProps {
  onBack?: () => void;
  onConfirm?: () => void;
  onSkip?: () => void;
  userId?: string; // User ID for saving slots
  initialData?: SelectAvailableSlotsDraft;
  onChange?: (data: SelectAvailableSlotsDraft) => void;
}

export interface SelectAvailableSlotsDraft {
  selectedDayRange: string;
  selectedTimeSlotKeys: string[];
}

const SelectAvailableSlotsScreen: React.FC<SelectAvailableSlotsScreenProps> = ({
  onBack,
  onConfirm,
  onSkip,
  userId,
  initialData,
  onChange,
}) => {
  const [dayRanges] = useState([
    {
      key: 'mon-fri',
      label: 'Mon-Friday',
      startDay: 'Monday',
      endDay: 'Friday',
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    },
    {
      key: 'mon-sun',
      label: 'Mon-Sunday',
      startDay: 'Monday',
      endDay: 'Sunday',
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    },
    {
      key: 'sat-sun',
      label: 'Sat-Sunday',
      startDay: 'Saturday',
      endDay: 'Sunday',
      days: ['Saturday', 'Sunday'],
    },
  ]);

  const [selectedDayRange, setSelectedDayRange] = useState<string>(
    initialData?.selectedDayRange || 'mon-fri',
  );
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<Set<string>>(
    () => new Set(initialData?.selectedTimeSlotKeys || []),
  );
  const [saving, setSaving] = useState(false);
  const [skipping, setSkipping] = useState(false);

  // Sync external initialData changes if they differ from local state
  const isInternalChangeRef = React.useRef(false);

  useEffect(() => {
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false;
      return;
    }
    if (initialData?.selectedDayRange && initialData.selectedDayRange !== selectedDayRange) {
      setSelectedDayRange(initialData.selectedDayRange);
    }
    if (initialData?.selectedTimeSlotKeys) {
      const incomingKeys = initialData.selectedTimeSlotKeys;
      const currentKeys = Array.from(selectedTimeSlots);
      if (
        incomingKeys.length !== currentKeys.length ||
        incomingKeys.some(k => !selectedTimeSlots.has(k))
      ) {
        setSelectedTimeSlots(new Set(incomingKeys));
      }
    }
  }, [initialData]);

  const notifyChange = (dayRange: string, slotKeys: Set<string>) => {
    isInternalChangeRef.current = true;
    onChange?.({
      selectedDayRange: dayRange,
      selectedTimeSlotKeys: Array.from(slotKeys),
    });
  };

  // Helper function to convert 24-hour to 12-hour format
  const formatTo12Hour = (hour24: number, minute: number) => {
    let hour12 = hour24;
    let period = 'AM';
    
    if (hour24 === 0) {
      hour12 = 12;
      period = 'AM';
    } else if (hour24 === 12) {
      hour12 = 12;
      period = 'PM';
    } else if (hour24 > 12) {
      hour12 = hour24 - 12;
      period = 'PM';
    } else {
      period = 'AM';
    }
    
    return {
      hour: hour12,
      minute: minute,
      period: period,
      formatted: `${hour12}:${minute.toString().padStart(2, '0')} ${period}`
    };
  };

const generateTimeSlots = (dayRangeKey: string) => {
  const slots = [];

  let totalMinutes = 10 * 60;   // Start at 10:00 AM
  const endLimit = 22 * 60;     // End at 10:00 PM

  const SLOT_DURATION = 60; // 1 hour slot
  const BREAK_DURATION = 0;

  while (totalMinutes + SLOT_DURATION <= endLimit) {
    // Start time
    const startHour = Math.floor(totalMinutes / 60);
    const startMinute = totalMinutes % 60;

    // End time = +1 hour
    const endTotalMinutes = totalMinutes + SLOT_DURATION;
    const endHour = Math.floor(endTotalMinutes / 60);
    const endMinute = endTotalMinutes % 60;

    // 12-hour formatting
    const startTime12 = formatTo12Hour(startHour, startMinute);
    const endTime12 = formatTo12Hour(endHour, endMinute);

    // Backend-safe time (24h)
    const startTime = `${startHour.toString().padStart(2, '0')}:${startMinute
      .toString()
      .padStart(2, '0')}`;
    const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute
      .toString()
      .padStart(2, '0')}`;

    const startLabel = startTime12.formatted;
    const endLabel = endTime12.formatted;

    const slotKey = `${dayRangeKey}_${startTime}_${endTime}`;

    slots.push({
      key: slotKey,
      label: `${startLabel} - ${endLabel}`,
      startTime,
      endTime,
      period: startTime12.period === 'AM' ? 'Am' : 'Pm',
    });

    // Move forward by one hour.
    totalMinutes += SLOT_DURATION + BREAK_DURATION;
  }

  return slots;
};


  const timeSlots = selectedDayRange ? generateTimeSlots(selectedDayRange) : [];

  const handleDayRangeSelect = (dayRangeKey: string) => {
    setSelectedDayRange(dayRangeKey);
    const newSelected = new Set<string>();
    setSelectedTimeSlots(newSelected);
    notifyChange(dayRangeKey, newSelected);
  };

  const handleTimeSlotToggle = (slotKey: string) => {
    const newSelected = new Set(selectedTimeSlots);
    if (newSelected.has(slotKey)) {
      newSelected.delete(slotKey);
    } else {
      newSelected.add(slotKey);
    }
    setSelectedTimeSlots(newSelected);
    notifyChange(selectedDayRange, newSelected);
  };

  const handleSelectAll = () => {
    if (timeSlots.length === 0) {
      return;
    }

    let newSelected: Set<string>;
    if (selectedTimeSlots.size === timeSlots.length) {
      newSelected = new Set();
    } else {
      newSelected = new Set(timeSlots.map((slot) => slot.key));
    }
    setSelectedTimeSlots(newSelected);
    notifyChange(selectedDayRange, newSelected);
  };

  const handleConfirm = async () => {
    if (saving || skipping) return;

    if (selectedTimeSlots.size === 0) {
      if (onSkip) {
        try {
          setSkipping(true);
          await onSkip();
        } finally {
          setSkipping(false);
        }
      } else if (onConfirm) {
        try {
          setSaving(true);
          await onConfirm();
        } finally {
          setSaving(false);
        }
      } else {
        Alert.alert('Notice', 'Please select at least one time slot or skip.');
      }
      return;
    }

    // Validate userId is present
    if (!userId) {
      Alert.alert('Error', 'User ID is missing. Please login again.');
      return;
    }

    try {
      setSaving(true);
      
      // Extract time slot data from selected slots
      // We need to get the actual slot data from the timeSlots array
      const timeSlotsData = Array.from(selectedTimeSlots)
        .map((slotKey) => {
          // Find the slot in the timeSlots array
          const slot = timeSlots.find((s) => s.key === slotKey);
          if (slot) {
            return {
              startTime: slot.startTime,
              endTime: slot.endTime,
              period: slot.period,
            };
          }
          return null;
        })
        .filter((slot) => slot !== null);



      const apiUrl = `${API_BASE_URL_WITH_API}/slots/save`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          userId,
          dayRange: selectedDayRange,
          timeSlots: timeSlotsData,
        }),
      });

      console.log('🟢 Save slots response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Save slots error:', errorText);
        throw new Error(`Failed to save slots: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Available slots saved successfully:', result);

      // Mark selectAvailableSlots step as completed
      if (userId) {
        await updateOnboardingStep(userId, 'selectAvailableSlots', true);
      }

      // Navigate to next screen after successful save
      if (onConfirm) {
        onConfirm();
      }
    } catch (error) {
      console.error('❌ Error saving available slots:', error);
      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Failed to save available slots. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={[ 'left', 'right', 'bottom']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.7}>
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Available Slots</Text>
        <View style={{ width: 40 }} /> {/* Placeholder for right side of header */}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Description */}
        <Text style={styles.sectionDescription}>
          Select Your Available Slots According To Your Availability For Whole
          Week . You Can Change It Later .
        </Text>

        {/* Day Range Selection */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.dateScrollView}
          contentContainerStyle={styles.dateScrollContent}>
          {dayRanges.map((range) => (
            <TouchableOpacity
              key={range.key}
              style={[
                styles.dateButton,
                selectedDayRange === range.key && styles.dateButtonSelectedWrapper,
              ]}
              onPress={() => handleDayRangeSelect(range.key)}
              activeOpacity={0.7}>
              {selectedDayRange === range.key ? (
                <LinearGradient
                  colors={['#FD8B36', '#f7bb2c']}
                  start={{ x: 0.5, y: 0.5 }}
                  end={{ x: 0.5, y: 0 }}
                  style={styles.dateButtonSelected}>
                  <Text style={styles.dateTextSelected}>{range.label}</Text>
                </LinearGradient>
              ) : (
                <View style={styles.dateButtonInner}>
                  <Text style={styles.dateRangeText}>{range.label}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Select Service Start Time Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Select Service Start Time</Text>
            <TouchableOpacity
              style={styles.selectAllButton}
              onPress={handleSelectAll}
              activeOpacity={0.8}>
              <LinearGradient
                colors={['#FD8B36', '#f7bb2c']}
                start={{ x: 0.5, y: 0.5 }}
                end={{ x: 0.5, y: 0 }}
                style={styles.selectAllButtonGradient}>
                <Text style={styles.selectAllButtonText}>
                  {selectedTimeSlots.size === timeSlots.length && timeSlots.length > 0
                    ? 'Clear All'
                    : 'Select All'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Time Slots Grid */}
          <View style={styles.timeSlotsGrid}>
            {timeSlots.map((slot) => {
              const isSelected = selectedTimeSlots.has(slot.key);
              return (
                <TouchableOpacity
                  key={slot.key}
                  style={[
                    styles.timeSlotButton,
                    isSelected && styles.timeSlotButtonSelected,
                  ]}
                  onPress={() => handleTimeSlotToggle(slot.key)}
                  activeOpacity={0.7}>
                  <Text
                    style={[
                      styles.timeSlotText,
                      isSelected && styles.timeSlotTextSelected,
                    ]}>
                    {slot.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

      
      </ScrollView>
      <View style={styles.confirmButtonContainer}>
        <TouchableOpacity
          style={[
            styles.confirmButton,
            saving && styles.confirmButtonDisabled,
          ]}
          onPress={() => {
            if (selectedTimeSlots.size === 0) {
              if (onSkip) onSkip();
              else handleConfirm();
            } else {
              handleConfirm();
            }
          }}
          activeOpacity={0.8}
          disabled={saving}
          hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
          <LinearGradient
            colors={
              selectedTimeSlots.size > 0
                ? ['#FD8B36', '#f7bb2c']
                : ['#E0E0E0', '#CCCCCC']
            }
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 0.5, y: 0 }}
            style={styles.confirmButtonGradient}>
            {saving ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.confirmButtonText}>Saving Slots...</Text>
              </View>
            ) : (
              <Text
                style={[
                  styles.confirmButtonText,
                  selectedTimeSlots.size === 0 && { color: '#555' },
                ]}>
                {selectedTimeSlots.size > 0 ? 'Confirm Slots' : 'Next / Skip Slots'}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
        {onSkip && (
          <TouchableOpacity
            style={[styles.skipButton, (saving || skipping) && { opacity: 0.6 }]}
            onPress={async () => {
              if (saving || skipping) return;
              try {
                setSkipping(true);
                await onSkip();
              } finally {
                setSkipping(false);
              }
            }}
            disabled={saving || skipping}
            activeOpacity={0.8}
            hitSlop={{ top: 12, bottom: 12, left: 24, right: 24 }}>
            {skipping ? (
              <ActivityIndicator size="small" color="#FD8B36" />
            ) : (
              <Text style={styles.skipButtonText}>Skip</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF3E8',
    // marginTop: 20,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: compactTopPadding(30),
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:'space-between'
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: '#333',
    // flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 100, // Space for bottom nav
  },
  section: {
    marginTop: 24,
    marginBottom: 32,

  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
    // marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
        // backgroundColor:'red'
  },
  selectAllButton: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  selectAllButtonGradient: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  selectAllButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 20,
  },
  dateScrollView: {
    marginHorizontal: -24,
  },
  dateScrollContent: {
    paddingHorizontal: 24,
  },
  dateButton: {
    minWidth: 120,
    height: 58,
    backgroundColor: '#FFF6F0',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  dateButtonSelectedWrapper: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  dateButtonSelected: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateButtonInner: {
    width: '100%',
    height: '100%',
    paddingHorizontal: 20,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateRangeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  dateTextSelected: {
    color: '#fff',
  },
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginTop: 8,
    justifyContent:'space-between'
  },
  timeSlotButton: {
    width: '28%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingVertical: 12,
    paddingHorizontal: 10,
    margin: 6,
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 50,

  },
  timeSlotButtonSelected: {
    backgroundColor: '#FD8B3675',
    borderColor: '#FD8B3675',
  },
  timeSlotText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
  },
  timeSlotTextSelected: {
    color: '#333',
  },
  confirmButtonContainer: {
    paddingTop: 12,
    paddingBottom: 24,
    paddingHorizontal: 24,
    backgroundColor: '#FFF3E8',
    zIndex: 10,
    elevation: 6,
  },
  confirmButton: {
    borderRadius: 52,
    width: '100%',
    overflow: 'hidden',
  },
  confirmButtonGradient: {
    width: '100%',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 52,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  skipButton: {
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  skipButtonText: {
    color: '#FD8B36',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default SelectAvailableSlotsScreen;
