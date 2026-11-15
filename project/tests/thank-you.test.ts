import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOTH_DIVIDER, THANK_YOU_TEMPLATE_EN, THANK_YOU_TEMPLATE_TA, buildThankYouMessage, thanksLanguageChoice, fillKnown,
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

test('language: own last choice, else the Settings default, else Tamil', () => {
  assert.equal(thanksLanguageChoice(null, null), 'ta');
  assert.equal(thanksLanguageChoice(undefined, 'both'), 'both');
  assert.equal(thanksLanguageChoice('en', 'both'), 'en');
  assert.equal(thanksLanguageChoice('fr', 'xx'), 'ta');
});

const templates = { en: THANK_YOU_TEMPLATE_EN, ta: THANK_YOU_TEMPLATE_TA };
const nataraj = { full_name: 'Nataraj', preferred_name: null };
const food = { amount: 1100, donation_date: '2026-11-09', type: 'Food' };

test('English and Tamil alone are unchanged', () => {
  assert.equal(buildThankYouMessage(templates, nataraj, food, names, 'en'), fillKnown(THANK_YOU_TEMPLATE_EN, thankYouData(nataraj, food, names, 'en')));
  assert.equal(buildThankYouMessage(templates, nataraj, food, names, 'ta'), fillKnown(THANK_YOU_TEMPLATE_TA, thankYouData(nataraj, food, names, 'ta')));
});

test('Both: Tamil first, the divider, then English, each with its own organization name', () => {
  const text = buildThankYouMessage(templates, nataraj, food, names, 'both');
  const [ta, en] = text.split(['', '', BOTH_DIVIDER, '', ''].join('\n'));
  assert.equal(ta, buildThankYouMessage(templates, nataraj, food, names, 'ta'));
  assert.equal(en, buildThankYouMessage(templates, nataraj, food, names, 'en'));
  assert.ok(ta.startsWith('🙏  மக்கள் சேவையே மகேசன் சேவை Nataraj அவர்களுக்கு வணக்கம்'));
  assert.ok(ta.includes('9 Nov 2026 அன்று நீங்கள் வழங்கிய ₹1,100 நன்கொடைக்கு வள்ளலார் பசியாற்றும் அறக்கட்டளை சார்பாக'));
  assert.ok(ta.endsWith('நன்றியுடன்,\nவள்ளலார் பசியாற்றும் அறக்கட்டளை'));
  assert.ok(en.startsWith('🙏 Vanakkam Nataraj,'));
  assert.ok(en.includes('donation of ₹1,100 received on 9 Nov 2026.'));
  assert.ok(en.endsWith('With heartfelt gratitude,\nVP TRUST'));
  assert.deepEqual(unfilledPlaceholders(text), []);
  assert.equal(thanksBlockReason(text, food), null);
  const url = buildWhatsAppUrl('919629522777', text);
  assert.equal(decodeURIComponent(url.split('?text=')[1]), text);
  assert.ok(url.includes(encodeURIComponent(BOTH_DIVIDER)));
});

test('WhatsApp link keeps ₹, Tamil, emoji and line breaks', () => {
  const text = fillKnown(THANK_YOU_TEMPLATE_TA, thankYouData(sathish, money, names, 'ta'));
  const url = buildWhatsAppUrl('919876543210', text);
  assert.ok(url.startsWith('https://wa.me/919876543210?text='));
  assert.equal(decodeURIComponent(url.split('?text=')[1]), text);
  assert.ok(url.includes('%E2%82%B9')); // ₹
  assert.ok(url.includes('%0A')); // line break
});

test('Both follows an edited Tamil template too', () => {
  const edited = { ...templates, ta: 'வணக்கம் {{sponsor_name}} — {{amount}}\n{{organization_name}}' };
  const tamil = buildThankYouMessage(edited, nataraj, food, names, 'ta');
  assert.equal(tamil, 'வணக்கம் Nataraj — ₹1,100\nவள்ளலார் பசியாற்றும் அறக்கட்டளை');
  assert.ok(buildThankYouMessage(edited, nataraj, food, names, 'both').startsWith(`${tamil}\n\n${BOTH_DIVIDER}\n\n🙏 Vanakkam Nataraj,`));
});
