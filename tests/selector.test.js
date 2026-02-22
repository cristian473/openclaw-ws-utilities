const { describe, it, expect } = require('vitest');
const { normalizeSelector } = require('../src/utils/selector');

describe('normalizeSelector', () => {
  it('returns stickerId selector', () => {
    const out = normalizeSelector({ stickerId: 'abc' });
    expect(out).toEqual({ type: 'stickerId', value: 'abc' });
  });

  it('throws when multiple selectors are present', () => {
    expect(() => normalizeSelector({ stickerId: 'abc', alias: 'x' })).toThrowError(
      /Use only one selector/
    );
  });

  it('throws when selector is missing', () => {
    expect(() => normalizeSelector({})).toThrowError(/Provide one selector/);
  });
});
