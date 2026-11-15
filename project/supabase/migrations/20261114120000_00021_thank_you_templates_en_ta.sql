-- ============================================================
-- English and Tamil donation thank-you notes, with the amount.
--
--   organization_settings.thank_you_template_en / _ta
--     edited in Settings -> Message Templates -> Thank-You Note.
--     Placeholders: {{sponsor_name}}, {{amount}}, {{donation_date}}, {{organization_name}}.
--
-- Seeds the default texts only where empty; saved edits are kept if this
-- runs again. Donation records are not touched.
-- ============================================================

ALTER TABLE organization_settings
  ADD COLUMN IF NOT EXISTS thank_you_template_en text,
  ADD COLUMN IF NOT EXISTS thank_you_template_ta text;

UPDATE organization_settings SET thank_you_template_en = $tpl$🙏 Vanakkam {{sponsor_name}},

On behalf of {{organization_name}}, we sincerely thank you for your generous donation of {{amount}} received on {{donation_date}}.

Your kindness helps us continue our service of feeding the hungry, in the path shown by Vallalar. Every rupee you give reaches someone in need.

With heartfelt gratitude,
{{organization_name}}$tpl$
WHERE thank_you_template_en IS NULL OR btrim(thank_you_template_en) = '';

UPDATE organization_settings SET thank_you_template_ta = $tpl$🙏  மக்கள் சேவையே மகேசன் சேவை மதிப்பிற்குரிய {{sponsor_name}} அவர்களுக்கு வணக்கம் 

{{donation_date}} அன்று நீங்கள் கருணையுடன் வழங்கிய {{amount}} நன்கொடைக்கு {{organization_name}} சார்பாக எங்களின் மனமார்ந்த வாழ்த்துக்களையும் நன்றிகளையும் தெரிவித்துக் கொள்கிறோம்.

வள்ளலார் காட்டிய வழியில் பசித்தவர்களுக்கு உணவளிக்கும் எங்கள் சேவையைத் தொடர உங்களின் மேலான உதவி பெரிதும் ஊக்கமளிக்கிறது. 

நன்றியுடன்,
{{organization_name}}$tpl$
WHERE thank_you_template_ta IS NULL OR btrim(thank_you_template_ta) = '';
