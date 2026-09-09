/*
# Rebrand default organization name to Sponsa

The initial schema seeded organization_settings.name as 'Sponsor Care'.
This renames the existing row so already-provisioned databases pick up
the new product name without needing a manual edit in Settings.
*/

UPDATE organization_settings
SET name = 'Sponsa'
WHERE name = 'Sponsor Care';
