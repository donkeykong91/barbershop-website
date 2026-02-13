import { useState } from 'react';
import { useRouter } from 'next/router';

const ReschedulePage = () => {
  const router = useRouter();
  const bookingId = typeof router.query.bookingId === 'string' ? router.query.bookingId : '';
  const token = typeof router.query.token === 'string' ? router.query.token : '';
  const [slotStart, setSlotStart] = useState('');
  const [slotEnd, setSlotEnd] = useState('');
  const [message, setMessage] = useState('');

  const submit = async () => {
    const response = await fetch(`/api/v1/bookings/${bookingId}/reschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, slotStart, slotEnd }),
    });
    const payload = await response.json();
    setMessage(response.ok ? 'Reschedule complete.' : payload.error?.message ?? 'Unable to reschedule');
  };

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-xl font-bold">Reschedule Appointment</h1>
      <p className="mt-2 text-sm text-gray-600">Choose your new time range in ISO format.</p>
      <input className="mt-4 w-full rounded border p-2" placeholder="slotStart" value={slotStart} onChange={(e) => setSlotStart(e.target.value)} />
      <input className="mt-2 w-full rounded border p-2" placeholder="slotEnd" value={slotEnd} onChange={(e) => setSlotEnd(e.target.value)} />
      <button type="button" onClick={submit} className="mt-3 rounded bg-black px-4 py-2 text-white">Submit</button>
      {message && <p className="mt-3 text-sm">{message}</p>}
    </main>
  );
};

export default ReschedulePage;
