INSERT OR IGNORE INTO business_hours (
  id,
  day_of_week,
  open_time_local,
  close_time_local,
  timezone,
  is_open
) VALUES
  ('biz_0', 0, '09:00', '17:00', 'America/Los_Angeles', 0),
  ('biz_1', 1, '09:00', '17:00', 'America/Los_Angeles', 1),
  ('biz_2', 2, '09:00', '17:00', 'America/Los_Angeles', 1),
  ('biz_3', 3, '09:00', '17:00', 'America/Los_Angeles', 1),
  ('biz_4', 4, '09:00', '17:00', 'America/Los_Angeles', 1),
  ('biz_5', 5, '09:00', '17:00', 'America/Los_Angeles', 1),
  ('biz_6', 6, '09:00', '17:00', 'America/Los_Angeles', 0);
