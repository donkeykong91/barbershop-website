import type { NextApiRequest, NextApiResponse } from 'next';

import { listAvailability } from '../../../../features/availability/repository';
import {
  createBooking,
  logBookingLegalConsent,
} from '../../../../features/bookings/repository';
import {
  getValidHold,
  logBookingEvent,
  releaseHold,
} from '../../../../features/bookings/v2Repository';
import { getServiceById } from '../../../../features/services/repository';
import { getClientFingerprint } from '../../../../lib/security/clientFingerprint';
import { getClientIp } from '../../../../lib/security/clientIp';
import { checkRateLimit } from '../../../../lib/security/rateLimit';

type CreateBookingBody = {
  serviceId?: string;
  staffId?: string;
  slotStart?: string;
  slotEnd?: string;
  customer?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  notes?: string;
  consent?: {
    agreeToTerms?: boolean;
    agreeToPrivacy?: boolean;
    agreeToBookingPolicies?: boolean;
    marketingOptIn?: boolean;
    smsOptIn?: boolean;
    legalVersion?: string;
  };
  holdId?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9()\-\s]{7,20}$/;
const MAX_NOTES_LENGTH = 500;
const MAX_NAME_LENGTH = 80;
const HORIZON_DAYS = 30;

const parseIsoDate = (value: string): Date | null => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getRateLimitConfig = (
  key: 'BOOKING_CREATE_MAX' | 'BOOKING_CREATE_WINDOW_MS',
  fallback: number,
) => {
  const configured = Number.parseInt(process.env[key] ?? '', 10);
  if (Number.isNaN(configured) || configured < 1) {
    return fallback;
  }

  return configured;
};

const isNonEmptyString = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0;

const toInstantMs = (value: string): number | null => {
  const instantMs = new Date(value).getTime();
  return Number.isNaN(instantMs) ? null : instantMs;
};

const isSameInstant = (left: string, right: string): boolean => {
  const leftMs = toInstantMs(left);
  const rightMs = toInstantMs(right);
  return leftMs !== null && rightMs !== null && leftMs === rightMs;
};

