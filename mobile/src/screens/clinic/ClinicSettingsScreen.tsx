// Clinic profile and directory listing (web: ClinicSettingsPage). Owners
// publish or hide the clinic and edit what patients see on its page.
import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { ClinicScreen } from '../../components/clinic/ClinicChrome';
import { ClinicProfileTabs } from '../../components/clinic/ClinicAdminKit';
import { useClinicPortal } from '../../components/clinic/ClinicPortalContext';
import { Badge, Button, Card, Field, FormError, LoadState, ui, useLoader } from '../../components/clinic/ClinicUi';
import { ClinicProfile, fetchClinicProfile, fetchSpecializationOptions, serverMessage, setClinicPublished, updateClinicProfile } from '../../services/clinicPortal';
import { palette, radius, spacing, type } from '../../theme/tokens';

const toNumberOrNull = (v: string) => (v.trim() === '' || Number.isNaN(Number(v)) ? null : Number(v));

function Publishing({ clinicId, clinic, onChanged }: { clinicId: number; clinic: ClinicProfile; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      await setClinicPublished(clinicId, !clinic.is_published);
      onChanged();
    } catch (err) {
      setError(serverMessage(err, 'The listing could not be changed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Directory listing"
      action={<Badge status={clinic.status} label={clinic.status.charAt(0).toUpperCase() + clinic.status.slice(1)} />}
      subtitle={
        clinic.status === 'suspended'
          ? 'This clinic is suspended by the platform administrators and is hidden from patients.'
          : clinic.is_published
            ? 'Your clinic is listed and patients can book online.'
            : 'Your clinic is hidden. Add services, dentist schedules and opening hours, then publish.'
      }
    >
      {clinic.status === 'approved' && (
        <Button
          small
          variant={clinic.is_published ? 'outline' : 'primary'}
          icon={clinic.is_published ? 'eye-off-outline' : 'globe-outline'}
          label={clinic.is_published ? 'Hide from directory' : 'Publish clinic'}
          busy={busy}
          onPress={toggle}
        />
      )}
      <FormError message={error} />
    </Card>
  );
}

function ProfileForm({ clinicId, clinic, onSaved }: { clinicId: number; clinic: ClinicProfile; onSaved: () => void }) {
  const specializations = useLoader(() => fetchSpecializationOptions(), []);
  const initial = () => ({
    name: clinic.name ?? '',
    description: clinic.description ?? '',
    address: clinic.address ?? '',
    city: clinic.city ?? '',
    province: clinic.province ?? '',
    contact_number: clinic.contact_number ?? '',
    email: clinic.email ?? '',
    latitude: clinic.latitude != null ? String(clinic.latitude) : '',
    longitude: clinic.longitude != null ? String(clinic.longitude) : '',
  });
  const [form, setForm] = useState(initial);
  const [specializationIds, setSpecializationIds] = useState<number[]>((clinic.specializations ?? []).map((s) => s.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const bind = (name: keyof ReturnType<typeof initial>) => ({ value: form[name], onChangeText: (v: string) => { setSaved(false); setForm((f) => ({ ...f, [name]: v })); } });

  // A different clinic was chosen from the switcher.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setForm(initial()), [clinic.id]);

  const toggleSpecialization = (id: number) => {
    setSaved(false);
    setSpecializationIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateClinicProfile(clinicId, {
        ...form,
        latitude: toNumberOrNull(form.latitude),
        longitude: toNumberOrNull(form.longitude),
        specialization_ids: specializationIds,
      });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(serverMessage(err, 'The profile could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Clinic profile" subtitle="Shown on your public clinic page.">
      <Field label="Clinic name" required {...bind('name')} />
      <Field label="Description" multiline {...bind('description')} />
      <Field label="Street address" required {...bind('address')} />
      <Field label="City / municipality" required {...bind('city')} />
      <Field label="Province" required {...bind('province')} />
      <Field label="Contact number" required keyboardType="phone-pad" {...bind('contact_number')} />
      <Field label="Email" keyboardType="email-address" autoCapitalize="none" {...bind('email')} />
      <Field label="Latitude" keyboardType="numbers-and-punctuation" hint="Places your clinic on the map." {...bind('latitude')} />
      <Field label="Longitude" keyboardType="numbers-and-punctuation" {...bind('longitude')} />
      <Text style={[ui.small, ui.spacedTop]}>Specializations</Text>
      <View style={ui.rowWrap}>
        {(specializations.data ?? []).map((s) => {
          const selected = specializationIds.includes(s.id);
          return (
            <TouchableOpacity
              key={s.id}
              style={[styles.check, selected && styles.checkActive]}
              onPress={() => toggleSpecialization(s.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
            >
              <Icon name={selected ? 'checkbox' : 'square-outline'} size={18} color={palette.primary} />
              <Text style={styles.checkText}>{s.name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <FormError message={error} />
      {saved && <Text style={ui.success}>Profile saved.</Text>}
      <Button label="Save profile" style={ui.spacedTop} busy={busy} onPress={save} />
    </Card>
  );
}

const ClinicSettingsScreen = () => {
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const clinic = useLoader(() => fetchClinicProfile(clinicId), [clinicId], 'The clinic could not be loaded.');

  return (
    <ClinicScreen title="Clinic Profile" active="ClinicSettings">
      <ScrollView
        contentContainerStyle={ui.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={clinic.refreshing} onRefresh={clinic.refresh} colors={[palette.primary]} />}
      >
        <ClinicProfileTabs active="ClinicSettings" />
        <LoadState loading={clinic.loading} error={clinic.data ? null : clinic.error} onRetry={clinic.reload} />
        {clinic.data && (
          <>
            <Publishing clinicId={clinicId} clinic={clinic.data} onChanged={clinic.sync} />
            <ProfileForm clinicId={clinicId} clinic={clinic.data} onSaved={clinic.sync} />
          </>
        )}
      </ScrollView>
    </ClinicScreen>
  );
};

const styles = StyleSheet.create({
  check: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 40, paddingHorizontal: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.outlineVariant },
  checkActive: { backgroundColor: palette.primaryFixed, borderColor: palette.primaryFixedDim },
  checkText: { ...type.bodyMd, color: palette.onSurface },
});

export default ClinicSettingsScreen;
