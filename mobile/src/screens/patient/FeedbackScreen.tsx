// Feedback & Ratings. Reviews are allowed once per completed appointment; the server
// enforces it, and a review written offline is sent once the phone reconnects.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import PatientShell from '../../components/patient/PatientShell';
import { Notice, StatusBadge, SuccessCard } from '../../components/patient/PatientUi';
import { Card, guestColors, Message, PrimaryButton } from '../../components/guest/GuestUi';
import { RATING_LABELS } from '../../content/patientContent';
import { patientService } from '../../services/api';
import { Appointment, appointmentDate } from '../../services/patientPortal';
import { spacing, type } from '../../theme/tokens';

const FeedbackScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  const [eligible, setEligible] = useState<Appointment[] | null>(null);
  const [appointmentId, setAppointmentId] = useState<number | string | undefined>(route.params?.appointmentId);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<{ queued: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await patientService.getReviewableAppointments();
      setEligible(response.data?.data ?? []);
    } catch {
      setEligible([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!appointmentId || rating === 0) {
      return;
    }
    setSaving(true);
    setProblem(null);
    try {
      const response = await patientService.submitFeedback({ appointment_id: appointmentId, rating, comment: comment.trim() || undefined });
      setDone({ queued: Boolean(response.data?.queued) });
    } catch (error: any) {
      // e.g. "You already reviewed this appointment."
      setProblem(error?.response?.data?.message ?? error?.message ?? 'Your review was not submitted. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const another = () => {
    setDone(null);
    setAppointmentId(undefined);
    setRating(0);
    setComment('');
    setEligible(null);
    load();
  };

  return (
    <PatientShell navigation={navigation} title="Feedback & Ratings">
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {done ? (
            <SuccessCard
              title="Review Submitted!"
              message={
                done.queued
                  ? "You're offline, so your review is saved and will be sent once you're back online."
                  : 'Thank you for your feedback! Your review helps other patients make informed decisions.'
              }
              actionLabel="Leave Another Review"
              onAction={another}
            />
          ) : (
            <>
              <Text style={styles.intro}>You can only review completed appointments.</Text>
              <Card>
                <Text style={styles.cardTitle} accessibilityRole="header">
                  Select Appointment to Review
                </Text>
                {eligible === null ? (
                  <ActivityIndicator style={styles.loader} color={guestColors.primary} />
                ) : eligible.length === 0 ? (
                  <Message icon="checkmark-done-outline" title="Nothing to review" body="Completed visits that have no review yet appear here." />
                ) : (
                  <View style={styles.visits}>
                    {eligible.map((visit) => {
                      const selected = String(visit.id) === String(appointmentId);
                      return (
                        <TouchableOpacity
                          key={visit.id}
                          style={[styles.visit, selected && styles.visitSelected]}
                          onPress={() => setAppointmentId(visit.id)}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                        >
                          <View style={styles.visitIcon}>
                            <Icon name="checkmark-circle-outline" size={20} color="#22a35a" />
                          </View>
                          <View style={styles.flex}>
                            <Text style={styles.visitTitle}>{visit.service?.name ?? 'Appointment'}</Text>
                            <Text style={styles.visitMeta}>{[visit.clinic?.name, appointmentDate(visit)].filter(Boolean).join(' · ')}</Text>
                          </View>
                          <StatusBadge group="completed" />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                <View style={styles.divider} />

                <Text style={styles.cardTitle}>Your Rating</Text>
                <View style={styles.stars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity key={star} onPress={() => setRating(star)} accessibilityRole="button" accessibilityLabel={`${star} of 5 stars`} accessibilityState={{ selected: star <= rating }}>
                      <Icon name={star <= rating ? 'star' : 'star-outline'} size={38} color={star <= rating ? '#f5843c' : '#dde3ee'} />
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.ratingLabel}>{RATING_LABELS[rating] || ' '}</Text>

                <Text style={styles.label}>YOUR REVIEW</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Share your experience with this clinic..."
                  placeholderTextColor={guestColors.textMuted}
                  value={comment}
                  onChangeText={setComment}
                  maxLength={2000}
                  multiline
                  textAlignVertical="top"
                  accessibilityLabel="Your review"
                />
                {problem && (
                  <View style={styles.problem}>
                    <Notice tone="danger">{problem}</Notice>
                  </View>
                )}
                <PrimaryButton label={saving ? 'Submitting…' : 'Submit Review'} onPress={submit} disabled={!appointmentId || rating === 0} busy={saving} style={styles.submit} />
              </Card>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </PatientShell>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { marginVertical: spacing.lg },
  content: { padding: spacing.marginMobile, paddingBottom: spacing.xl },
  intro: { ...type.bodyMd, color: guestColors.textMuted, marginBottom: spacing.sm },
  cardTitle: { fontSize: 18, lineHeight: 24, fontWeight: '600', color: guestColors.text, marginBottom: spacing.sm },
  visits: { gap: spacing.sm },
  visit: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: 12, borderWidth: 1, borderColor: guestColors.border },
  visitSelected: { borderColor: guestColors.primary, backgroundColor: guestColors.primarySoft },
  visitIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e8f7ee' },
  visitTitle: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: guestColors.text },
  visitMeta: { fontSize: 12, lineHeight: 17, color: guestColors.textMuted },
  divider: { height: 1, backgroundColor: guestColors.border, marginVertical: spacing.md },
  stars: { flexDirection: 'row', gap: spacing.xs },
  ratingLabel: { ...type.bodyMd, color: guestColors.text, marginTop: spacing.xs, marginBottom: spacing.sm },
  label: { fontSize: 12, lineHeight: 18, fontWeight: '600', letterSpacing: 0.6, color: guestColors.text, marginBottom: spacing.base },
  input: { ...type.bodyMd, minHeight: 110, padding: spacing.sm, color: guestColors.text, borderWidth: 1, borderColor: guestColors.border, borderRadius: 10, backgroundColor: guestColors.surface },
  problem: { marginTop: spacing.sm },
  submit: { marginTop: spacing.md },
});

export default FeedbackScreen;
