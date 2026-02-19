import Link from 'next/link';

import { Footer } from '../components/templates/Footer';
import { Meta } from '../components/ui/layout/Meta';
import { Section } from '../components/ui/layout/Section';
import { AppConfig } from '../utils/AppConfig';

const TermsPage = () => (
  <div className="text-gray-700 antialiased">
    <Meta
      title={`Terms | ${AppConfig.site_name}`}
      description="Booking terms for Kevin Barbershop online appointments."
    />
    <Section yPadding="py-8">
      <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
      <p className="mt-2 text-sm text-gray-600">
        Effective date: {AppConfig.legalVersion}
      </p>
      <div className="mt-6 space-y-4 text-sm leading-6">
        <p>
          These terms govern online appointment booking with{' '}
          {AppConfig.legalBusinessName}.
        </p>
        <p>
          <strong>Payment:</strong> Payment is due in-shop and currently cash
          only unless otherwise posted.
        </p>
        <p>
          <strong>Rescheduling and cancellation:</strong> You may reschedule or
          cancel up to {AppConfig.cancellationCutoffHours} hours before your
          appointment. Late cancellations/no-shows may be charged up to 100% of
          the service price.
        </p>
        <p>
          <strong>Refund policy:</strong> Refunds are issued when we cancel your
          appointment or cannot provide the booked service.
        </p>
        <p>
          <strong>Disputes and governing law:</strong> These terms are governed
          by California law, with venue in Los Angeles County, California,
          unless otherwise required by law.
        </p>
        <p>
          <strong>Contact:</strong> {AppConfig.legalBusinessName},{' '}
          {AppConfig.legalAddress},{' '}
          <a className="underline" href={`mailto:${AppConfig.supportEmail}`}>
            {AppConfig.supportEmail}
          </a>
          .
        </p>
        <p>
          <Link className="underline" href="/privacy">
            View Privacy Policy
          </Link>
        </p>
      </div>
    </Section>
    <Footer />
  </div>
);

export default TermsPage;
