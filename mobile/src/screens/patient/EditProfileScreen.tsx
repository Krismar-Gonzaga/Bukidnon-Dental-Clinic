// Edit Profile with the website's four tabs. Personal details are saved or queued offline;
// health details are sensitive and never queued on the device, so they need a connection.
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import PatientShell from '../../components/patient/PatientShell';
import { BackLink, Notice, SuccessCard } from '../../components/patient/PatientUi';
import { Card, guestColors, Message, OutlineButton, PrimaryButton } from '../../components/guest/GuestUi';
import SelectSheet from '../../components/guest/SelectSheet';
import {
  ALLERGY_SEVERITIES,
  ALLERGY_TYPES,
  ANXIETY_LEVELS,
  BLOOD_TYPE_OPTIONS,
  CIVIL_STATUS_OPTIONS,
  GENDER_OPTIONS,
  VITAL_FIELDS,
} from '../../content/patientContent';
import { useAuth } from '../../context/AuthContext';
import { useSync } from '../../context/SyncContext';
import { fetchProfile, Health, joinName, Profile, saveHealth, saveProfile, splitName } from '../../services/patientPortal';
import { spacing, type } from '../../theme/tokens';
import { serverMessage } from './BookAppointmentScreen';

type TabId = 'overview' | 'medical' | 'allergies' | 'emergency';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Personal' },
  { id: 'medical', label: 'Medical History' },
  { id: 'allergies', label: 'Allergies & Meds' },
  { id: 'emergency', label: 'Emergency Contact' },
];

const BIRTH_DATE = /^\d{4}-\d{2}-\d{2}$/;

type Picker = { title: string; options: Array<{ label: string; value: string }>; selected: string; onSelect: (value: string) => void };

const Field = ({ label, ...input }: TextInputProps & { label: string }) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label.toUpperCase()}</Text>
    <TextInput style={styles.input} placeholderTextColor={guestColors.textMuted} accessibilityLabel={label} {...input} />
  </View>
);

