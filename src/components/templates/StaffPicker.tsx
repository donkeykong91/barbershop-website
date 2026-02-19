import Link from 'next/link';
import { useMemo, useState } from 'react';

import type { StaffMember } from '@/features/staff/types';
import { Section } from '@/components/ui/layout/Section';

type StaffPickerProps = {
  staff: StaffMember[];
};

const StaffPicker = ({ staff }: StaffPickerProps) => {
  const options = useMemo(() => {
    const activeStaff = staff.filter((member) => member.active !== false);

    if (activeStaff.some((member) => member.id === 'any')) {
      return activeStaff;
    }

    return [
      { id: 'any', displayName: 'Any barber', active: true },
      ...activeStaff,
    ];
  }, [staff]);

  const [selectedStaffId, setSelectedStaffId] = useState('any');
  const hasSpecificBarber = options.some((member) => member.id !== 'any');

  return (
    <Section
      title="Barber preference"
      description="Choose a specific barber, or leave the default as Any barber."
    >
      <div className="max-w-md rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <label
          htmlFor="staff-picker"
          className="text-sm font-medium text-gray-700"
        >
          Preferred barber
        </label>
        <select
          id="staff-picker"
          value={selectedStaffId}
          onChange={(event) => setSelectedStaffId(event.target.value)}
          className="mt-2 w-full rounded-md border border-gray-300 p-3 text-sm text-gray-900"
        >
          {options.map((member) => (
            <option key={member.id} value={member.id}>
              {member.displayName}
            </option>
          ))}
        </select>

        {!hasSpecificBarber && (
          <p className="mt-2 text-xs text-gray-600">
            No specific barbers are currently available online. We&apos;ll book
            you with any available barber.
          </p>
        )}

        <Link
          href={`/?staffId=${encodeURIComponent(selectedStaffId)}#book`}
          className="mt-3 inline-flex min-h-11 items-center justify-center rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white transition duration-200 hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 active:scale-[0.99]"
        >
          Continue to booking
        </Link>
      </div>
    </Section>
  );
};

export { StaffPicker };
