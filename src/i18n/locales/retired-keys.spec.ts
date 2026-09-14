import { describe, it, expect } from 'vitest';
import { flatten } from './_lib/parity';

/**
 * A key left behind by a retired feature is invisible: i18n still resolves it,
 * nothing renders it, and the next grep concludes the feature is still there.
 */
const RETIRED_KEY_FRAGMENTS = ['conversation_mention'];

const modules = import.meta.glob<Record<string, unknown>>('./*/*.json', {
  eager: true,
  import: 'default',
});

describe('retired i18n keys', () => {
  it('reads the whole locale catalog', () => {
    expect(Object.keys(modules).length).toBeGreaterThan(0);
  });

  it.each(RETIRED_KEY_FRAGMENTS)('no locale file still carries "%s"', (fragment) => {
    const survivors: string[] = [];

    for (const [path, mod] of Object.entries(modules)) {
      for (const key of flatten(mod)) {
        if (key.includes(fragment)) survivors.push(`${path}:${key}`);
      }
    }

    expect(survivors).toEqual([]);
  });
});
