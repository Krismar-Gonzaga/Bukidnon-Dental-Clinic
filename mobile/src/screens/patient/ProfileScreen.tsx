// My Profile with the website's four tabs. Personal details are readable offline; health
// details are not kept on the device, so they need a connection.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Icon from 'react-native-vector-icons/Ionicons';
import PatientShell from '../../components/patient/PatientShell';
import { Notice } from '../../components/patient/PatientUi';
import { Card, guestColors, initialOf, Message, OutlineButton, PrimaryButton } from '../../components/guest/GuestUi';
import {
  ALLERGY_SEVERITIES,
  ALLERGY_TYPES,
  ANXIETY_LEVELS,
  CLINIC_RECORDED_NOTE,
  CONDITIONS_NOTICE,
  CONSENT_OPTIONS,
  VITAL_FIELDS,
} from '../../content/patientContent';
import { useSync } from '../../context/SyncContext';
import { patientService } from '../../services/api';
import { formatDateKey } from '../../services/booking';
import {
  ageFrom,
  fetchClinicRecorded,
  fetchProfile,
  Health,
  medicalAlerts,
  photoSource,
  Profile,
  profileChips,
  saveConsent,
  uploadPhoto,
  Vital,
} from '../../services/patientPortal';
import { spacing, type } from '../../theme/tokens';
import { serverMessage } from './BookAppointmentScreen';

type TabId = 'overview' | 'medical' | 'allergies' | 'emergency';

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'overview', label: 'Overview', icon: 'person-outline' },
  { id: 'medical', label: 'Medical History', icon: 'clipboard-outline' },
  { id: 'allergies', label: 'Allergies & Medications', icon: 'shield-outline' },
  { id: 'emergency', label: 'Emergency Contact', icon: 'call-outline' },
];

const SEVERITY_TONES: Record<string, { color: string; background: string }> = {
  severe: { color: '#c81e1e', background: '#fbdada' },
  moderate: { color: '#a16207', background: '#fdeeb5' },
  mild: { color: '#13784a', background: '#ecfbf3' },
};

const orDash = (value?: string | number | null) => (value === null || value === undefined || value === '' ? '—' : String(value));

const Rows = ({ rows }: { rows: Array<[string, string]> }) => (
  <View>
    {rows.map(([label, value], index) => (
      <View key={label} style={[styles.row, index > 0 && styles.rowDivider]}>
        <Text style={styles.rowLabel}>{label.toUpperCase()}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    ))}
  </View>
);

const Section = ({ title, subtitle, onEdit, children }: { title: string; subtitle?: string; onEdit?: () => void; children: React.ReactNode }) => (
  <Card style={styles.section}>
    <View style={styles.sectionHeader}>
      <View style={styles.flex}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {onEdit && (
        <TouchableOpacity style={styles.edit} onPress={onEdit} hitSlop={8} accessibilityRole="link" accessibilityLabel={`Edit ${title}`}>
          <Icon name="pencil-outline" size={14} color={guestColors.primary} />
          <Text style={styles.editText}>Edit</Text>
        </TouchableOpacity>
      )}
    </View>
    {children}
  </Card>
);

const Empty = ({ children }: { children: string }) => <Text style={styles.empty}>{children}</Text>;

// Amber when the patient added a note, green when they report nothing, neutral otherwise.
const vitalStyle = (vital: Vital) => {
  if (!vital.value) {
    return null;
  }
  if (vital.note) {
    return styles.vitalWarning;
  }
  return /^none/i.test(vital.value) ? styles.vitalSuccess : null;
};

