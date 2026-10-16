/*
# Death Anniversary occasion type

The Add Sponsor page now records a sponsor's family days (birthdays,
anniversaries, death anniversaries) as `special_occasions`, so the team sees
them on the sponsor page, calendar and reminders. Death anniversaries need
their own type: the reminder engine only sends automatic WhatsApp wishes for
Birthday / Wedding Anniversary / Business Anniversary, so a remembrance day
is never greeted with a "happy" message.
*/

ALTER TABLE special_occasions DROP CONSTRAINT IF EXISTS special_occasions_occasion_type_check;
ALTER TABLE special_occasions ADD CONSTRAINT special_occasions_occasion_type_check
  CHECK (occasion_type IN (
    'Birthday', 'Wedding Anniversary', 'Death Anniversary', 'Business Anniversary',
    'Achievement', 'Celebration', 'Other'
  ));
