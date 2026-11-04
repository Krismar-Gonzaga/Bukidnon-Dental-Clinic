import { DEMO_ACCOUNTS } from './demoAccounts';

test('demo logins are not offered outside development builds', () => {
  // Jest runs with NODE_ENV=test (like a non-development build).
  expect(process.env.NODE_ENV).not.toBe('development');
  expect(DEMO_ACCOUNTS).toEqual([]);
});
