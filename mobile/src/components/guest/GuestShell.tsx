// Frame shared by the guest pages: the website's header (brand and menu button), the
// offline strip and the slide-in menu. GuestFooter is the website's footer.
import React, { useState } from 'react';
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import OfflineBanner from '../common/OfflineBanner';
import { BRAND_NAME, FOOTER_TAGLINE, SUPPORT_EMAIL, SUPPORT_PHONE } from '../../content/guestContent';
import { LegalPageKey } from '../../content/guestLegal';
import { guestColors } from './GuestUi';
import GuestDrawer, { GuestMenuKey } from './GuestDrawer';
import PatientShell, { PatientRoute } from '../patient/PatientShell';
import { useAuth } from '../../context/AuthContext';
import { spacing, type } from '../../theme/tokens';

const MENU_ROUTES: Record<Exclude<GuestMenuKey, 'home'>, string> = {
  clinics: 'GuestClinics',
  dentists: 'GuestDentists',
  services: 'GuestServices',
  about: 'GuestAbout',
  contact: 'GuestContact',
};

/** Top-level pages replace each other, so the back button never unwinds a menu history. */
const goToMenu = (navigation: any, key: GuestMenuKey, current?: GuestMenuKey) => {
  if (key === current) {
    return;
  }
  if (key === 'home') {
    navigation.popToTop();
    return;
  }
  navigation.popTo(MENU_ROUTES[key]);
};

type GuestShellProps = {
  navigation: any;
  /** The page this is in the menu; detail pages leave it out and get a back button. */
  active?: GuestMenuKey;
  children: React.ReactNode;
  /** Top bar title when a signed-in patient opens this page. */
  patientTitle?: string;
};

// The same page in the patient's own menu, for the entries both have.
const PATIENT_ACTIVE: Partial<Record<GuestMenuKey, PatientRoute>> = { clinics: 'GuestClinics' };

const GuestShell = ({ navigation, active, children, patientTitle = 'BukidnonDental' }: GuestShellProps) => {
  const { isAuthenticated } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // Patients browse the same clinic and dentist pages, inside their own frame.
  if (isAuthenticated) {
    return (
      <PatientShell navigation={navigation} title={patientTitle} active={active ? PATIENT_ACTIVE[active] : undefined}>
        {children}
      </PatientShell>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          {active === undefined && (
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} accessibilityLabel="Back">
              <Icon name="arrow-back" size={24} color={guestColors.primary} />
            </TouchableOpacity>
          )}
          <Text style={styles.brand}>{BRAND_NAME}</Text>
        </View>
        <TouchableOpacity style={styles.menuButton} onPress={() => setMenuOpen(true)} accessibilityLabel="Open menu">
          <Icon name="menu" size={24} color={guestColors.primary} />
        </TouchableOpacity>
      </View>
      <OfflineBanner />

      {children}

      <GuestDrawer
        visible={menuOpen}
        activeItem={active ?? null}
        onClose={() => setMenuOpen(false)}
        onSelect={(key) => goToMenu(navigation, key, active)}
        onLogin={() => navigation.navigate('Login')}
        onRegister={() => navigation.navigate('Register')}
      />
    </SafeAreaView>
  );
};

const FooterLink = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <Text style={styles.footerLink} onPress={onPress} accessibilityRole="link">
    {label}
  </Text>
);

export const GuestFooter = ({ navigation, active }: { navigation: any; active?: GuestMenuKey }) => {
  const { isAuthenticated } = useAuth();
  const openLegal = (page: LegalPageKey) => navigation.navigate('GuestLegal', { page });
  // Signed-in patients have every page in their menu.
  if (isAuthenticated) {
    return null;
  }
  return (
    <View style={styles.footer}>
      <View style={styles.footerInner}>
        <Text style={styles.footerBrand}>{BRAND_NAME}</Text>
        <Text style={styles.footerText}>{FOOTER_TAGLINE}</Text>
        <View style={styles.footerColumns}>
          <View style={styles.footerColumn}>
            <Text style={styles.footerHeading}>Quick Links</Text>
            <FooterLink label="Home" onPress={() => goToMenu(navigation, 'home', active)} />
            <FooterLink label="Find Clinics" onPress={() => goToMenu(navigation, 'clinics', active)} />
            <FooterLink label="Dentists" onPress={() => goToMenu(navigation, 'dentists', active)} />
            <FooterLink label="Services" onPress={() => goToMenu(navigation, 'services', active)} />
          </View>
          <View style={styles.footerColumn}>
            <Text style={styles.footerHeading}>Legal</Text>
            <FooterLink label="Privacy Policy" onPress={() => openLegal('privacy')} />
            <FooterLink label="Terms of Service" onPress={() => openLegal('terms')} />
            <FooterLink label="Cookie Policy" onPress={() => openLegal('cookies')} />
          </View>
        </View>
        <Text style={[styles.footerHeading, styles.footerContactHeading]}>Contact Us</Text>
        <Text style={styles.footerLink}>{SUPPORT_EMAIL}</Text>
        <Text style={styles.footerLink}>{SUPPORT_PHONE}</Text>
      </View>
      <View style={styles.footerBottom}>
        <Text style={styles.footerCopyright}>
          © {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: guestColors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.marginMobile,
    paddingVertical: spacing.sm,
    backgroundColor: guestColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: guestColors.border,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  brand: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: guestColors.primary },
  menuButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: guestColors.border,
    backgroundColor: guestColors.surface,
  },

  footer: { backgroundColor: '#eaedf2', borderTopWidth: 1, borderTopColor: '#dfe2e8' },
  footerInner: { paddingHorizontal: spacing.marginMobile, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  footerBrand: { fontSize: 24, lineHeight: 32, fontWeight: '700', color: guestColors.text, marginBottom: spacing.sm },
  footerText: { ...type.bodyMd, color: guestColors.textMuted, marginBottom: spacing.lg },
  footerColumns: { flexDirection: 'row', gap: spacing.md },
  footerColumn: { flex: 1 },
  footerHeading: { fontSize: 16, lineHeight: 24, fontWeight: '600', color: guestColors.text, marginBottom: spacing.sm },
  footerContactHeading: { marginTop: spacing.lg },
  footerLink: { ...type.bodyMd, color: guestColors.textMuted, paddingVertical: 4 },
  footerBottom: { borderTopWidth: 1, borderTopColor: '#dfe2e8', padding: spacing.md },
  footerCopyright: { ...type.bodyMd, color: guestColors.textMuted, textAlign: 'center' },
});

export default GuestShell;
