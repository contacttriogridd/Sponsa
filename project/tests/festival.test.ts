import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFestivalMessage, fillFestivalTemplate, joinNames } from '@/lib/festival';
import { familyStarSubjects, parentIdOf, subjectLabel } from '@/lib/monthly-sponsors';
import { DEFAULT_ORGANIZATION_NAMES as ORG } from '@/lib/organization';
import { buildReminderItems, type ReminderSources } from '@/lib/today-reminders';
import type { MonthlyFamilyMember, MonthlySponsor } from '@/lib/types';

const EN = `Dear {{sponsor_name}} and family,

Heartfelt Deepavali greetings from {{organization_name}}! 🪔

Our special Deepavali wishes to {{family_member_names}}.

May this festival of lights bring joy.

With gratitude,
{{organization_name}}`;
const TA = `அன்புள்ள {{sponsor_name}} அவர்களுக்கும் அவர்தம் குடும்பத்தினருக்கும்,

{{organization_name}} சார்பாக இனிய தீபாவளி நல்வாழ்த்துகள்! 🪔

{{family_member_names}} உட்பட உங்கள் குடும்பத்தினர் அனைவருக்கும் எங்கள் சிறப்பு தீபாவளி வாழ்த்துகள்.

நன்றியுடன்,
{{organization_name}}`;

test('organization name: VP TRUST in English, the Tamil name in Tamil', () => {
  const en = fillFestivalTemplate(EN, 'en', { sponsor_name: 'Ravi', family_member_names: 'Priya and Arun' }, ORG);
  const ta = fillFestivalTemplate(TA, 'ta', { sponsor_name: 'Ravi', family_member_names: 'Priya and Arun' }, ORG);
  assert.ok(en.endsWith('With gratitude,\nVP TRUST') && en.includes('greetings from VP TRUST!'));
  assert.ok(ta.endsWith('நன்றியுடன்,\nவள்ளலார் பசியாற்றும் அறக்கட்டளை'));
  assert.ok(en.includes('Our special Deepavali wishes to Priya and Arun.'));
  assert.ok(ta.includes('Priya and Arun உட்பட'));
});

test('no family members: the whole line goes, with no gap left', () => {
  const en = fillFestivalTemplate(EN, 'en', { sponsor_name: 'Ravi', family_member_names: '' }, ORG);
  const ta = fillFestivalTemplate(TA, 'ta', { sponsor_name: 'Ravi' }, ORG);
  assert.ok(!en.includes('special Deepavali wishes') && !en.includes('\n\n\n') && !en.includes('{{'));
  assert.ok(en.includes('🪔\n\nMay this festival'));
  assert.ok(!ta.includes('உட்பட') && !ta.includes('\n\n\n'));
});

test('Both is Tamil first, then English', () => {
  const both = buildFestivalMessage('both', { en: EN, ta: TA }, { sponsor_name: 'Ravi' }, ORG);
  assert.ok(both.startsWith('அன்புள்ள Ravi') && both.indexOf('Dear Ravi') > both.indexOf('நன்றியுடன்'));
  assert.ok(both.endsWith('VP TRUST'));
  assert.equal(decodeURIComponent(encodeURIComponent(both)), both);
  assert.equal(buildFestivalMessage('ta', { en: EN, ta: TA }, { sponsor_name: 'Ravi' }, ORG).includes('Dear'), false);
});

test('names are joined naturally', () => {
  assert.equal(joinNames([]), '');
  assert.equal(joinNames(['Priya']), 'Priya');
  assert.equal(joinNames(['Priya', 'Arun', 'Meena']), 'Priya, Arun and Meena');
});

const ravi = { id: 'm1', name: 'Ravi', phone: '919876543210', status: 'active', star: 6, raasi: 3, sponsor_id: null, dob: null } as unknown as MonthlySponsor;
const member = (extra: Partial<MonthlyFamilyMember>) => ({
  id: 'f1', monthly_sponsor_id: 'm1', name: 'Priya', relationship: 'Daughter', relationship_other: null, star: 0, raasi: 0,
  dob: '2015-11-06', phone: null, address: null, notes: null, created_at: '', updated_at: '', ...extra,
}) as MonthlyFamilyMember;

test("family members' star days ride with their sponsor", () => {
  const [p] = familyStarSubjects([ravi], [member({}), member({ id: 'f2', star: null })]);
  assert.equal(p.star, 0);
  assert.equal(p.phone, '919876543210', "uses the sponsor's phone when the member has none");
  assert.equal(parentIdOf(p), 'm1');
  assert.equal(subjectLabel(p), 'Priya (Daughter of Ravi)');
  assert.equal(familyStarSubjects([ravi], [member({ phone: '919000000000' })])[0].phone, '919000000000');
});

test("a family member's birthday shows on the dashboard with whose it is", () => {
  const items = buildReminderItems({
    sponsors: [], occasions: [], familyMembers: [], donations: [], requests: [],
    monthlySponsors: [ravi], monthlyFamily: [member({})],
  } as unknown as ReminderSources, '2026-11-06');
  const b = items.find((i) => i.key === 'msfam:f1')!;
  assert.equal(b.group, 'today');
  assert.equal(b.occasion, "Priya's Birthday (Daughter of Ravi)");
  assert.equal(b.contactName, 'Ravi');
  assert.equal(b.phone, '919876543210');
});
