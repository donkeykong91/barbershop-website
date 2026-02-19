import Link from 'next/link';

import { Section } from '@/components/ui/layout/Section';
import type { Service } from '@/features/services/types';

type ServiceCatalogProps = {
  services: Service[];
};

const formatPrice = (priceCents: number, currency: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(priceCents / 100);

const ServiceCatalog = ({ services }: ServiceCatalogProps) => (
  <Section
    title="Services"
    description="Choose a service and duration that fits your appointment."
  >
    <div className="grid gap-4 sm:grid-cols-2">
      {services.map((service) => {
        const canBook = service.active && service.bookable;

        return (
          <article
            key={service.id}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-xl font-semibold text-gray-900">
                {service.name}
              </h3>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  canBook
                    ? 'bg-primary-50 text-primary-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {canBook ? 'Available online' : 'Call to book'}
              </span>
            </div>

            <p className="mt-2 text-gray-600">{service.description}</p>

            <div className="mt-4 flex items-center justify-between text-sm text-gray-700">
              <span>{service.durationMin} min</span>
              <span className="font-semibold text-gray-900">
                {formatPrice(service.priceCents, service.currency)}
              </span>
            </div>

            <div className="mt-4">
              {canBook ? (
                <Link
                  href={`/?serviceId=${encodeURIComponent(service.id)}#book`}
                  className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white transition duration-200 hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 active:scale-[0.99]"
                >
                  Book this service
                </Link>
              ) : (
                <p className="text-sm font-medium text-amber-700">
                  Not available for online booking right now.
                </p>
              )}
            </div>
          </article>
        );
      })}
    </div>
  </Section>
);

export { ServiceCatalog };
