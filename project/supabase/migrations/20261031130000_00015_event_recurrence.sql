-- ============================================================
-- Repeating events: daily, weekly, monthly, yearly.
--
-- Added to special_occasions and sponsorship_requests:
--   recurrence    none | daily | weekly | monthly | yearly
--                 (NULL on an occasion means: follow recurring_yearly)
--   weekdays      0 (Sunday) to 6, for weekly
--   day_of_month  1 to 31, for monthly
--   start_date, end_date (no end_date = no end)
-- Whether an event happens on a date is decided in lib/recurrence.ts.
-- ============================================================

ALTER TABLE special_occasions
  ADD COLUMN IF NOT EXISTS recurrence text CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly', 'yearly')),
  ADD COLUMN IF NOT EXISTS weekdays smallint[],
  ADD COLUMN IF NOT EXISTS day_of_month smallint CHECK (day_of_month BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date;

ALTER TABLE sponsorship_requests
  ADD COLUMN IF NOT EXISTS recurrence text CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly', 'yearly')),
  ADD COLUMN IF NOT EXISTS weekdays smallint[],
  ADD COLUMN IF NOT EXISTS day_of_month smallint CHECK (day_of_month BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- One reminder per occasion per DATE, so a daily event can remind every day.
-- (Yearly occasions behave as before: their reminder dates differ each year.)
DROP INDEX IF EXISTS idx_reminders_dedup;
CREATE UNIQUE INDEX IF NOT EXISTS idx_reminders_dedup_date ON reminders (occasion_id, reminder_date, days_before);
