/*
# Rebrand default organization name to VP Trust

The initial schema seeded organization_settings.name as 'Sponsor Care'.
This renames the existing row so already-provisioned databases pick up
the new product name without needing a manual edit in Settings.
*/

UPDATE organization_settings
SET name = 'VP Trust'
WHERE name IN ('Sponsor Care', 'Sponsa');
