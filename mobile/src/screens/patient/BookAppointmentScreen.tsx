// src/screens/BookAppointmentScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { patientService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

type Dentist = {
  id: number | string;
  name: string;
  specialization: string;
};

const BookAppointmentScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  const { clinicId } = route.params || {};
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    clinic_id: clinicId || '',
    dentist_id: '' as number | string,
    appointment_date: new Date(),
    appointment_time: '09:00',
    notes: '',
    reason: '',
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dentists, setDentists] = useState<Dentist[]>([]);
  const [selectedDentist, setSelectedDentist] = useState<Dentist | null>(null);

  useEffect(() => {
    if (clinicId) {
      fetchDentists();
    }
  }, [clinicId]);

  const fetchDentists = async () => {
    try {
      // Fetch dentists for the clinic
      // This would be an API call to get dentists by clinic
      // For now, using sample data
      setDentists([
        { id: 1, name: 'Dr. Maria Santos', specialization: 'Orthodontics' },
        { id: 2, name: 'Dr. Juan Reyes', specialization: 'General Dentistry' },
        { id: 3, name: 'Dr. Anna Cruz', specialization: 'Pediatric Dentistry' },
      ]);
    } catch (error) {
      console.error('Error fetching dentists:', error);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setFormData({ ...formData, appointment_date: selectedDate });
    }
  };

  const handleSubmit = async () => {
    if (!formData.dentist_id) {
      Alert.alert('Error', 'Please select a dentist');
      return;
    }

    if (!formData.reason) {
      Alert.alert('Error', 'Please provide a reason for the appointment');
      return;
    }

    setLoading(true);
    try {
      const appointmentData = {
        ...formData,
        patient_id: user?.id,
        appointment_date: formData.appointment_date.toISOString().split('T')[0],
      };
      await patientService.createAppointment(appointmentData);
      Alert.alert(
        'Success',
        'Appointment booked successfully! You will receive a confirmation shortly.',
        [
          {
            text: 'View Appointments',
            onPress: () => navigation.navigate('Appointments'),
          },
          { text: 'OK', style: 'cancel' },
        ]
      );
    } catch {
      Alert.alert('Error', 'Failed to book appointment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const availableSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30',
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Book Appointment</Text>
          <Text style={styles.headerSubtitle}>Schedule your dental visit</Text>
        </View>

        <View style={styles.formContainer}>
          {/* Select Dentist */}
          <Text style={styles.label}>Select Dentist</Text>
          <View style={styles.dentistList}>
            {dentists.map((dentist) => (
              <TouchableOpacity
                key={dentist.id}
                style={[
                  styles.dentistCard,
                  selectedDentist?.id === dentist.id && styles.selectedDentistCard,
                ]}
                onPress={() => {
                  setSelectedDentist(dentist);
                  setFormData({ ...formData, dentist_id: dentist.id });
                }}
              >
                <View style={styles.dentistAvatar}>
                  <Text style={styles.dentistInitials}>
                    {dentist.name.charAt(0)}
                  </Text>
                </View>
                <View style={styles.dentistInfo}>
                  <Text style={styles.dentistName}>{dentist.name}</Text>
                  <Text style={styles.dentistSpecialty}>{dentist.specialization}</Text>
                </View>
                {selectedDentist?.id === dentist.id && (
                  <Icon name="checkmark-circle" size={24} color="#48bb78" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Date Selection */}
          <Text style={styles.label}>Select Date</Text>
          <TouchableOpacity
            style={styles.datePickerButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Icon name="calendar-outline" size={20} color="#667eea" />
            <Text style={styles.datePickerText}>
              {formData.appointment_date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
            <Icon name="chevron-down" size={20} color="#a0aec0" />
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={formData.appointment_date}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              minimumDate={new Date()}
            />
          )}

          {/* Time Selection */}
          <Text style={styles.label}>Select Time</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeSlots}>
            {availableSlots.map((time) => (
              <TouchableOpacity
                key={time}
                style={[
                  styles.timeSlot,
                  formData.appointment_time === time && styles.selectedTimeSlot,
                ]}
                onPress={() => setFormData({ ...formData, appointment_time: time })}
              >
                <Text
                  style={[
                    styles.timeSlotText,
                    formData.appointment_time === time && styles.selectedTimeSlotText,
                  ]}
                >
                  {time}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Reason for Visit */}
          <Text style={styles.label}>Reason for Visit</Text>
          <View style={styles.reasonContainer}>
            {['Checkup', 'Cleaning', 'Braces', 'Surgery', 'Emergency', 'Other'].map(
              (reason) => (
                <TouchableOpacity
                  key={reason}
                  style={[
                    styles.reasonOption,
                    formData.reason === reason && styles.selectedReasonOption,
                  ]}
                  onPress={() => setFormData({ ...formData, reason })}
                >
                  <Text
                    style={[
                      styles.reasonOptionText,
                      formData.reason === reason && styles.selectedReasonOptionText,
                    ]}
                  >
                    {reason}
                  </Text>
                </TouchableOpacity>
              )
            )}
          </View>

          {/* Notes */}
          <Text style={styles.label}>Additional Notes (Optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Any special requests or concerns..."
            placeholderTextColor="#a0aec0"
            value={formData.notes}
            onChangeText={(text) => setFormData({ ...formData, notes: text })}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Icon name="calendar-outline" size={24} color="#fff" />
                <Text style={styles.submitButtonText}>Book Appointment</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Cancellation Policy */}
          <View style={styles.policyContainer}>
            <Icon name="information-circle-outline" size={20} color="#a0aec0" />
            <Text style={styles.policyText}>
              Please arrive 15 minutes before your appointment. 
              Cancellations must be made at least 24 hours in advance.
            </Text>
          </View>
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
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 5,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 12,
    marginTop: 16,
  },
  dentistList: {
    marginBottom: 8,
  },
  dentistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  selectedDentistCard: {
    borderColor: '#667eea',
    backgroundColor: '#ebf8ff',
  },
  dentistAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dentistInitials: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  dentistInfo: {
    flex: 1,
  },
  dentistName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
  },
  dentistSpecialty: {
    fontSize: 14,
    color: '#718096',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#f7fafc',
  },
  datePickerText: {
    flex: 1,
    fontSize: 16,
    color: '#2d3748',
    marginLeft: 12,
  },
  timeSlots: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  timeSlot: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
    backgroundColor: '#fff',
  },
  selectedTimeSlot: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  timeSlotText: {
    fontSize: 14,
    color: '#2d3748',
  },
  selectedTimeSlotText: {
    color: '#fff',
  },
  reasonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  reasonOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  selectedReasonOption: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  reasonOptionText: {
    fontSize: 14,
    color: '#2d3748',
  },
  selectedReasonOptionText: {
    color: '#fff',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#2d3748',
    minHeight: 100,
    backgroundColor: '#f7fafc',
  },
  submitButton: {
    backgroundColor: '#667eea',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 24,
    marginBottom: 16,
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
  policyContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#f7fafc',
    borderRadius: 12,
  },
  policyText: {
    flex: 1,
    fontSize: 13,
    color: '#718096',
    marginLeft: 8,
    lineHeight: 18,
  },
});

export default BookAppointmentScreen;