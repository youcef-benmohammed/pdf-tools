import { describe, expect, it } from 'vitest';
import { chunkEvery, formatPageList, parseGroups, parsePageList } from '../src/utils/pageRanges';

describe('parsePageList', () => {
  it('parses pages and ranges', () => {
    expect(parsePageList('1-3, 5', 10)).toEqual([0, 1, 2, 4]);
    expect(parsePageList('8-', 10)).toEqual([7, 8, 9]);
    expect(parsePageList('-2', 10)).toEqual([0, 1]);
    expect(parsePageList('3, 1, 3', 10)).toEqual([2, 0]);
  });
  it('rejects invalid input with a code', () => {
    expect(() => parsePageList('', 5)).toThrow(expect.objectContaining({ code: 'rangeRequired' }));
    expect(() => parsePageList('abc', 5)).toThrow(expect.objectContaining({ code: 'rangeInvalid' }));
    expect(() => parsePageList('0', 5)).toThrow(expect.objectContaining({ code: 'rangeStartsAt1' }));
    expect(() => parsePageList('7', 5)).toThrow(expect.objectContaining({ code: 'rangeOutOfBounds', params: { page: 7, total: 5 } }));
    expect(() => parsePageList('4-2', 5)).toThrow(expect.objectContaining({ code: 'rangeReversed' }));
  });
});

describe('parseGroups / chunkEvery / formatPageList', () => {
  it('splits into groups', () => {
    expect(parseGroups('1-2, 3, 4-', 5)).toEqual([[0, 1], [2], [3, 4]]);
    expect(chunkEvery(5, 2)).toEqual([[0, 1], [2, 3], [4]]);
  });
  it('formats compactly', () => {
    expect(formatPageList([4, 0, 1, 2, 7])).toBe('1-3, 5, 8');
    expect(formatPageList([])).toBe('');
  });
});
