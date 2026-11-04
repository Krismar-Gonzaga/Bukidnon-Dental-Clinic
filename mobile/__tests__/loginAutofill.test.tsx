/**
 * Development-only demo account auto fill on the sign-in screen.
 */
import React from 'react';
import { TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ login: jest.fn(), loading: false }) }));

const LoginScreen = require('../src/screens/auth/LoginScreen').default;

test('tapping a demo account fills the email and password', () => {
  let tree: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<LoginScreen navigation={{ navigate: jest.fn(), canGoBack: () => false }} />);
  });

  const chip = tree!.root.findByProps({ accessibilityLabel: 'Auto fill the Clinic Admin demo account' });
  ReactTestRenderer.act(() => chip.props.onPress());

  const values = tree!.root.findAllByType(TextInput).map((input) => input.props.value);
  expect(values).toContain('demo.clinic-admin@example.test');
  expect(values).toContain('DemoPass2026');
});
