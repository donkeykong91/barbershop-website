import { useEffect, useState } from 'react';

import type { Service } from '../features/services/types';
import type { StaffMember } from '../features/staff/types';
import { Base } from '../components/templates/Base';

const Index = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);

  useEffect(() => {
    const loadServices = async () => {
      const response = await fetch('/api/v1/services');
      const payload = (await response.json()) as { data?: Service[] };
      setServices(payload.data ?? []);
    };

    const loadStaff = async () => {
      const response = await fetch('/api/v1/staff');
      const payload = (await response.json()) as { data?: StaffMember[] };
      setStaff(payload.data ?? []);
    };

    Promise.all([loadServices(), loadStaff()]).catch(() => {
      // no-op
    });
  }, []);

  return <Base services={services} staff={staff} />;
};

export default Index;
