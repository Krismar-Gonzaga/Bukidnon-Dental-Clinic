// Contact page, laid out like the website's: contact details and a message form that
// really sends (POST /contact). A message is never queued: if it fails, the sender is
// told and keeps what they typed.
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import GuestShell, { GuestFooter } from '../../components/guest/GuestShell';
import { Card, guestColors, PageIntro, PrimaryButton } from '../../components/guest/GuestUi';
import { CONTACT_METHODS } from '../../content/guestContent';
import { isNetworkError } from '../../services/api';
import { ContactMessage, sendContactMessage } from '../../services/offline/publicRepository';
import { spacing, type } from '../../theme/tokens';

type FieldKey = keyof ContactMessage;

const FIELDS: Array<{
  key: FieldKey;
  label: string;
  placeholder: string;
  maxLength: number;
  multiline?: boolean;
  email?: boolean;
}> = [
  { key: 'first_name', label: 'First Name', placeholder: 'Juan', maxLength: 100 },
  { key: 'last_name', label: 'Last Name', placeholder: 'Dela Cruz', maxLength: 100 },
  { key: 'email', label: 'Email', placeholder: 'juan@example.com', maxLength: 255, email: true },
  { key: 'subject', label: 'Subject', placeholder: 'How can we help?', maxLength: 150 },
  { key: 'message', label: 'Message', placeholder: 'Your message here...', maxLength: 5000, multiline: true },
];

