import Link from 'next/link';

import { Meta } from '../components/ui/layout/Meta';
import { Section } from '../components/ui/layout/Section';
import { Footer } from '../components/templates/Footer';
import { AppConfig } from '../utils/AppConfig';

const PrivacyPage = () => (
  <div className="text-gray-700 antialiased">
    <Meta
      title={`Privacy Policy | ${AppConfig.site_name}`}
      description="Privacy Policy for Kevin Barbershop online booking."
    />
    <Section yPadding="py-8">
      <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-gray-600">
        Effective date: {AppConfig.legalVersion}
      </p>
      <div className="mt-6 space-y-4 text-sm leading-6">
        <p>
          {AppConfig.legalBusinessName} collects contact and booking information
          (name, email, phone, appointment details, and notes) to schedule,
          confirm, and service your appointment.
        </p>
        <p>
          We may use your contact information for appointment reminders and
          operational messages. Marketing messages are sent only if you opt in.
        </p>
        <p>
          We retain booking records as needed for operations, dispute handling,
          legal compliance, and fraud prevention.
        </p>
        <p>
          <strong>Your rights:</strong> You may request access, correction,
          deletion, and a copy of your personal data. Submit requests to{' '}
          <a className="underline" href={`mailto:${AppConfig.privacyEmail}`}>
            {AppConfig.privacyEmail}
          </a>
          .
        </p>
        <p>
          For general support, contact{' '}
          <a className="underline" href={`mailto:${AppConfig.supportEmail}`}>
            {AppConfig.supportEmail}
          </a>{' '}
          or call{' '}
          <a className="underline" href={`tel:${AppConfig.shopPhoneE164}`}>
            {AppConfig.shopPhoneDisplay}
          </a>
          .
        </p>
        <p>Address: {AppConfig.legalAddress}</p>
        <p>
          <Link className="underline" href="/terms">
            View Terms
          </Link>
        </p>
      </div>
    </Section>
    <Footer />
  </div>
);

export default PrivacyPage;
