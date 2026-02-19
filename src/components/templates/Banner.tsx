import Link from 'next/link';

import { Button } from '@/components/ui/button/Button';
import { CTABanner } from '@/components/ui/cta/CTABanner';
import { Section } from '@/components/ui/layout/Section';

const Banner = () => (
  <Section>
    <CTABanner
      title="Ready for a fresh cut this week?"
      subtitle="Book online in under a minute — pay cash at the shop."
      button={
        <Link href="#book">
          <Button>Book Appointment</Button>
        </Link>
      }
    />
  </Section>
);

export { Banner };
