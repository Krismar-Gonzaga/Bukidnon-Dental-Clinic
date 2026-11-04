// Move a pending request, or ask the clinic to move a confirmed one. Needs a connection:
// the new slot must be checked against live availability.
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import PatientShell from '../../components/patient/PatientShell';
import { BackLink, CalendarPicker, Notice, SectionLabel, SuccessCard, TimeSlots } from '../../components/patient/PatientUi';
import { Card, guestColors, OutlineButton, PrimaryButton } from '../../components/guest/GuestUi';
import { patientService } from '../../services/api';
import { fetchAvailableDates, fetchSlots, Slot, upcomingBusinessDates } from '../../services/booking';
import { Appointment, appointmentDate, appointmentTime } from '../../services/patientPortal';
import { spacing, type } from '../../theme/tokens';
import { serverMessage } from './BookAppointmentScreen';

const CALENDAR_DAYS = 28;

const RescheduleScreen = ({ navigation, route }: { navigation: any; route: any }) => {
  const appointment: Appointment = route.params.appointment;
  const clinicId = appointment.clinic?.id;
  const serviceRateId = appointment.service?.id;
  const dentistId = appointment.dentist?.id;

  const calendar = useMemo(() => upcomingBusinessDates(CALENDAR_DAYS), []);
  const [openDates, setOpenDates] = useState<Set<string> | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ requested: boolean } | null>(null);

  useEffect(() => {
    if (!clinicId || !serviceRateId || !dentistId) {
      return;
    }
    let active = true;
    fetchAvailableDates({ clinicId, serviceRateId, dentistId, from: calendar[0], to: calendar[calendar.length - 1] })
      .then((dates) => active && setOpenDates(new Set(dates)))
      .catch((error) => active && setProblem(serverMessage(error, 'Open dates could not be loaded.')));
    return () => {
      active = false;
    };
  }, [clinicId, serviceRateId, dentistId, calendar]);

  const chooseDate = async (day: string) => {
    if (!clinicId || !serviceRateId || !dentistId) {
      return;
    }
    setDate(day);
    setSlots(null);
    setSlot(null);
    setProblem(null);
    try {
      setSlots(await fetchSlots({ clinicId, serviceRateId, dentistId, date: day }));
    } catch (error) {
      setProblem(serverMessage(error, 'Open times could not be loaded.'));
    }
  };

  const confirm = async () => {
    if (!slot) {
      return;
    }
    setSaving(true);
    setProblem(null);
    try {
      const response = await patientService.rescheduleAppointment(appointment.id, slot.startsAt);
      setDone({ requested: response.data?.data?.status === 'reschedule_requested' });
    } catch (error) {
      setProblem(serverMessage(error, 'The appointment could not be moved.'));
      if (date) {
        chooseDate(date);
      }
    } finally {
      setSaving(false);
    }
  };

  const backToAppointment = () => navigation.goBack();

  return (
    <PatientShell navigation={navigation} title="Reschedule Appointment" active="Appointments">
      <ScrollView contentContainerStyle={styles.content}>
        <BackLink label="Back to Appointment" onPress={backToAppointment} />
        {done ? (
          <SuccessCard
            title={done.requested ? 'Reschedule Requested!' : 'Appointment Rescheduled!'}
            message={
              done.requested
                ? 'The clinic will confirm your new time. Your original appointment is kept until then.'
                : 'Your appointment has been updated. The clinic will review the new time.'
            }
            actionLabel="View All Appointments"
            onAction={() => navigation.popTo('Appointments')}
          />
        ) : (
          <Card>
            <Text style={styles.title} accessibilityRole="header">
              Reschedule Appointment
            </Text>
            <View style={styles.stack}>
              <Notice>
                {`Current appointment: ${appointmentDate(appointment)} at ${appointmentTime(appointment)}${
                  appointment.dentist?.name ? ` with ${appointment.dentist.name}` : ''
                }`}
              </Notice>
              {problem && <Notice tone="danger">{problem}</Notice>}
              <Text style={styles.label}>SELECT NEW DATE</Text>
              {openDates === null ? (
                !problem && <ActivityIndicator style={styles.loader} color={guestColors.primary} />
              ) : (
                <CalendarPicker dates={calendar} open={openDates} selected={date} onSelect={chooseDate} />
              )}
              {date && (
                <View>
                  <SectionLabel>SELECT NEW TIME</SectionLabel>
                  {slots === null ? (
                    !problem && <ActivityIndicator color={guestColors.primary} />
                  ) : slots.length === 0 ? (
                    <Text style={styles.empty}>No open times on this date. Please choose another.</Text>
                  ) : (
                    <TimeSlots slots={slots} selected={slot} onSelect={setSlot} />
                  )}
                </View>
              )}
              <View style={styles.footer}>
                <OutlineButton label="Cancel" onPress={backToAppointment} style={styles.flex} />
                <PrimaryButton label={saving ? 'Saving…' : 'Confirm Reschedule'} onPress={confirm} disabled={!slot} busy={saving} style={styles.confirm} />
              </View>
            </View>
          </Card>
        )}
      </ScrollView>
    </PatientShell>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  confirm: { flex: 2 },
  content: { padding: spacing.marginMobile, paddingBottom: spacing.xl },
  loader: { marginVertical: spacing.lg },
  title: { fontSize: 20, lineHeight: 28, fontWeight: '600', color: guestColors.text, marginBottom: spacing.sm },
  stack: { gap: spacing.sm },
  label: { fontSize: 12, lineHeight: 18, fontWeight: '600', letterSpacing: 0.6, color: guestColors.text },
  empty: { ...type.bodyMd, color: guestColors.textMuted },
  footer: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
});

export default RescheduleScreen;