const ClinicRecords = () => {
  const [data, setData] = useState<{ history: any[]; records: any[] } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchClinicRecorded()
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  return (
    <Section title="Recorded by Your Clinics" subtitle={CLINIC_RECORDED_NOTE}>
      {failed ? (
        <Empty>This needs an internet connection.</Empty>
      ) : !data ? (
        <ActivityIndicator color={guestColors.primary} />
      ) : data.history.length === 0 && data.records.length === 0 ? (
        <Empty>Nothing recorded by a clinic yet.</Empty>
      ) : (
        <>
          {data.history.map((entry) => (
            <View key={entry.clinic} style={styles.clinicRecord}>
              <Text style={styles.itemTitle}>{entry.clinic}</Text>
              <Text style={styles.itemText}>Allergies: {orDash(entry.allergies)}</Text>
              <Text style={styles.itemText}>Medications: {orDash(entry.medications)}</Text>
              <Text style={styles.itemText}>Conditions: {orDash(entry.conditions)}</Text>
            </View>
          ))}
          {data.records.map((record) => (
            <View key={record.id} style={styles.clinicRecord}>
              <Text style={styles.itemTitle}>{record.procedures || record.record_type}</Text>
              <Text style={styles.itemText}>{[record.clinic, record.dentist].filter(Boolean).join(' · ')}</Text>
              {record.care_instructions ? <Text style={styles.itemText}>{record.care_instructions}</Text> : null}
            </View>
          ))}
        </>
      )}
    </Section>
  );
};

const MedicalTab = ({ health, onEdit }: { health: Health; onEdit: () => void }) => (
  <>
    <Section title="Medical Conditions" subtitle="Existing or prior diagnoses relevant to dental care" onEdit={onEdit}>
      {health.conditions.length > 0 ? (
        <>
          <View style={styles.chips}>
            {health.conditions.map((condition) => (
              <Text key={condition} style={[styles.chip, styles.chipWarning]}>
                {condition}
              </Text>
            ))}
          </View>
          <Notice>{CONDITIONS_NOTICE}</Notice>
        </>
      ) : (
        <Empty>No conditions added.</Empty>
      )}
    </Section>

    <Section title="Previous Dental Procedures" subtitle="Relevant past treatments" onEdit={onEdit}>
      {health.procedures.length > 0 ? (
        health.procedures.map((procedure, index) => (
          <View key={`${procedure.name}-${index}`} style={styles.item}>
            <View style={styles.itemIcon}>
              <Icon name="medkit-outline" size={18} color={guestColors.primary} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.itemTitle}>{procedure.name}</Text>
              {procedure.detail ? <Text style={styles.itemText}>{procedure.detail}</Text> : null}
              {procedure.note ? <Text style={styles.itemNote}>{procedure.note}</Text> : null}
            </View>
            {procedure.date ? <Text style={styles.itemDate}>{procedure.date}</Text> : null}
          </View>
        ))
      ) : (
        <Empty>No procedures added.</Empty>
      )}
    </Section>

    <Section title="Vital & Systemic Notes" subtitle="Information that may affect anesthesia or treatment" onEdit={onEdit}>
      <View style={styles.vitals}>
        {VITAL_FIELDS.map(({ id, label }) => {
          const vital = health.vitals[id] ?? {};
          return (
            <View key={id} style={[styles.vital, vitalStyle(vital)]}>
              <Text style={styles.rowLabel}>{label.toUpperCase()}</Text>
              <Text style={styles.vitalValue}>{orDash(vital.value)}</Text>
              {vital.note ? <Text style={styles.vitalNote}>{vital.note}</Text> : null}
            </View>
          );
        })}
      </View>
    </Section>

    <ClinicRecords />
  </>
);

