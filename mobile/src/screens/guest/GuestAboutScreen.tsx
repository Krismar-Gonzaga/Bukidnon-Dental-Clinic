// About page, laid out like the website's. The copy is provisional; the four figures are
// counted by the server from real records and show a dash until they are known.
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSync } from '../../context/SyncContext';
import GuestShell, { GuestFooter } from '../../components/guest/GuestShell';
import { guestColors } from '../../components/guest/GuestUi';
import { ABOUT_HERO, ABOUT_MISSION, ABOUT_VALUES } from '../../content/guestContent';
import { getCachedHome, HomeData } from '../../services/offline/publicRepository';
import { spacing, type } from '../../theme/tokens';

const count = (value: number | null | undefined) => (value == null ? '—' : value.toLocaleString('en-PH'));

/** The four figures shown on the page; never a sample number. */
export const aboutStats = (stats: HomeData['stats'] | undefined) => [
  { id: 'clinics', icon: 'business-outline', value: count(stats?.verifiedClinics), label: 'Partner Clinics' },
  { id: 'patients', icon: 'people-outline', value: count(stats?.patients), label: 'Patients Served' },
  {
    id: 'satisfaction',
    icon: 'ribbon-outline',
    value: stats?.satisfactionRate == null ? '—' : `${stats.satisfactionRate}%`,
    label: 'Satisfaction Rate',
  },
  { id: 'municipalities', icon: 'location-outline', value: count(stats?.municipalities), label: 'Municipalities' },
];

const GuestAboutScreen = ({ navigation }: { navigation: any }) => {
  const { isReady, dataVersion } = useSync();
  const [stats, setStats] = useState<HomeData['stats']>();

  useEffect(() => {
    if (isReady) {
      getCachedHome()
        .then((cached) => setStats(cached?.value.stats))
        .catch((error) => console.error('Failed to read saved home data:', error));
    }
  }, [isReady, dataVersion]);

  return (
    <GuestShell navigation={navigation} active="about">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle} accessibilityRole="header">
            {ABOUT_HERO.title}
          </Text>
          <Text style={styles.heroText}>{ABOUT_HERO.subtitle}</Text>
        </View>

        <View style={styles.mission}>
          <Text style={styles.sectionTitle}>{ABOUT_MISSION.title}</Text>
          {ABOUT_MISSION.paragraphs.map((paragraph) => (
            <Text key={paragraph} style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}
          <View style={styles.stats}>
            {aboutStats(stats).map((stat) => (
              <View key={stat.id} style={styles.statCard}>
                <View style={styles.statIcon}>
                  <Icon name={stat.icon} size={22} color={guestColors.primary} />
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.values}>
          <Text style={[styles.sectionTitle, styles.valuesTitle]}>Our Core Values</Text>
          {ABOUT_VALUES.map((value) => (
            <View key={value.id} style={styles.valueCard}>
              <View style={[styles.valueIcon, { backgroundColor: value.background }]}>
                <Icon name={value.icon} size={26} color={value.color} />
              </View>
              <Text style={styles.valueTitle}>{value.title}</Text>
              <Text style={styles.valueText}>{value.description}</Text>
            </View>
          ))}
        </View>

        <GuestFooter navigation={navigation} active="about" />
      </ScrollView>
    </GuestShell>
  );
};

const styles = StyleSheet.create({
  hero: { backgroundColor: '#003b85', paddingHorizontal: spacing.marginMobile, paddingVertical: spacing.xl + spacing.sm, alignItems: 'center' },
  heroTitle: { fontSize: 30, lineHeight: 38, fontWeight: '700', color: '#ffffff', textAlign: 'center', marginBottom: spacing.sm },
  heroText: { ...type.bodyLg, color: 'rgba(255,255,255,0.85)', textAlign: 'center' },

  mission: { backgroundColor: guestColors.surface, paddingHorizontal: spacing.marginMobile, paddingVertical: spacing.xl },
  sectionTitle: { fontSize: 26, lineHeight: 32, fontWeight: '700', color: guestColors.text, marginBottom: spacing.md },
  paragraph: { ...type.bodyLg, color: guestColors.text, marginBottom: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm, marginTop: spacing.sm },
  statCard: {
    width: '48.5%',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: guestColors.border,
    backgroundColor: guestColors.surface,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: guestColors.primarySoft,
    marginBottom: spacing.sm,
  },
  statValue: { fontSize: 26, lineHeight: 32, fontWeight: '700', color: guestColors.text },
  statLabel: { fontSize: 14, lineHeight: 20, color: guestColors.text, textAlign: 'center' },

  values: { paddingHorizontal: spacing.marginMobile, paddingVertical: spacing.xl, gap: spacing.md },
  valuesTitle: { textAlign: 'center', marginBottom: spacing.sm },
  valueCard: {
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: guestColors.border,
    backgroundColor: guestColors.surface,
  },
  valueIcon: { width: 64, height: 64, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  valueTitle: { fontSize: 18, lineHeight: 24, fontWeight: '600', color: guestColors.text, marginBottom: spacing.xs, textAlign: 'center' },
  valueText: { ...type.bodyMd, color: guestColors.textMuted, textAlign: 'center' },
});

export default GuestAboutScreen;
