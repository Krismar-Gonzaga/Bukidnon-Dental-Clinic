// Design tokens from the BukidnonDental web design system (Material 3 palette),
// shared by the guest screens so they match the approved mockups.
import { Platform, TextStyle } from 'react-native';

export const palette = {
  background: '#f7f9ff',
  surface: '#f7f9ff',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f1f4f9',
  surfaceContainer: '#ebeef3',
  surfaceContainerHigh: '#e5e8ee',
  surfaceContainerHighest: '#e0e3e8',
  onSurface: '#181c20',
  onSurfaceVariant: '#424752',
  outline: '#727784',
  outlineVariant: '#c2c6d4',

  primary: '#003f87',
  onPrimary: '#ffffff',
  primaryContainer: '#0056b3',
  primaryFixed: '#d7e2ff',
  primaryFixedDim: '#acc7ff',
  onPrimaryFixedVariant: '#004491',

  secondary: '#006c4f',
  secondaryContainer: '#67fcc6',
  onSecondaryContainer: '#007354',

  tertiaryContainer: '#515a62',
  tertiaryFixed: '#dbe4ed',
  onTertiaryFixed: '#141d23',
  onTertiaryFixedVariant: '#3f484f',

  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',

  inverseSurface: '#2d3135',
  inverseOnSurface: '#eef1f6',
  scrim: 'rgba(24,28,32,0.4)',
};

export const spacing = {
  xs: 4,
  base: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  marginMobile: 16,
};

export const radius = {
  sm: 4,
  lg: 8,
  xl: 12,
  xxl: 16,
  full: 9999,
};

const fontFamily = Platform.OS === 'ios' ? 'System' : 'sans-serif';
const fontFamilyMedium = Platform.OS === 'ios' ? 'System' : 'sans-serif-medium';

export const type: Record<
  'headlineLgMobile' | 'headlineMd' | 'titleLg' | 'bodyLg' | 'bodyMd' | 'labelMd',
  TextStyle
> = {
  headlineLgMobile: { fontFamily, fontSize: 28, lineHeight: 36, fontWeight: '600' },
  headlineMd: { fontFamily, fontSize: 24, lineHeight: 32, fontWeight: '600' },
  titleLg: { fontFamily: fontFamilyMedium, fontSize: 20, lineHeight: 28, fontWeight: '500' },
  bodyLg: { fontFamily, fontSize: 16, lineHeight: 25, fontWeight: '400' },
  bodyMd: { fontFamily, fontSize: 14, lineHeight: 22, fontWeight: '400' },
  labelMd: { fontFamily: fontFamilyMedium, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, fontWeight: '600' },
};

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#003f87',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
};