const buildSlotAlternatives = async ({
  serviceDurationMin,
  slotStartIso,
  slotEndIso,
  staffId,
}: {
  serviceDurationMin: number;
  slotStartIso: string;
  slotEndIso: string;
  staffId: string;
}) => {
  const requestedStart = new Date(slotStartIso).getTime();
  const requestedDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(slotStartIso));

  const searchFrom = new Date(slotStartIso);
  const searchTo = new Date(searchFrom.getTime() + 48 * 60 * 60 * 1000);

  const alternatives = await listAvailability({
    serviceDurationMin,
    fromIso: searchFrom.toISOString(),
    toIso: searchTo.toISOString(),
    staffId,
  });

  return alternatives
    .filter(
      (slot) =>
        !(slot.slotStart === slotStartIso && slot.slotEnd === slotEndIso),
    )
    .map((slot) => {
      const dayKey = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Los_Angeles',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(slot.slotStart));
      return {
        ...slot,
        distance: Math.abs(new Date(slot.slotStart).getTime() - requestedStart),
        sameDay: dayKey === requestedDate,
      };
    })
    .sort((a, b) => {
      if (a.sameDay !== b.sameDay) {
        return a.sameDay ? -1 : 1;
      }
      return a.distance - b.distance;
    })
    .slice(0, 5)
    .map(({ slotStart, slotEnd, staffId: altStaffId }) => ({
      slotStart,
      slotEnd,
      staffId: altStaffId,
    }));
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST is supported on this endpoint',
      },
    });
    return;
  }

  const maxRequests = getRateLimitConfig('BOOKING_CREATE_MAX', 8);
  const windowMs = getRateLimitConfig('BOOKING_CREATE_WINDOW_MS', 60_000);
  const clientIp = getClientIp(req);
  const clientFingerprint = getClientFingerprint(req);

  const [ipLimit, fingerprintLimit] = await Promise.all([
    checkRateLimit(`bookings:create:ip:${clientIp}`, maxRequests, windowMs),
    checkRateLimit(
      `bookings:create:fingerprint:${clientFingerprint}`,
      maxRequests,
      windowMs,
    ),
  ]);

  const effectiveLimit = ipLimit.allowed ? fingerprintLimit : ipLimit;
  res.setHeader(
    'X-RateLimit-Remaining',
    Math.min(ipLimit.remaining, fingerprintLimit.remaining).toString(),
  );

  if (!ipLimit.allowed || !fingerprintLimit.allowed) {
    res.setHeader('Retry-After', effectiveLimit.retryAfterSec.toString());
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many booking attempts. Please try again shortly.',
        retryAfterSec: effectiveLimit.retryAfterSec,
      },
    });
    console.warn('[security] booking_submit_rate_limited', {
      ip: clientIp,
      fingerprintPrefix: clientFingerprint.slice(0, 8),
      route: '/api/v1/bookings',
    });
    return;
  }

  const body = (req.body ?? {}) as CreateBookingBody;

  if (
    !isNonEmptyString(body.serviceId) ||
    !isNonEmptyString(body.staffId) ||
    !isNonEmptyString(body.slotStart) ||
    !isNonEmptyString(body.slotEnd) ||
    !isNonEmptyString(body.customer?.firstName) ||
    !isNonEmptyString(body.customer?.lastName) ||
    !isNonEmptyString(body.customer?.email) ||
    !isNonEmptyString(body.customer?.phone)
  ) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Missing required booking fields',
      },
    });
    return;
  }

  const {
    serviceId: rawServiceId,
    staffId: rawStaffId,
    slotStart: rawSlotStart,
    slotEnd: rawSlotEnd,
    customer,
  } = body;

  const serviceId = rawServiceId as string;
  const staffId = rawStaffId as string;
  const slotStartIso = rawSlotStart as string;
  const slotEndIso = rawSlotEnd as string;

  if (!customer) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Missing required booking fields',
      },
    });
    return;
  }

  const firstName = (customer.firstName as string).trim();
  const lastName = (customer.lastName as string).trim();
  const email = (customer.email as string).trim();
  const phone = (customer.phone as string).trim();
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  const { consent } = body;

  if (
    !consent?.agreeToTerms ||
    !consent?.agreeToPrivacy ||
    !consent?.agreeToBookingPolicies
  ) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Missing required legal consent',
      },
    });
    return;
  }

  if (
    firstName.length > MAX_NAME_LENGTH ||
    lastName.length > MAX_NAME_LENGTH ||
    notes.length > MAX_NOTES_LENGTH ||
    !EMAIL_REGEX.test(email) ||
    !PHONE_REGEX.test(phone)
  ) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid customer or notes format',
      },
    });
    return;
  }

  const slotStart = parseIsoDate(slotStartIso);
  const slotEnd = parseIsoDate(slotEndIso);

  if (!slotStart || !slotEnd || slotStart >= slotEnd) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid slot window',
      },
    });
    return;
  }

  const now = new Date();
  const latestAllowed = new Date(
    now.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000,
  );
  if (slotStart < now || slotStart > latestAllowed) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Slot must be in the future and within booking horizon',
      },
    });
    return;
  }

  try {
    const service = await getServiceById(serviceId);
    if (!service || !service.active || !service.bookable || !service.visible) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Service is not currently bookable',
        },
      });
      return;
    }

    const expectedDurationMs = service.durationMin * 60_000;
    if (slotEnd.getTime() - slotStart.getTime() !== expectedDurationMs) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Slot duration does not match service duration',
        },
      });
      return;
    }

    const availableSlots = await listAvailability({
      serviceDurationMin: service.durationMin,
      fromIso: slotStart.toISOString(),
      toIso: slotEnd.toISOString(),
      staffId,
    });

    const requestedSlotIsAvailable = availableSlots.some(
      (slot) =>
        slot.staffId === staffId &&
        slot.slotStart === slotStart.toISOString() &&
        slot.slotEnd === slotEnd.toISOString(),
    );

    if (!requestedSlotIsAvailable) {
      const alternatives = await buildSlotAlternatives({
        serviceDurationMin: service.durationMin,
        slotStartIso: slotStart.toISOString(),
        slotEndIso: slotEnd.toISOString(),
        staffId,
      });

      res.status(409).json({
        error: {
          code: 'SLOT_TAKEN',
          message: 'Selected slot is no longer available',
          alternatives,
        },
      });
      return;
    }

    if (!isNonEmptyString(body.holdId)) {
      res.status(409).json({
        error: {
          code: 'HOLD_REQUIRED',
          message:
            'A valid review hold is required. Please reselect your slot.',
        },
      });
      return;
    }

    const validHold = await getValidHold(
      body.holdId as string,
      clientFingerprint,
    );
    if (!validHold) {
      res.status(409).json({
        error: {
          code: 'HOLD_EXPIRED',
          message: 'Your hold expired. Please pick a time slot again.',
        },
      });
      return;
    }

    if (
      !isSameInstant(validHold.slotStart, slotStart.toISOString()) ||
      !isSameInstant(validHold.slotEnd, slotEnd.toISOString()) ||
      validHold.staffId !== staffId ||
      validHold.serviceId !== serviceId
    ) {
      res.status(409).json({
        error: {
          code: 'HOLD_MISMATCH',
          message: 'Your hold does not match this booking request.',
        },
      });
      return;
    }

    const booking = await createBooking({
      serviceId,
      staffId,
      slotStart: slotStart.toISOString(),
      slotEnd: slotEnd.toISOString(),
      customer: {
        firstName,
        lastName,
        email,
        phone,
      },
      notes,
    });

    try {
      await logBookingLegalConsent({
        bookingId: booking.id,
        legalVersion: consent.legalVersion?.trim() || '2026-02-12',
        agreedToTerms: Boolean(consent.agreeToTerms),
        agreedToPrivacy: Boolean(consent.agreeToPrivacy),
        agreedToBookingPolicies: Boolean(consent.agreeToBookingPolicies),
        marketingOptIn: Boolean(consent.marketingOptIn),
        smsOptIn: Boolean(consent.smsOptIn),
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent']?.toString() ?? null,
      });
    } catch (consentError) {
      console.error('[booking] legal consent persistence failed', {
        bookingId: booking.id,
        error:
          consentError instanceof Error
            ? consentError.message
            : String(consentError),
      });
    }

    try {
      await releaseHold(body.holdId as string);
    } catch (releaseError) {
      console.warn('[booking] hold release failed after confirmation', {
        holdId: body.holdId,
        bookingId: booking.id,
        error:
          releaseError instanceof Error
            ? releaseError.message
            : String(releaseError),
      });
    }

    try {
      await logBookingEvent(booking.id, 'booking_confirmed', {
        source: 'api_v1_bookings_create',
      });
    } catch (eventError) {
      console.warn('[booking] lifecycle event log failed after confirmation', {
        bookingId: booking.id,
        error:
          eventError instanceof Error ? eventError.message : String(eventError),
      });
    }

    res.status(201).json({
      data: {
        id: booking.id,
        status: booking.status,
        totalCents: booking.totalCents,
        currency: booking.currency,
        accessToken: booking.accessToken,
      },
    });
  } catch (error) {
    console.error('[booking] create booking failed', {
      route: '/api/v1/bookings',
      errorMessage: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });

    if (error instanceof Error && error.message === 'SLOT_UNAVAILABLE') {
      res.status(409).json({
        error: {
          code: 'SLOT_TAKEN',
          message: 'Selected slot is no longer available',
          alternatives: [],
        },
      });
      return;
    }

    if (error instanceof Error && error.message === 'SERVICE_NOT_BOOKABLE') {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Service is not currently bookable',
        },
      });
      return;
    }

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unable to create booking at this time',
      },
    });
  }
};

export default handler;
