import { render, screen } from '@testing-library/react';

import { ServiceCatalog } from './ServiceCatalog';

const services = [
  {
    id: 'svc-1',
    name: 'Haircut',
    description: 'Classic cut',
    durationMin: 30,
    priceCents: 3000,
    currency: 'USD',
    active: true,
    visible: true,
    bookable: true,
    displayOrder: 1,
  },
  {
    id: 'svc-2',
    name: 'Beard Trim',
    description: 'Clean beard line-up',
    durationMin: 20,
    priceCents: 2000,
    currency: 'USD',
    active: false,
    visible: true,
    bookable: false,
    displayOrder: 2,
  },
];

describe('ServiceCatalog UX copy', () => {
  it('replaces internal status pills with customer-friendly availability badges and unavailable copy', () => {
    render(<ServiceCatalog services={services} />);

    expect(screen.queryByText('Active')).not.toBeInTheDocument();
    expect(screen.queryByText('Inactive')).not.toBeInTheDocument();
    expect(screen.getByText('Available online')).toBeInTheDocument();
    expect(screen.getByText('Call to book')).toBeInTheDocument();
    expect(
      screen.getByText('Not available for online booking right now.'),
    ).toBeInTheDocument();
  });
});
