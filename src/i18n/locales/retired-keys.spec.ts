import { describe, it, expect } from 'vitest';
import { flatten } from './_lib/parity';

/**
 * Keys of features this repo retired (CRM-579: conversation mention).
 *
 * A retirement is spread over 12 locale files in 6 languages, and a key left
 * behind is invisible: i18n resolves it, nothing renders it, and the next grep
 * for the feature finds it and concludes the feature is still there. This spec
 * is the counter-proof — it goes red on the state before the removal.
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
