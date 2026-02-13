import type { NextApiRequest, NextApiResponse } from 'next';

import { getBookingById, updateBookingStatus } from '../../../../../features/bookings/repository';
import { createActionToken, logBookingEvent, verifyActionToken } from '../../../../../features/bookings/v2Repository';
import { getClientIp } from '../../../../../lib/security/clientIp';
import { checkRateLimit } from '../../../../../lib/security/rateLimit';
import { run } from '../../../../../lib/db/sqlite';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const bookingId = typeof req.query.bookingId === 'string' ? req.query.bookingId : '';
  if (!bookingId) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'bookingId is required' } });
    return;
  }

  if (req.method === 'GET') {
    const tokenData = await createActionToken(bookingId, 'reschedule');
    res.status(200).json({ data: tokenData });
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET,POST');
    res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Unsupported method' } });
    return;
  }

  const ip = getClientIp(req);
  const limit = await checkRateLimit(`bookings:reschedule:ip:${ip}`, 8, 60_000);
  if (!limit.allowed) {
    res.setHeader('Retry-After', limit.retryAfterSec.toString());
    res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many reschedule attempts', retryAfterSec: limit.retryAfterSec } });
    return;
  }

  const { token, slotStart, slotEnd } = req.body ?? {};
  if (!token || !slotStart || !slotEnd) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'token and slot range are required' } });
    return;
  }

  const tokenOk = await verifyActionToken(bookingId, 'reschedule', token);
  if (!tokenOk) {
    res.status(403).json({ error: { code: 'INVALID_OR_EXPIRED_TOKEN', message: 'This reschedule link is invalid or expired. Please call the shop.' } });
    return;
  }

  const booking = await getBookingById(bookingId);
  if (!booking) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Booking not found' } });
    return;
  }

  await run('UPDATE bookings SET slot_start = ?, slot_end = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [slotStart, slotEnd, bookingId]);
  await updateBookingStatus(bookingId, 'confirmed');
  await logBookingEvent(bookingId, 'booking_rescheduled', { from: booking.slotStart, to: slotStart });

  res.status(200).json({ data: { id: bookingId, status: 'confirmed', slotStart, slotEnd } });
};

export default handler;
