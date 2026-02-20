/* eslint-disable no-nested-ternary */
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Section } from '@/components/ui/layout/Section';
import type { Service } from '@/features/services/types';
import type { StaffMember } from '@/features/staff/types';
import { AppConfig } from '@/utils/AppConfig';

type SchedulerProps = {
  services: Service[];
  staff: StaffMember[];
};

type AvailabilitySlot = {
  slotStart: string;
  slotEnd: string;
  staffId: string;
};

type SlotConflictError = {
  code?: string;
  message?: string;
  alternatives?: AvailabilitySlot[];
};

type ContactForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  notes: string;
};

type LegalConsent = {
  agreeToTerms: boolean;
  agreeToPrivacy: boolean;
  agreeToBookingPolicies: boolean;
  marketingOptIn: boolean;
  smsOptIn: boolean;
};

type CreatedBooking = {
  id: string;
  status: string;
  totalCents: number;
  currency: string;
};

type ContactField = keyof Pick<
  ContactForm,
  'firstName' | 'lastName' | 'email' | 'phone'
>;

type BookingDraft = {
  version: number;
  step: number;
  selectedServiceId: string;
  selectedStaffId: string;
  rangeDays: number;
  selectedSlot: AvailabilitySlot | null;
  contact: ContactForm;
  consent: LegalConsent;
};

type AvailabilityStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';

const STEP_META = [
  { id: 1, label: 'Service' },
  { id: 2, label: 'Time' },
  { id: 3, label: 'Contact' },
  { id: 4, label: 'Review' },
  { id: 5, label: 'Confirm' },
] as const;

const CONTACT_FIELDS: ContactField[] = [
  'firstName',
  'lastName',
  'email',
  'phone',
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9()\-\s]{7,20}$/;
const DRAFT_STORAGE_KEY = 'kb_booking_draft_v1';
const DRAFT_STORAGE_VERSION = 1;
const RESTORED_DRAFT_MARKER_KEY = 'kb_booking_draft_restored_marker_v1';

const ctaBaseClass =
  'inline-flex min-h-11 items-center justify-center rounded-md border px-4 py-2.5 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 active:scale-[0.99]';
const ctaPrimaryClass = `${ctaBaseClass} border-primary-500 bg-primary-500 text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60`;
const ctaSecondaryClass = `${ctaBaseClass} border-gray-300 bg-white text-gray-800 hover:border-primary-300 hover:bg-primary-50`;

const currencyFormat = (priceCents: number, currency: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(priceCents / 100);

const formatShopDateTime = (iso: string) =>
  new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: AppConfig.shopTimeZone,
  }).format(new Date(iso));

const formatShopDayHeading = (iso: string) =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: AppConfig.shopTimeZone,
  }).format(new Date(iso));

const formatShopTimeRange = (slotStartIso: string, slotEndIso: string) => {
  const startDate = new Date(slotStartIso);
  const endDate = new Date(slotEndIso);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return 'Time unavailable';
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: AppConfig.shopTimeZone,
  });

  return `${formatter.format(startDate)}-${formatter.format(endDate)}`;
};

const hasMeaningfulDraftProgress = (draft: BookingDraft) => {
  const hasContactInput = Object.values(draft.contact).some(
    (value) => value.trim().length > 0,
  );

  return draft.step > 1 || Boolean(draft.selectedSlot) || hasContactInput;
};

const parseRetryAfterSeconds = (retryAfterHeader: string | null) => {
  if (!retryAfterHeader) {
    return 60;
  }

  const retryAfterSeconds = Number.parseInt(retryAfterHeader, 10);
  if (!Number.isNaN(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return retryAfterSeconds;
  }

  const retryAt = new Date(retryAfterHeader).getTime();
  if (Number.isNaN(retryAt)) {
    return 60;
  }

  return Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
};

const parseJsonSafely = async <T,>(response: Response): Promise<T | null> => {
  const responseWithFallback = response as Response & {
    text?: () => Promise<string>;
    json?: () => Promise<unknown>;
  };

  if (typeof responseWithFallback.text === 'function') {
    const body = await responseWithFallback.text();

    if (!body) {
      return null;
    }

    try {
      return JSON.parse(body) as T;
    } catch {
      return null;
    }
  }

  if (typeof responseWithFallback.json === 'function') {
    try {
      return (await responseWithFallback.json()) as T;
    } catch {
      return null;
    }
  }

  return null;
};

const getInvalidApiResponseMessage = (response: Response, fallback: string) => {
  if (response.status === 403) {
    return 'Booking service is temporarily protected by a security check. Please retry in a moment or call the shop.';
  }

  if (response.status >= 500) {
    return 'Booking service is temporarily unavailable. Please retry in a moment.';
  }

  return fallback;
};

const getShopMinutes = (iso: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: AppConfig.shopTimeZone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(iso));
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(
    parts.find((part) => part.type === 'minute')?.value ?? 0,
  );

  return hour * 60 + minute;
};

const isWithinShopHours = (slot: AvailabilitySlot) => {
  const openMin = 9 * 60;
  const closeMin = 17 * 60;
  const slotStartMin = getShopMinutes(slot.slotStart);
  const slotEndMin = getShopMinutes(slot.slotEnd);

  return slotStartMin >= openMin && slotEndMin <= closeMin;
};

const fieldLabel = (field: ContactField) => field.replace(/([A-Z])/g, ' $1');

const fieldHelperText: Record<ContactField, string> = {
  firstName: 'Required.',
  lastName: 'Required.',
  email: 'Required. Use format: name@example.com',
  phone: 'Required. Enter a valid phone number (7-20 digits, symbols allowed).',
};