const AllergiesTab = ({ health, onEdit }: { health: Health; onEdit: () => void }) => {
  const { level, sedation, notes } = health.anxiety;
  return (
    <>
      <Section title="Known Allergies" subtitle="Drug, food, and material sensitivities" onEdit={onEdit}>
        {health.allergies.length > 0 ? (
          health.allergies.map((allergy, index) => {
            const tone = SEVERITY_TONES[allergy.severity];
            return (
              <View key={`${allergy.name}-${index}`} style={[styles.item, styles.itemDanger]}>
                <View style={[styles.itemIcon, styles.itemIconDanger]}>
                  <Icon name="alert-circle-outline" size={18} color="#c81e1e" />
                </View>
                <View style={styles.flex}>
                  <View style={styles.itemHeading}>
                    <Text style={styles.itemTitle}>{allergy.name}</Text>
                    <Text style={styles.chip}>{ALLERGY_TYPES.find(({ value }) => value === allergy.type)?.label ?? allergy.type}</Text>
                    <Text style={[styles.chip, tone && { color: tone.color, backgroundColor: tone.background }]}>
                      {ALLERGY_SEVERITIES.find(({ value }) => value === allergy.severity)?.label ?? allergy.severity}
                    </Text>
                  </View>
                  {allergy.reaction ? <Text style={styles.itemText}>Reaction: {allergy.reaction}</Text> : null}
                </View>
              </View>
            );
          })
        ) : (
          <Empty>No allergies added.</Empty>
        )}
      </Section>

      <Section title="Current Medications" subtitle="Medicines taken regularly that may interact with dental treatments" onEdit={onEdit}>
        {health.medications.length > 0 ? (
          health.medications.map((medication, index) => (
            <View key={`${medication.name}-${index}`} style={styles.item}>
              <View style={styles.itemIcon}>
                <Icon name="medkit-outline" size={18} color={guestColors.primary} />
              </View>
              <View style={styles.flex}>
                <View style={styles.itemHeading}>
                  <Text style={styles.itemTitle}>{medication.name}</Text>
                  {medication.dosage ? <Text style={styles.itemText}>{medication.dosage}</Text> : null}
                </View>
                {medication.purpose ? <Text style={styles.itemText}>For: {medication.purpose}</Text> : null}
                {medication.note ? <Text style={styles.vitalNote}>{medication.note}</Text> : null}
              </View>
            </View>
          ))
        ) : (
          <Empty>No medications added.</Empty>
        )}
      </Section>

      <Section title="Dental Anxiety" subtitle="Helps the dentist prepare and accommodate your needs" onEdit={onEdit}>
        <View style={styles.box}>
          <Text style={styles.rowLabel}>ANXIETY LEVEL</Text>
          <Text style={styles.vitalValue}>{level ? ANXIETY_LEVELS[level - 1] : '—'}</Text>
          <View style={styles.bar} accessibilityLabel={level ? `Level ${level} of ${ANXIETY_LEVELS.length}` : 'Not set'}>
            {ANXIETY_LEVELS.map((name, index) => (
              <View key={name} style={[styles.barSegment, index < (level ?? 0) && styles.barSegmentOn]} />
            ))}
          </View>
        </View>
        <View style={styles.box}>
          <Text style={styles.rowLabel}>PREFERRED SEDATION</Text>
          <Text style={styles.vitalValue}>{orDash(sedation)}</Text>
        </View>
        <View style={styles.box}>
          <Text style={styles.rowLabel}>NOTES FOR DENTIST</Text>
          <Text style={styles.itemText}>{orDash(notes)}</Text>
        </View>
      </Section>
    </>
  );
};

