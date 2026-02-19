import { render, screen, within } from '@testing-library/react';

import { Hero } from './Hero';

describe('Hero nav active state', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');

    class MockIntersectionObserver {
      // eslint-disable-next-line class-methods-use-this
      observe() {}

      // eslint-disable-next-line class-methods-use-this
      disconnect() {}
    }

    Object.defineProperty(window, 'IntersectionObserver', {
      writable: true,
      value: MockIntersectionObserver,
    });

    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 0,
      writable: true,
    });
  });

  it('highlights Book Appointment (top section) and not Services on initial load', () => {
    render(<Hero />);

    const topNav = screen.getAllByRole('navigation')[0];

    expect(
      within(topNav).getByRole('link', { name: 'Book Appointment' }),
    ).toHaveAttribute('aria-current', 'location');
    expect(
      within(topNav).getByRole('link', { name: 'Services' }),
    ).not.toHaveAttribute('aria-current');
  });

  it('uses deep link hash to mark Services as current on first load', () => {
    window.history.replaceState({}, '', '/#services');

    render(<Hero />);

    expect(screen.getByRole('link', { name: 'Services' })).toHaveAttribute(
      'aria-current',
      'location',
    );
  });
});
