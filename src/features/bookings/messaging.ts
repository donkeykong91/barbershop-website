import { AppConfig } from '../../utils/AppConfig';

const REMINDER_HOURS_DEFAULT = Number.parseInt(process.env.REMINDER_OFFSET_HOURS ?? '24', 10);
const NEAR_TERM_REMINDER_HOURS_DEFAULT = Number.parseInt(process.env.REMINDER_NEAR_TERM_OFFSET_HOURS ?? '2', 10);

const templateVersion = 'v2.0.0';

const buildConfirmationMessage = (input: {
  serviceName: string;
  staffName: string;
  slotStart: string;
  slotEnd: string;
}) =>
  `[${templateVersion}] Confirmed: ${input.serviceName} with ${input.staffName}. ` +
  `${input.slotStart} - ${input.slotEnd} (${AppConfig.shopTimeLabel}). ` +
  'Payment due at shop (cash).';

const buildReminderMessage = (input: {
  serviceName: string;
  staffName: string;
  slotStart: string;
}) =>
  `[${templateVersion}] Reminder: ${input.serviceName} with ${input.staffName} at ${input.slotStart} (${AppConfig.shopTimeLabel}). Cash due at shop.`;

const getReminderSendTime = (slotStartIso: string, now = Date.now()) => {
  const slotMs = new Date(slotStartIso).getTime();
  const standardMs = REMINDER_HOURS_DEFAULT * 60 * 60 * 1000;
  const nearTermMs = NEAR_TERM_REMINDER_HOURS_DEFAULT * 60 * 60 * 1000;
  const offset = slotMs - now < standardMs ? nearTermMs : standardMs;
  return new Date(slotMs - offset).toISOString();
};

const processReminderWindow = async (windowStartIso: string, windowEndIso: string) => {
  const { listReminderCandidates, logBookingEvent } = await import('./v2Repository');
  const candidates = await listReminderCandidates(windowStartIso, windowEndIso);
  let sent = 0;

  // placeholder queue hook
  await Promise.all(candidates.map(async (row) => {
    sent += 1;
    await logBookingEvent(row.id, 'booking_reminder_queued', {
      channel: ['email', 'sms'],
      templateVersion,
      emailPreview: buildReminderMessage({
        serviceName: row.service_name,
        staffName: row.staff_name,
        slotStart: row.slot_start,
      }).slice(0, 120),
    });
  }));

  return { sent, failed: 0 };
};

export {
  buildConfirmationMessage,
  buildReminderMessage,
  getReminderSendTime,
  processReminderWindow,
  templateVersion,
};
