const baseUrl = 'http://127.0.0.1:3001';

async function req(path, options = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'content-type': 'application/json',
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    return { ok: res.ok, status: res.status, json };
  } catch (e) {
    return { ok: false, status: 0, json: { error: String(e) } };
  } finally {
    clearTimeout(t);
  }
}

const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

(async () => {
  const report = { passes: [], defects: [] };
  const services = await req('/api/v1/services/');
  const staffRes = await req('/api/v1/staff/');
  const service = (services.json?.data || []).find((s) => s.bookable);
  const staff = (staffRes.json?.data || []).filter((s) => s.id !== 'any');
  if (!service) throw new Error('No bookable service');

  for (let i = 1; i <= 15; i++) {
    const pass = { pass: i, status: 'PASS', bookingId: null };
    const from = addDays(new Date(), 1 + (i % 3));
    const to = addDays(from, 7 + (i % 2) * 7);
    const qs = new URLSearchParams({
      serviceId: service.id,
      from: from.toISOString(),
      to: to.toISOString(),
    });
    const pref = staff[(i - 1) % staff.length]?.id;
    if (pref && i % 4 !== 0) qs.set('staffId', pref);

    const ip = `198.51.100.${i}`;
    const headers = { 'x-forwarded-for': ip };

    const av = await req(`/api/v1/availability/?${qs.toString()}`, { headers });
    const slots = Array.isArray(av.json?.data) ? av.json.data : [];
    if (!av.ok || !slots.length) {
      pass.status = 'FAIL';
      report.defects.push({
        category: 'Code',
        pass: i,
        title: 'Availability request returned no slots/error',
        evidence: { status: av.status, body: av.json, qs: qs.toString() },
      });
      report.passes.push(pass);
      continue;
    }
    const slot = slots[Math.min(slots.length - 1, i % slots.length)];
    const payload = {
      serviceId: service.id,
      staffId: slot.staffId || pref,
      slotStart: slot.slotStart,
      slotEnd: slot.slotEnd,
      customer: {
        firstName: `QA${i}`,
        lastName: 'Flow',
        email: `qa${Date.now()}_${i}@example.com`,
        phone: `+1555${String(1200000 + i).slice(-7)}`,
      },
      notes: `qa pass ${i}`,
    };
    const create = await req('/api/v1/bookings/', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const bid = create.json?.data?.id;
    const token = create.json?.data?.accessToken;
    if (!create.ok || !bid || !token) {
      pass.status = 'FAIL';
      report.defects.push({
        category: 'Code',
        pass: i,
        title: 'Booking create failed/missing token',
        evidence: { status: create.status, body: create.json },
      });
      report.passes.push(pass);
      continue;
    }
    pass.bookingId = bid;

    const detail = await req(`/api/v1/bookings/${bid}/`, {
      headers: { ...headers, 'x-booking-access-token': token },
    });
    if (!detail.ok) {
      pass.status = 'FAIL';
      report.defects.push({
        category: 'Code',
        pass: i,
        title: 'Booking detail fetch failed with valid token',
        evidence: { status: detail.status, body: detail.json, bid },
      });
    }

    const conf = await req(`/api/v1/bookings/${bid}/confirmation/`, {
      headers: { ...headers, 'x-booking-access-token': token },
    });
    if (!conf.ok) {
      pass.status = 'FAIL';
      report.defects.push({
        category: 'Code',
        pass: i,
        title: 'Booking confirmation fetch failed with valid token',
        evidence: { status: conf.status, body: conf.json, bid },
      });
    }

    if (i % 5 === 0) {
      const cancel = await req(`/api/v1/bookings/${bid}/cancel/`, {
        method: 'POST',
        headers: { ...headers, 'x-booking-access-token': token },
      });
      if (!cancel.ok) {
        pass.status = 'FAIL';
        report.defects.push({
          category: 'Code',
          pass: i,
          title: 'Booking cancel failed with valid token',
          evidence: { status: cancel.status, body: cancel.json, bid },
        });
      }
    }

    report.passes.push(pass);
    console.log(`pass ${i}: ${pass.status} ${bid || ''}`);
  }

  console.log('FINAL_REPORT_START');
  console.log(JSON.stringify(report, null, 2));
})();
