import '@testing-library/jest-dom';

// Allow router mocks.
// eslint-disable-next-line no-undef
jest.mock('next/router', () => require('next-router-mock'));

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '0px';
  readonly thresholds = [];

  disconnect() {}

  observe() {}

  takeRecords() {
    return [];
  }

  unobserve() {}
}

Object.defineProperty(globalThis, 'IntersectionObserver', {
  configurable: true,
  writable: true,
  value: MockIntersectionObserver,
});
