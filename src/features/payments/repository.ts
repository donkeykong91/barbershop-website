import crypto from 'crypto';

import { run } from '../../lib/db/sqlite';
import { getBookingById } from '../bookings/repository';

type PaymentMode = 'deposit' | 'full';

type CreateCheckoutSessionInput = {
  bookingId: string;
  mode: PaymentMode;
  amountCents: number;
  returnUrl: string;
  cancelUrl: string;
};

type CheckoutSession = {
  provider: 'stripe';
  checkoutUrl: string;
  paymentIntentId: string;
};

const createCheckoutSession = async (
  input: CreateCheckoutSessionInput,
): Promise<CheckoutSession> => {
  const booking = await getBookingById(input.bookingId);

  if (!booking) {
    throw new Error('BOOKING_NOT_FOUND');
  }

  if (booking.status !== 'pending_payment') {
    throw new Error('BOOKING_NOT_PAYABLE');
  }

  if (input.amountCents <= 0 || input.amountCents > booking.totalCents) {
    throw new Error('INVALID_PAYMENT_AMOUNT');
  }

  const paymentId = crypto.randomUUID();
  const providerPaymentId = `pi_mock_${paymentId.replace(/-/g, '').slice(0, 16)}`;
  const providerCheckoutId = `cs_mock_${paymentId.replace(/-/g, '').slice(0, 16)}`;

  await run(
    `
    INSERT INTO payments (
      id,
      booking_id,
      provider,
      provider_payment_id,
      provider_checkout_id,
      mode,
      amount_cents,
      currency,
      status
    ) VALUES (?, ?, 'stripe', ?, ?, ?, ?, ?, 'pending')
    `,
    [
      paymentId,
      input.bookingId,
      providerPaymentId,
      providerCheckoutId,
      input.mode,
      input.amountCents,
      booking.currency,
    ],
  );

  const checkoutUrl = `${input.returnUrl}?bookingId=${encodeURIComponent(input.bookingId)}&session=${providerCheckoutId}&mock=1`;

  return {
    provider: 'stripe',
    checkoutUrl,
    paymentIntentId: providerPaymentId,
  };
};

export { createCheckoutSession };
export type { CreateCheckoutSessionInput, PaymentMode };
