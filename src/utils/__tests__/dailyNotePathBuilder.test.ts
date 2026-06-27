// src/utils/__tests__/dailyNotePathBuilder.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildDailyNotePath, buildHierarchicalDailyNotePath } from '../dailyNotePathBuilder.js';

describe('buildDailyNotePath', () => {
  beforeEach(() => {
    vi.useFakeTimers().setSystemTime(new Date('2026-02-04T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should build path with YYYY placeholders', () => {
    const result = buildDailyNotePath('notes/YYYY');
    expect(result).toBe('notes/2026');
  });

  it('should build path with YYYY-MM-DD format', () => {
    const result = buildDailyNotePath('092.Daily/YYYY-MM-DD');
    expect(result).toBe('092.Daily/2026-02-04');
  });

  it('should handle empty path', () => {
    const result = buildDailyNotePath('');
    expect(result).toBe('2026-02-04');
  });

  it('should handle individual placeholders', () => {
    expect(buildDailyNotePath('YYYY')).toBe('2026');
    expect(buildDailyNotePath('MM')).toBe('02');
    expect(buildDailyNotePath('DD')).toBe('04');
  });
});

describe('buildHierarchicalDailyNotePath', () => {
  const testDate = new Date('2026-06-27T12:00:00Z');

  it('should add year/month hierarchy to empty path', () => {
    const result = buildHierarchicalDailyNotePath('', testDate);
    // pathSegment: 2026-06-27/ (because buildDailyNotePath('') returns date) + 2026/ + 06/ -> No, wait.
    // Let's re-verify logic:
    // fileName = buildDailyNotePath('', testDate) -> "2026-06-27"
    // dailyPath = buildDailyNotePath('', testDate) -> "2026-06-27"
    // pathSegment = "2026-06-27/"
    // !pathRaw.includes('YYYY') -> true -> pathSegment += "2026/"
    // !pathRaw.includes('MM') -> true -> pathSegment += "06/"
    // returns "2026-06-27/2026/06/2026-06-27"
    expect(result).toBe('2026-06-27/2026/06/2026-06-27');
  });

  it('should add year/month hierarchy to a flat directory', () => {
    const result = buildHierarchicalDailyNotePath('092.Daily', testDate);
    // dailyPath = "092.Daily"
    // pathSegment = "092.Daily/2026/06/"
    // returns "092.Daily/2026/06/2026-06-27"
    expect(result).toBe('092.Daily/2026/06/2026-06-27');
  });

  it('should not add double hierarchy if placeholders are present', () => {
    const result = buildHierarchicalDailyNotePath('092.Daily/YYYY/MM', testDate);
    // dailyPath = "092.Daily/2026/06"
    // pathSegment = "092.Daily/2026/06/"
    // placeholders present -> no addition
    // returns "092.Daily/2026/06/2026-06-27"
    expect(result).toBe('092.Daily/2026/06/2026-06-27');
  });

  it('should add missing month hierarchy if YYYY is present', () => {
    const result = buildHierarchicalDailyNotePath('Archive/YYYY', testDate);
    // dailyPath = "Archive/2026"
    // pathSegment = "Archive/2026/06/"
    expect(result).toBe('Archive/2026/06/2026-06-27');
  });
});