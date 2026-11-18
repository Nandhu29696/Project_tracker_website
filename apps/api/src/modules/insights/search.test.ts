import { describe, expect, it } from 'vitest';
import { toPrefixQuery } from './search.service';

describe('search query building', () => {
  it('turns words into prefix terms', () => {
    expect(toPrefixQuery('Login SSO')).toBe('login:* & sso:*');
  });

  it('drops tsquery operators so input cannot change the query', () => {
    expect(toPrefixQuery("a | b & !c ' : (d)")).toBe('a:* & b:* & c:* & d:*');
    expect(toPrefixQuery('!!! &&& |||')).toBeNull();
  });

  it('keeps non-English letters and limits the number of terms', () => {
    // Tamil vowel signs / virama are combining marks and must stay inside the word
    expect(toPrefixQuery('வணக்கம் café')).toBe('வணக்கம்:* & café:*');
    expect(toPrefixQuery('a b c d e f g h')!.split(' & ')).toHaveLength(6);
  });
});
