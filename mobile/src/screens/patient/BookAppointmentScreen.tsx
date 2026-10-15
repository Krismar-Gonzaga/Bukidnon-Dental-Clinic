// Book an appointment, or move an existing one (route.params.reschedule).
//
// Every option comes from the API: the clinic's services and dentists, the
// dates the chosen dentist works, and the open times on the chosen date. The
// server checks the slot again when the request arrives, so two patients can
// never get the same time.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import axios from 'axios';
import { isNetworkError, patientService } from '../../services/api';
import {
  ClinicDetails,
  fetchClinicDetails,
  getCachedClinicDetails,
} from '../../services/offline/publicRepository';
import { newIdempotencyKey } from '../../services/offline/patientRepository';
import {
  fetchAvailableDates,
  fetchSlots,
  formatClockTime,
  formatDateKey,
  Slot,
  upcomingBusinessDates,
} from '../../services/booking';
import { formatPrice } from '../../utils/format';

const CALENDAR_DAYS = 28;
const REASONS = ['Checkup', 'Cleaning', 'Toothache', 'Braces', 'Follow-up', 'Other'];

export type RescheduleParams = {
  appointmentId: number | string;
  clinicId: number | string;
  serviceRateId: number;
  dentistId: number;
  currentLabel: string;
};

const serverMessage = (error: unknown, fallback: string) => {
  if (isNetworkError(error)) {
    return "You're offline. Connect to the internet to see open times.";
  }
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; errors?: Record<string, string[]> } | undefined;
    const firstFieldError = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined;
    return data?.message ?? firstFieldError ?? fallback;
  }
  return fallback;
};

const BookAppointmentScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  const reschedule: RescheduleParams | undefined = route.params?.reschedule;
  const clinicId: number | string | undefined = reschedule?.clinicId ?? route.params?.clinicId;

  const [clinic, setClinic] = useState<ClinicDetails | null>(null);
  const [loadingClinic, setLoadingClinic] = useState(Boolean(clinicId));
  const [clinicError, setClinicError] = useState<string | null>(null);

  const [serviceId, setServiceId] = useState<number | null>(reschedule?.serviceRateId ?? null);
  const [dentistId, setDentistId] = useState<number | null>(reschedule?.dentistId ?? null);
  const [openDates, setOpenDates] = useState<Set<string> | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [datesAttempt, setDatesAttempt] = useState(0);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // One key per booking attempt: a retry after a lost response cannot book twice.
  const idempotencyKey = useRef(newIdempotencyKey());

  const calendar = useMemo(() => upcomingBusinessDates(CALENDAR_DAYS), []);
  const service = clinic?.services.find((s) => s.id === serviceId) ?? null;
  const dentist = clinic?.dentists.find((d) => d.id === dentistId) ?? null;

  // Clinic details: saved copy first, then the latest from the server.
  useEffect(() => {
    if (!clinicId) {
      return;
    }
    let active = true;
    (async () => {
      const cached = await getCachedClinicDetails(clinicId);
      if (active && cached && 'services' in cached.clinic) {
        setClinic(cached.clinic as ClinicDetails);
        setLoadingClinic(false);
      }
      try {
        const fresh = await fetchClinicDetails(clinicId);
        if (active) {
          setClinic(fresh);
        }
      } catch (error) {
        if (active && !cached) {
          setClinicError(serverMessage(error, 'This clinic could not be loaded.'));
        }
      } finally {
        if (active) {
          setLoadingClinic(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [clinicId]);

  // Dates the dentist works, whenever the service or dentist changes.
  useEffect(() => {
    setOpenDates(null);
    setDate(null);
    setSlots(null);
    setSlot(null);
    setAvailabilityError(null);
    if (!clinicId || !serviceId || !dentistId) {
      return;
    }
    let active = true;
    fetchAvailableDates({
      clinicId,
      serviceRateId: serviceId,
      dentistId,
      from: calendar[0],
      to: calendar[calendar.length - 1],
    })
      .then((dates) => active && setOpenDates(new Set(dates)))
      .catch((error) => active && setAvailabilityError(serverMessage(error, 'Open dates could not be loaded.')));
    return () => {
      active = false;
    };
  }, [clinicId, serviceId, dentistId, calendar, datesAttempt]);

  const loadSlots = async (day: string) => {
    if (!clinicId || !serviceId || !dentistId) {
      return;
    }
    setSlots(null);
    setSlot(null);
    setAvailabilityError(null);
    try {
      setSlots(await fetchSlots({ clinicId, serviceRateId: serviceId, dentistId, date: day }));
    } catch (error) {
      setAvailabilityError(serverMessage(error, 'Open times could not be loaded.'));
    }
  };

  const chooseDate = (day: string) => {
    setDate(day);
    loadSlots(day);
  };

  const handleSubmit = async () => {
    if (!slot || !service || (!reschedule && !dentist)) {
      return;
    }
    setSubmitting(true);
    try {
      if (reschedule) {
        const response = await patientService.rescheduleAppointment(reschedule.appointmentId, slot.startsAt);
        const requested = response.data?.data?.status === 'reschedule_requested';
        Alert.alert(
          requested ? 'Request sent' : 'Appointment moved',
          requested
            ? 'The clinic will confirm your new time. Your original appointment is kept until then.'
            : `Your request is now for ${formatDateKey(date!)} at ${formatClockTime(slot.time)}. The clinic will review it.`,
          [{ text: 'OK', onPress: () => navigation.navigate('Appointments') }],
        );
        return;
      }

      const response = await patientService.createAppointment(
        {
          clinic_id: Number(clinicId),
          service_rate_id: service.id,
          dentist_id: dentist!.id,
          branch_id: slot.branchId,
          starts_at: slot.startsAt,
          reason: reason || undefined,
          notes: notes.trim() || undefined,
        },
        idempotencyKey.current,
        { service: service.name, dentist: dentist!.name },
      );
      const queued = Boolean(response.data?.queued);
      Alert.alert(
        queued ? 'Saved on this phone' : 'Request sent',
        queued
          ? "Your connection dropped, so the request is saved and will be sent automatically. It isn't booked until the clinic confirms it, and the time may no longer be free."
          : 'The clinic will review your request. You will be notified when it is confirmed.',
        [{ text: 'View Appointments', onPress: () => navigation.navigate('Appointments') }],
      );
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      Alert.alert('Not booked', serverMessage(error, 'Please try again.'));
      if (status === 409 && date) {
        // That time was just taken: start a new attempt with fresh times.
        idempotencyKey.current = newIdempotencyKey();
        loadSlots(date);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!clinicId) {
    return (
      <View style={styles.centered}>
        <Icon name="business-outline" size={48} color="#667eea" />
        <Text style={styles.emptyTitle}>Choose a clinic first</Text>
        <Text style={styles.emptyText}>Open a clinic and tap Book Appointment to see its services and open times.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('Clinics')}>
          <Text style={styles.primaryButtonText}>Find a Clinic</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loadingClinic) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  if (!clinic) {
    return (
      <View style={styles.centered}>
        <Icon name="cloud-offline-outline" size={48} color="#a0aec0" />
        <Text style={styles.emptyText}>{clinicError ?? 'This clinic could not be loaded.'}</Text>
      </View>
    );
  }

  const canSubmit = Boolean(slot) && !submitting;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{reschedule ? 'Reschedule' : 'Book Appointment'}</Text>
          <Text style={styles.headerSubtitle}>{clinic.name}</Text>
        </View>

        <View style={styles.formContainer}>
          {reschedule ? (
            <View style={styles.policyContainer}>
              <Icon name="time-outline" size={20} color="#667eea" />
              <Text style={styles.policyText}>Current time: {reschedule.currentLabel}</Text>
            </View>
          ) : (
            <>
              <Text style={styles.label}>Service</Text>
              {clinic.services.length === 0 ? (
                <Text style={styles.emptyText}>This clinic has not published services yet.</Text>
              ) : (
                clinic.services.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: serviceId === item.id }}
                    style={[styles.dentistCard, serviceId === item.id && styles.selectedDentistCard]}
                    onPress={() => setServiceId(item.id)}
                  >
                    <View style={styles.dentistInfo}>
                      <Text style={styles.dentistName}>{item.name}</Text>
                      <Text style={styles.dentistSpecialty}>
                        {formatPrice(item.price)} · {item.durationMinutes} min
                      </Text>
                    </View>
                    {serviceId === item.id && <Icon name="checkmark-circle" size={24} color="#48bb78" />}
                  </TouchableOpacity>
                ))
              )}

              <Text style={styles.label}>Dentist</Text>
              {clinic.dentists.length === 0 ? (
                <Text style={styles.emptyText}>No dentists are accepting online bookings here yet.</Text>
              ) : (
                clinic.dentists.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: dentistId === item.id }}
                    style={[styles.dentistCard, dentistId === item.id && styles.selectedDentistCard]}
                    onPress={() => setDentistId(item.id)}
                  >
                    <View style={styles.dentistAvatar}>
                      <Text style={styles.dentistInitials}>{item.name.replace(/^Dr\.?\s*/i, '').charAt(0)}</Text>
                    </View>
                    <View style={styles.dentistInfo}>
                      <Text style={styles.dentistName}>{item.name}</Text>
                      <Text style={styles.dentistSpecialty}>{item.specialization ?? 'General Dentistry'}</Text>
                    </View>
                    {dentistId === item.id && <Icon name="checkmark-circle" size={24} color="#48bb78" />}
                  </TouchableOpacity>
                ))
              )}
            </>
          )}

          {serviceId && dentistId && (
            <>
              <Text style={styles.label}>Date</Text>
              {!openDates && !availabilityError ? (
                <ActivityIndicator color="#667eea" />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeSlots}>
                  {calendar.map((day) => {
                    const isOpen = openDates?.has(day) ?? false;
                    const isSelected = day === date;
                    return (
                      <TouchableOpacity
                        key={day}
                        disabled={!isOpen}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isSelected, disabled: !isOpen }}
                        accessibilityLabel={`${formatDateKey(day, { weekday: 'long', month: 'long', day: 'numeric' })}${isOpen ? '' : ', unavailable'}`}
                        style={[styles.timeSlot, isSelected && styles.selectedTimeSlot, !isOpen && styles.disabledSlot]}
                        onPress={() => chooseDate(day)}
                      >
                        <Text style={[styles.timeSlotText, isSelected && styles.selectedTimeSlotText, !isOpen && styles.disabledSlotText]}>
                          {formatDateKey(day)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {date && (
                <>
                  <Text style={styles.label}>Time (Philippine time)</Text>
                  {!slots && !availabilityError ? (
                    <ActivityIndicator color="#667eea" />
                  ) : slots && slots.length === 0 ? (
                    <Text style={styles.emptyText}>No open times on this date. Please choose another day.</Text>
                  ) : (
                    <View style={styles.reasonContainer}>
                      {(slots ?? []).map((item) => (
                        <TouchableOpacity
                          key={item.startsAt}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: slot?.startsAt === item.startsAt }}
                          style={[styles.reasonOption, slot?.startsAt === item.startsAt && styles.selectedReasonOption]}
                          onPress={() => setSlot(item)}
                        >
                          <Text style={[styles.reasonOptionText, slot?.startsAt === item.startsAt && styles.selectedReasonOptionText]}>
                            {formatClockTime(item.time)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </>
              )}

              {availabilityError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{availabilityError}</Text>
                  <TouchableOpacity onPress={() => (date ? loadSlots(date) : setDatesAttempt((n) => n + 1))}>
                    <Text style={styles.retryText}>Try again</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {!reschedule && (
            <>
              <Text style={styles.label}>Reason for Visit (optional)</Text>
              <View style={styles.reasonContainer}>
                {REASONS.map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={[styles.reasonOption, reason === item && styles.selectedReasonOption]}
                    onPress={() => setReason(reason === item ? '' : item)}
                  >
                    <Text style={[styles.reasonOptionText, reason === item && styles.selectedReasonOptionText]}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Notes for the clinic (optional)</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Anything the clinic should know before your visit"
                placeholderTextColor="#a0aec0"
                value={notes}
                onChangeText={setNotes}
                maxLength={2000}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </>
          )}

          <TouchableOpacity
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Icon name="calendar-outline" size={24} color="#fff" />
                <Text style={styles.submitButtonText}>{reschedule ? 'Request New Time' : 'Request Appointment'}</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.policyContainer}>
            <Icon name="information-circle-outline" size={20} color="#a0aec0" />
            <Text style={styles.policyText}>
              Your request is confirmed only when the clinic approves it. Online changes are possible until 24 hours
              before your appointment; after that, please call the clinic.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#f8f9fa' },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#2d3748', marginTop: 12 },
  emptyText: { fontSize: 15, color: '#718096', textAlign: 'center', marginVertical: 8, lineHeight: 21 },
  primaryButton: { backgroundColor: '#667eea', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, marginTop: 12 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  header: { backgroundColor: '#667eea', padding: 24, paddingBottom: 32 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  headerSubtitle: { fontSize: 16, color: 'rgba(255,255,255,0.8)' },
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
  label: { fontSize: 16, fontWeight: '600', color: '#2d3748', marginBottom: 12, marginTop: 16 },
  dentistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  selectedDentistCard: { borderColor: '#667eea', backgroundColor: '#ebf8ff' },
  dentistAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dentistInitials: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  dentistInfo: { flex: 1 },
  dentistName: { fontSize: 16, fontWeight: '600', color: '#2d3748' },
  dentistSpecialty: { fontSize: 14, color: '#718096' },
  timeSlots: { flexDirection: 'row', marginBottom: 8 },
  timeSlot: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
    backgroundColor: '#fff',
  },
  selectedTimeSlot: { backgroundColor: '#667eea', borderColor: '#667eea' },
  disabledSlot: { backgroundColor: '#f7fafc', borderColor: '#edf2f7' },
  timeSlotText: { fontSize: 14, color: '#2d3748' },
  selectedTimeSlotText: { color: '#fff' },
  disabledSlotText: { color: '#cbd5e0', textDecorationLine: 'line-through' },
  reasonContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  reasonOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  selectedReasonOption: { backgroundColor: '#667eea', borderColor: '#667eea' },
  reasonOptionText: { fontSize: 14, color: '#2d3748' },
  selectedReasonOptionText: { color: '#fff' },
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
  errorBox: { padding: 12, borderRadius: 12, backgroundColor: '#fff5f5', marginTop: 8 },
  errorText: { color: '#c53030', fontSize: 14 },
  retryText: { color: '#667eea', fontWeight: '600', marginTop: 6 },
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
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginLeft: 8 },
  policyContainer: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, backgroundColor: '#f7fafc', borderRadius: 12 },
  policyText: { flex: 1, fontSize: 13, color: '#718096', marginLeft: 8, lineHeight: 18 },
});

export default BookAppointmentScreen;
