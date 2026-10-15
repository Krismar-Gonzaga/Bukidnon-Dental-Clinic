import { PASSWORD_MIN_LENGTH } from '../config/profile';

// PROVISIONAL strength rules: one point per rule met; the hint names the
// first unmet rule, in this order. Figma shows only the Medium state
// ("add a symbol"), so the other levels and hints are estimates.
const STRENGTH_RULES = [
  {
    test: (password) => password.length >= PASSWORD_MIN_LENGTH,
    hint: `use at least ${PASSWORD_MIN_LENGTH} characters`,
  },
  { test: (password) => /[^A-Za-z0-9]/.test(password), hint: 'add a symbol' },
  { test: (password) => /\d/.test(password), hint: 'add a number' },
  {
    test: (password) => /[a-z]/.test(password) && /[A-Z]/.test(password),
    hint: 'mix uppercase and lowercase letters',
  },
];

export const PASSWORD_STRENGTH_SEGMENTS = STRENGTH_RULES.length;

// level: tone used by the meter (weak | medium | strong)
const LEVELS = [
  { label: 'Weak', level: 'weak' },
  { label: 'Weak', level: 'weak' },
  { label: 'Medium', level: 'medium' },
  { label: 'Good', level: 'strong' },
  { label: 'Strong', level: 'strong' },
];

// Returns the score (0-4), label, tone, and a hint for the first unmet rule.
export function getPasswordStrength(password) {
  const unmet = STRENGTH_RULES.filter(({ test }) => !test(password));
  const score = STRENGTH_RULES.length - unmet.length;
  const { label, level } = LEVELS[score];
  const hint = unmet[0] ? `${unmet[0].hint} to strengthen` : '';
  return { score, label, level, hint };
}

// The rule the server enforces (at least PASSWORD_MIN_LENGTH characters with
// at least one letter and one number). Returns a message, or '' when it passes.
export function getPasswordRuleError(password, label = 'Password') {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `${label} must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return `${label} must include at least one letter and one number.`;
  }
  return '';
}
