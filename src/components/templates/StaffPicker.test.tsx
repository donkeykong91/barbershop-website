import { render, screen } from '@testing-library/react';

import { StaffPicker } from './StaffPicker';

describe('StaffPicker UX filtering', () => {
  it('shows only active staff options and Any barber', () => {
    render(
      <StaffPicker
        staff={[
          { id: 's1', displayName: 'Active Barber', active: true },
          { id: 's2', displayName: 'Inactive Barber', active: false },
        ]}
      />,
    );

    const options = screen.getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'Any barber',
      'Active Barber',
    ]);
  });

  it('shows helper copy when no specific active barber is available', () => {
    render(
      <StaffPicker
        staff={[{ id: 's2', displayName: 'Inactive Barber', active: false }]}
      />,
    );

    expect(
      screen.getByText(/no specific barbers are currently available online/i),
    ).toBeInTheDocument();
  });
});
