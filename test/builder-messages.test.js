// Spec of the Image Builder texts (builder/messages.js)
const { test, expect } = require('bun:test');
const messages = require('../builder/messages');

test('has English and Japanese', () => {
  expect(Object.keys(messages).sort()).toEqual(['en', 'ja']);
});

test('English and Japanese have the same keys (nothing is left untranslated)', () => {
  expect(Object.keys(messages.ja).sort()).toEqual(
    Object.keys(messages.en).sort(),
  );
});

test('texts that take arguments are functions with the same number of arguments in both languages', () => {
  const problems = [];
  for (const [key, en] of Object.entries(messages.en)) {
    const ja = messages.ja[key];
    if (typeof en !== typeof ja) problems.push(`${key}: different types`);
    else if (typeof en === 'function' && en.length !== ja.length)
      problems.push(`${key}: different number of arguments`);
    else if (typeof en === 'string' && (!en || !ja))
      problems.push(`${key}: empty text`);
  }
  expect(problems).toEqual([]);
});
