import { describe, expect, it } from 'vitest';

import { clockTime, rupees } from '../lib/format.js';

describe('clockTime', () => {
  it('reads morning and afternoon times the way a person says them', () => {
    expect(clockTime('09:30')).toBe('9:30 am');
    expect(clockTime('11:00')).toBe('11:00 am');
    expect(clockTime('13:30')).toBe('1:30 pm');
    expect(clockTime('16:00')).toBe('4:00 pm');
  });

  it('does not turn noon or midnight into zero o’clock', () => {
    expect(clockTime('12:00')).toBe('12:00 pm');
    expect(clockTime('00:15')).toBe('12:15 am');
  });
});

describe('rupees', () => {
  it('groups digits the Indian way', () => {
    expect(rupees(1500)).toBe('₹1,500');
    expect(rupees(350)).toBe('₹350');
    expect(rupees(100000)).toBe('₹1,00,000');
  });
});
