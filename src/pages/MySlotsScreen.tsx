import { QueuedModal as Modal } from '../popup/PopupProvider';
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
import { API_BASE_URL_WITH_API } from '../config/api';
import Shimmer from '../components/Shimmer';
import LinearGradient from '../components/AppLinearGradient';

interface MySlotsScreenProps {
  onBack?: () => void;
  userId?: string;
}

const GRADIENT_COLORS = ['#FD8B36', '#f7bb2c'];
const GRADIENT_LOCATIONS = [0, 0.7];
const GRADIENT_START = { x: 0.5, y: 0.5 };
const GRADIENT_END = { x: 0.5, y: 0 };

interface AvailableSlot {
  dayRange: string;
  day?: string;
  timeSlots: Array<{
    startTime: string;
    endTime: string;
    period: string;
  }>;
}

const normalizeFetchedSlots = (raw: any): AvailableSlot[] => {
  const slotArray = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.allSlots)
      ? raw.allSlots
      : [];

  return slotArray
    .filter((slot: any) => slot && Array.isArray(slot.timeSlots) && slot.dayRange)
    .map((slot: any) => ({
      dayRange: slot.dayRange,
      day: slot.day,
      timeSlots: slot.timeSlots.map((timeSlot: any) => ({
        startTime: String(timeSlot.startTime || ''),
        endTime: String(timeSlot.endTime || ''),
        period: String(timeSlot.period || 'Am'),
      })),
    }));
};

