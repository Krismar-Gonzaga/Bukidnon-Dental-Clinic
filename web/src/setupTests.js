// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

// API-backed pages resolve over a few renders; allow for a busy test runner.
configure({ asyncUtilTimeout: 5000 });

// Multi-step flows (booking, rescheduling) render many screens in one test.
jest.setTimeout(20000);