const EMPTY: ContactMessage = { first_name: '', last_name: '', email: '', subject: '', message: '' };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Field errors shown before anything is sent; the server checks again. */
export const validateContact = (values: ContactMessage) => {
  const errors: Partial<Record<FieldKey, string>> = {};
  FIELDS.forEach(({ key, label }) => {
    if (!values[key].trim()) {
      errors[key] = `${label} is required.`;
    }
  });
  if (!errors.email && !EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  return errors;
};

const GuestContactScreen = ({ navigation }: { navigation: any }) => {
  const [values, setValues] = useState<ContactMessage>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const change = (key: FieldKey, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = async () => {
    const invalid = validateContact(values);
    setErrors(invalid);
    setFailure(null);
    if (Object.keys(invalid).length > 0) {
      return;
    }
    setSending(true);
    try {
      await sendContactMessage({
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
        email: values.email.trim(),
        subject: values.subject.trim(),
        message: values.message.trim(),
      });
      setValues(EMPTY);
      setSent(true);
    } catch (error: any) {
      const fieldErrors = error?.response?.status === 422 ? error.response.data?.errors : null;
      if (fieldErrors) {
        const next: Partial<Record<FieldKey, string>> = {};
        FIELDS.forEach(({ key }) => {
          if (fieldErrors[key]?.[0]) {
            next[key] = fieldErrors[key][0];
          }
        });
        setErrors(next);
      } else if (isNetworkError(error)) {
        setFailure('You appear to be offline. Your message was not sent; please try again when connected.');
      } else {
        setFailure(error?.response?.data?.message ?? 'Your message could not be sent. Please try again.');
      }
    } finally {
      setSending(false);
    }
  };

  const open = (url: string) => Linking.openURL(url).catch(() => Alert.alert('Not available', 'This could not be opened on this device.'));

  return (
    <GuestShell navigation={navigation} active="contact">
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <PageIntro title="Contact Us" description="Have questions? Our team is ready to help you." />

          <View style={styles.content}>
            {CONTACT_METHODS.map((method) => {
              const body = (
                <>
                  <View style={styles.methodIcon}>
                    <Icon name={method.icon} size={22} color={guestColors.primary} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.methodTitle}>{method.title}</Text>
                    <Text style={styles.methodText}>{method.primary}</Text>
                    <Text style={styles.methodText}>{method.secondary}</Text>
                  </View>
                </>
              );
              const { url } = method;
              return url ? (
                <TouchableOpacity key={method.id} style={styles.method} onPress={() => open(url)} accessibilityRole="link">
                  {body}
                </TouchableOpacity>
              ) : (
                <View key={method.id} style={styles.method}>
                  {body}
                </View>
              );
            })}

            {sent ? (
              <Card style={styles.sent}>
                <Icon name="checkmark-circle-outline" size={64} color={guestColors.accent} />
                <Text style={styles.sentTitle} accessibilityLiveRegion="polite">
                  Message Sent!
                </Text>
                <Text style={styles.sentText}>Thank you for reaching out. We will get back to you within 24 hours.</Text>
                <PrimaryButton label="Send Another" onPress={() => setSent(false)} style={styles.sentButton} />
              </Card>
            ) : (
              <Card>
                <Text style={styles.formTitle}>Send us a Message</Text>
                {FIELDS.map((field) => (
                  <View key={field.key} style={styles.field}>
                    <Text style={styles.label}>{field.label.toUpperCase()}</Text>
                    <TextInput
                      style={[styles.input, field.multiline && styles.textarea, errors[field.key] ? styles.inputError : null]}
                      placeholder={field.placeholder}
                      placeholderTextColor={guestColors.textMuted}
                      value={values[field.key]}
                      onChangeText={(value) => change(field.key, value)}
                      maxLength={field.maxLength}
                      multiline={field.multiline}
                      numberOfLines={field.multiline ? 4 : undefined}
                      textAlignVertical={field.multiline ? 'top' : 'center'}
                      keyboardType={field.email ? 'email-address' : 'default'}
                      autoCapitalize={field.email ? 'none' : 'sentences'}
                      autoCorrect={!field.email}
                      accessibilityLabel={field.label}
                    />
                    {errors[field.key] ? (
                      <Text style={styles.error} accessibilityRole="alert">
                        {errors[field.key]}
                      </Text>
                    ) : null}
                  </View>
                ))}
                {failure ? (
                  <Text style={[styles.error, styles.failure]} accessibilityRole="alert">
                    {failure}
                  </Text>
                ) : null}
                <PrimaryButton label={sending ? 'Sending…' : 'Send Message'} icon="paper-plane-outline" onPress={submit} busy={sending} />
              </Card>
            )}
          </View>

          <GuestFooter navigation={navigation} active="contact" />
        </ScrollView>
      </KeyboardAvoidingView>
    </GuestShell>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.marginMobile, paddingTop: spacing.xl, paddingBottom: spacing.xl, gap: spacing.md },

  method: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: guestColors.border,
    backgroundColor: guestColors.surface,
  },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: guestColors.primarySoft,
  },
  methodTitle: { fontSize: 16, lineHeight: 24, fontWeight: '600', color: guestColors.text },
  methodText: { ...type.bodyMd, color: guestColors.text },

  formTitle: { fontSize: 22, lineHeight: 28, fontWeight: '600', color: guestColors.text, marginBottom: spacing.md },
  field: { marginBottom: spacing.md },
  label: { fontSize: 12, lineHeight: 18, fontWeight: '600', letterSpacing: 0.6, color: guestColors.text, marginBottom: spacing.base },
  input: {
    ...type.bodyMd,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.base,
    color: guestColors.text,
    backgroundColor: guestColors.surface,
    borderWidth: 1,
    borderColor: guestColors.border,
    borderRadius: 8,
  },
  textarea: { minHeight: 120 },
  inputError: { borderColor: guestColors.error },
  error: { fontSize: 13, lineHeight: 18, color: guestColors.error, marginTop: spacing.xs },
  failure: { marginTop: 0, marginBottom: spacing.sm },

  sent: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  sentTitle: { fontSize: 24, lineHeight: 32, fontWeight: '700', color: guestColors.text },
  sentText: { ...type.bodyLg, color: guestColors.textMuted, textAlign: 'center' },
  sentButton: { alignSelf: 'stretch', marginTop: spacing.sm },
});

export default GuestContactScreen;