const Select = ({ label, value, onPress }: { label: string; value: string; onPress: () => void }) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label.toUpperCase()}</Text>
    <TouchableOpacity style={[styles.input, styles.select]} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value || 'Select'}`}>
      <Text style={[styles.selectValue, !value && styles.selectEmpty]} numberOfLines={1}>
        {value || 'Select…'}
      </Text>
      <Icon name="chevron-down" size={16} color={guestColors.textMuted} />
    </TouchableOpacity>
  </View>
);

/** A list of entries of the same shape (allergies, medications...). */
function Repeatable<T extends Record<string, any>>({
  title,
  addLabel,
  rows,
  emptyRow,
  onChange,
  renderRow,
}: {
  title: string;
  addLabel: string;
  rows: T[];
  emptyRow: T;
  onChange: (rows: T[]) => void;
  renderRow: (row: T, update: (changes: Partial<T>) => void) => React.ReactNode;
}) {
  return (
    <View style={styles.repeatable}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {rows.map((row, index) => (
        <View key={index} style={styles.repeatRow}>
          <TouchableOpacity
            style={styles.remove}
            onPress={() => onChange(rows.filter((_, position) => position !== index))}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${title} ${index + 1}`}
          >
            <Icon name="close" size={18} color={guestColors.textMuted} />
          </TouchableOpacity>
          {renderRow(row, (changes) => onChange(rows.map((item, position) => (position === index ? { ...item, ...changes } : item))))}
        </View>
      ))}
      <TouchableOpacity style={styles.add} onPress={() => onChange([...rows, { ...emptyRow }])} accessibilityRole="button">
        <Icon name="add" size={18} color={guestColors.primary} />
        <Text style={styles.addText}>{addLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

// Blank rows are ones the patient added and left empty: they are not saved.
const withName = <T extends { name?: string }>(rows: T[]) => rows.filter((row) => row.name?.trim());

export const cleanHealth = (health: Health, conditions: Array<{ name: string }>): Health => ({
  ...health,
  conditions: withName(conditions).map(({ name }) => name.trim()),
  procedures: withName(health.procedures),
  allergies: withName(health.allergies),
  medications: withName(health.medications),
});

const EditProfileScreen = ({ navigation, route }: { navigation: any; route: any }) => {
  const { isOnline } = useSync();
  const { updateUser } = useAuth();
  const [tab, setTab] = useState<TabId>(route.params?.tab ?? 'overview');
  const [form, setForm] = useState<(Profile & { firstName: string; lastName: string }) | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [conditions, setConditions] = useState<Array<{ name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<{ queued: boolean } | null>(null);
  const [picker, setPicker] = useState<Picker | null>(null);
  const savedHealth = useRef('');

  useEffect(() => {
    fetchProfile()
      .then((profile) => {
        setForm({ ...profile, ...splitName(profile.name) });
        setHealth(profile.health);
        setConditions(profile.health.conditions.map((name) => ({ name })));
        savedHealth.current = JSON.stringify(cleanHealth(profile.health, profile.health.conditions.map((name) => ({ name }))));
      })
      .catch((error) => setProblem(serverMessage(error, 'Your profile could not be loaded.')))
      .finally(() => setLoading(false));
  }, []);

  const back = () => navigation.popTo('Profile');

  const save = async () => {
    if (!form || !health) {
      return;
    }
    if (!form.firstName.trim()) {
      setTab('overview');
      setProblem('First name is required.');
      return;
    }
    if (form.birthDate && !BIRTH_DATE.test(form.birthDate)) {
      setTab('overview');
      setProblem('Enter the date of birth as YYYY-MM-DD.');
      return;
    }

    const nextHealth = cleanHealth(health, conditions);
    const healthChanged = JSON.stringify(nextHealth) !== savedHealth.current;
    if (healthChanged && (!isOnline || !form.healthAvailable)) {
      setProblem('Health details need an internet connection to save. Your other changes were not saved yet.');
      return;
    }

    setSaving(true);
    setProblem(null);
    try {
      const name = joinName(form.firstName, form.lastName);
      const queued = await saveProfile({ ...form, name });
      if (healthChanged) {
        await saveHealth(nextHealth);
      }
      updateUser({ name, email: form.email });
      setDone({ queued });
    } catch (error) {
      setProblem(serverMessage(error, 'Your changes could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  const setField = (key: keyof NonNullable<typeof form>) => (value: string) => setForm((current) => (current ? { ...current, [key]: value } : current));
  const setSection = <K extends keyof Health>(key: K) => (value: Health[K]) => setHealth((current) => (current ? { ...current, [key]: value } : current));
  const setVital = (id: string, key: 'value' | 'note', value: string) =>
    setHealth((current) => (current ? { ...current, vitals: { ...current.vitals, [id]: { ...current.vitals[id], [key]: value } } } : current));
  const setAnxiety = (key: 'level' | 'sedation' | 'notes', value: string | number | null) =>
    setHealth((current) => (current ? { ...current, anxiety: { ...current.anxiety, [key]: value } } : current));

  const choose = (title: string, options: string[], selected: string, onSelect: (value: string) => void) =>
    setPicker({ title, options: options.map((option) => ({ label: option, value: option })), selected, onSelect });

  const healthOffline = form && !form.healthAvailable && <Notice>Your health details are not stored on this device. Connect to the internet to edit them.</Notice>;

  const body = () => {
    if (!form || !health) {
      return null;
    }
    if (tab === 'overview') {
      return (
        <>
          <View style={styles.pair}>
            <View style={styles.flex}>
              <Field label="First Name" value={form.firstName} onChangeText={setField('firstName')} />
            </View>
            <View style={styles.flex}>
              <Field label="Last Name" value={form.lastName} onChangeText={setField('lastName')} />
            </View>
          </View>
          <Field label="Email Address" value={form.email} onChangeText={setField('email')} keyboardType="email-address" autoCapitalize="none" />
          <Field label="Phone Number" value={form.phone} onChangeText={setField('phone')} keyboardType="phone-pad" />
          <View style={styles.pair}>
            <View style={styles.flex}>
              <Field label="Date of Birth" value={form.birthDate} onChangeText={setField('birthDate')} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" maxLength={10} />
            </View>
            <View style={styles.flex}>
              <Select label="Gender" value={form.gender} onPress={() => choose('Gender', GENDER_OPTIONS, form.gender, setField('gender'))} />
            </View>
          </View>
          <View style={styles.pair}>
            <View style={styles.flex}>
              <Select label="Civil Status" value={form.civilStatus} onPress={() => choose('Civil Status', CIVIL_STATUS_OPTIONS, form.civilStatus, setField('civilStatus'))} />
            </View>
            <View style={styles.flex}>
              <Select label="Blood Type" value={form.bloodType} onPress={() => choose('Blood Type', BLOOD_TYPE_OPTIONS, form.bloodType, setField('bloodType'))} />
            </View>
          </View>
          <Field label="Address" value={form.address} onChangeText={setField('address')} />
          <Field label="City / Municipality" value={form.city} onChangeText={setField('city')} />
          <View style={styles.pair}>
            <View style={styles.flex}>
              <Field label="Province" value={form.province} onChangeText={setField('province')} />
            </View>
            <View style={styles.flex}>
              <Field label="Zip Code" value={form.zipCode} onChangeText={setField('zipCode')} keyboardType="number-pad" maxLength={10} />
            </View>
          </View>
        </>
      );
    }
    if (tab === 'medical') {
      return (
        <>
          {healthOffline}
          <Repeatable
            title="Medical Conditions"
            addLabel="Add condition"
            rows={conditions}
            emptyRow={{ name: '' }}
            onChange={setConditions}
            renderRow={(row, update) => <Field label="Condition" value={row.name} placeholder="Hypertension" onChangeText={(name) => update({ name })} />}
          />
          <Repeatable
            title="Previous Dental Procedures"
            addLabel="Add procedure"
            rows={health.procedures}
            emptyRow={{ name: '', date: '', detail: '', note: '' }}
            onChange={setSection('procedures')}
            renderRow={(row, update) => (
              <>
                <Field label="Procedure" value={row.name} placeholder="Tooth Extraction" onChangeText={(name) => update({ name })} />
                <Field label="Date" value={row.date ?? ''} placeholder="March 2024" onChangeText={(date) => update({ date })} />
                <Field label="Details" value={row.detail ?? ''} placeholder="Lower right molar (#47)" onChangeText={(detail) => update({ detail })} />
                <Field label="Notes" value={row.note ?? ''} placeholder="No complications" onChangeText={(note) => update({ note })} />
              </>
            )}
          />
          <Text style={styles.sectionTitle}>Vital & Systemic Notes</Text>
          {VITAL_FIELDS.map(({ id, label, placeholder }) => (
            <View key={id} style={styles.vital}>
              <Field label={label} value={health.vitals[id]?.value ?? ''} placeholder={placeholder} onChangeText={(value) => setVital(id, 'value', value)} />
              <TextInput
                style={styles.input}
                value={health.vitals[id]?.note ?? ''}
                placeholder="Note (optional)"
                placeholderTextColor={guestColors.textMuted}
                onChangeText={(value) => setVital(id, 'note', value)}
                accessibilityLabel={`${label} note`}
              />
            </View>
          ))}
        </>
      );
    }
    if (tab === 'allergies') {
      return (
        <>
          {healthOffline}
          <Repeatable
            title="Known Allergies"
            addLabel="Add allergy"
            rows={health.allergies}
            emptyRow={{ name: '', type: 'drug', severity: 'mild', reaction: '' }}
            onChange={setSection('allergies')}
            renderRow={(row, update) => (
              <>
                <Field label="Allergy" value={row.name} placeholder="Penicillin" onChangeText={(name) => update({ name })} />
                <View style={styles.pair}>
                  <View style={styles.flex}>
                    <Select
                      label="Type"
                      value={ALLERGY_TYPES.find(({ value }) => value === row.type)?.label ?? ''}
                      onPress={() => setPicker({ title: 'Type', options: ALLERGY_TYPES, selected: row.type, onSelect: (value) => update({ type: value }) })}
                    />
                  </View>
                  <View style={styles.flex}>
                    <Select
                      label="Severity"
                      value={ALLERGY_SEVERITIES.find(({ value }) => value === row.severity)?.label ?? ''}
                      onPress={() => setPicker({ title: 'Severity', options: ALLERGY_SEVERITIES, selected: row.severity, onSelect: (severity) => update({ severity }) })}
                    />
                  </View>
                </View>
                <Field label="Reaction" value={row.reaction ?? ''} placeholder="Hives, difficulty breathing" onChangeText={(reaction) => update({ reaction })} />
              </>
            )}
          />
          <Repeatable
            title="Current Medications"
            addLabel="Add medication"
            rows={health.medications}
            emptyRow={{ name: '', dosage: '', purpose: '', note: '' }}
            onChange={setSection('medications')}
            renderRow={(row, update) => (
              <>
                <Field label="Medication" value={row.name} placeholder="Amlodipine" onChangeText={(name) => update({ name })} />
                <Field label="Dosage" value={row.dosage ?? ''} placeholder="5mg once daily" onChangeText={(dosage) => update({ dosage })} />
                <Field label="For" value={row.purpose ?? ''} placeholder="Hypertension" onChangeText={(purpose) => update({ purpose })} />
                <Field label="Note for the dentist" value={row.note ?? ''} placeholder="Anything to watch out for" onChangeText={(note) => update({ note })} />
              </>
            )}
          />
          <Text style={styles.sectionTitle}>Dental Anxiety</Text>
          <Select
            label="Anxiety Level"
            value={health.anxiety.level ? ANXIETY_LEVELS[health.anxiety.level - 1] : ''}
            onPress={() =>
              choose('Anxiety Level', ANXIETY_LEVELS, health.anxiety.level ? ANXIETY_LEVELS[health.anxiety.level - 1] : '', (value) =>
                setAnxiety('level', ANXIETY_LEVELS.indexOf(value) + 1),
              )
            }
          />
          <Field label="Preferred Sedation" value={health.anxiety.sedation ?? ''} placeholder="Local anesthesia only" onChangeText={(value) => setAnxiety('sedation', value)} />
          <Field label="Notes for Dentist" value={health.anxiety.notes ?? ''} multiline textAlignVertical="top" style={[styles.input, styles.textarea]} maxLength={1000} onChangeText={(value) => setAnxiety('notes', value)} />
        </>
      );
    }
    return (
      <>
        <Field label="Contact Name" value={form.emergencyContactName} onChangeText={setField('emergencyContactName')} />
        <Field label="Relationship" value={form.emergencyContactRelationship} onChangeText={setField('emergencyContactRelationship')} />
        <Field label="Contact Phone" value={form.emergencyContactPhone} onChangeText={setField('emergencyContactPhone')} keyboardType="phone-pad" />
        <Field label="Address" value={form.emergencyContactAddress} onChangeText={setField('emergencyContactAddress')} />
      </>
    );
  };

  return (
    <PatientShell navigation={navigation} title="Edit Profile" active="Profile">
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <BackLink label="Back to Profile" onPress={back} />
          {loading ? (
            <ActivityIndicator style={styles.loader} size="large" color={guestColors.primary} />
          ) : done ? (
            <SuccessCard
              title="Profile Updated!"
              message={done.queued ? "You're offline, so your changes are saved on this phone and will be sent once you're back online." : 'Your profile information has been successfully saved.'}
              actionLabel="Back to Profile"
              onAction={back}
            />
          ) : !form ? (
            <Message icon="cloud-offline-outline" title={problem ?? 'Your profile could not be loaded.'} />
          ) : (
            <Card>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabs}>
                {TABS.map(({ id, label }) => {
                  const active = id === tab;
                  return (
                    <TouchableOpacity key={id} style={[styles.tab, active && styles.tabActive]} onPress={() => setTab(id)} accessibilityRole="tab" accessibilityState={{ selected: active }}>
                      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <View style={styles.body}>{body()}</View>
              {problem && <Notice tone="danger">{problem}</Notice>}
              <View style={styles.actions}>
                <OutlineButton label="Cancel" onPress={back} style={styles.flex} />
                <PrimaryButton label={saving ? 'Saving…' : 'Save Changes'} onPress={save} busy={saving} style={styles.flex} />
              </View>
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <SelectSheet
        visible={picker !== null}
        title={picker?.title ?? ''}
        options={picker?.options ?? []}
        selected={picker?.selected ?? ''}
        onSelect={(value: string) => picker?.onSelect(value)}
        onClose={() => setPicker(null)}
      />
    </PatientShell>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { marginTop: 48 },
  content: { padding: spacing.marginMobile, paddingBottom: spacing.xl },
  tabBar: { flexGrow: 0, marginBottom: spacing.md },
  tabs: { gap: spacing.xs, padding: spacing.xs, borderRadius: 10, backgroundColor: '#eaedf2' },
  tab: { paddingHorizontal: spacing.sm, paddingVertical: spacing.base, borderRadius: 8 },
  tabActive: { backgroundColor: guestColors.surface },
  tabText: { fontSize: 13, lineHeight: 18, fontWeight: '500', color: guestColors.textMuted },
  tabTextActive: { color: guestColors.primary, fontWeight: '600' },
  body: { gap: spacing.sm, marginBottom: spacing.sm },
  pair: { flexDirection: 'row', gap: spacing.sm },
  field: { gap: spacing.xs },
  label: { fontSize: 12, lineHeight: 18, fontWeight: '600', letterSpacing: 0.4, color: guestColors.text },
  input: { ...type.bodyMd, minHeight: 44, paddingHorizontal: spacing.sm, paddingVertical: spacing.base, color: guestColors.text, borderWidth: 1, borderColor: guestColors.border, borderRadius: 10, backgroundColor: guestColors.surface },
  textarea: { minHeight: 90 },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  selectValue: { ...type.bodyMd, flex: 1, color: guestColors.text },
  selectEmpty: { color: guestColors.textMuted },
  sectionTitle: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: guestColors.text, marginTop: spacing.xs },
  repeatable: { gap: spacing.sm },
  repeatRow: { gap: spacing.sm, padding: spacing.sm, paddingTop: spacing.lg, borderRadius: 12, backgroundColor: guestColors.background },
  remove: { position: 'absolute', top: spacing.xs, right: spacing.xs, zIndex: 1, padding: spacing.xs },
  add: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start' },
  addText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: guestColors.primary },
  vital: { gap: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});

export default EditProfileScreen;