const Scheduler = ({ services, staff }: SchedulerProps) => {
  const selectableServices = useMemo(
    () => services.filter((service) => service.active && service.bookable),
    [services],
  );

  const selectableStaff = useMemo(() => {
    const normalized = new Map<string, StaffMember>();

    staff.forEach((member) => {
      if (member.active === false) {
        return;
      }

      const normalizedId = member.id.trim().toLowerCase();
      const normalizedName = member.displayName.trim().toLowerCase();

      if (normalizedId === 'any' || normalizedName === 'any barber') {
        return;
      }

      if (!normalized.has(normalizedId)) {
        normalized.set(normalizedId, member);
      }
    });

    return [
      { id: 'any', displayName: 'Any barber', active: true },
      ...Array.from(normalized.values()),
    ];
  }, [staff]);

  const [step, setStep] = useState(1);
  const [selectedServiceId, setSelectedServiceId] = useState(
    selectableServices[0]?.id ?? '',
  );
  const [selectedStaffId, setSelectedStaffId] = useState('any');
  const [rangeDays, setRangeDays] = useState(7);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(
    null,
  );
  const [contact, setContact] = useState<ContactForm>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    notes: '',
  });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<ContactField, string>>
  >({});
  const [consent, setConsent] = useState<LegalConsent>({
    agreeToTerms: false,
    agreeToPrivacy: false,
    agreeToBookingPolicies: false,
    marketingOptIn: false,
    smsOptIn: false,
  });
  const [booking, setBooking] = useState<CreatedBooking | null>(null);
  const [apiError, setApiError] = useState('');
  const [slotConflictAlternatives, setSlotConflictAlternatives] = useState<
    AvailabilitySlot[]
  >([]);
  const [holdId, setHoldId] = useState('');
  const [, setHoldExpiresAt] = useState('');
  const [holdSlotKey, setHoldSlotKey] = useState('');
  const [isHoldingSlot, setIsHoldingSlot] = useState(false);
  const [serviceIntentMessage, setServiceIntentMessage] = useState('');
  const [staffIntentMessage, setStaffIntentMessage] = useState('');
  const [restoreNotice, setRestoreNotice] = useState('');
  const [pendingRestoredStep, setPendingRestoredStep] = useState<number | null>(
    null,
  );
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [expandedDayKeys, setExpandedDayKeys] = useState<
    Record<string, boolean>
  >({});
  const [availabilityStatus, setAvailabilityStatus] =
    useState<AvailabilityStatus>('idle');
  const [availabilityErrorMessage, setAvailabilityErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rateLimitRetryAtMs, setRateLimitRetryAtMs] = useState<number | null>(
    null,
  );
  const [rateLimitSecondsLeft, setRateLimitSecondsLeft] = useState(0);
  const [isKeyboardMode, setIsKeyboardMode] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const resetDialogOpen = isResetConfirmOpen;

  const serviceSelectRef = useRef<HTMLSelectElement | null>(null);
  const staffSelectRef = useRef<HTMLSelectElement | null>(null);
  const resetTriggerRef = useRef<HTMLButtonElement | null>(null);
  const resetCancelRef = useRef<HTMLButtonElement | null>(null);
  const resetConfirmRef = useRef<HTMLButtonElement | null>(null);
  const schedulerCardRef = useRef<HTMLDivElement | null>(null);
  const slotsHeadingRef = useRef<HTMLParagraphElement | null>(null);
  const slotOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [focusedSlotIndex, setFocusedSlotIndex] = useState(0);
  const reviewEditRef = useRef<HTMLButtonElement | null>(null);
  const contactFieldRefs = useRef<
    Partial<Record<ContactField, HTMLInputElement | null>>
  >({});
  const hasHydratedDraft = useRef(false);

  useEffect(() => {
    const firstService = selectableServices[0];

    if (!selectedServiceId && firstService) {
      setSelectedServiceId(firstService.id);
    }
  }, [selectableServices, selectedServiceId]);

  useEffect(() => {
    const applyIntentFromUrl = () => {
      if (typeof window === 'undefined') {
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const serviceIdFromQuery = params.get('serviceId');
      const staffIdFromQuery = params.get('staffId');

      if (serviceIdFromQuery) {
        const requestedService = selectableServices.find(
          (service) => service.id === serviceIdFromQuery,
        );

        if (requestedService) {
          setSelectedServiceId(requestedService.id);
          setServiceIntentMessage('');
        } else {
          setServiceIntentMessage(
            'That service is not currently available online. Please choose another service.',
          );
        }
      } else {
        setServiceIntentMessage('');
      }

      if (staffIdFromQuery) {
        const requestedStaff = selectableStaff.find(
          (member) => member.id === staffIdFromQuery,
        );

        if (requestedStaff && requestedStaff.active !== false) {
          setSelectedStaffId(requestedStaff.id);
          setStaffIntentMessage('');
        } else {
          setSelectedStaffId('any');
          setStaffIntentMessage(
            'That barber is not currently available online. Defaulted to Any barber.',
          );
        }
      } else {
        setStaffIntentMessage('');
      }
    };

    applyIntentFromUrl();
    window.addEventListener('popstate', applyIntentFromUrl);
    window.addEventListener('hashchange', applyIntentFromUrl);

    return () => {
      window.removeEventListener('popstate', applyIntentFromUrl);
      window.removeEventListener('hashchange', applyIntentFromUrl);
    };
  }, [selectableServices, selectableStaff]);

  useEffect(() => {
    if (
      hasHydratedDraft.current ||
      selectableServices.length === 0 ||
      selectableStaff.length === 0
    ) {
      return;
    }

    hasHydratedDraft.current = true;

    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.removeItem('kb_booking_draft');

    const draftRaw = window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!draftRaw) {
      return;
    }

    try {
      const draft = JSON.parse(draftRaw) as BookingDraft;
      if (draft.version !== DRAFT_STORAGE_VERSION) {
        window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
        window.sessionStorage.removeItem(RESTORED_DRAFT_MARKER_KEY);
        return;
      }

      const validService = selectableServices.find(
        (service) => service.id === draft.selectedServiceId,
      );
      const validStaff = selectableStaff.find(
        (member) =>
          member.id === draft.selectedStaffId && member.active !== false,
      );

      const nextStep = draft.step >= 1 && draft.step <= 4 ? draft.step : 1;

      setSelectedServiceId(validService?.id ?? selectableServices[0]?.id ?? '');
      setSelectedStaffId(validStaff?.id ?? 'any');
      setRangeDays(draft.rangeDays === 14 ? 14 : 7);
      setSelectedSlot(draft.selectedSlot ?? null);
      setContact(draft.contact);
      setConsent(
        draft.consent ?? {
          agreeToTerms: false,
          agreeToPrivacy: false,
          agreeToBookingPolicies: false,
          marketingOptIn: false,
          smsOptIn: false,
        },
      );

      const lastRestoredMarker = window.sessionStorage.getItem(
        RESTORED_DRAFT_MARKER_KEY,
      );
      const restoreMarker = draftRaw;
      const shouldShowRestoreNotice =
        lastRestoredMarker !== restoreMarker &&
        hasMeaningfulDraftProgress(draft);

      if (shouldShowRestoreNotice && nextStep > 1) {
        setPendingRestoredStep(nextStep);
        setStep(1);

        if (!validService || !validStaff) {
          setRestoreNotice(
            'Found a previous booking draft. Some saved selections are no longer available. Continue draft or start new booking.',
          );
        } else {
          setRestoreNotice(
            'Found your previous booking draft. Continue draft or start new booking.',
          );
        }
      } else {
        setPendingRestoredStep(null);
        setStep(nextStep);
        setRestoreNotice('');
      }

      window.sessionStorage.setItem(RESTORED_DRAFT_MARKER_KEY, restoreMarker);
    } catch {
      window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      window.sessionStorage.removeItem(RESTORED_DRAFT_MARKER_KEY);
    }
  }, [selectableServices, selectableStaff]);

  useEffect(() => {
    if (!hasHydratedDraft.current || typeof window === 'undefined') {
      return;
    }

    if (booking || step === 5) {
      window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      window.sessionStorage.removeItem(RESTORED_DRAFT_MARKER_KEY);
      return;
    }

    const draft: BookingDraft = {
      version: DRAFT_STORAGE_VERSION,
      step,
      selectedServiceId,
      selectedStaffId,
      rangeDays,
      selectedSlot,
      contact,
      consent,
    };

    window.sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [
    booking,
    consent,
    contact,
    rangeDays,
    selectedServiceId,
    selectedSlot,
    selectedStaffId,
    step,
  ]);

  useEffect(() => {
    const keyboardStart = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        setIsKeyboardMode(true);
      }
    };
    const pointerStart = () => setIsKeyboardMode(false);

    window.addEventListener('keydown', keyboardStart);
    window.addEventListener('mousedown', pointerStart);
    window.addEventListener('touchstart', pointerStart);

    return () => {
      window.removeEventListener('keydown', keyboardStart);
      window.removeEventListener('mousedown', pointerStart);
      window.removeEventListener('touchstart', pointerStart);
    };
  }, []);

  useEffect(() => {
    if (!rateLimitRetryAtMs) {
      setRateLimitSecondsLeft(0);
      return undefined;
    }

    const updateCountdown = () => {
      const nextSeconds = Math.max(
        0,
        Math.ceil((rateLimitRetryAtMs - Date.now()) / 1000),
      );
      setRateLimitSecondsLeft(nextSeconds);

      if (nextSeconds === 0) {
        setRateLimitRetryAtMs(null);
      }
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 250);

    return () => window.clearInterval(interval);
  }, [rateLimitRetryAtMs]);

  useEffect(() => {
    if (!resetDialogOpen) {
      return undefined;
    }

    const focusables = [resetCancelRef.current, resetConfirmRef.current].filter(
      Boolean,
    ) as HTMLButtonElement[];

    focusables[0]?.focus();

    const handleDialogKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsResetConfirmOpen(false);
        setIsKeyboardMode(false);
        window.setTimeout(() => resetTriggerRef.current?.focus(), 0);
        return;
      }

      if (event.key !== 'Tab' || focusables.length === 0) {
        return;
      }

      const activeElement = document.activeElement as HTMLElement | null;
      const currentIndex = focusables.findIndex((el) => el === activeElement);

      if (event.shiftKey) {
        if (currentIndex <= 0) {
          event.preventDefault();
          focusables[focusables.length - 1]?.focus();
        }
      } else if (currentIndex === focusables.length - 1) {
        event.preventDefault();
        focusables[0]?.focus();
      }
    };

    window.addEventListener('keydown', handleDialogKeydown);
    return () => window.removeEventListener('keydown', handleDialogKeydown);
  }, [resetDialogOpen]);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    schedulerCardRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });

    if (!isKeyboardMode) {
      return undefined;
    }

    if (step === 1) {
      serviceSelectRef.current?.focus();
      return undefined;
    }

    if (step === 2) {
      slotsHeadingRef.current?.focus();
      return undefined;
    }

    if (step === 3) {
      contactFieldRefs.current.firstName?.focus();
      return undefined;
    }

    if (step === 4) {
      reviewEditRef.current?.focus();
      return undefined;
    }

    return undefined;
  }, [isKeyboardMode, step]);

  const selectedService =
    selectableServices.find((service) => service.id === selectedServiceId) ??
    null;
  const selectedStaff =
    selectableStaff.find((member) => member.id === selectedStaffId) ?? null;
  const boundedSlots = useMemo(
    () => slots.filter((slot) => isWithinShopHours(slot)),
    [slots],
  );
  const sortedSlots = useMemo(
    () =>
      [...boundedSlots].sort(
        (a, b) =>
          new Date(a.slotStart).getTime() - new Date(b.slotStart).getTime(),
      ),
    [boundedSlots],
  );
  const groupedSlots = useMemo(() => {
    return sortedSlots.reduce<
      Array<{
        dayKey: string;
        heading: string;
        slotsForDay: AvailabilitySlot[];
      }>
    >((acc, slot) => {
      const dayKey = new Intl.DateTimeFormat('en-CA', {
        timeZone: AppConfig.shopTimeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(slot.slotStart));
      const existingGroup = acc.find((group) => group.dayKey === dayKey);

      if (existingGroup) {
        existingGroup.slotsForDay.push(slot);
      } else {
        acc.push({
          dayKey,
          heading: formatShopDayHeading(slot.slotStart),
          slotsForDay: [slot],
        });
      }

      return acc;
    }, []);
  }, [sortedSlots]);

  const validateContactField = (
    field: ContactField,
    value: string,
  ): string | null => {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return `${fieldLabel(field)} is required.`;
    }

    if (field === 'email' && !EMAIL_REGEX.test(trimmedValue)) {
      return 'Enter a valid email address.';
    }

    if (field === 'phone' && !PHONE_REGEX.test(trimmedValue)) {
      return 'Enter a valid phone number.';
    }

    return null;
  };

  const validateAllContactFields = (form: ContactForm) => {
    const errors: Partial<Record<ContactField, string>> = {};

    CONTACT_FIELDS.forEach((field) => {
      const message = validateContactField(field, form[field]);
      if (message) {
        errors[field] = message;
      }
    });

    return errors;
  };

  const focusFirstInvalidField = (
    errors: Partial<Record<ContactField, string>>,
  ) => {
    const firstInvalidField = CONTACT_FIELDS.find((field) => errors[field]);
    if (!firstInvalidField) {
      return;
    }

    contactFieldRefs.current[firstInvalidField]?.focus();
    contactFieldRefs.current[firstInvalidField]?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  };

  const continueRestoredDraft = () => {
    setStep(pendingRestoredStep ?? 1);
    setPendingRestoredStep(null);
    setRestoreNotice('Restored your in-progress booking draft.');
  };

  const releaseHold = async (targetHoldId: string) => {
    try {
      await fetch(
        `/api/v1/bookings/holds?holdId=${encodeURIComponent(targetHoldId)}`,
        {
          method: 'DELETE',
        },
      );
    } catch {
      // best-effort cleanup
    }
  };

  const clearHold = async () => {
    if (!holdId) {
      return;
    }
    const target = holdId;
    setHoldId('');
    setHoldExpiresAt('');
    setHoldSlotKey('');
    await releaseHold(target);
  };

  const clearDraft = () => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      window.sessionStorage.removeItem(RESTORED_DRAFT_MARKER_KEY);
    }
    clearHold().catch(() => {
      // best-effort cleanup
    });
    setSelectedServiceId(selectableServices[0]?.id ?? '');
    setSelectedStaffId('any');
    setRangeDays(7);
    setSlots([]);
    setSelectedSlot(null);
    setContact({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      notes: '',
    });
    setFieldErrors({});
    setConsent({
      agreeToTerms: false,
      agreeToPrivacy: false,
      agreeToBookingPolicies: false,
      marketingOptIn: false,
      smsOptIn: false,
    });
    setBooking(null);
    setApiError('');
    setSlotConflictAlternatives([]);
    setPendingRestoredStep(null);
    setRestoreNotice('Booking draft cleared.');
    setStep(1);
    setIsResetConfirmOpen(false);
    setRateLimitRetryAtMs(null);
    setHoldSlotKey('');
  };

  const ensureHold = async (slot: AvailabilitySlot) => {
    if (!selectedService) {
      return;
    }

    const slotFingerprint = `${slot.staffId}|${slot.slotStart}|${slot.slotEnd}`;
    const isSameSlot = holdSlotKey === slotFingerprint && holdId;
    if (!isSameSlot && holdId) {
      await clearHold();
    }

    if (holdId && isSameSlot) {
      setIsHoldingSlot(true);
      try {
        const response = await fetch('/api/v1/bookings/holds', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ holdId }),
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(
            payload?.error?.message ?? 'Unable to refresh slot hold.',
          );
        }

        setHoldExpiresAt(payload?.data?.expiresAt ?? '');
      } catch {
        setHoldId('');
        setHoldSlotKey('');
      } finally {
        setIsHoldingSlot(false);
      }
      return;
    }

    setIsHoldingSlot(true);
    try {
      const response = await fetch('/api/v1/bookings/holds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: selectedService.id,
          staffId: slot.staffId,
          slotStart: slot.slotStart,
          slotEnd: slot.slotEnd,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          payload?.error?.message ?? 'Unable to reserve slot hold.',
        );
      }
      const nextId = payload?.data?.id;
      if (typeof nextId === 'string' && nextId.length > 0) {
        setHoldId(nextId);
      }
      setHoldSlotKey(slotFingerprint);
      setHoldExpiresAt(payload?.data?.expiresAt ?? '');
    } catch {
      setHoldId('');
      setHoldSlotKey('');
      setHoldExpiresAt('');
    } finally {
      setIsHoldingSlot(false);
    }
  };

  const openResetConfirm = () => {
    setIsResetConfirmOpen(true);
  };

  const closeResetConfirm = () => {
    setIsResetConfirmOpen(false);
    setIsKeyboardMode(false);
    window.setTimeout(() => resetTriggerRef.current?.focus(), 0);
  };

  const downloadCalendarInvite = () => {
    if (!selectedSlot || !selectedService || typeof window === 'undefined') {
      return;
    }

    const formatForIcs = (dateIso: string) =>
      dateIso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

    const nowStamp = formatForIcs(new Date().toISOString());
    const startStamp = formatForIcs(selectedSlot.slotStart);
    const endStamp = formatForIcs(selectedSlot.slotEnd);
    const staffName =
      selectableStaff.find((member) => member.id === selectedSlot.staffId)
        ?.displayName ?? 'Any barber';

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Kevin Barbershop//Booking//EN',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${booking?.id ?? `booking-${startStamp}`}@kevinbarbershop`,
      `DTSTAMP:${nowStamp}`,
      `DTSTART:${startStamp}`,
      `DTEND:${endStamp}`,
      `SUMMARY:Barbershop Appointment - ${selectedService.name}`,
      `DESCRIPTION:Appointment with ${staffName}. Payment due at shop (cash only).`,
      'LOCATION:Kevin Barbershop',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kevin-barbershop-${startStamp}.ics`;
    document.body.append(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const loadSlots = async (daysOverride?: number) => {
    if (!selectedServiceId) {
      return;
    }

    const activeDays = daysOverride ?? rangeDays;

    setApiError('');
    setSlotConflictAlternatives([]);
    setAvailabilityErrorMessage('');
    setIsLoadingSlots(true);
    setAvailabilityStatus('loading');
    setStep(2);
    setSelectedSlot(null);
    setFocusedSlotIndex(0);
    setExpandedDayKeys({});

    try {
      const from = new Date();
      const to = new Date(from.getTime() + activeDays * 24 * 60 * 60 * 1000);
      const params = new URLSearchParams({
        serviceId: selectedServiceId,
        from: from.toISOString(),
        to: to.toISOString(),
      });

      if (selectedStaffId !== 'any') {
        params.set('staffId', selectedStaffId);
      }

      const response = await fetch(`/api/v1/availability?${params.toString()}`);
      const payload = await parseJsonSafely<{
        data?: AvailabilitySlot[];
        error?: { message?: string };
      }>(response);

      if (!response.ok) {
        throw new Error(
          payload?.error?.message ??
            getInvalidApiResponseMessage(
              response,
              'Unable to load availability',
            ),
        );
      }

      if (!payload) {
        throw new Error(
          getInvalidApiResponseMessage(
            response,
            'Schedule service returned an invalid response. Please retry.',
          ),
        );
      }

      const fetchedSlots = payload.data ?? [];
      const inBoundsSlots = fetchedSlots.filter((slot) =>
        isWithinShopHours(slot),
      );
      setSlots(fetchedSlots);
      setAvailabilityStatus(inBoundsSlots.length > 0 ? 'success' : 'empty');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to load availability';
      setAvailabilityErrorMessage(message);
      setAvailabilityStatus('error');
    } finally {
      setIsLoadingSlots(false);
    }
  };

  useEffect(() => {
    if (
      selectedSlot &&
      !boundedSlots.some(
        (slot) =>
          slot.slotStart === selectedSlot.slotStart &&
          slot.staffId === selectedSlot.staffId,
      )
    ) {
      setSelectedSlot(null);
      setHoldSlotKey('');
      setHoldId('');
      setHoldExpiresAt('');
    }
  }, [boundedSlots, selectedSlot]);

  useEffect(() => {
    if (!selectedSlot) {
      clearHold().catch(() => {
        // best-effort cleanup
      });
      return;
    }

    if (!selectedService) {
      return;
    }

    ensureHold(selectedSlot).catch(() => {
      // best-effort hold refresh
    });
  }, [selectedSlot, selectedService?.id]);

  useEffect(() => {
    if (sortedSlots.length === 0) {
      setFocusedSlotIndex(0);
      return;
    }

    if (selectedSlot) {
      const selectedIndex = sortedSlots.findIndex(
        (slot) =>
          slot.slotStart === selectedSlot.slotStart &&
          slot.staffId === selectedSlot.staffId,
      );

      if (selectedIndex >= 0) {
        setFocusedSlotIndex(selectedIndex);
        return;
      }
    }

    if (focusedSlotIndex > sortedSlots.length - 1) {
      setFocusedSlotIndex(0);
    }
  }, [focusedSlotIndex, selectedSlot, sortedSlots]);

  const handleReviewSummary = () => {
    const errors = validateAllContactFields(contact);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      focusFirstInvalidField(errors);
      return;
    }

    setStep(4);
  };

  const submitBooking = async () => {
    if (!selectedSlot || !selectedService) {
      return;
    }

    const errors = validateAllContactFields(contact);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setStep(3);
      focusFirstInvalidField(errors);
      return;
    }

    if (
      !consent.agreeToTerms ||
      !consent.agreeToPrivacy ||
      !consent.agreeToBookingPolicies
    ) {
      setApiError(
        'Please agree to Terms, Privacy Policy, and Booking Policies before confirming.',
      );
      return;
    }

    if (rateLimitSecondsLeft > 0) {
      setApiError(
        `Too many booking attempts. Try again in ${rateLimitSecondsLeft}s.`,
      );
      return;
    }

    if (!holdId) {
      setApiError('Slot hold is not ready yet. Please reselect your time.');
      return;
    }

    if (isHoldingSlot) {
      setApiError('Preparing your hold. Please retry in a moment.');
      return;
    }

    setIsSubmitting(true);
    setApiError('');

    try {
      const bookingResponse = await fetch('/api/v1/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: selectedService.id,
          staffId: selectedSlot.staffId,
          slotStart: selectedSlot.slotStart,
          slotEnd: selectedSlot.slotEnd,
          holdId,
          customer: {
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email,
            phone: contact.phone,
          },
          notes: contact.notes,
          consent: {
            ...consent,
            legalVersion: AppConfig.legalVersion,
          },
        }),
      });

      const bookingPayload = (await bookingResponse.json()) as {
        data?: CreatedBooking;
        error?: SlotConflictError;
      };

      if (bookingResponse.status === 429) {
        const retryAfterHeader = bookingResponse.headers.get('Retry-After');
        const retryAfterSec = Math.max(
          1,
          parseRetryAfterSeconds(retryAfterHeader),
        );

        setRateLimitRetryAtMs(Date.now() + retryAfterSec * 1000);
        setApiError(
          `Too many booking attempts. Try again in ${retryAfterSec}s.`,
        );
        return;
      }

      if (
        bookingResponse.status === 409 &&
        bookingPayload.error?.code === 'SLOT_TAKEN'
      ) {
        setApiError(
          bookingPayload.error?.message ??
            'That slot was just taken. Choose another nearby time.',
        );
        setSlotConflictAlternatives(bookingPayload.error.alternatives ?? []);
        return;
      }

      if (
        bookingResponse.status === 409 &&
        bookingPayload.error?.code === 'HOLD_REQUIRED'
      ) {
        setHoldId('');
        setHoldSlotKey('');
        setSlotConflictAlternatives([]);
        ensureHold(selectedSlot).catch(() => {
          // best-effort hold refresh
        });
        setApiError(
          bookingPayload.error?.message ??
            'Your slot hold expired. Please confirm again.',
        );
        return;
      }

      if (
        bookingResponse.status === 409 &&
        (bookingPayload.error?.code === 'HOLD_EXPIRED' ||
          bookingPayload.error?.code === 'HOLD_MISMATCH')
      ) {
        setHoldId('');
        setHoldSlotKey('');
        setSlotConflictAlternatives([]);
        ensureHold(selectedSlot).catch(() => {
          // best-effort hold refresh
        });
        setApiError(
          bookingPayload.error?.message ??
            'Your slot hold was not valid. Please confirm again.',
        );
        return;
      }

      if (!bookingResponse.ok || !bookingPayload.data) {
        throw new Error(
          bookingPayload.error?.message ?? 'Unable to create booking',
        );
      }

      setRateLimitRetryAtMs(null);
      setSlotConflictAlternatives([]);
      setBooking(bookingPayload.data);
      setStep(5);
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
        window.sessionStorage.removeItem(RESTORED_DRAFT_MARKER_KEY);
      }
    } catch (err) {
      setApiError(
        err instanceof Error ? err.message : 'Unable to complete booking',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const subtotal = selectedService?.priceCents ?? 0;
  const total = subtotal;

  return (
    <Section
      title="Book an Appointment"
      description="Choose your service and slot, share your details, then confirm. Payment is collected at the shop (cash only)."
    >
      <div
        id="book"
        ref={schedulerCardRef}
        className="anchor-section rounded-2xl bg-white p-6 shadow-md sm:p-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-primary-700">
            Step {step} of 5
          </p>
          <button
            ref={resetTriggerRef}
            type="button"
            className="text-xs font-semibold text-gray-600 underline decoration-dotted underline-offset-2 hover:text-primary-700"
            onClick={openResetConfirm}
          >
            Reset booking
          </button>
        </div>

        <ol
          className="mt-3 flex flex-wrap gap-2 text-xs sm:text-sm"
          aria-label="Booking progress"
        >
          {STEP_META.map((item) => {
            const isComplete = step > item.id;
            const isCurrent = step === item.id;
            let stepClass = 'border-gray-300 bg-gray-50 text-gray-500';

            if (isCurrent) {
              stepClass = 'border-primary-500 bg-primary-50 text-primary-700';
            } else if (isComplete) {
              stepClass = 'border-green-300 bg-green-50 text-green-700';
            }

            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (item.id <= step) {
                      setStep(item.id);
                    }
                  }}
                  disabled={item.id > step}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`rounded-full border px-3 py-1 ${stepClass} disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {item.label}
                </button>
              </li>
            );
          })}
        </ol>

        {restoreNotice && (
          <div
            className="mt-3 rounded-md bg-blue-50 p-3 text-sm text-blue-800"
            role="status"
            aria-live="polite"
          >
            <p>{restoreNotice}</p>
            {pendingRestoredStep ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={ctaPrimaryClass}
                  onClick={continueRestoredDraft}
                >
                  Continue draft
                </button>
                <button
                  type="button"
                  className={ctaSecondaryClass}
                  onClick={clearDraft}
                >
                  Start new booking
                </button>
              </div>
            ) : null}
          </div>
        )}

        {apiError && (
          <p
            className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700"
            role="alert"
            aria-live="assertive"
          >
            {apiError}
          </p>
        )}

        {resetDialogOpen && (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm reset booking"
          >
            <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
              <p className="text-base font-semibold text-gray-900">
                Reset your booking draft?
              </p>
              <p className="mt-2 text-sm text-gray-600">
                This will clear your selected service, barber, time slot, and
                contact details.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  ref={resetCancelRef}
                  type="button"
                  className={ctaSecondaryClass}
                  onClick={closeResetConfirm}
                >
                  Cancel
                </button>
                <button
                  ref={resetConfirmRef}
                  type="button"
                  className={ctaPrimaryClass}
                  onClick={clearDraft}
                >
                  Confirm reset
                </button>
              </div>
            </div>
          </div>
        )}

        {(step === 3 || step === 4) && selectedService && selectedSlot && (
          <div className="bg-primary-50 sticky top-2 z-10 mt-4 rounded-lg border border-primary-200 px-3 py-2 text-xs text-primary-900 shadow-sm sm:hidden">
            <p className="font-semibold">{selectedService.name}</p>
            <p>
              {formatShopDateTime(selectedSlot.slotStart)} ·{' '}
              {selectableStaff.find(
                (member) => member.id === selectedSlot.staffId,
              )?.displayName ?? 'Any barber'}
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="step-panel mt-4 space-y-4">
            {selectableServices.length === 0 ? (
              <div className="space-y-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
                <p className="font-medium text-gray-900">
                  Online booking is temporarily unavailable.
                </p>
                <p className="text-sm text-gray-600">
                  We currently have no bookable services online. Please call the
                  shop and we&apos;ll help you schedule your appointment.
                </p>
                <a
                  href={`tel:${AppConfig.shopPhoneE164}`}
                  className={ctaPrimaryClass}
                  aria-label={`Call the shop at ${AppConfig.shopPhoneDisplay}`}
                >
                  Call the shop: {AppConfig.shopPhoneDisplay}
                </a>
              </div>
            ) : (
              <>
                {serviceIntentMessage && (
                  <p
                    className="rounded-md bg-amber-50 p-3 text-sm text-amber-800"
                    role="status"
                    aria-live="polite"
                  >
                    {serviceIntentMessage}
                  </p>
                )}

                {staffIntentMessage && (
                  <p
                    className="rounded-md bg-amber-50 p-3 text-sm text-amber-800"
                    role="status"
                    aria-live="polite"
                  >
                    {staffIntentMessage}
                  </p>
                )}

                <div>
                  <label
                    htmlFor="service"
                    className="text-sm font-medium text-gray-700"
                  >
                    Service
                  </label>
                  <select
                    id="service"
                    ref={serviceSelectRef}
                    className="mt-2 w-full rounded-md border border-gray-300 p-3"
                    value={selectedServiceId}
                    onChange={(event) =>
                      setSelectedServiceId(event.target.value)
                    }
                  >
                    {selectableServices.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name} ({service.durationMin} min) -{' '}
                        {currencyFormat(service.priceCents, service.currency)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="booking-staff"
                    className="text-sm font-medium text-gray-700"
                  >
                    Preferred barber
                  </label>
                  <select
                    id="booking-staff"
                    ref={staffSelectRef}
                    className="mt-2 w-full rounded-md border border-gray-300 p-3"
                    value={selectedStaffId}
                    onChange={(event) => setSelectedStaffId(event.target.value)}
                  >
                    {selectableStaff.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-gray-600">Availability window</p>
                  <div className="flex gap-2">
                    {[7, 14].map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setRangeDays(days)}
                        className={`${ctaSecondaryClass} px-3 py-2 text-sm ${
                          rangeDays === days
                            ? 'bg-primary-50 border-primary-500 text-primary-700'
                            : ''
                        }`}
                      >
                        Next {days} days
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    loadSlots().catch(() => {
                      // handled in loadSlots
                    });
                  }}
                  disabled={!selectedServiceId || isLoadingSlots}
                  className={ctaPrimaryClass}
                >
                  {isLoadingSlots ? 'Loading slots...' : 'Find available slots'}
                </button>
              </>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="step-panel mt-4 space-y-3">
            <p
              ref={slotsHeadingRef}
              tabIndex={-1}
              className="text-sm text-gray-600 focus-visible:outline-none"
            >
              {availabilityStatus === 'error'
                ? `We couldn't load availability right now for ${AppConfig.shopTimeLabel}.`
                : `Pick an open slot in shop time (${AppConfig.shopTimeLabel}) (${boundedSlots.length} found in next ${rangeDays} days).`}
            </p>

            {availabilityStatus === 'loading' ? (
              <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm text-gray-700">
                  Loading availability in {AppConfig.shopTimeLabel} for the next{' '}
                  {rangeDays} days...
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={`slot-skeleton-${index + 1}`}
                      className="h-16 animate-pulse rounded-md border border-gray-200 bg-white"
                    />
                  ))}
                </div>
              </div>
            ) : availabilityStatus === 'error' ? (
              <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="font-medium text-red-900">
                  Availability failed to load.
                </p>
                <p className="text-sm text-red-700">
                  We had trouble reaching the schedule service. Please retry, go
                  back, or call the shop and we&apos;ll book you directly.
                </p>
                {availabilityErrorMessage && (
                  <p className="text-xs text-red-700">
                    Details: {availabilityErrorMessage}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={ctaSecondaryClass}
                    onClick={() => {
                      loadSlots().catch(() => {
                        // handled in loadSlots
                      });
                    }}
                  >
                    Retry loading slots
                  </button>
                  <button
                    type="button"
                    className={ctaSecondaryClass}
                    onClick={() => setStep(1)}
                  >
                    Back to service & barber
                  </button>
                  <a
                    href={`tel:${AppConfig.shopPhoneE164}`}
                    aria-label={`Call the shop at ${AppConfig.shopPhoneDisplay}`}
                    className={ctaSecondaryClass}
                  >
                    Call the shop: {AppConfig.shopPhoneDisplay}
                  </a>
                </div>
              </div>
            ) : availabilityStatus === 'empty' ||
              availabilityStatus === 'idle' ? (
              <div className="space-y-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
                <p className="font-medium text-gray-900">
                  No appointments available in the next {rangeDays} days.
                </p>
                <p className="text-sm text-gray-600">
                  Popular times fill quickly. Try another barber or service, or
                  search a wider range.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={ctaSecondaryClass}
                    onClick={() => {
                      setStep(1);
                      setTimeout(() => staffSelectRef.current?.focus(), 0);
                    }}
                  >
                    Try another barber
                  </button>
                  <button
                    type="button"
                    className={ctaSecondaryClass}
                    onClick={() => {
                      setStep(1);
                      setTimeout(() => serviceSelectRef.current?.focus(), 0);
                    }}
                  >
                    Choose a different service
                  </button>
                  <button
                    type="button"
                    className={ctaSecondaryClass}
                    onClick={() => {
                      setRangeDays(14);
                      loadSlots(14).catch(() => {
                        // handled in loadSlots
                      });
                    }}
                  >
                    Search next 14 days
                  </button>
                  <a
                    href={`tel:${AppConfig.shopPhoneE164}`}
                    aria-label={`Call the shop at ${AppConfig.shopPhoneDisplay}`}
                    className={ctaSecondaryClass}
                  >
                    Call the shop: {AppConfig.shopPhoneDisplay}
                  </a>
                </div>
              </div>
            ) : (
              <div
                data-testid="slot-results-list"
                className="space-y-4"
                role="radiogroup"
                aria-label="Available appointment slots"
                onKeyDown={(event) => {
                  if (sortedSlots.length === 0) {
                    return;
                  }

                  const { key } = event;
                  const isNextKey = key === 'ArrowRight' || key === 'ArrowDown';
                  const isPrevKey = key === 'ArrowLeft' || key === 'ArrowUp';

                  if (
                    isNextKey ||
                    isPrevKey ||
                    key === 'Home' ||
                    key === 'End'
                  ) {
                    event.preventDefault();
                    let nextIndex = focusedSlotIndex;

                    if (isNextKey) {
                      nextIndex = (focusedSlotIndex + 1) % sortedSlots.length;
                    } else if (isPrevKey) {
                      nextIndex =
                        (focusedSlotIndex - 1 + sortedSlots.length) %
                        sortedSlots.length;
                    } else if (key === 'Home') {
                      nextIndex = 0;
                    } else if (key === 'End') {
                      nextIndex = sortedSlots.length - 1;
                    }

                    const targetSlot = sortedSlots[nextIndex];
                    setFocusedSlotIndex(nextIndex);
                    if (targetSlot) {
                      setSelectedSlot(targetSlot);
                    }
                    slotOptionRefs.current[nextIndex]?.focus();
                    return;
                  }

                  if (key === ' ' || key === 'Enter') {
                    event.preventDefault();
                    const targetSlot = sortedSlots[focusedSlotIndex];
                    if (targetSlot) {
                      if (targetSlot) {
                        setSelectedSlot(targetSlot);
                      }
                    }
                  }
                }}
              >
                {groupedSlots.map((group, groupIndex) => {
                  const expanded = Boolean(expandedDayKeys[group.dayKey]);
                  const visibleSlots = expanded
                    ? group.slotsForDay
                    : group.slotsForDay.slice(0, 6);
                  const hasMore =
                    group.slotsForDay.length > visibleSlots.length;

                  return (
                    <div key={group.dayKey} className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {group.heading}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {visibleSlots.map((slot, slotPosition) => {
                          const isEarliest =
                            groupIndex === 0 && slotPosition === 0;
                          const isSelected =
                            selectedSlot?.slotStart === slot.slotStart &&
                            selectedSlot.staffId === slot.staffId;
                          const slotIndex = sortedSlots.findIndex(
                            (orderedSlot) =>
                              orderedSlot.slotStart === slot.slotStart &&
                              orderedSlot.staffId === slot.staffId,
                          );

                          return (
                            <button
                              key={`${slot.staffId}:${slot.slotStart}`}
                              ref={(element) => {
                                slotOptionRefs.current[slotIndex] = element;
                              }}
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              tabIndex={slotIndex === focusedSlotIndex ? 0 : -1}
                              onClick={() => {
                                setSelectedSlot(slot);
                                setFocusedSlotIndex(slotIndex);
                                setStep((currentStep) =>
                                  Math.max(currentStep, 3),
                                );
                              }}
                              onFocus={() => setFocusedSlotIndex(slotIndex)}
                              className={`${ctaSecondaryClass} text-left ${
                                isSelected
                                  ? 'bg-primary-50 border-primary-500'
                                  : 'border-gray-300'
                              }`}
                            >
                              {isEarliest && (
                                <span className="mb-1 inline-block rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">
                                  Earliest available
                                </span>
                              )}
                              <div>{formatShopDateTime(slot.slotStart)}</div>
                              <div className="text-xs text-gray-500">
                                Time:{' '}
                                {formatShopTimeRange(
                                  slot.slotStart,
                                  slot.slotEnd,
                                )}
                              </div>
                              <div className="text-xs text-gray-500">
                                Staff:{' '}
                                {selectableStaff.find(
                                  (m) => m.id === slot.staffId,
                                )?.displayName ?? slot.staffId}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      {hasMore ? (
                        <button
                          type="button"
                          className={ctaSecondaryClass}
                          onClick={() =>
                            setExpandedDayKeys((prev) => ({
                              ...prev,
                              [group.dayKey]: true,
                            }))
                          }
                        >
                          Show more times (
                          {group.slotsForDay.length - visibleSlots.length} more)
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                className={ctaSecondaryClass}
                onClick={() => setStep(1)}
              >
                Back
              </button>
              <button
                type="button"
                className={ctaPrimaryClass}
                disabled={!selectedSlot}
                onClick={() => setStep(3)}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="step-panel mt-4 space-y-4">
            {CONTACT_FIELDS.map((field) => {
              const isEmail = field === 'email';
              const isPhone = field === 'phone';
              let inputType: 'text' | 'email' | 'tel' = 'text';
              let autoCompleteValue:
                | 'given-name'
                | 'family-name'
                | 'email'
                | 'tel' = 'tel';
              let inputModeValue: 'text' | 'email' | 'tel' = 'text';

              if (isEmail) {
                inputType = 'email';
                autoCompleteValue = 'email';
                inputModeValue = 'email';
              } else if (isPhone) {
                inputType = 'tel';
                autoCompleteValue = 'tel';
                inputModeValue = 'tel';
              }

              if (field === 'firstName') {
                autoCompleteValue = 'given-name';
              } else if (field === 'lastName') {
                autoCompleteValue = 'family-name';
              }

              const enterKeyHintValue = field === 'phone' ? 'done' : 'next';
              const helperId = `${field}-hint`;
              const errorId = `${field}-error`;
              const describedBy = fieldErrors[field]
                ? `${helperId} ${errorId}`
                : helperId;

              return (
                <div key={field}>
                  <label
                    htmlFor={field}
                    className="text-sm font-medium capitalize text-gray-700"
                  >
                    {fieldLabel(field)} <span aria-hidden="true">*</span>
                    <span className="sr-only"> required</span>
                  </label>
                  <input
                    id={field}
                    ref={(element) => {
                      contactFieldRefs.current[field] = element;
                    }}
                    value={contact[field]}
                    onChange={(event) => {
                      const nextValue = event.target.value;

                      setContact((current) => ({
                        ...current,
                        [field]: nextValue,
                      }));

                      if (fieldErrors[field]) {
                        const nextError = validateContactField(
                          field,
                          nextValue,
                        );
                        setFieldErrors((current) => ({
                          ...current,
                          [field]: nextError ?? '',
                        }));
                      }
                    }}
                    onBlur={(event) => {
                      const nextError = validateContactField(
                        field,
                        event.target.value,
                      );
                      setFieldErrors((current) => ({
                        ...current,
                        [field]: nextError ?? '',
                      }));
                    }}
                    type={inputType}
                    autoComplete={autoCompleteValue}
                    inputMode={inputModeValue}
                    enterKeyHint={enterKeyHintValue}
                    required
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') {
                        return;
                      }

                      event.preventDefault();
                      const currentIndex = CONTACT_FIELDS.indexOf(field);
                      const nextField = CONTACT_FIELDS[currentIndex + 1];

                      if (nextField) {
                        contactFieldRefs.current[nextField]?.focus();
                        return;
                      }

                      handleReviewSummary();
                    }}
                    aria-invalid={Boolean(fieldErrors[field])}
                    aria-describedby={describedBy}
                    className={`mt-1 w-full rounded-md border p-3 ${
                      fieldErrors[field]
                        ? 'border-red-500 focus:border-red-500'
                        : 'border-gray-300'
                    }`}
                  />
                  <p id={helperId} className="mt-1 text-xs text-gray-500">
                    {fieldHelperText[field]}
                  </p>
                  {fieldErrors[field] && (
                    <p
                      id={errorId}
                      role="alert"
                      aria-live="assertive"
                      className="mt-1 text-sm text-red-700"
                    >
                      {fieldErrors[field]}
                    </p>
                  )}
                </div>
              );
            })}

            <div>
              <label
                htmlFor="notes"
                className="text-sm font-medium text-gray-700"
              >
                Notes (optional)
              </label>
              <textarea
                id="notes"
                value={contact.notes}
                onChange={(event) =>
                  setContact((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-md border border-gray-300 p-3"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                className={ctaSecondaryClass}
                onClick={() => setStep(2)}
              >
                Back
              </button>
              <button
                type="button"
                className={ctaPrimaryClass}
                onClick={handleReviewSummary}
              >
                Review summary
              </button>
            </div>
          </div>
        )}

        {step === 4 && selectedService && selectedSlot && (
          <div className="step-panel mt-4 space-y-3 text-sm text-gray-700">
            <p>
              <strong>Service:</strong> {selectedService.name}
            </p>
            <p>
              <strong>Staff:</strong>{' '}
              {selectableStaff.find(
                (member) => member.id === selectedSlot.staffId,
              )?.displayName ?? selectedStaff?.displayName}
            </p>
            <p>
              <strong>Date/Time (Shop time {AppConfig.shopTimeLabel}):</strong>{' '}
              {formatShopDateTime(selectedSlot.slotStart)} (
              {formatShopTimeRange(
                selectedSlot.slotStart,
                selectedSlot.slotEnd,
              )}
              )
            </p>
            <p>
              <strong>Duration:</strong> {selectedService.durationMin} minutes
            </p>
            <p>
              <strong>Subtotal:</strong>{' '}
              {currencyFormat(subtotal, selectedService.currency)}
            </p>
            <p>
              <strong>Total:</strong>{' '}
              {currencyFormat(total, selectedService.currency)}
            </p>
            <p className="rounded-md bg-amber-50 p-3 text-amber-800">
              <strong>Payment:</strong> Cash only, paid at the shop.
            </p>

            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-gray-800">
              <p className="font-semibold">Booking policies</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs sm:text-sm">
                <li>
                  Free cancellation/reschedule until{' '}
                  {AppConfig.cancellationCutoffHours} hours before your slot.
                </li>
                <li>
                  Late cancellations or no-shows may be charged up to 100% of
                  the service price.
                </li>
                <li>
                  Refunds are only issued when we cancel or cannot deliver the
                  booked service.
                </li>
              </ul>
              <p className="mt-2 text-xs">
                Full terms:{' '}
                <Link className="underline" href="/terms">
                  Terms
                </Link>{' '}
                and{' '}
                <Link className="underline" href="/privacy">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>

            <div className="space-y-2 rounded-md border border-gray-200 p-3">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={consent.agreeToTerms}
                  onChange={(event) =>
                    setConsent((current) => ({
                      ...current,
                      agreeToTerms: event.target.checked,
                    }))
                  }
                />
                <span>
                  I agree to the{' '}
                  <Link className="underline" href="/terms">
                    Terms
                  </Link>
                  .
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={consent.agreeToPrivacy}
                  onChange={(event) =>
                    setConsent((current) => ({
                      ...current,
                      agreeToPrivacy: event.target.checked,
                    }))
                  }
                />
                <span>
                  I acknowledge the{' '}
                  <Link className="underline" href="/privacy">
                    Privacy Policy
                  </Link>{' '}
                  and data-rights process.
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={consent.agreeToBookingPolicies}
                  onChange={(event) =>
                    setConsent((current) => ({
                      ...current,
                      agreeToBookingPolicies: event.target.checked,
                    }))
                  }
                />
                <span>
                  I agree to the cancellation, reschedule, no-show, and refund
                  policy.
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={consent.marketingOptIn}
                  onChange={(event) =>
                    setConsent((current) => ({
                      ...current,
                      marketingOptIn: event.target.checked,
                    }))
                  }
                />
                <span>Optional: send me promotional emails.</span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={consent.smsOptIn}
                  onChange={(event) =>
                    setConsent((current) => ({
                      ...current,
                      smsOptIn: event.target.checked,
                    }))
                  }
                />
                <span>
                  Optional: send me SMS updates and reminders (msg/data rates
                  may apply).
                </span>
              </label>
            </div>

            {rateLimitSecondsLeft > 0 && (
              <p
                className="rounded-md bg-amber-50 p-3 text-amber-800"
                role="status"
                aria-live="polite"
              >
                Too many attempts detected. You can confirm again in{' '}
                {rateLimitSecondsLeft}s.
              </p>
            )}

            {slotConflictAlternatives.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="font-semibold text-amber-900">
                  That time was just taken. Try one of these nearby options:
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {slotConflictAlternatives.map((alternative) => (
                    <button
                      key={`${alternative.staffId}:${alternative.slotStart}`}
                      type="button"
                      className={ctaSecondaryClass}
                      onClick={() => {
                        setSelectedSlot(alternative);
                        setSlotConflictAlternatives([]);
                        setApiError('');
                      }}
                    >
                      {formatShopTimeRange(
                        alternative.slotStart,
                        alternative.slotEnd,
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                ref={reviewEditRef}
                type="button"
                className={ctaSecondaryClass}
                onClick={() => setStep(3)}
              >
                Edit details
              </button>
              <button
                type="button"
                className={ctaPrimaryClass}
                disabled={
                  isSubmitting ||
                  isHoldingSlot ||
                  rateLimitSecondsLeft > 0 ||
                  !consent.agreeToTerms ||
                  !consent.agreeToPrivacy ||
                  !consent.agreeToBookingPolicies
                }
                onClick={() => {
                  submitBooking().catch(() => {
                    // handled in submitBooking
                  });
                }}
              >
                {isSubmitting
                  ? 'Confirming booking...'
                  : isHoldingSlot
                    ? 'Preparing hold...'
                    : rateLimitSecondsLeft > 0
                      ? `Retry in ${rateLimitSecondsLeft}s`
                      : 'Confirm booking'}
              </button>
            </div>
          </div>
        )}

        {step === 5 && booking && (
          <div className="step-panel mt-4 space-y-3 text-sm text-gray-700">
            <div role="status" aria-live="polite" className="space-y-3">
              <p className="font-semibold text-green-700">Booking confirmed.</p>
              <p>
                <strong>Booking reference:</strong> {booking.id}
              </p>
              <p>
                <strong>Status:</strong> {booking.status}
              </p>
              <p>
                <strong>When:</strong>{' '}
                {selectedSlot
                  ? formatShopDateTime(selectedSlot.slotStart)
                  : '-'}{' '}
                ({AppConfig.shopTimeLabel})
              </p>
              <p>
                <strong>Amount due at shop:</strong>{' '}
                {currencyFormat(booking.totalCents, booking.currency)}
              </p>
              <p>Bring cash for payment at your appointment.</p>
              <p className="rounded-md bg-blue-50 p-3 text-blue-800">
                We&apos;ll see you at your selected time. Save this appointment
                or call us if you need to adjust anything.
              </p>
              <p className="text-xs text-gray-600">
                Data rights requests (access, correction, deletion):{' '}
                <a
                  className="underline"
                  href={`mailto:${AppConfig.privacyEmail}`}
                >
                  {AppConfig.privacyEmail}
                </a>
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={ctaSecondaryClass}
                onClick={downloadCalendarInvite}
              >
                Add to calendar
              </button>
              <a
                href={`tel:${AppConfig.shopPhoneE164}`}
                className={ctaSecondaryClass}
                aria-label={`Call the shop at ${AppConfig.shopPhoneDisplay}`}
              >
                Call shop
              </a>
              <button
                type="button"
                className={ctaPrimaryClass}
                onClick={clearDraft}
              >
                Book another appointment
              </button>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
};

export { Scheduler };
