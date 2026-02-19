INSERT OR IGNORE INTO staff_availability (
  id,
  staff_id,
  day_of_week,
  start_time_local,
  end_time_local,
  timezone,
  is_available
)
SELECT
  'avl_' || s.id || '_' || d.day_of_week,
  s.id,
  d.day_of_week,
  '09:00',
  '17:00',
  'America/Los_Angeles',
  1
FROM staff s
CROSS JOIN (
  SELECT 1 AS day_of_week UNION ALL
  SELECT 2 UNION ALL
  SELECT 3 UNION ALL
  SELECT 4 UNION ALL
  SELECT 5
) d
WHERE s.active = 1;