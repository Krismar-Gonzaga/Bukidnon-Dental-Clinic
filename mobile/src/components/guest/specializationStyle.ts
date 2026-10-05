import { palette } from '../../theme/tokens';

const ACCENTS = [palette.primary, palette.secondary, palette.tertiaryContainer, palette.error];

/** Icon and accent colour for a specialization tile, matched by name. */
export const specializationStyle = (name: string, index: number) => {
  const lower = name.toLowerCase();
  let icon = 'medical-outline';
  if (lower.includes('general')) {
    icon = 'medkit-outline';
  } else if (lower.includes('ortho')) {
    icon = 'sparkles-outline';
  } else if (lower.includes('surg')) {
    icon = 'cut-outline';
  } else if (lower.includes('pediatric') || lower.includes('child') || lower.includes('kid')) {
    icon = 'happy-outline';
  }
  return { icon, color: ACCENTS[index % ACCENTS.length] };
};
