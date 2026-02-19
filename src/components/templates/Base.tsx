import { useEffect } from 'react';

import type { Service } from '@/features/services/types';
import type { StaffMember } from '@/features/staff/types';
import { Meta } from '@/components/ui/layout/Meta';
import { AppConfig } from '@/utils/AppConfig';
import { Banner } from './Banner';
import { Footer } from './Footer';
import { Hero } from './Hero';
import { Scheduler } from './Scheduler';
import { ServiceCatalog } from './ServiceCatalog';
import { Sponsors } from './Sponsors';
import { StaffPicker } from './StaffPicker';

type BaseProps = {
  services: Service[];
  staff: StaffMember[];
};

const Base = ({ services, staff }: BaseProps) => {
  useEffect(() => {
    const focusHashTarget = () => {
      const hash = window.location.hash.replace('#', '');
      if (!hash) {
        return;
      }

      const target = document.getElementById(hash);
      if (!target) {
        return;
      }

      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    };

    focusHashTarget();
    window.addEventListener('hashchange', focusHashTarget);

    return () => {
      window.removeEventListener('hashchange', focusHashTarget);
    };
  }, []);

  return (
    <div className="text-gray-600 antialiased">
      <Meta title={AppConfig.title} description={AppConfig.description} />
      <Hero />
      <Sponsors />
      <div id="services" className="anchor-section">
        <ServiceCatalog services={services} />
      </div>
      <div id="staff" className="anchor-section">
        <StaffPicker staff={staff} />
      </div>
      <Scheduler services={services} staff={staff} />
      <Banner />
      <Footer />
    </div>
  );
};

export { Base };
