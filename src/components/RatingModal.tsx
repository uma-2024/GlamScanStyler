import { QueuedModal as Modal } from '../popup/PopupProvider';
import { QueuedAlert as Alert } from '../popup/QueuedAlert';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { API_BASE_URL_WITH_API } from '../config/api';

interface RatingModalProps {
  visible: boolean;
  bookingId: string;
  userId: string;
  stylistId: string;
  userName: string;
  onClose: () => void;
  onRatingSubmitted: () => void;
}

const RatingModal: React.FC<RatingModalProps> = ({
  visible,
  bookingId,
  userId,
  stylistId,
  userName,
  onClose,
  onRatingSubmitted,
}) => {
  const insets = useSafeAreaInsets();
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [ratingComment, setRatingComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleSubmitRating = async () => {
    if (selectedRating === 0) {
      Alert.alert('Please Rate', 'Please select a rating before submitting.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${API_BASE_URL_WITH_API}/bookings/${bookingId}/stylist-rating`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            stylistId,
            userId,
            rating: selectedRating,
            ratingComment: ratingComment.trim() || undefined,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to submit rating' }));
        throw new Error(errorData.message || 'Failed to submit rating');
      }

      const result = await response.json();
      console.log('✅ Rating submitted successfully:', result);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('❌ Error submitting rating:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to submit rating. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedRating(0);
    setRatingComment('');
    setShowSuccessModal(false);
    onClose();
  };

  const handleSuccessContinue = () => {
    setShowSuccessModal(false);
    setSelectedRating(0);
    setRatingComment('');
    onRatingSubmitted();
  };

  const renderStars = () => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setSelectedRating(star)}
            activeOpacity={0.7}
            disabled={isSubmitting}>
            <Icon
              name={selectedRating >= star ? 'star' : 'star-border'}
              size={40}
              color={selectedRating >= star ? '#FFD700' : '#ccc'}
              style={styles.star}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}>
      <View style={[styles.modalOverlay, { paddingTop: insets.top + 10 }]}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Rate {userName}</Text>
            <TouchableOpacity onPress={handleClose} disabled={isSubmitting}>
              <Icon name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            How was your experience with this customer?
          </Text>

          {renderStars()}

          <Text style={styles.commentLabel}>Add a comment (optional)</Text>
          <TextInput
            style={styles.commentInput}
            placeholder="Share your experience..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            value={ratingComment}
            onChangeText={setRatingComment}
            editable={!isSubmitting}
          />

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmitRating}
              disabled={isSubmitting || selectedRating === 0}>
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Rating</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.skipButton, isSubmitting && styles.skipButtonDisabled]}
              onPress={handleClose}
              disabled={isSubmitting}>
              <Text style={styles.skipButtonText}>Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleSuccessContinue}>
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconWrap}>
              <Icon name="task-alt" size={36} color="#fff" />
            </View>
            <Text style={styles.successTitle}>Rating Submitted</Text>
            <Text style={styles.successSubtitle}>Thank you for sharing your feedback.</Text>
            <TouchableOpacity
              style={styles.successButton}
              onPress={handleSuccessContinue}
              activeOpacity={0.85}>
              <Text style={styles.successButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  star: {
    marginHorizontal: 4,
  },
  commentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#333',
    textAlignVertical: 'top',
    minHeight: 100,
    marginBottom: 24,
  },
  buttonContainer: {
    gap: 12,
  },
  submitButton: {
    backgroundColor: '#FD8B36',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonDisabled: {
    opacity: 0.6,
  },
  skipButtonText: {
    color: '#666',
    fontSize: 14,
  },
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 26,
    alignItems: 'center',
  },
  successIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FD8B36',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 18,
  },
  successButton: {
    backgroundColor: '#FD8B36',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  successButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default RatingModal;
