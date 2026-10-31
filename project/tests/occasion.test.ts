import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OCCASION_TEMPLATES, fillOccasionMessage, occasionContact, occasionKeyOf, occasionSendLabel, occasionTemplateType, occasionTitle, occasionVariables,
  type OccasionLike,
} from '@/lib/occasion-details';
import { DEFAULT_ORGANIZATION_NAMES as ORG } from '@/lib/organization';
import { DEFAULT_OCCASION_TYPES, draftToRow, newDraft, validateDraft } from '@/lib/occasion-draft';
import { buildDailySummary } from '@/lib/messaging';
import { buildReminderItems, type ReminderSources } from '@/lib/today-reminders';

const ravi = { full_name: 'Ravi Kumar', title: 'Mr' as const, phone: '919876543210', whatsapp: null };
const message = (o: OccasionLike, sponsor: typeof ravi = ravi) =>
  fillOccasionMessage(OCCASION_TEMPLATES[occasionTemplateType(o)].body, occasionVariables(o, sponsor, '2026-10-31', ORG));
const arun: OccasionLike = { person_name: 'Arun', relationship: 'Son', occasion_type: 'Birthday', occasion_type_key: 'family_birthday' };
const father: OccasionLike = {
  person_name: 'Late Muthusamy', relationship: 'Father', occasion_type: 'Death Anniversary', occasion_type_key: 'death_anniversary',
  linked_donation_type: 'Food',
};

test("son's birthday message, in English then Tamil", () => {
  const m = message(arun);
  assert.ok(m.includes('Warm birthday wishes to your beloved son, Arun!'));
  assert.ok(m.includes('உங்கள் அன்பு மகன் Arun அவர்களுக்கு'));
  assert.ok(m.includes('அன்புள்ள திரு. Ravi Kumar அவர்களுக்கு,'));
  assert.ok(m.indexOf('Dear Ravi Kumar') < m.indexOf('அருட்பெருஞ்ஜோதி'));
  assert.ok(m.endsWith('VP TRUST\n(வள்ளலார் பசியாற்றும் அறக்கட்டளை)'));
  assert.ok(!m.includes('{{'));
});

test('no donation: the donation line and its gap are removed', () => {
  const m = message(arun);
  assert.ok(!/being offered|வழங்கப்படுகிறது/.test(m));
  assert.ok(m.includes('joy always.\nWith warm wishes,'));
  assert.ok(!m.includes('\n\n\n'));
});

test('remembrance: respectful, with the donation line and no celebration words', () => {
  const m = message(father);
  assert.ok(!/happy|wishes|celebrat/i.test(m), m);
  assert.ok(!m.includes('வாழ்த்து'));
  assert.ok(m.includes('Late Muthusamy') && !m.includes('Late Late'));
  assert.ok(m.includes('அமரர் Muthusamy') && m.includes('தந்தையார்'));
  assert.ok(m.includes('In their loving memory, Food is being offered to those in need today.'));
  assert.ok(m.includes('அவர்களின் நினைவாக இன்று ஆதரவற்றோருக்கு உணவு வழங்கப்படுகிறது.'));
  assert.equal(occasionSendLabel(father), 'Send Remembrance Message');
});

test('a Mrs contact gets திருமதி. in Tamil', () => {
  const m = message({ ...arun, contact_name: 'Meena', contact_title: 'Mrs' });
  assert.ok(m.includes('அன்புள்ள திருமதி. Meena அவர்களுக்கு,'));
  assert.ok(m.startsWith('Dear Meena,'));
});

test('no title: no stray space or raw placeholder', () => {
  const m = message(arun, { ...ravi, title: null as unknown as 'Mr' });
  assert.ok(m.includes('அன்புள்ள Ravi Kumar அவர்களுக்கு,'));
});

test("own day drops relationship words; a child's anniversary keeps them", () => {
  const own = message({ person_name: 'Ravi Kumar', relationship: 'Self', occasion_type: 'Wedding Anniversary' });
  assert.ok(own.includes('Heartfelt wishes on your wedding anniversary!'));
  assert.ok(own.includes('இன்று திருமண நாள் காணும் உங்களுக்கும் உங்கள் துணைவருக்கும்'));
  const son = message({ person_name: 'Arun', relationship: 'Son', occasion_type: 'Wedding Anniversary' });
  assert.ok(son.includes('the wedding anniversary of your son Arun'));
  assert.ok(son.includes('உங்கள் அன்பு மகன் Arun தம்பதியருக்கு'));
  const birthday = message({ person_name: 'Ravi Kumar', relationship: 'Self', occasion_type: 'Birthday' });
  assert.ok(birthday.includes('Wishing you a very Happy Birthday!') && !birthday.includes('beloved'));
});

test('a custom birthday type with no relationship reads as their own', () => {
  const m = message({ person_name: 'Ravi Kumar', relationship: 'Self', occasion_type: 'Birthday', occasion_type_key: 'custom_birthday' });
  assert.ok(m.includes('Wishing you a very Happy Birthday!') && !m.includes('beloved'));
});

test('other occasion uses its own name', () => {
  const m = message({ person_name: 'Ravi Kumar', relationship: 'Self', occasion_type: 'Other', occasion_name_en: 'House Warming', occasion_name_ta: 'புதுமனை புகுவிழா' });
  assert.ok(m.includes('Warm wishes on the occasion of House Warming!') && m.includes('புதுமனை புகுவிழா நன்னாளில்'));
});

