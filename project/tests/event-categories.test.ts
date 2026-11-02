import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoryFromText, eventCategoryOf, eventsBySponsor } from '@/lib/event-categories';
import type { SpecialOccasion } from '@/lib/types';

const occ = (extra: Partial<SpecialOccasion>) => ({
  id: Math.random().toString(36), sponsor_id: 's', family_member_id: null, person_name: 'P', relationship: 'Self',
  occasion_type: 'Birthday', occasion_date: '1990-11-14', recurring_yearly: true, active: true, notes: null, ...extra,
}) as SpecialOccasion;

test('saved occasion types map to the tabs', () => {
  assert.equal(eventCategoryOf(occ({ occasion_type_key: 'self_birthday' })), 'birthday');
  assert.equal(eventCategoryOf(occ({ occasion_type_key: 'family_birthday', relationship: 'Son' })), 'child_birthday');
  assert.equal(eventCategoryOf(occ({ occasion_type_key: 'family_birthday', relationship: 'granddaughter' })), 'child_birthday');
  assert.equal(eventCategoryOf(occ({ occasion_type_key: 'family_birthday', relationship: 'Wife' })), 'birthday');
  assert.equal(eventCategoryOf(occ({ occasion_type: 'Wedding Anniversary' })), 'wedding_anniversary');
  assert.equal(eventCategoryOf(occ({ occasion_type: 'Death Anniversary' })), 'death_anniversary');
  assert.equal(eventCategoryOf(occ({ occasion_type: 'Business Anniversary' })), 'other');
  assert.equal(eventCategoryOf(occ({ occasion_type: 'Celebration' })), 'other');
});

test('old rows without a type key still map', () => {
  assert.equal(eventCategoryOf(occ({ occasion_type: 'Birthday', relationship: 'Daughter' })), 'child_birthday');
  assert.equal(eventCategoryOf(occ({ occasion_type: 'Birthday', relationship: 'Self' })), 'birthday');
});

test('free text is matched without case', () => {
  assert.equal(categoryFromText('anniversary'), 'wedding_anniversary');
  assert.equal(categoryFromText('Wedding Anniversary'), 'wedding_anniversary');
  assert.equal(categoryFromText('child bday'), 'child_birthday');
  assert.equal(categoryFromText("Kid's Birthday"), 'child_birthday');
  assert.equal(categoryFromText('BIRTHDAY'), 'birthday');
  assert.equal(categoryFromText('Remembrance day'), 'death_anniversary');
  assert.equal(categoryFromText('Business anniversary'), null);
  assert.equal(categoryFromText('House warming'), null);
  assert.equal(eventCategoryOf(occ({ occasion_type: 'Other', occasion_type_key: 'house_warming_x', occasion_name_en: "Kid's Birthday" })), 'child_birthday');
});

test('a sponsor with several events is listed under each, nearest first', () => {
  const from = new Date(2026, 10, 2); // 2 Nov 2026
  const map = eventsBySponsor([
    occ({ occasion_type: 'Wedding Anniversary', occasion_date: '2005-12-01' }),
    occ({ occasion_type_key: 'self_birthday', occasion_date: '1980-11-14' }),
    occ({ occasion_type: 'Death Anniversary', occasion_date: '2010-11-03', active: false }),
  ], from);
  const events = map.get('s')!;
  assert.deepEqual(events.map((e) => e.category), ['birthday', 'wedding_anniversary'], 'inactive left out, nearest first');
  assert.equal(events[0].next!.getDate(), 14);
});
