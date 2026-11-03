// Book an appointment in the website's five steps: clinic, dentist, service, schedule, confirm.
//
// Every option comes from the API or the saved directory: the clinic's services and
// dentists, the dates the chosen dentist works, and the open times on the chosen date. The
// server checks the slot again when the request arrives, so two patients can never get the
// same time.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import axios from 'axios';
import Icon from 'react-native-vector-icons/Ionicons';
import PatientShell from '../../components/patient/PatientShell';
import { CalendarPicker, Notice, SectionLabel, StatusBadge, TimeSlots } from '../../components/patient/PatientUi';
import { accentFor, Card, guestColors, initialOf, Message, OutlineButton, PrimaryButton, Stars } from '../../components/guest/GuestUi';
import {
  BOOKING_APPROVAL_NOTICE,
  BOOKING_ARRIVAL_NOTICE,
  BOOKING_QUEUED_MESSAGE,
  BOOKING_STEPS,
  BOOKING_SUBMITTED_MESSAGE,
} from '../../content/patientContent';
import { useSync } from '../../context/SyncContext';
import { isNetworkError, patientService } from '../../services/api';
import { fetchAvailableDates, fetchSlots, formatClockTime, formatDateKey, Slot, upcomingBusinessDates } from '../../services/booking';
import { newIdempotencyKey } from '../../services/offline/patientRepository';
import {
  ClinicDetails,
  ClinicSummary,
  fetchClinicDetails,
  getCachedClinicDetails,
  queryClinics,
} from '../../services/offline/publicRepository';
import { spacing, type } from '../../theme/tokens';
import { formatPrice } from '../../utils/format';

const CALENDAR_DAYS = 28;
const SCHEDULE_STEP = BOOKING_STEPS.findIndex(({ id }) => id === 'schedule');

export const serverMessage = (error: unknown, fallback: string) => {
  if (isNetworkError(error)) {
    return "You're offline. Connect to the internet to see open times.";
  }
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; errors?: Record<string, string[]> } | undefined;
    return (data?.errors ? Object.values(data.errors)[0]?.[0] : undefined) ?? data?.message ?? fallback;
  }
  return fallback;
};

const Stepper = ({ current }: { current: number }) => (
  <View style={styles.stepper} accessibilityLabel={`Step ${current + 1} of ${BOOKING_STEPS.length}: ${BOOKING_STEPS[current].label}`}>
    {BOOKING_STEPS.map((step, index) => {
      const done = index < current;
      const active = index === current;
      return (
        <View key={step.id} style={styles.step}>
          <View style={[styles.stepCircle, (done || active) && styles.stepCircleOn]}>
            {done ? <Icon name="checkmark" size={15} color="#ffffff" /> : <Text style={[styles.stepNumber, active && styles.stepNumberOn]}>{index + 1}</Text>}
          </View>
          <Text style={[styles.stepLabel, (done || active) && styles.stepLabelOn]} numberOfLines={1}>
            {step.label}
          </Text>
        </View>
      );
    })}
  </View>
);

const Row = ({ label, value }: { label: string; value?: string | null }) => (
  <View style={styles.reviewRow}>
    <Text style={styles.reviewLabel}>{label}</Text>
    <Text style={styles.reviewValue}>{value ?? '—'}</Text>
  </View>
);

const BookAppointmentScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  const { isReady, dataVersion } = useSync();
  const [stepIndex, setStepIndex] = useState(0);

  const [clinics, setClinics] = useState<ClinicSummary[] | null>(null);
  const [clinicId, setClinicId] = useState<number | null>(route.params?.clinicId ?? null);
  const [clinic, setClinic] = useState<ClinicDetails | null>(null);
  const [clinicProblem, setClinicProblem] = useState<string | null>(null);
  const [dentistId, setDentistId] = useState<number | null>(route.params?.dentistId ?? null);
  const [serviceId, setServiceId] = useState<number | null>(null);

  const [openDates, setOpenDates] = useState<Set<string> | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [datesAttempt, setDatesAttempt] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ queued: boolean } | null>(null);
  // One key per booking attempt: a retry after a lost response cannot book twice.
  const idempotencyKey = useRef(newIdempotencyKey());

  const calendar = useMemo(() => upcomingBusinessDates(CALENDAR_DAYS), []);
  const service = clinic?.services.find(({ id }) => id === serviceId) ?? null;
  const dentist = clinic?.dentists.find(({ id }) => id === dentistId) ?? null;
  const step = BOOKING_STEPS[stepIndex];

  // Arriving again from a clinic or dentist page chooses that clinic and starts over.
  useEffect(() => {
    if (route.params?.clinicId) {
      setClinicId(route.params.clinicId);
      setDentistId(route.params.dentistId ?? null);
      setServiceId(null);
      setStepIndex(0);
      setSubmitted(null);
    }
  }, [route.params?.clinicId, route.params?.dentistId]);

  useEffect(() => {
    if (isReady) {
      queryClinics({ sort: 'name' })
        .then(setClinics)
        .catch(() => setClinics([]));
    }
  }, [isReady, dataVersion]);

  // Clinic details: saved copy first, then the latest from the server.
  useEffect(() => {
    if (!clinicId) {
      setClinic(null);
      return;
    }
    let active = true;
    setClinicProblem(null);
    (async () => {
      const cached = await getCachedClinicDetails(clinicId);
      if (active && cached && 'services' in cached.clinic) {
        setClinic(cached.clinic as ClinicDetails);
      }
      try {
        const fresh = await fetchClinicDetails(clinicId);
        if (active) {
          setClinic(fresh);
        }
      } catch (error) {
        if (active && !(cached && 'services' in cached.clinic)) {
          setClinic(null);
          setClinicProblem(serverMessage(error, 'This clinic could not be loaded.'));
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
    setProblem(null);
    if (!clinicId || !serviceId || !dentistId) {
      return;
    }
    let active = true;
    fetchAvailableDates({ clinicId, serviceRateId: serviceId, dentistId, from: calendar[0], to: calendar[calendar.length - 1] })
      .then((dates) => active && setOpenDates(new Set(dates)))
      .catch((error) => active && setProblem(serverMessage(error, 'Open dates could not be loaded.')));
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
    setProblem(null);
    try {
      setSlots(await fetchSlots({ clinicId, serviceRateId: serviceId, dentistId, date: day }));
    } catch (error) {
      setProblem(serverMessage(error, 'Open times could not be loaded.'));
    }
  };

  const chooseDate = (day: string) => {
    setDate(day);
    loadSlots(day);
  };

  // Dentists and services belong to a clinic, so a new clinic clears them.
  const chooseClinic = (id: number) => {
    if (id !== clinicId) {
      setClinic(null);
      setDentistId(null);
      setServiceId(null);
    }
    setClinicId(id);
  };

  const confirm = async () => {
    if (!slot || !service || !dentist) {
      return;
    }
    setSubmitting(true);
    setProblem(null);
    try {
      const response = await patientService.createAppointment(
        { clinic_id: clinicId, service_rate_id: service.id, dentist_id: dentist.id, branch_id: slot.branchId, starts_at: slot.startsAt },
        idempotencyKey.current,
        { service: service.name, dentist: dentist.name },
      );
      setSubmitted({ queued: Boolean(response.data?.queued) });
    } catch (error) {
      setProblem(serverMessage(error, 'Your request was not sent. Please try again.'));
      if (axios.isAxiosError(error) && error.response?.status === 409 && date) {
        // That time was just taken: start a new attempt with fresh times.
        idempotencyKey.current = newIdempotencyKey();
        setStepIndex(SCHEDULE_STEP);
        loadSlots(date);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const startOver = (target: string) => {
    idempotencyKey.current = newIdempotencyKey();
    setSubmitted(null);
    setStepIndex(0);
    setClinicId(null);
    setDentistId(null);
    setServiceId(null);
    if (target === 'Home') {
      navigation.popToTop();
    } else {
      navigation.navigate(target);
    }
  };

  const whenLabel = date ? formatDateKey(date, { month: 'long', day: 'numeric', year: 'numeric' }) : null;
  const timeLabel = slot ? formatClockTime(slot.time) : null;

  if (submitted) {
    return (
      <PatientShell navigation={navigation} title="Booking Submitted" active="BookAppointment">
        <ScrollView contentContainerStyle={styles.content}>
          <Card style={styles.submitted}>
            <View style={styles.clockCircle}>
              <Icon name="time-outline" size={36} color="#c98a0b" />
            </View>
            <StatusBadge group="pending" />
            <Text style={styles.submittedTitle} accessibilityLiveRegion="polite">
              {submitted.queued ? 'Saved on This Phone' : 'Appointment Request Sent!'}
            </Text>
            <Text style={styles.submittedText}>{submitted.queued ? BOOKING_QUEUED_MESSAGE : BOOKING_SUBMITTED_MESSAGE}</Text>
            <View style={styles.reviewBox}>
              <Row label="Clinic" value={clinic?.name} />
              <Row label="Dentist" value={dentist?.name} />
              <Row label="Service" value={service?.name} />
              <Row label="Requested Date" value={whenLabel} />
              <Row label="Requested Time" value={timeLabel} />
            </View>
            <Notice>{BOOKING_APPROVAL_NOTICE}</Notice>
            <View style={styles.footer}>
              <OutlineButton label="Dashboard" onPress={() => startOver('Home')} style={styles.flex} />
              <PrimaryButton label="View Appointments" onPress={() => startOver('Appointments')} style={styles.flex} />
            </View>
          </Card>
        </ScrollView>
      </PatientShell>
    );
  }

  const clinicDependent = (render: (details: ClinicDetails) => React.ReactNode) => {
    if (clinicProblem) {
      return <Message icon="cloud-offline-outline" title={clinicProblem} />;
    }
    return clinic ? render(clinic) : <ActivityIndicator style={styles.loader} color={guestColors.primary} />;
  };

  const stepContent: Record<string, { complete: boolean; content: React.ReactNode }> = {
    clinic: {
      complete: Boolean(clinicId),
      content:
        clinics === null ? (
          <ActivityIndicator style={styles.loader} color={guestColors.primary} />
        ) : clinics.length === 0 ? (
          <Message icon="business-outline" title="No clinics are accepting bookings yet." />
        ) : (
          clinics.map((item) => {
            const selected = item.id === clinicId;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => chooseClinic(item.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <View style={[styles.optionTile, { backgroundColor: accentFor(item.id) }]}>
                  <Icon name="business-outline" size={22} color="#ffffff" />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.optionTitle}>{item.name}</Text>
                  <Text style={styles.optionMeta}>{item.city}</Text>
                  <Stars rating={item.rating} size={13} />
                </View>
                {selected && <Icon name="checkmark" size={20} color={guestColors.primary} />}
              </TouchableOpacity>
            );
          })
        ),
    },
    dentist: {
      complete: Boolean(dentist),
      content: clinicDependent((details) =>
        details.dentists.length === 0 ? (
          <Message icon="people-outline" title="This clinic has no dentists accepting online bookings yet." />
        ) : (
          details.dentists.map((item) => {
            const selected = item.id === dentistId;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.option, selected && styles.optionSelected, !item.isAvailable && styles.optionOff]}
                onPress={() => setDentistId(item.id)}
                disabled={!item.isAvailable}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled: !item.isAvailable }}
              >
                <View style={[styles.optionTile, { backgroundColor: accentFor(item.id) }]}>
                  <Text style={styles.optionInitial}>{initialOf(item.name)}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.optionTitle}>{item.name}</Text>
                  <Text style={styles.optionMeta}>{item.specialization ?? 'General Dentistry'}</Text>
                </View>
                <Text style={[styles.availability, !item.isAvailable && styles.availabilityOff]}>{item.isAvailable ? 'Available' : 'Unavailable'}</Text>
                {selected && <Icon name="checkmark" size={20} color={guestColors.primary} />}
              </TouchableOpacity>
            );
          })
        ),
      ),
    },
    service: {
      complete: Boolean(service),
      content: clinicDependent((details) =>
        details.services.length === 0 ? (
          <Message icon="medical-outline" title="This clinic has not published any services yet." />
        ) : (
          <View style={styles.serviceGrid}>
            {details.services.map((item) => {
              const selected = item.id === serviceId;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.serviceCard, selected && styles.optionSelected]}
                  onPress={() => setServiceId(item.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <View style={styles.serviceHeading}>
                    <Text style={styles.serviceName}>{item.name}</Text>
                    {selected && <Icon name="checkmark" size={16} color={guestColors.primary} />}
                  </View>
                  <Text style={styles.optionMeta}>{item.durationMinutes} min</Text>
                  <Text style={styles.servicePrice}>{formatPrice(item.price, item.currency)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ),
      ),
    },
    schedule: {
      complete: Boolean(slot),
      content: (
        <>
          {openDates === null && !problem ? (
            <ActivityIndicator style={styles.loader} color={guestColors.primary} />
          ) : (
            <CalendarPicker dates={calendar} open={openDates} selected={date} onSelect={chooseDate} />
          )}
          {openDates === null && problem ? <OutlineButton label="Try again" onPress={() => setDatesAttempt((n) => n + 1)} /> : null}
          {date && (
            <View style={styles.slotSection}>
              <SectionLabel>AVAILABLE TIME SLOTS</SectionLabel>
              {slots === null ? (
                !problem && <ActivityIndicator color={guestColors.primary} />
              ) : slots.length === 0 ? (
                <Text style={styles.optionMeta}>No open times on this date. Please choose another.</Text>
              ) : (
                <TimeSlots slots={slots} selected={slot} onSelect={setSlot} />
              )}
            </View>
          )}
        </>
      ),
    },
    confirm: {
      complete: true,
      content: (
        <>
          <View style={styles.reviewBox}>
            <Row label="Clinic" value={clinic?.name} />
            <Row label="Dentist" value={dentist?.name} />
            <Row label="Service" value={service?.name} />
            <Row label="Date" value={whenLabel} />
            <Row label="Time" value={timeLabel} />
            <Row label="Estimated Cost" value={service ? formatPrice(service.price, service.currency) : null} />
          </View>
          <Notice>{BOOKING_ARRIVAL_NOTICE}</Notice>
        </>
      ),
    },
  };
  const { complete, content } = stepContent[step.id];
  const isLast = stepIndex === BOOKING_STEPS.length - 1;

  return (
    <PatientShell navigation={navigation} title="Book Appointment" active="BookAppointment">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Stepper current={stepIndex} />
        <Card>
          <Text style={styles.title} accessibilityRole="header">
            {step.title}
          </Text>
          {problem ? (
            <View style={styles.problem}>
              <Notice tone="danger">{problem}</Notice>
            </View>
          ) : null}
          <View style={styles.options} accessibilityRole="radiogroup">
            {content}
          </View>
          <View style={styles.footer}>
            {stepIndex > 0 && <OutlineButton label="Back" onPress={() => setStepIndex(stepIndex - 1)} style={styles.backButton} />}
            <PrimaryButton
              label={submitting ? 'Sending request…' : step.nextLabel}
              onPress={() => (isLast ? confirm() : setStepIndex(stepIndex + 1))}
              disabled={!complete}
              busy={submitting}
              style={styles.flex}
            />
          </View>
        </Card>
      </ScrollView>
    </PatientShell>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.marginMobile, paddingBottom: spacing.xl },
  loader: { marginVertical: spacing.xl },

  stepper: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  step: { flex: 1, alignItems: 'center', gap: spacing.xs },
  stepCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e7eaf0' },
  stepCircleOn: { backgroundColor: guestColors.primary },
  stepNumber: { fontSize: 13, fontWeight: '600', color: guestColors.textMuted },
  stepNumberOn: { color: '#ffffff' },
  stepLabel: { fontSize: 11, lineHeight: 15, fontWeight: '600', color: guestColors.textMuted },
  stepLabelOn: { color: guestColors.primary },

  title: { fontSize: 20, lineHeight: 28, fontWeight: '600', color: guestColors.text, marginBottom: spacing.md },
  problem: { marginBottom: spacing.sm },
  options: { gap: spacing.sm },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: 12, borderWidth: 1, borderColor: guestColors.border, backgroundColor: guestColors.surface },
  optionSelected: { borderColor: guestColors.primary, backgroundColor: guestColors.primarySoft },
  optionOff: { opacity: 0.5 },
  optionTile: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  optionInitial: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  optionTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: guestColors.text },
  optionMeta: { fontSize: 13, lineHeight: 18, color: guestColors.textMuted },
  availability: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: '#13784a', backgroundColor: '#ecfbf3', borderRadius: 999, overflow: 'hidden', paddingHorizontal: spacing.base, paddingVertical: 3 },
  availabilityOff: { color: guestColors.textMuted, backgroundColor: guestColors.neutralSoft },

  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm },
  serviceCard: { width: '48.5%', padding: spacing.sm, gap: 2, borderRadius: 12, borderWidth: 1, borderColor: guestColors.border, backgroundColor: guestColors.surface },
  serviceHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
  serviceName: { flex: 1, fontSize: 14, lineHeight: 19, fontWeight: '600', color: guestColors.primary },
  servicePrice: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: guestColors.text, marginTop: spacing.xs },
  slotSection: { marginTop: spacing.xs },

  reviewBox: { alignSelf: 'stretch', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 12, backgroundColor: guestColors.background },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.sm },
  reviewLabel: { ...type.bodyMd, color: guestColors.textMuted },
  reviewValue: { flexShrink: 1, fontSize: 14, lineHeight: 20, fontWeight: '600', color: guestColors.text, textAlign: 'right' },

  footer: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, alignSelf: 'stretch' },
  backButton: { minWidth: 80 },

  submitted: { alignItems: 'center', gap: spacing.sm },
  clockCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#f3e2a6', backgroundColor: '#fdf8e8' },
  submittedTitle: { fontSize: 22, lineHeight: 30, fontWeight: '700', color: guestColors.text, textAlign: 'center' },
  submittedText: { ...type.bodyMd, color: guestColors.textMuted, textAlign: 'center' },
});

export default BookAppointmentScreen;
