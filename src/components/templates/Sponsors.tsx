import { Section } from '@/components/ui/layout/Section';

const highlights = [
  {
    title: 'Trusted local shop',
    detail:
      'Experienced barbers focused on clean fades, classic cuts, and consistent service.',
  },
  {
    title: 'Convenient shop hours',
    detail:
      'Open daily with online booking windows clearly shown in Pacific Time.',
  },
  {
    title: 'Straightforward policies',
    detail:
      'Book online in under a minute. Payment is collected in-shop (cash only).',
  },
  {
    title: 'Comfort-first experience',
    detail:
      'Sanitized tools, friendly service, and flexible barber preference options.',
  },
];

const Sponsors = () => (
  <Section
    title="Why clients choose Kevin Barbershop"
    description="Everything you need to book with confidence."
  >
    <div className="grid gap-4 sm:grid-cols-2">
      {highlights.map((item) => (
        <article
          key={item.title}
          className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h3 className="text-base font-semibold text-gray-900">
            {item.title}
          </h3>
          <p className="mt-2 text-sm text-gray-600">{item.detail}</p>
        </article>
      ))}
    </div>
  </Section>
);

export { Sponsors };