const EmergencyTab = ({ profile, onEdit, onChanged }: { profile: Profile; onEdit: () => void; onChanged: () => Promise<void> }) => {
  const [pending, setPending] = useState<{ id: string; value: boolean } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const hasContact = Boolean(profile.emergencyContactName || profile.emergencyContactPhone);

  const change = async (id: string, value: boolean) => {
    setPending({ id, value });
    setProblem(null);
    try {
      await saveConsent(id, value);
      await onChanged();
    } catch (error) {
      setProblem(serverMessage(error, 'This setting could not be saved.'));
    } finally {
      setPending(null);
    }
  };

  const current = (id: string) => {
    if (pending?.id === id) {
      return pending.value;
    }
    return id === 'emailReminders' ? profile.emailNotifications : Boolean(profile.consents[id]);
  };

  return (
    <>
      <Section title="Primary Emergency Contact" subtitle="Person to contact in case of emergency during or after a procedure" onEdit={onEdit}>
        {hasContact ? (
          <>
            <View style={styles.contact}>
              <View style={styles.contactAvatar}>
                <Text style={styles.contactInitial}>{initialOf(profile.emergencyContactName || '?')}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.itemTitle}>{orDash(profile.emergencyContactName)}</Text>
                {profile.emergencyContactRelationship ? <Text style={styles.itemText}>{profile.emergencyContactRelationship}</Text> : null}
                {profile.emergencyContactPhone ? (
                  <Text style={styles.contactPhone} accessibilityRole="link" onPress={() => Linking.openURL(`tel:${profile.emergencyContactPhone.replace(/\s/g, '')}`)}>
                    {profile.emergencyContactPhone}
                  </Text>
                ) : null}
              </View>
            </View>
            <Rows
              rows={[
                ['Relationship', orDash(profile.emergencyContactRelationship)],
                ['Mobile Number', orDash(profile.emergencyContactPhone)],
                ['Address', orDash(profile.emergencyContactAddress)],
              ]}
            />
          </>
        ) : (
          <Empty>No emergency contact added.</Empty>
        )}
      </Section>

      <Section title="Consent & Preferences" subtitle="Communication and treatment consent settings">
        {CONSENT_OPTIONS.map(({ id, label }, index) => (
          <View key={id} style={[styles.consent, index > 0 && styles.rowDivider]}>
            <Text style={styles.consentLabel}>{label}</Text>
            <Switch
              value={current(id)}
              onValueChange={(value) => change(id, value)}
              disabled={pending !== null}
              trackColor={{ false: '#c5cad6', true: guestColors.primary }}
              thumbColor="#ffffff"
              accessibilityLabel={label}
            />
          </View>
        ))}
        {problem && <Notice tone="danger">{problem}</Notice>}
      </Section>
    </>
  );
};

