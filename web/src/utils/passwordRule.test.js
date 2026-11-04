import { getPasswordRuleError } from './passwordStrength';

describe('getPasswordRuleError (matches the server rule)', () => {
  it('requires 8+ characters with a letter and a number', () => {
    expect(getPasswordRuleError('short1')).toMatch(/at least 8/);
    expect(getPasswordRuleError('onlyletters')).toMatch(/letter and one number/);
    expect(getPasswordRuleError('12345678')).toMatch(/letter and one number/);
    expect(getPasswordRuleError('secret-1x')).toBe('');
  });

  it('uses the given field label', () => {
    expect(getPasswordRuleError('abc', 'New password')).toMatch(/^New password/);
  });
});
