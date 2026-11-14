import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  THANK_YOU_TEMPLATE_EN, THANK_YOU_TEMPLATE_TA, defaultThanksLanguage, fillKnown,
  formatDonationDate, formatThanksAmount, thankYouData, thankYouTemplatesFrom, thanksBlockReason, unfilledPlaceholders,
} from '@/lib/thank-you';

// Same as buildWhatsAppUrl in lib/whatsapp (which needs the Supabase client to load).
const buildWhatsAppUrl = (phone: string, message: string) => `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;

const names = { org_name_en: 'VP TRUST', org_name_ta: 'வள்ளலார் பசியாற்றும் அறக்கட்டளை' };
const sathish = { full_name: 'Sathish', preferred_name: null };
const money = { amount: 5000, donation_date: '2026-11-13', type: 'Money' };

test('amount is Indian style with ₹ and no decimals', () => {
  assert.equal(formatThanksAmount(5000), '₹5,000');
  assert.equal(formatThanksAmount(1100), '₹1,100');
  assert.equal(formatThanksAmount(100000), '₹1,00,000');
  assert.equal(formatThanksAmount('2500.75'), '₹2,501');
  assert.equal(formatThanksAmount(0), '');
  assert.equal(formatThanksAmount(null), '');
});

test('donation date reads like 13 Nov 2026', () => {
  assert.equal(formatDonationDate('2026-11-13'), '13 Nov 2026');
  assert.equal(formatDonationDate('2026-11-03'), '3 Nov 2026');
});

test('English note fills every placeholder', () => {
  const text = fillKnown(THANK_YOU_TEMPLATE_EN, thankYouData(sathish, money, names, 'en'));
  assert.ok(text.startsWith('🙏 Vanakkam Sathish,\n\nOn behalf of VP TRUST,'));
  assert.ok(text.includes('donation of ₹5,000 received on 13 Nov 2026.'));
  assert.ok(text.endsWith('With heartfelt gratitude,\nVP TRUST'));
  assert.deepEqual(unfilledPlaceholders(text), []);
  assert.equal(thanksBlockReason(text, money), null);
});

test('Tamil note uses the Tamil organization name', () => {
  const food = { amount: 1100, donation_date: '2026-11-13', type: 'Food' };
  const text = fillKnown(THANK_YOU_TEMPLATE_TA, thankYouData({ full_name: 'Ganeshan', preferred_name: null }, food, names, 'ta'));
  assert.ok(text.includes('Ganeshan அவர்களுக்கு வணக்கம்'));
  assert.ok(text.includes('13 Nov 2026 அன்று நீங்கள் வழங்கிய ₹1,100 நன்கொடைக்கு வள்ளலார் பசியாற்றும் அறக்கட்டளை சார்பாக'));
  assert.ok(text.endsWith('நன்றியுடன்,\nவள்ளலார் பசியாற்றும் அறக்கட்டளை'));
  assert.deepEqual(unfilledPlaceholders(text), []);
});

test('a missing or 0 amount blocks the send instead of saying ₹0', () => {
  const none = { ...money, amount: 0 };
  const text = fillKnown(THANK_YOU_TEMPLATE_EN, thankYouData(sathish, none, names, 'en'));
  assert.ok(!text.includes('₹0'));
  assert.deepEqual(unfilledPlaceholders(text), ['{{amount}}']);
  assert.match(thanksBlockReason(text, none)!, /update the donation amount/);
});

test('a raw placeholder typed into the message blocks the send', () => {
  assert.match(thanksBlockReason('Hello {{ unknown }}', money)!, /\{\{ unknown \}\}/);
});

test('saved templates win; empty ones fall back to the defaults', () => {
  assert.deepEqual(thankYouTemplatesFrom({ thank_you_template_en: 'Hi {{sponsor_name}}', thank_you_template_ta: '  ' }),
    { en: 'Hi {{sponsor_name}}', ta: THANK_YOU_TEMPLATE_TA });
  assert.deepEqual(thankYouTemplatesFrom(null), { en: THANK_YOU_TEMPLATE_EN, ta: THANK_YOU_TEMPLATE_TA });
});

test('language defaults to Tamil unless the sponsor prefers English', () => {
  assert.equal(defaultThanksLanguage({}), 'ta');
  assert.equal(defaultThanksLanguage({ preferred_language: 'en' }), 'en');
});

test('WhatsApp link keeps ₹, Tamil, emoji and line breaks', () => {
  const text = fillKnown(THANK_YOU_TEMPLATE_TA, thankYouData(sathish, money, names, 'ta'));
  const url = buildWhatsAppUrl('919876543210', text);
  assert.ok(url.startsWith('https://wa.me/919876543210?text='));
  assert.equal(decodeURIComponent(url.split('?text=')[1]), text);
  assert.ok(url.includes('%E2%82%B9')); // ₹
  assert.ok(url.includes('%0A')); // line break
});