const ProfileScreen = ({ navigation }: { navigation: any }) => {
  const { dataVersion } = useSync();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [counts, setCounts] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>('overview');
  const [photo, setPhoto] = useState<{ uri: string; headers?: Record<string, string> } | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const fresh = await fetchProfile();
      setProfile(fresh);
      setPhoto(fresh.photoVersion ? await photoSource(fresh.photoVersion) : null);
    } catch (error) {
      console.error('Failed to load the profile:', error);
    } finally {
      setLoading(false);
    }
    patientService
      .getDashboard()
      .then((response: any) => setCounts(response.data.data?.counts ?? null))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
    return navigation.addListener?.('focus', load);
  }, [load, navigation, dataVersion]);

  const choosePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) {
      return;
    }
    setUploading(true);
    try {
      await uploadPhoto(asset);
      await load();
    } catch (error) {
      Alert.alert('Photo not updated', serverMessage(error, 'Please choose a JPG, PNG or WebP image under 2 MB.'));
    } finally {
      setUploading(false);
    }
  };

  const editTab = (id: TabId) => () => navigation.navigate('EditProfile', { tab: id });

  if (!profile) {
    return (
      <PatientShell navigation={navigation} title="My Profile" active="Profile">
        {loading ? (
          <ActivityIndicator style={styles.loader} size="large" color={guestColors.primary} />
        ) : (
          <Message icon="cloud-offline-outline" title="Your profile isn't saved yet" body="Connect to the internet to load it." actionLabel="Try again" onAction={load} />
        )}
      </PatientShell>
    );
  }

  const chips = profileChips(profile);
  const alerts = medicalAlerts(profile);
  const place = [profile.city, profile.province].filter(Boolean).join(', ') || profile.address;

  const healthOffline = <Message icon="cloud-offline-outline" title="This needs an internet connection" body="Your health details are not stored on this device." actionLabel="Try again" onAction={load} />;

  return (
    <PatientShell navigation={navigation} title="My Profile" active="Profile">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <View style={styles.avatar}>
                {photo ? <Image source={photo} style={styles.avatarImage} accessibilityIgnoresInvertColors /> : <Text style={styles.avatarText}>{initialOf(profile.name)}</Text>}
              </View>
              <TouchableOpacity style={styles.camera} onPress={choosePhoto} disabled={uploading} accessibilityRole="button" accessibilityLabel="Upload new photo">
                {uploading ? <ActivityIndicator size="small" color={guestColors.primary} /> : <Icon name="camera-outline" size={15} color={guestColors.text} />}
              </TouchableOpacity>
            </View>
            <View style={styles.flex}>
              <Text style={styles.name} accessibilityRole="header">
                {profile.name}
              </Text>
              <Text style={styles.meta}>{profile.email}</Text>
              <Text style={styles.meta}>{[profile.phone, place].filter(Boolean).join(' · ')}</Text>
            </View>
          </View>
          {chips.length > 0 && (
            <View style={styles.chips}>
              {chips.map(({ label, tone }) => (
                <Text key={label} style={[styles.chip, tone === 'danger' ? styles.chipDanger : styles.chipWarning]}>
                  {label}
                </Text>
              ))}
            </View>
          )}
          <View style={styles.headerActions}>
            <PrimaryButton label="Edit Profile" icon="pencil-outline" onPress={() => navigation.navigate('EditProfile')} style={styles.flex} />
            <OutlineButton label="Password" icon="lock-closed-outline" onPress={() => navigation.navigate('ChangePassword')} style={styles.flex} />
          </View>
        </Card>

        {alerts ? <Notice tone="danger" title="Important Medical Alerts">{alerts}</Notice> : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} style={styles.tabBar}>
          {TABS.map(({ id, label, icon }) => {
            const active = id === tab;
            return (
              <TouchableOpacity
                key={id}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setTab(id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Icon name={icon} size={15} color={active ? guestColors.primary : guestColors.textMuted} />
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {tab === 'overview' && (
          <>
            <Section title="Personal Information" subtitle="Basic demographic details" onEdit={editTab('overview')}>
              <Rows
                rows={[
                  ['Full Name', profile.name],
                  ['Date of Birth', profile.birthDate ? formatDateKey(profile.birthDate, { month: 'long', day: 'numeric', year: 'numeric' }) : '—'],
                  ['Age', profile.birthDate ? `${ageFrom(profile.birthDate)} years old` : '—'],
                  ['Gender', orDash(profile.gender)],
                  ['Civil Status', orDash(profile.civilStatus)],
                  ['Blood Type', orDash(profile.bloodType)],
                ]}
              />
            </Section>
            <Section title="Contact Details" subtitle="How we reach you" onEdit={editTab('overview')}>
              <Rows
                rows={[
                  ['Email', profile.email],
                  ['Mobile', orDash(profile.phone)],
                  ['Address', orDash(profile.address)],
                  ['City', orDash(profile.city)],
                  ['Province', orDash(profile.province)],
                  ['Zip Code', orDash(profile.zipCode)],
                ]}
              />
            </Section>
            {counts && (
              <Section title="Activity Summary">
                <View style={styles.activity}>
                  {[
                    ['Total Appointments', counts.total],
                    ['Completed', counts.completed],
                    ['Upcoming', counts.upcoming],
                    ['Reviews Submitted', counts.reviews_given],
                  ].map(([label, value]) => (
                    <View key={label} style={styles.activityItem}>
                      <Text style={styles.activityValue}>{orDash(value)}</Text>
                      <Text style={styles.activityLabel}>{label}</Text>
                    </View>
                  ))}
                </View>
              </Section>
            )}
          </>
        )}
        {tab === 'medical' && (profile.healthAvailable ? <MedicalTab health={profile.health} onEdit={editTab('medical')} /> : healthOffline)}
        {tab === 'allergies' && (profile.healthAvailable ? <AllergiesTab health={profile.health} onEdit={editTab('allergies')} /> : healthOffline)}
        {tab === 'emergency' && <EmergencyTab profile={profile} onEdit={editTab('emergency')} onChanged={load} />}
      </ScrollView>
    </PatientShell>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { marginTop: 64 },
  content: { padding: spacing.marginMobile, paddingBottom: spacing.xl, gap: spacing.md },

  header: { padding: spacing.md, gap: spacing.sm },
  headerTop: { flexDirection: 'row', gap: spacing.md },
  avatar: { width: 84, height: 84, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: guestColors.primary },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { fontSize: 30, fontWeight: '700', color: '#ffffff' },
  camera: {
    position: 'absolute',
    right: -8,
    bottom: -8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: guestColors.border,
    backgroundColor: guestColors.surface,
  },
  name: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: guestColors.text },
  meta: { fontSize: 13, lineHeight: 19, color: guestColors.textMuted },
  headerActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.base },
  chip: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: guestColors.textMuted, backgroundColor: guestColors.neutralSoft, borderRadius: 999, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 3 },
  chipDanger: { color: '#c81e1e', backgroundColor: '#fdecec' },
  chipWarning: { color: '#a16207', backgroundColor: '#fdeeb5' },

  tabBar: { flexGrow: 0, marginHorizontal: -spacing.marginMobile },
  tabs: { paddingHorizontal: spacing.marginMobile, gap: spacing.xs },
  tab: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.base, borderRadius: 10, backgroundColor: '#eaedf2' },
  tabActive: { backgroundColor: guestColors.surface },
  tabText: { fontSize: 13, lineHeight: 18, fontWeight: '500', color: guestColors.textMuted },
  tabTextActive: { color: guestColors.primary, fontWeight: '600' },

  section: { padding: spacing.md, gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  sectionTitle: { fontSize: 18, lineHeight: 24, fontWeight: '600', color: guestColors.text },
  sectionSubtitle: { fontSize: 12, lineHeight: 17, color: guestColors.textMuted },
  edit: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  editText: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: guestColors.primary },
  empty: { ...type.bodyMd, color: guestColors.textMuted },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.sm },
  rowDivider: { borderTopWidth: 1, borderTopColor: guestColors.border },
  rowLabel: { fontSize: 11, lineHeight: 16, fontWeight: '600', letterSpacing: 0.4, color: guestColors.textMuted },
  rowValue: { flexShrink: 1, fontSize: 14, lineHeight: 20, color: guestColors.text, textAlign: 'right' },

  activity: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm },
  activityItem: { width: '48.5%', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.xs, borderRadius: 12, backgroundColor: guestColors.background },
  activityValue: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: guestColors.primary },
  activityLabel: { fontSize: 12, lineHeight: 17, color: guestColors.textMuted, textAlign: 'center' },

  item: { flexDirection: 'row', gap: spacing.sm, padding: spacing.sm, borderRadius: 12, backgroundColor: guestColors.background },
  itemDanger: { backgroundColor: '#fdecec' },
  itemIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: guestColors.primarySoft },
  itemIconDanger: { backgroundColor: '#fbdada' },
  itemHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  itemTitle: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: guestColors.text },
  itemText: { fontSize: 13, lineHeight: 18, color: guestColors.textMuted },
  itemNote: { fontSize: 13, lineHeight: 18, fontStyle: 'italic', color: guestColors.textMuted },
  itemDate: { fontSize: 12, lineHeight: 18, color: guestColors.textMuted },
  clinicRecord: { paddingVertical: spacing.base, gap: 2 },

  vitals: { gap: spacing.sm },
  vital: { padding: spacing.sm, borderRadius: 10, borderWidth: 1, borderColor: guestColors.border, backgroundColor: guestColors.background },
  vitalWarning: { borderColor: '#f3e2a6', backgroundColor: '#fdf8e8' },
  vitalSuccess: { borderColor: '#b6e6cb', backgroundColor: '#ecfbf3' },
  vitalValue: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: guestColors.text, marginTop: 2 },
  vitalNote: { fontSize: 13, lineHeight: 18, fontStyle: 'italic', color: '#a16207' },

  box: { padding: spacing.sm, borderRadius: 10, backgroundColor: guestColors.background },
  bar: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.base },
  barSegment: { flex: 1, height: 5, borderRadius: 3, backgroundColor: guestColors.border },
  barSegmentOn: { backgroundColor: '#f5a524' },

  contact: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: 12, backgroundColor: guestColors.background },
  contactAvatar: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: guestColors.primary },
  contactInitial: { fontSize: 18, fontWeight: '600', color: '#ffffff' },
  contactPhone: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: guestColors.primary },
  consent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.sm },
  consentLabel: { flex: 1, fontSize: 14, lineHeight: 20, color: guestColors.text },
});

export default ProfileScreen;
