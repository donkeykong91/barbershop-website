import '@testing-library/jest-dom';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
  writable: true,
  value: jest.fn(),
});

const originalConsoleError = console.error;

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const isStyledJsxAttributeWarning = args.some(
      (arg) => typeof arg === 'string' && arg.includes('non-boolean attribute'),
    );

    if (isStyledJsxAttributeWarning) {
      return;
    }

    originalConsoleError(...args);
  });
});

afterAll(() => {
  const mockedConsoleError = console.error as typeof console.error & {
    mockRestore?: () => void;
  };

  if (typeof mockedConsoleError.mockRestore === 'function') {
    mockedConsoleError.mockRestore();
  }
});
