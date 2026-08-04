import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';

type RegisterFormData = {
  name: string;
  email: string;
  phone: string;
  address: string;
  password: string;
  password_confirmation: string;
  role: 'patient' | 'clinic_admin';
};

type RegisterErrors = Partial<Record<keyof RegisterFormData | 'terms', string>>;

type RegisterScreenProps = {
  navigation: { navigate: (screen: string) => void };
};

const RegisterScreen = ({ navigation }: RegisterScreenProps) => {
  const { width } = useWindowDimensions();
  const isCompact = width < 360;

  const [formData, setFormData] = useState<RegisterFormData>({
    name: '',
    email: '',
    phone: '',
    address: '',
    password: '',
    password_confirmation: '',
    role: 'patient',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const { register } = useAuth();

  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const validateForm = () => {
    const newErrors: RegisterErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Full name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!formData.email.includes('@') || !formData.email.includes('.')) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (formData.phone.length < 10) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    if (!formData.address.trim()) {
      newErrors.address = 'Address is required';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (formData.password !== formData.password_confirmation) {
      newErrors.password_confirmation = 'Passwords do not match';
    }

    if (!agreeToTerms) {
      newErrors.terms = 'You must agree to the Terms of Service';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    const result = await register(formData);
    setLoading(false);

    if (!result.success) {
      const err = result.error;
      if (err && typeof err === 'object') {
        const errorMessages = Object.values(err).flat();
        Alert.alert('Registration Failed', String(errorMessages[0] ?? 'Please check your information'));
      } else {
        Alert.alert('Registration Failed', (err as string) || 'An error occurred. Please try again.');
      }
    } else {
      Alert.alert(
        'Registration Successful',
        'Your account has been created! Welcome to BukidnonDental.',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Background Decorative Elements */}
        <View style={styles.backgroundElements} pointerEvents="none">
          <View style={[styles.blurCircle, styles.blurCircle1]} />
          <View style={[styles.blurCircle, styles.blurCircle2]} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Header with Logo */}
          <View style={styles.headerContainer}>
            <View style={styles.logoContainer}>
              <Icon name="medkit-outline" size={40} color="#ffffff" />
            </View>
            <Text style={styles.title}>BukidnonDental</Text>
            <Text style={[styles.subtitle, isCompact && styles.subtitleCompact]}>Create Account</Text>
            <Text style={styles.description}>
              Join BukidnonDental to start booking your dental visits.
            </Text>
          </View>

          {/* Registration Card */}
          <View style={styles.cardContainer}>
            {/* Role Selection */}
            <View style={styles.roleSection}>
              <Text style={styles.roleLabel}>Registration Type</Text>
              <View style={styles.roleContainer}>
                <TouchableOpacity
                  style={[
                    styles.roleOption,
                    formData.role === 'patient' && styles.roleOptionActive,
                  ]}
                  onPress={() => setFormData({ ...formData, role: 'patient' })}
                  activeOpacity={0.7}
                >
                  <Icon
                    name="person-outline"
                    size={24}
                    color={formData.role === 'patient' ? '#003f87' : '#727784'}
                  />
                  <Text
                    style={[
                      styles.roleText,
                      formData.role === 'patient' && styles.roleTextActive,
                    ]}
                  >
                    Patient
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.roleOption,
                    formData.role === 'clinic_admin' && styles.roleOptionActive,
                  ]}
                  onPress={() => setFormData({ ...formData, role: 'clinic_admin' })}
                  activeOpacity={0.7}
                >
                  <Icon
                    name="business-outline"
                    size={24}
                    color={formData.role === 'clinic_admin' ? '#003f87' : '#727784'}
                  />
                  <Text
                    style={[
                      styles.roleText,
                      formData.role === 'clinic_admin' && styles.roleTextActive,
                    ]}
                  >
                    Clinic Admin
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.roleNote}>
                <Icon name="information-circle-outline" size={14} color="#727784" />
                <Text style={styles.roleNoteText}>
                  Clinic Admins will need to provide additional professional documentation.
                </Text>
              </View>
            </View>

            {/* Full Name */}
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <View style={[styles.inputContainer, errors.name && styles.inputError]}>
                <Icon name="person-outline" size={20} color="#727784" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Juan dela Cruz"
                  placeholderTextColor="#a0aec0"
                  value={formData.name}
                  onChangeText={(text) => {
                    setFormData({ ...formData, name: text });
                    if (errors.name) setErrors({ ...errors, name: undefined });
                  }}
                  autoCapitalize="words"
                  autoComplete="name"
                  textContentType="name"
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                  submitBehavior="submit"
                />
              </View>
              {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
            </View>

            {/* Email */}
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={[styles.inputContainer, errors.email && styles.inputError]}>
                <Icon name="mail-outline" size={20} color="#727784" style={styles.inputIcon} />
                <TextInput
                  ref={emailRef}
                  style={styles.input}
                  placeholder="juan@example.com"
                  placeholderTextColor="#a0aec0"
                  value={formData.email}
                  onChangeText={(text) => {
                    setFormData({ ...formData, email: text });
                    if (errors.email) setErrors({ ...errors, email: undefined });
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  onSubmitEditing={() => phoneRef.current?.focus()}
                  submitBehavior="submit"
                />
              </View>
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            {/* Phone Number */}
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Mobile Number</Text>
              <View style={[styles.inputContainer, errors.phone && styles.inputError]}>
                <Icon name="call-outline" size={20} color="#727784" style={styles.inputIcon} />
                <TextInput
                  ref={phoneRef}
                  style={styles.input}
                  placeholder="0912 345 6789"
                  placeholderTextColor="#a0aec0"
                  value={formData.phone}
                  onChangeText={(text) => {
                    setFormData({ ...formData, phone: text });
                    if (errors.phone) setErrors({ ...errors, phone: undefined });
                  }}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  returnKeyType="next"
                  onSubmitEditing={() => addressRef.current?.focus()}
                  submitBehavior="submit"
                />
              </View>
              {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
            </View>

            {/* Address */}
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Address</Text>
              <View style={[styles.inputContainer, errors.address && styles.inputError]}>
                <Icon name="location-outline" size={20} color="#727784" style={styles.inputIcon} />
                <TextInput
                  ref={addressRef}
                  style={styles.input}
                  placeholder="City, Municipality, Province"
                  placeholderTextColor="#a0aec0"
                  value={formData.address}
                  onChangeText={(text) => {
                    setFormData({ ...formData, address: text });
                    if (errors.address) setErrors({ ...errors, address: undefined });
                  }}
                  autoComplete="street-address"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  submitBehavior="submit"
                />
              </View>
              {errors.address && <Text style={styles.errorText}>{errors.address}</Text>}
            </View>

            {/* Password */}
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={[styles.inputContainer, errors.password && styles.inputError]}>
                <Icon name="lock-closed-outline" size={20} color="#727784" style={styles.inputIcon} />
                <TextInput
                  ref={passwordRef}
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#a0aec0"
                  value={formData.password}
                  onChangeText={(text) => {
                    setFormData({ ...formData, password: text });
                    if (errors.password) setErrors({ ...errors, password: undefined });
                  }}
                  secureTextEntry={!showPassword}
                  autoComplete="password-new"
                  textContentType="newPassword"
                  returnKeyType="next"
                  onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                  submitBehavior="submit"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#727784" />
                </TouchableOpacity>
              </View>
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            </View>

            {/* Confirm Password */}
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Confirm Password</Text>
              <View style={[styles.inputContainer, errors.password_confirmation && styles.inputError]}>
                <Icon name="lock-closed-outline" size={20} color="#727784" style={styles.inputIcon} />
                <TextInput
                  ref={confirmPasswordRef}
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#a0aec0"
                  value={formData.password_confirmation}
                  onChangeText={(text) => {
                    setFormData({ ...formData, password_confirmation: text });
                    if (errors.password_confirmation) setErrors({ ...errors, password_confirmation: undefined });
                  }}
                  secureTextEntry={!showConfirmPassword}
                  autoComplete="password-new"
                  textContentType="newPassword"
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeIcon}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#727784" />
                </TouchableOpacity>
              </View>
              {errors.password_confirmation && (
                <Text style={styles.errorText}>{errors.password_confirmation}</Text>
              )}
            </View>

            {/* Terms Checkbox */}
            <View style={styles.termsContainer}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setAgreeToTerms(!agreeToTerms)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.checkbox,
                    agreeToTerms && styles.checkboxChecked,
                    errors.terms && styles.checkboxError,
                  ]}
                >
                  {agreeToTerms && <Icon name="checkmark" size={16} color="#ffffff" />}
                </View>
                <Text style={styles.termsText}>
                  I agree to the <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
                  <Text style={styles.termsLink}>Privacy Policy</Text>.
                </Text>
              </TouchableOpacity>
              {errors.terms && <Text style={styles.errorText}>{errors.terms}</Text>}
            </View>

            {/* Register Button */}
            <TouchableOpacity
              style={[styles.registerButton, loading && styles.registerButtonDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Text style={styles.registerButtonText}>Create Account</Text>
                  <Icon name="arrow-forward-outline" size={22} color="#ffffff" />
                </>
              )}
            </TouchableOpacity>

            {/* Footer Links */}
            <View style={styles.footerContainer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')} hitSlop={{ top: 8, bottom: 8 }}>
                <Text style={styles.footerLink}>Login</Text>
              </TouchableOpacity>
            </View>

            {/* Security Badges */}
            <View style={styles.securityContainer}>
              <View style={styles.dividerContainer}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>Secure & Private</Text>
                <View style={styles.divider} />
              </View>
              <View style={styles.badgesContainer}>
                <View style={styles.badge}>
                  <Icon name="shield-checkmark-outline" size={20} color="#003f87" />
                  <Text style={styles.badgeText}>HIPAA Ready</Text>
                </View>
                <View style={styles.badge}>
                  <Icon name="lock-closed-outline" size={20} color="#003f87" />
                  <Text style={styles.badgeText}>SSL Secure</Text>
                </View>
                <View style={styles.badge}>
                  <Icon name="medical-outline" size={20} color="#003f87" />
                  <Text style={styles.badgeText}>Certified Care</Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f9ff',
  },
  flex: {
    flex: 1,
  },
  backgroundElements: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  blurCircle: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.4,
  },
  blurCircle1: {
    width: 220,
    height: 220,
    top: -60,
    right: -60,
    backgroundColor: '#003f87',
    opacity: 0.05,
  },
  blurCircle2: {
    width: 180,
    height: 180,
    bottom: -50,
    left: -50,
    backgroundColor: '#006c4f',
    opacity: 0.05,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 24,
    zIndex: 1,
  },
  // Header
  headerContainer: {
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#003f87',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#003f87',
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 26,
    fontWeight: '600',
    color: '#181c20',
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
    textAlign: 'center',
  },
  subtitleCompact: {
    fontSize: 22,
  },
  description: {
    fontSize: 14,
    color: '#424752',
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
    marginTop: 4,
    textAlign: 'center',
  },
  // Card
  cardContainer: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#c2c6d4',
  },
  // Role Selection
  roleSection: {
    marginBottom: 16,
  },
  roleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#424752',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 4,
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
  roleContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  roleOption: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#c2c6d4',
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  roleOptionActive: {
    borderColor: '#003f87',
    backgroundColor: '#d7e2ff',
    borderWidth: 2,
  },
  roleText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#424752',
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
  roleTextActive: {
    color: '#003f87',
  },
  roleNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginTop: 8,
    opacity: 0.8,
  },
  roleNoteText: {
    flex: 1,
    fontSize: 11,
    color: '#424752',
    lineHeight: 16,
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
  // Form Inputs
  inputWrapper: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#424752',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    paddingHorizontal: 4,
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#c2c6d4',
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    minHeight: 48,
  },
  inputError: {
    borderColor: '#ba1a1a',
    borderWidth: 2,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#181c20',
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
  errorText: {
    fontSize: 12,
    color: '#ba1a1a',
    marginTop: 4,
    paddingHorizontal: 4,
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
  eyeIcon: {
    padding: 4,
  },
  // Terms
  termsContainer: {
    marginTop: 4,
    marginBottom: 16,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#c2c6d4',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#003f87',
    borderColor: '#003f87',
  },
  checkboxError: {
    borderColor: '#ba1a1a',
    borderWidth: 2,
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: '#424752',
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
  termsLink: {
    color: '#003f87',
    fontWeight: '600',
  },
  // Register Button
  registerButton: {
    backgroundColor: '#003f87',
    minHeight: 52,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    marginTop: 4,
  },
  registerButtonDisabled: {
    opacity: 0.7,
  },
  registerButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
  // Footer
  footerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  footerText: {
    fontSize: 14,
    color: '#424752',
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#003f87',
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
  // Security Badges
  securityContainer: {
    marginTop: 4,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#c2c6d4',
  },
  dividerText: {
    paddingHorizontal: 16,
    color: '#727784',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 20,
    opacity: 0.6,
  },
  badge: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#003f87',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
});

export default RegisterScreen;
