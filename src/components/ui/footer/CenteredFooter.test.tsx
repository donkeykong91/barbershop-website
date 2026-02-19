import { render, screen } from '@testing-library/react';

import { CenteredFooter } from './CenteredFooter';

describe('CenteredFooter', () => {
  it('uses wrapping footer links container instead of non-wrapping navbar class', () => {
    render(
      <CenteredFooter logo={<div>Logo</div>} iconList={<></>}>
        <li>
          <a href="#book">Book Appointment</a>
        </li>
        <li>
          <a href="#services">Services</a>
        </li>
        <li>
          <a href="#accessibility">Accessibility</a>
        </li>
        <li>
          <a href="mailto:test@example.com">Email support</a>
        </li>
      </CenteredFooter>,
    );

    const links = screen.getByRole('link', { name: 'Book Appointment' });
    const list = links.closest('ul');

    expect(list).not.toBeNull();
    expect(list).toHaveClass('footer-links');
    expect(list).toHaveClass('flex-wrap');
    expect(list).toHaveClass('min-w-0');
    expect(list).toHaveClass('max-w-full');
    expect(list).toHaveClass('overflow-x-hidden');
    expect(list).toHaveClass('overflow-x-clip');
    expect(list).toHaveClass('list-none');
    expect(list).not.toHaveClass('navbar');
  });
});
