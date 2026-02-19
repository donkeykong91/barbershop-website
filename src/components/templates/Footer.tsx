import Link from 'next/link';

import { Background } from '@/components/ui/background/Background';
import { CenteredFooter } from '@/components/ui/footer/CenteredFooter';
import { Section } from '@/components/ui/layout/Section';
import { AppConfig } from '@/utils/AppConfig';

import { Logo } from './Logo';

const Footer = () => (
  <Background color="bg-gray-100">
    <Section>
      <CenteredFooter logo={<Logo />} iconList={<></>}>
        <li>
          <Link href="/#book">Book Appointment</Link>
        </li>
        <li>
          <Link href="/#services">Services</Link>
        </li>
        <li>
          <Link href="/#staff">Barbers</Link>
        </li>
        <li>
          <Link href="/privacy">Privacy Policy</Link>
        </li>
        <li>
          <Link href="/terms">Terms</Link>
        </li>
        <li>
          <Link href="/accessibility">Accessibility</Link>
        </li>
        <li>
          <a
            href={`tel:${AppConfig.shopPhoneE164}`}
            className="rounded-md border border-primary-500 bg-primary-500 px-4 py-3 font-semibold text-white"
            aria-label={`Call the shop at ${AppConfig.shopPhoneDisplay}`}
          >
            Call {AppConfig.shopPhoneDisplay}
          </a>
        </li>
        <li>
          <a
            href={`mailto:${AppConfig.supportEmail}`}
            className="rounded-md border border-primary-500 bg-white px-4 py-3 font-semibold text-primary-700"
          >
            Email support
          </a>
        </li>
      </CenteredFooter>
      <div className="mt-4 text-center text-xs text-gray-600">
        <p>{AppConfig.legalBusinessName}</p>
        <p>{AppConfig.legalAddress}</p>
      </div>
    </Section>
  </Background>
);

export { Footer };
