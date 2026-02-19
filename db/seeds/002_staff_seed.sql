INSERT OR IGNORE INTO staff (
  id,
  display_name,
  email,
  phone,
  active
) VALUES
  (
    'stf_kevin',
    'Kevin',
    'kevin@barbershop.example',
    '+18505550100',
    1
  ),
  (
    'stf_mario',
    'Mario',
    'mario@barbershop.example',
    '+18505550101',
    1
  ),
  (
    'stf_inactive_demo',
    'Inactive Demo',
    'inactive@barbershop.example',
    '+18505550199',
    0
  );