const MySlotsScreen: React.FC<MySlotsScreenProps> = ({ onBack, userId }) => {
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedDayRange, setSelectedDayRange] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<Set<string>>(new Set());
  const [editingSlotIndex, setEditingSlotIndex] = useState<number | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [slotIndexToDelete, setSlotIndexToDelete] = useState<number | null>(null);

  // Generate day range options
  const generateDayRanges = () => {
    return [
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
      {
        key: 'all-week',
        label: 'All Week',
        startDay: 'Monday',
        endDay: 'Sunday',
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      },
    ];
  };

  const [dayRanges] = useState(generateDayRanges());

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

    let totalMinutes = 10 * 60;
    const endLimit = 22 * 60;   // 10:00 PM

    while (totalMinutes + 60 <= endLimit) {
      // Start time
      const startHour = Math.floor(totalMinutes / 60);
      const startMinute = totalMinutes % 60;

      // End time = +1 hour
      const endTotalMinutes = totalMinutes + 60;
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

      // UI label (AM/PM only once)
      const startLabel = `${startTime12.hour}:${startTime12.minute
        .toString()
        .padStart(2, '0')}`;
      const endLabel = `${endTime12.hour}:${endTime12.minute
        .toString()
        .padStart(2, '0')}`;

      const slotKey = `${dayRangeKey}_${startTime}_${endTime}`;

      slots.push({
        key: slotKey,
        label: `${startLabel} - ${endLabel} ${startTime12.period}`,
        startTime,
        endTime,
      });

      // ⏭ Move forward: 1 hr slot + 30 min gap = 90 min
      totalMinutes += 90;
    }

    return slots;
  };

  // Fetch available slots from backend
  useEffect(() => {
    const fetchAvailableSlots = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        const apiUrl = `${API_BASE_URL_WITH_API}/slots/user/${userId}`;
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Fetch slots error:', errorText);
          throw new Error(`Failed to fetch slots: ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ Available slots fetched successfully:', result);

        if (result.success && result.data) {
          const normalizedSlots = normalizeFetchedSlots(result.data);
          setAvailableSlots(normalizedSlots);
        }
      } catch (error) {
        console.error('❌ Error fetching available slots:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAvailableSlots();
  }, [userId]);

  // Helper function to format time to 12-hour format
  const formatTimeTo12Hour = (time: string): string => {
    try {
      const [hours, minutes] = time.split(':');
      const hour24 = parseInt(hours, 10);
      const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
      const ampm = hour24 >= 12 ? 'PM' : 'AM';
      const minutesStr = minutes.toString().padStart(2, '0');
      return `${hour12}:${minutesStr} ${ampm}`;
    } catch (error) {
      console.error('Error formatting time:', error);
      return time;
    }
  };

  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(part => Number(part));
    return hours * 60 + minutes;
  };

  const getSlotTimeRanges = (timeSlots: AvailableSlot['timeSlots']): string[] => {
    if (!timeSlots || timeSlots.length === 0) {
      return [];
    }

    const sorted = [...timeSlots].sort(
      (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
    );

    const ranges: Array<{ startTime: string; endTime: string }> = [];
    const maxAllowedGapInMinutes = 31; // treat <= 30m as continuous (with tiny tolerance)

    let currentStart = sorted[0].startTime;
    let currentEnd = sorted[0].endTime;
    let previousEnd = timeToMinutes(sorted[0].endTime);

    for (let i = 1; i < sorted.length; i += 1) {
      const slot = sorted[i];
      const currentStartMinutes = timeToMinutes(slot.startTime);
      const gapAfterPrevious = currentStartMinutes - previousEnd;
      const hasBreak = gapAfterPrevious > maxAllowedGapInMinutes;

      if (hasBreak) {
        ranges.push({ startTime: currentStart, endTime: currentEnd });
        currentStart = slot.startTime;
        currentEnd = slot.endTime;
      } else {
        currentEnd = slot.endTime;
      }

      previousEnd = timeToMinutes(slot.endTime);
    }

    ranges.push({ startTime: currentStart, endTime: currentEnd });

    return ranges.map(
      range =>
        `${formatTimeTo12Hour(range.startTime)} - ${formatTimeTo12Hour(range.endTime)}`,
    );
  };

  // Get day range label
  const getDayRangeLabel = (dayRange: string): string => {
    const labels: { [key: string]: string } = {
      'mon-fri': 'Monday - Friday',
      'mon-sun': 'Monday - Sunday',
      'sat-sun': 'Saturday - Sunday',
      'all-week': 'All Week',
    };
    return labels[dayRange] || dayRange;
  };

  // Handle edit button click
  const handleEditSlot = (index: number) => {
    const slot = availableSlots[index];
    setEditingSlotIndex(index);
    setSelectedDayRange(slot.dayRange || 'all-week');
    setSelectedDay(slot.day || '');

    // Pre-select existing time slots
    const timeSlots = generateTimeSlots(slot.dayRange || 'all-week');
    const preSelectedSlots = new Set<string>();

    slot.timeSlots.forEach((existingSlot) => {
      timeSlots.forEach((generatedSlot) => {
        if (
          generatedSlot.startTime === existingSlot.startTime &&
          generatedSlot.endTime === existingSlot.endTime
        ) {
          preSelectedSlots.add(generatedSlot.key);
        }
      });
    });

    setSelectedTimeSlots(preSelectedSlots);
    setIsEditMode(true);
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditingSlotIndex(null);
    setSelectedDayRange('');
    setSelectedDay('');
    setSelectedTimeSlots(new Set());
  };

  // Handle save slot
  const handleSaveSlot = async () => {
    if (selectedTimeSlots.size === 0) {
      Alert.alert('Error', 'Please select at least one time slot');
      return;
    }

    if (!userId) {
      Alert.alert('Error', 'User ID is missing. Please login again.');
      return;
    }

    try {
      setSaving(true);

      const timeSlots = generateTimeSlots(selectedDayRange);
      const timeSlotsData = Array.from(selectedTimeSlots)
        .map((slotKey) => {
          const slot = timeSlots.find((s) => s.key === slotKey);
          if (slot) {
            const periodMatch = slot.label.match(/\s(Am|Pm)$/i);
            const period = periodMatch
              ? (periodMatch[1].toLowerCase() === 'am' ? 'Am' : 'Pm')
              : 'Am';

            return {
              startTime: slot.startTime,
              endTime: slot.endTime,
              period,
            };
          }
          return null;
        })
        .filter((slot) => slot !== null);

      const isEditingSpecificDay = editingSlotIndex !== null && !!selectedDay;
      const apiUrl = isEditingSpecificDay
        ? `${API_BASE_URL_WITH_API}/slots/update-day`
        : `${API_BASE_URL_WITH_API}/slots/save`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(
          isEditingSpecificDay
            ? {
              userId,
              day: selectedDay,
              dayRange: selectedDayRange,
              timeSlots: timeSlotsData,
            }
            : {
              userId,
              dayRange: selectedDayRange,
              timeSlots: timeSlotsData,
            },
        ),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Save slots error:', errorText);
        throw new Error(`Failed to save slots: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Available slots saved successfully:', result);

      // Update local state
      const updatedSlots = [...availableSlots];
      if (editingSlotIndex !== null) {
        updatedSlots[editingSlotIndex] = {
          dayRange: selectedDayRange,
          day: selectedDay || updatedSlots[editingSlotIndex]?.day,
          timeSlots: timeSlotsData,
        };
      } else {
        updatedSlots.push({
          dayRange: selectedDayRange,
          timeSlots: timeSlotsData,
        });
      }
      setAvailableSlots(updatedSlots);

      // Reset edit mode
      setIsEditMode(false);
      setEditingSlotIndex(null);
      setSelectedDayRange('');
      setSelectedDay('');
      setSelectedTimeSlots(new Set());

      Alert.alert('Success', 'Slots updated successfully!');
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

  // Handle delete slot
  const handleDeleteSlot = (index: number) => {
    setSlotIndexToDelete(index);
    setShowDeleteModal(true);
  };

  const handleConfirmDeleteSlot = async () => {
    if (slotIndexToDelete === null) {
      setShowDeleteModal(false);
      return;
    }

    const slotToDelete = availableSlots[slotIndexToDelete];

    if (!userId) {
      Alert.alert('Error', 'User ID is missing. Please login again.');
      setShowDeleteModal(false);
      return;
    }

    if (!slotToDelete?.day) {
      Alert.alert(
        'Unable to Delete',
        'This slot does not have a specific day attached. Please edit and save the slot first, then try again.',
      );
      setShowDeleteModal(false);
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(`${API_BASE_URL_WITH_API}/slots/delete-day`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          userId,
          day: slotToDelete.day,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Delete slot error:', errorText);
        throw new Error(`Failed to delete slot: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Slot deleted successfully:', result);

      const updatedSlots = availableSlots.filter((_, i) => i !== slotIndexToDelete);
      setAvailableSlots(updatedSlots);
      Alert.alert('Success', `Slot deleted for ${slotToDelete.day}`);
    } catch (error) {
      console.error('❌ Error deleting slot:', error);
      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Failed to delete slot. Please try again.',
      );
    } finally {
      setSaving(false);
      setShowDeleteModal(false);
      setSlotIndexToDelete(null);
    }
  };

  // Handle day range selection in edit mode
  const handleDayRangeSelect = (dayRangeKey: string) => {
    setSelectedDayRange(dayRangeKey);
    setSelectedTimeSlots(new Set());
  };

  // Handle time slot toggle in edit mode
  const handleTimeSlotToggle = (slotKey: string) => {
    const newSelected = new Set(selectedTimeSlots);
    if (newSelected.has(slotKey)) {
      newSelected.delete(slotKey);
    } else {
      newSelected.add(slotKey);
    }
    setSelectedTimeSlots(newSelected);
  };

  const timeSlots = selectedDayRange ? generateTimeSlots(selectedDayRange) : [];
  const groupedSlots = availableSlots.reduce(
    (acc, slot, index) => {
      const key = slot.dayRange || 'all-week';
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push({ slot, index });
      return acc;
    },
    {} as Record<string, Array<{ slot: AvailableSlot; index: number }>>,
  );

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowDeleteModal(false);
          setSlotIndexToDelete(null);
        }}>
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalCard}>
            <Text style={styles.deleteModalTitle}>Delete Slot</Text>
            <Text style={styles.deleteModalMessage}>
              Are you sure you want to delete this slot?
            </Text>
            <View style={styles.deleteModalActions}>
              <TouchableOpacity
                style={styles.deleteModalCancelBtn}
                onPress={() => {
                  setShowDeleteModal(false);
                  setSlotIndexToDelete(null);
                }}
                activeOpacity={0.8}>
                <Text style={styles.deleteModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteModalDeleteBtn, saving && styles.saveButtonDisabled]}
                onPress={handleConfirmDeleteSlot}
                activeOpacity={0.8}
                disabled={saving}>
                <Text style={styles.deleteModalDeleteText}>
                  {saving ? 'Deleting...' : 'Delete'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        {onBack && !isEditMode && (
          <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
            <Icon name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
        )}
        {isEditMode && (
          <TouchableOpacity onPress={handleCancelEdit} style={styles.backButton} activeOpacity={0.7}>
            <Icon name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>
          {isEditMode ? 'Edit Slot' : 'My Slots'}
        </Text>
        {!isEditMode && (
          <TouchableOpacity
            onPress={() => {
              // Add new slot
              setEditingSlotIndex(null);
              setSelectedDayRange(dayRanges[0].key);
              setSelectedDay('');
              setSelectedTimeSlots(new Set());
              setIsEditMode(true);
            }}
            style={styles.editButton}
            activeOpacity={0.7}>
            <Icon name="add" size={24} color="#FD8B36" />
          </TouchableOpacity>
        )}
        {isEditMode && <View style={styles.headerSpacer} />}
      </View>

      {isEditMode ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* Day Range Selection */}
          {editingSlotIndex === null ? (
            <>
              <Text style={styles.sectionTitle}>Select Day Range</Text>
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
                      selectedDayRange === range.key && styles.dateButtonSelected,
                    ]}
                    onPress={() => handleDayRangeSelect(range.key)}
                    activeOpacity={0.7}>
                    {selectedDayRange === range.key && (
                      <LinearGradient
                        colors={GRADIENT_COLORS}
                        locations={GRADIENT_LOCATIONS}
                        start={GRADIENT_START}
                        end={GRADIENT_END}
                        style={styles.dateButtonGradient}
                      />
                    )}
                    <Text
                      style={[
                        styles.dateRangeText,
                        selectedDayRange === range.key && styles.dateTextSelected,
                      ]}>
                      {range.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          ) : (
            <View style={styles.editingDayInfo}>
              <Text style={styles.sectionTitle}>Editing Day</Text>
              <Text style={styles.editingDayText}>
                {selectedDay || 'Selected Day'} ({getDayRangeLabel(selectedDayRange)})
              </Text>
            </View>
          )}

          {/* Time Slots Selection */}
          {selectedDayRange && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Time Slots</Text>
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
                      {isSelected && (
                        <LinearGradient
                          colors={GRADIENT_COLORS}
                          locations={GRADIENT_LOCATIONS}
                          start={GRADIENT_START}
                          end={GRADIENT_END}
                          style={styles.timeSlotGradientOverlay}
                        />
                      )}
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
          )}

          {/* Save Button */}
          {selectedTimeSlots.size > 0 && (
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveSlot}
              activeOpacity={0.8}
              disabled={saving}>
              <LinearGradient
                colors={GRADIENT_COLORS}
                locations={GRADIENT_LOCATIONS}
                start={GRADIENT_START}
                end={GRADIENT_END}
                style={[styles.saveButtonGradient, saving && styles.saveButtonGradientDisabled]}>
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Slot</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}
        </ScrollView>
      ) : loading ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {[1, 2, 3].map((item) => (
            <View key={item} style={styles.slotCardShimmer}>
              <Shimmer width="60%" height={20} borderRadius={8} style={{ marginBottom: 12 }} />
              <View style={styles.timeSlotsShimmer}>
                {[1, 2, 3, 4, 5, 6].map((slot) => (
                  <Shimmer
                    key={slot}
                    width={80}
                    height={36}
                    borderRadius={8}
                    style={{ marginRight: 8, marginBottom: 8 }}
                  />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      ) : availableSlots.length > 0 ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {Object.entries(groupedSlots).map(([dayRange, items]) => (
            <View key={dayRange} style={styles.rangeGroup}>
              <View style={styles.rangeHeader}>
                <Icon name="calendar-today" size={18} color="#FD8B36" />
                <Text style={styles.rangeHeaderText}>{getDayRangeLabel(dayRange)}</Text>
              </View>

              {items.map(({ slot, index }) => (
                <View key={index} style={styles.slotCard}>
                  <View style={styles.slotCardHeader}>
                    <Text style={styles.slotCardTitle}>
                      {slot.day || 'Selected Day'}
                    </Text>
                    <View style={styles.slotCardActions}>
                      <TouchableOpacity
                        onPress={() => handleEditSlot(index)}
                        style={styles.actionButton}
                        activeOpacity={0.7}>
                        <Icon name="edit" size={18} color="green" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteSlot(index)}
                        style={styles.actionButton}
                        activeOpacity={0.7}>
                        <Icon name="delete" size={18} color="#FF5722" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.timeSlotsContainer}>
                    {(() => {
                      const ranges = getSlotTimeRanges(slot.timeSlots);
                      if (ranges.length === 0) {
                        return <Text style={styles.noTimeSlotsText}>No time slots available</Text>;
                      }

                      return ranges.map((range, rangeIndex) => (
                        <View key={rangeIndex} style={styles.timeSlotChip}>
                          <Icon name="access-time" size={14} color="#666" />
                          <Text style={styles.timeSlotText}>{range}</Text>
                        </View>
                      ));
                    })()}
                  </View>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyContainer}>
          <Icon name="schedule" size={64} color="#E0E0E0" />
          <Text style={styles.emptyText}>No Available Slots</Text>
          <Text style={styles.emptySubtext}>
            You haven't set up your available slots yet.
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              setEditingSlotIndex(null);
              setSelectedDayRange(dayRanges[0].key);
              setSelectedDay('');
              setSelectedTimeSlots(new Set());
              setIsEditMode(true);
            }}
            activeOpacity={0.8}>
            <Text style={styles.addButtonText}>Add Your First Slot</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF3E8',
    paddingTop: compactTopPadding(20),
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
  editButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  section: {
    marginTop: 24,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  dateScrollView: {
    marginHorizontal: -24,
  },
  dateScrollContent: {
    paddingHorizontal: 24,
  },
  editingDayInfo: {
    marginBottom: 12,
  },
  editingDayText: {
    fontSize: 14,
    color: '#555',
    marginTop: -8,
    marginBottom: 8,
    fontWeight: '600',
  },
  dateButton: {
    minWidth: 100,
    height: 50,
    backgroundColor: '#FFF',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    overflow: 'hidden',
  },
  dateButtonSelected: {
    borderColor: 'transparent',
  },
  dateRangeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  dateTextSelected: {
    color: '#fff',
  },
  dateButtonGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
  },
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginTop: 8,
  },
  timeSlotButton: {
    width: '30%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingVertical: 12,
    paddingHorizontal: 10,
    margin: 6,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 50,
    backgroundColor: '#fff',
    overflow: 'hidden',
    position: 'relative',
  },
  timeSlotButtonSelected: {
    borderColor: 'transparent',
  },
  timeSlotText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
  },
  timeSlotTextSelected: {
    color: '#fff',
  },
  timeSlotGradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
  },
  saveButton: {
    marginTop: 24,
    marginBottom: 40,
    borderRadius: 52,
    overflow: 'hidden',
    width: '100%',
  },
  saveButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonGradientDisabled: {
    opacity: 0.6,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  slotCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    // borderWidth: 1,
    // borderColor: '#E0E0E0',
  },
  slotCardShimmer: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  rangeGroup: {
    marginBottom: 14,
  },
  rangeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  rangeHeaderText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
  },
  slotCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  slotCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  slotCardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 4,
  },
  timeSlotsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeSlotsShimmer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  timeSlotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 6,
  },

  noTimeSlotsText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 24,
  },
  addButton: {
    backgroundColor: '#FD8B36',
    borderRadius: 52,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  deleteModalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 8,
  },
  deleteModalMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 18,
  },
  deleteModalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  deleteModalCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteModalCancelText: {
    color: '#555',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteModalDeleteBtn: {
    flex: 1,
    backgroundColor: '#FD8B36',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteModalDeleteText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default MySlotsScreen;
