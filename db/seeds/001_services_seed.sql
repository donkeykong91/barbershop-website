INSERT OR IGNORE INTO services (
  id,
  name,
  description,
  duration_min,
  price_cents,
  currency,
  active,
  visible,
  bookable,
  display_order
) VALUES
  (
    'svc_classic_cut',
    'Classic Haircut',
    'Traditional scissor and clipper cut with clean finish.',
    30,
    3500,
    'USD',
    1,
    1,
    1,
    10
  ),
  (
    'svc_beard_trim',
    'Beard Trim',
    'Shape-up, line-up, and beard detailing.',
    20,
    2500,
    'USD',
    0,
    1,
    0,
    20
  ),
  (
    'svc_membership_consult',
    'Membership Consultation',
    'Private consultation for recurring service plans.',
    15,
    0,
    'USD',
    1,
    0,
    0,
    30
  );
