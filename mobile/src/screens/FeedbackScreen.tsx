// src/screens/FeedbackScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { patientService } from '../services/api';

const FeedbackScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  const { appointmentId } = route.params || {};
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Error', 'Please select a rating');
      return;
    }

    if (!comment.trim()) {
      Alert.alert('Error', 'Please write a review');
      return;
    }

    setLoading(true);
    try {
      await patientService.submitFeedback({
        appointment_id: appointmentId,
        rating,
        comment,
      });
      Alert.alert(
        'Thank You!',
        'Your feedback has been submitted successfully.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch {
      Alert.alert('Error', 'Failed to submit feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStars = () => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setRating(star)}
            style={styles.starButton}
          >
            <Icon
              name={star <= rating ? 'star' : 'star-outline'}
              size={40}
              color={star <= rating ? '#f6ad55' : '#e2e8f0'}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const getRatingLabel = () => {
    const labels: Record<number, string> = {
      1: 'Poor',
      2: 'Fair',
      3: 'Good',
      4: 'Very Good',
      5: 'Excellent',
    };
    return labels[rating] || 'Tap a star to rate';
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Rate Your Experience</Text>
          <Text style={styles.headerSubtitle}>
            Help us improve by sharing your feedback
          </Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.ratingLabel}>How would you rate your experience?</Text>
          
          {renderStars()}
          
          <Text style={styles.ratingFeedback}>{getRatingLabel()}</Text>

          <Text style={styles.commentLabel}>Write a Review</Text>
          <TextInput
            style={styles.commentInput}
            placeholder="Share your experience with the clinic..."
            placeholderTextColor="#a0aec0"
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />

          <View style={styles.quickComments}>
            <Text style={styles.quickCommentsLabel}>Quick comments:</Text>
            <View style={styles.quickCommentsContainer}>
              {[
                'Friendly staff',
                'Clean facility',
                'Professional service',
                'Great experience',
                'Will recommend',
              ].map((quick) => (
                <TouchableOpacity
                  key={quick}
                  style={[
                    styles.quickCommentChip,
                    comment.includes(quick) && styles.selectedQuickCommentChip,
                  ]}
                  onPress={() => {
                    if (comment.includes(quick)) {
                      setComment(comment.replace(quick, '').trim());
                    } else {
                      setComment(comment ? `${comment} ${quick}` : quick);
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.quickCommentText,
                      comment.includes(quick) && styles.selectedQuickCommentText,
                    ]}
                  >
                    {quick}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Icon name="send-outline" size={24} color="#fff" />
                <Text style={styles.submitButtonText}>Submit Feedback</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#667eea',
    padding: 24,
    paddingBottom: 32,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  formContainer: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: -20,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 5,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
    textAlign: 'center',
    marginBottom: 16,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
  },
  starButton: {
    padding: 4,
  },
  ratingFeedback: {
    fontSize: 18,
    fontWeight: '600',
    color: '#667eea',
    textAlign: 'center',
    marginBottom: 24,
  },
  commentLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 12,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#2d3748',
    minHeight: 150,
    backgroundColor: '#f7fafc',
  },
  quickComments: {
    marginTop: 16,
    marginBottom: 24,
  },
  quickCommentsLabel: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 8,
  },
  quickCommentsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  quickCommentChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  selectedQuickCommentChip: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  quickCommentText: {
    fontSize: 13,
    color: '#4a5568',
  },
  selectedQuickCommentText: {
    color: '#fff',
  },
  submitButton: {
    backgroundColor: '#667eea',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipButtonText: {
    color: '#a0aec0',
    fontSize: 16,
  },
});

export default FeedbackScreen;