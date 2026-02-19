export type Service = {
  id: string;
  name: string;
  description: string;
  durationMin: number;
  priceCents: number;
  currency: 'USD';
  active: boolean;
  visible: boolean;
  bookable: boolean;
  displayOrder: number;
};
