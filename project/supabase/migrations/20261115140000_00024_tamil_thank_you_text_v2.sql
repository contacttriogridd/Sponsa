-- ============================================================
-- Tamil thank-you note: replace the saved copy with the NEW approved
-- text (adds மதிப்பிற்குரிய, கருணையுடன், எங்களின், உங்களின்).
--
-- Overwrites organization_settings.thank_you_template_ta (Settings ->
-- Message Templates -> Thank-You Note -> Tamil). "Reset to default"
-- restores this same text. The தமிழ் and "Both" options in Send Thanks
-- both read this one template. The English template is not changed.
-- Donation records are not touched.
-- ============================================================

UPDATE organization_settings SET
  thank_you_template_ta = $tpl$🙏  மக்கள் சேவையே மகேசன் சேவை மதிப்பிற்குரிய {{sponsor_name}} அவர்களுக்கு வணக்கம் 

{{donation_date}} அன்று நீங்கள் கருணையுடன் வழங்கிய {{amount}} நன்கொடைக்கு {{organization_name}} சார்பாக எங்களின் மனமார்ந்த வாழ்த்துக்களையும் நன்றிகளையும் தெரிவித்துக் கொள்கிறோம்.

வள்ளலார் காட்டிய வழியில் பசித்தவர்களுக்கு உணவளிக்கும் எங்கள் சேவையைத் தொடர உங்களின் மேலான உதவி பெரிதும் ஊக்கமளிக்கிறது. 

நன்றியுடன்,
{{organization_name}}$tpl$;
