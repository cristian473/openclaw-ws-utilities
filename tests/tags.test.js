const { describe, it, expect } = require('vitest');
const { parseTags } = require('../src/utils/tags');

describe('parseTags', () => {
  it('parses comma-separated string', () => {
    expect(parseTags('one, two,three')).toEqual(['one', 'two', 'three']);
  });

  it('parses arrays and trims empty values', () => {
    expect(parseTags(['  hola ', '', ' mundo'])).toEqual(['hola', 'mundo']);
  });

  it('returns empty for falsy values', () => {
    expect(parseTags(null)).toEqual([]);
    expect(parseTags(undefined)).toEqual([]);
  });
});
