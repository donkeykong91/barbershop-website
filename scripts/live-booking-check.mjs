const base = 'https://kevinbarbershopwebsite.vercel.app';
const headers = {
  'user-agent': 'Mozilla/5.0 test',
  'accept-language': 'en-US',
  'sec-ch-ua-platform': '"Windows"',
  'sec-ch-ua-mobile': '?0',
  'content-type': 'application/json',
};

const parseResponse = async (response) => {
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  return {
    status: response.status,
    url: response.url,
    body,
  };
};

const run = async () => {
  const services = await parseResponse(
    await fetch(`${base}/api/v1/services/`, { headers }),
  );
  const service = services.body?.data?.[0];
  if (!service) throw new Error(`No service found: ${JSON.stringify(services)}`);

  const from = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const to = new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString();

  const availability = await parseResponse(
    await fetch(
      `${base}/api/v1/availability/?serviceId=${service.id}&staffId=any&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { headers },
    ),
  );

  const slot = availability.body?.data?.[0];
  if (!slot) throw new Error(`No slot found: ${JSON.stringify(availability)}`);

  const hold = await parseResponse(
    await fetch(`${base}/api/v1/bookings/holds/`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        serviceId: service.id,
        staffId: slot.staffId,
        slotStart: slot.slotStart,
        slotEnd: slot.slotEnd,
      }),
    }),
  );

  const holdId = hold.body?.data?.id;

  const booking = await parseResponse(
    await fetch(`${base}/api/v1/bookings/`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        serviceId: service.id,
        staffId: slot.staffId,
        slotStart: slot.slotStart,
        slotEnd: slot.slotEnd,
        holdId,
        customer: {
          firstName: 'Sen',
          lastName: 'Test',
          email: `sen${Math.floor(Math.random() * 1000000)}@example.com`,
          phone: '5551234567',
        },
        consent: {
          agreeToTerms: true,
          agreeToPrivacy: true,
          agreeToBookingPolicies: true,
          marketingOptIn: false,
          smsOptIn: false,
          legalVersion: '2026-02-12',
        },
      }),
    }),
  );

  console.log(
    JSON.stringify(
      {
        serviceId: service.id,
        slot,
        hold,
        booking,
      },
      null,
      2,
    ),
  );
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
