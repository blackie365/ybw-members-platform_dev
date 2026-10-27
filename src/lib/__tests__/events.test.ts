import { describe, it, expect } from 'vitest';
import { partitionEventsByDate, resolveEventDate } from '../events';

/** A fixed "today" so the ordering assertions cannot drift with the clock. */
const NOW = new Date('2026-10-27T12:00:00Z');

function post(slug: string, tagSlugs: string[] = []) {
  return { slug, tags: tagSlugs.map((slug) => ({ slug })) };
}

describe('resolveEventDate', () => {
  it('reads the date from an event-date-* tag', () => {
    const d = resolveEventDate(post('autumn-networking', ['events', 'event-date-2026-11-12']));
    expect(d?.toISOString()).toBe('2026-11-12T00:00:00.000Z');
  });

  it('prefers the tag over a date sitting in the slug', () => {
    const d = resolveEventDate(post('thing-event-date-2020-01-01', ['event-date-2026-11-12']));
    expect(d?.toISOString()).toBe('2026-11-12T00:00:00.000Z');
  });

  it('falls back to a date baked into the post slug', () => {
    // The live Doodle HR post put its date in the slug rather than a tag.
    const d = resolveEventDate(post('doodle-hr-announces-employment-law-expo-event-date-2026-10-15'));
    expect(d?.toISOString()).toBe('2026-10-15T00:00:00.000Z');
  });

  it('returns null when the post carries no date at all', () => {
    expect(resolveEventDate(post('christmas-magic-at-the-showground'))).toBeNull();
  });
});

describe('partitionEventsByDate', () => {
  it('orders upcoming soonest-first, sinks undated events, then past most-recent-first', () => {
    const sooner = post('b-event-date-2026-11-05');
    const later = post('a-event-date-2026-12-01');
    const undated = post('d-no-date-here');
    const justPassed = post('c-event-date-2026-10-15');
    const longPast = post('e-event-date-2026-01-02');

    const { upcoming, past } = partitionEventsByDate(
      [later, justPassed, undated, sooner, longPast],
      NOW
    );

    expect(upcoming).toEqual([sooner, later, undated]);
    expect(past).toEqual([justPassed, longPast]);
  });

  it('treats an event happening today as upcoming, not past', () => {
    const today = post('today-event-date-2026-10-27');
    const { upcoming, past } = partitionEventsByDate([today], NOW);

    expect(upcoming).toEqual([today]);
    expect(past).toEqual([]);
  });

  it('never demotes an undated event, even though its publish date is stale', () => {
    // Undated posts are "unknown", not "already happened" — demoting them would
    // bury most of the archive, since only a handful of events carry a date.
    const undated = { slug: 'x', tags: [], published_at: '2023-01-01T00:00:00.000Z' };
    const { upcoming, past } = partitionEventsByDate([undated], NOW);

    expect(upcoming).toEqual([undated]);
    expect(past).toEqual([]);
  });

  it('returns the original post objects, untouched', () => {
    const original = post('b-event-date-2026-11-05');
    const { upcoming } = partitionEventsByDate([original], NOW);

    expect(upcoming[0]).toBe(original);
  });
});
