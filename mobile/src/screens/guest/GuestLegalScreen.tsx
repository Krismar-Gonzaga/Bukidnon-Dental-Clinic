// Privacy Policy, Terms of Service and Cookie Policy, opened from the footer.
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import GuestShell, { GuestFooter } from '../../components/guest/GuestShell';
import { guestColors, PageIntro } from '../../components/guest/GuestUi';
import { LEGAL_PAGES, LegalPageKey } from '../../content/guestLegal';
import { spacing, type } from '../../theme/tokens';

const GuestLegalScreen = ({ navigation, route }: { navigation: any; route: any }) => {
  const page = LEGAL_PAGES[route.params.page as LegalPageKey];

  return (
    <GuestShell navigation={navigation}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <PageIntro title={page.title} description={page.intro} />
        <View style={styles.content}>
          <Text style={styles.updated}>Last updated {page.updated}</Text>
          {page.sections.map((section) => (
            <View key={section.heading} style={styles.section}>
              <Text style={styles.heading} accessibilityRole="header">
                {section.heading}
              </Text>
              {section.body.map((paragraph) => (
                <Text key={paragraph} style={styles.paragraph}>
                  {paragraph}
                </Text>
              ))}
            </View>
          ))}
        </View>
        <GuestFooter navigation={navigation} />
      </ScrollView>
    </GuestShell>
  );
};

const styles = StyleSheet.create({
  content: { padding: spacing.marginMobile, paddingBottom: spacing.xl },
  updated: { ...type.bodyMd, color: guestColors.textMuted, marginBottom: spacing.md },
  section: { marginBottom: spacing.md },
  heading: { fontSize: 20, lineHeight: 28, fontWeight: '600', color: guestColors.text, marginBottom: spacing.sm },
  paragraph: { ...type.bodyMd, color: guestColors.text, marginBottom: spacing.sm },
});

export default GuestLegalScreen;
