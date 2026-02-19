import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Background } from '@/components/ui/background/Background';
import { Button } from '@/components/ui/button/Button';
import { HeroOneButton } from '@/components/ui/hero/HeroOneButton';
import { Section } from '@/components/ui/layout/Section';
import { NavbarTwoColumns } from '@/components/ui/navigation/NavbarTwoColumns';
import { Logo } from './Logo';

const baseNavLinkClass =
  'rounded-sm px-1 py-1 transition duration-200 hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 active:scale-[0.99]';

const Hero = () => {
  const [activeSection, setActiveSection] = useState<string>('top');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const hashId = window.location.hash.replace('#', '');
    const deepLinkedSection = ['book', 'services', 'staff'].includes(hashId)
      ? hashId
      : 'top';
    setActiveSection(deepLinkedSection);

    const sectionIds = ['top', 'book', 'services', 'staff'];
    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => Boolean(node));

    if (sections.length === 0) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!window.location.hash && window.scrollY < 80) {
          setActiveSection('top');
          return;
        }

        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visibleEntry?.target?.id) {
          setActiveSection(visibleEntry.target.id);
        }
      },
      {
        rootMargin: '-20% 0px -55% 0px',
        threshold: [0.2, 0.4, 0.6],
      },
    );

    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  const isLinkActive = (sectionId: string) =>
    sectionId === 'book'
      ? activeSection === 'book' || activeSection === 'top'
      : activeSection === sectionId;

  const linkClass = (sectionId: string) =>
    `${baseNavLinkClass} ${
      isLinkActive(sectionId)
        ? 'font-semibold underline decoration-2 underline-offset-4'
        : ''
    }`;

  return (
    <Background color="bg-gray-100">
      <div id="top" className="anchor-section" aria-hidden="true" />
      <Section yPadding="py-6">
        <NavbarTwoColumns logo={<Logo xl />}>
          <li>
            <Link
              href="#book"
              className={linkClass('book')}
              aria-current={isLinkActive('book') ? 'location' : undefined}
              onClick={() => setActiveSection('book')}
            >
              Book Appointment
            </Link>
          </li>
          <li>
            <Link
              href="#services"
              className={linkClass('services')}
              aria-current={isLinkActive('services') ? 'location' : undefined}
              onClick={() => setActiveSection('services')}
            >
              Services
            </Link>
          </li>
          <li>
            <Link
              href="#staff"
              className={linkClass('staff')}
              aria-current={isLinkActive('staff') ? 'location' : undefined}
              onClick={() => setActiveSection('staff')}
            >
              Barbers
            </Link>
          </li>
        </NavbarTwoColumns>
      </Section>

      <Section yPadding="pt-20 pb-32">
        <HeroOneButton
          title={
            <>
              {'Kevin Barbershop\n'}
              <span className="text-primary-500">Fresh Cuts, Clean Style</span>
            </>
          }
          description="Book your haircut online in seconds with our free scheduler."
          button={
            <Link href="#book">
              <Button xl>Book Now</Button>
            </Link>
          }
        />
      </Section>
    </Background>
  );
};

export { Hero };