test('titles and contact default to the sponsor', () => {
  assert.equal(occasionTitle(arun, 'Ravi Kumar'), "Arun's Birthday (Son of Ravi Kumar)");
  assert.equal(occasionTitle(father, 'Senthil'), 'Remembrance Day – Late Muthusamy (Father of Senthil)');
  assert.deepEqual(occasionContact(arun, ravi), { name: 'Ravi Kumar', title: 'Mr', phone: '919876543210' });
  assert.deepEqual(occasionContact({ ...arun, contact_name: 'Meena', contact_phone: '919000000000' }, ravi), { name: 'Meena', title: null, phone: '919000000000' });
});

test('old rows with no type key still work', () => {
  assert.equal(occasionKeyOf({ person_name: 'A', occasion_type: 'Birthday', relationship: 'Self' }), 'self_birthday');
  assert.equal(occasionKeyOf({ person_name: 'A', occasion_type: 'Birthday', relationship: 'Son' }), 'family_birthday');
  assert.equal(occasionKeyOf({ person_name: 'A', occasion_type: 'Birthday', relationship: null, family_member_id: 'f' }), 'family_birthday');
  assert.equal(occasionKeyOf({ person_name: 'A', occasion_type: 'Death Anniversary' }), 'death_anniversary');
});

test('form rules: required fields, phone normalised, defaults to the sponsor', () => {
  const types = DEFAULT_OCCASION_TYPES;
  const family = types.find((t) => t.key === 'family_birthday');
  const sponsor = { name: 'Ravi Kumar', phone: '9876543210', dob: '1980-01-15' };
  const d = newDraft('family_birthday');
  assert.match(validateDraft(d, family, sponsor)!, /date is required/);
  d.occasion_date = '2015-10-31';
  assert.match(validateDraft(d, family, sponsor)!, /relationship is required/);
  d.relationship = 'Son';
  assert.match(validateDraft(d, family, sponsor)!, /name is required/);
  d.person_name = 'Arun';
  assert.equal(validateDraft(d, family, sponsor), null);
  d.contact_phone = '123';
  assert.match(validateDraft(d, family, sponsor)!, /valid 10-digit/);
  d.contact_phone = '96295 22777';
  const row = draftToRow(d, family, 's', sponsor);
  assert.equal(row.contact_phone, '919629522777');
  assert.equal(row.occasion_type, 'Birthday');
  assert.equal(row.occasion_type_key, 'family_birthday');
  assert.equal(row.recurrence, 'yearly');
  assert.equal(row.contact_name, null);
  const own = newDraft('self_birthday');
  assert.equal(validateDraft(own, types[0], sponsor), null, 'own birthday uses the DOB');
  const ownRow = draftToRow(own, types[0], 's', sponsor);
  assert.equal(ownRow.occasion_date, '1980-01-15');
  assert.equal(ownRow.relationship, 'Self');
  assert.equal(ownRow.person_name, 'Ravi Kumar');
  assert.match(validateDraft(newDraft('self_birthday'), types[0], { name: 'R' })!, /date of birth/);
});

const today = '2026-10-31';
const row = (id: string, extra: object) => ({ id, sponsor_id: 'r', family_member_id: null, active: true, recurring_yearly: true, ...extra });
const sources = {
  sponsors: [{ id: 'r', full_name: 'Ravi Kumar', title: 'Mr', dob: null, phone: '919876543210', whatsapp: null, status: 'active' }],
  occasions: [
    row('son', { person_name: 'Arun', relationship: 'Son', occasion_type: 'Birthday', occasion_type_key: 'family_birthday', occasion_date: '2015-10-31' }),
    row('dad', { person_name: 'Muthusamy', relationship: 'Father', occasion_type: 'Death Anniversary', occasion_type_key: 'death_anniversary', occasion_date: '2008-10-31', linked_donation_type: 'Food' }),
    row('wed', { person_name: 'Ravi & Meena', relationship: 'Self', occasion_type: 'Wedding Anniversary', occasion_date: '2005-02-10' }),
    // An old record with no new fields.
    row('old', { person_name: 'Ravi Kumar', relationship: 'Self', occasion_type: 'Birthday', occasion_date: '1980-10-31' }),
  ],
  familyMembers: [], monthlySponsors: [], donations: [], requests: [],
} as unknown as ReminderSources;

test('dashboard: both show today with Ravi Kumar as the contact, remembrance calm', () => {
  const items = buildReminderItems(sources, today).filter((i) => i.group === 'today');
  const son = items.find((i) => i.key === 'occ:son')!;
  const dad = items.find((i) => i.key === 'occ:dad')!;
  assert.equal(son.occasion, "Arun's Birthday (Son of Ravi Kumar)");
  assert.equal(son.contactName, 'Ravi Kumar');
  assert.equal(son.calm, false);
  assert.equal(dad.occasion, 'Remembrance Day – Late Muthusamy (Father of Ravi Kumar)');
  assert.equal(dad.contactName, 'Ravi Kumar');
  assert.equal(dad.calm, true);
  assert.equal(dad.icon, '🪔');
  assert.ok(items.some((i) => i.key === 'occ:old'), 'old birthdays still show');
});

test('daily summary gives person, relationship, type, contact and phone', () => {
  const text = buildDailySummary(buildReminderItems(sources, today), today);
  assert.ok(text.includes("Ravi Kumar – 919876543210 – 🎂 Arun's Birthday (Son of Ravi Kumar)"), text);
  assert.ok(text.includes('Ravi Kumar – 919876543210 – 🪔 Remembrance Day – Late Muthusamy (Father of Ravi Kumar)'), text);
});
