import { Meta } from '../components/ui/layout/Meta';
import { Section } from '../components/ui/layout/Section';
import { Footer } from '../components/templates/Footer';
import { AppConfig } from '../utils/AppConfig';

const AccessibilityPage = () => (
  <div className="text-gray-700 antialiased">
    <Meta
      title={`Accessibility | ${AppConfig.site_name}`}
      description="Accessibility statement for Kevin Barbershop website."
    />
    <Section yPadding="py-8">
      <h1 className="text-3xl font-bold text-gray-900">
        Accessibility Statement
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        Effective date: {AppConfig.legalVersion}
      </p>
      <div className="mt-6 space-y-4 text-sm leading-6">
        <p>
          We aim to provide an accessible booking experience and target
          conformance with WCAG 2.1 Level AA.
        </p>
        <p>
          If you experience difficulty using this site or need an accommodation
          to book services, contact us at{' '}
          <a
            className="underline"
            href={`mailto:${AppConfig.accessibilityEmail}`}
          >
            {AppConfig.accessibilityEmail}
          </a>{' '}
          or call{' '}
          <a className="underline" href={`tel:${AppConfig.shopPhoneE164}`}>
            {AppConfig.shopPhoneDisplay}
          </a>
          .
        </p>
        <p>
          We review reported issues and prioritize remediation as quickly as
          possible.
        </p>
      </div>
    </Section>
    <Footer />
  </div>
);

export default AccessibilityPage;
