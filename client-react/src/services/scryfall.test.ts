import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCardImage, getCardOracleText, getCardPrice, getLigaMagicUrl, getScryfallCard } from './scryfall';

const card = {
  id: 'card-1',
  name: 'Sol Ring',
  type_line: 'Artifact',
  oracle_text: '{T}: Add {C}{C}.',
  set_name: 'Commander Masters',
  set: 'cmm',
  collector_number: '396',
  scryfall_uri: 'https://scryfall.com/card/cmm/396/sol-ring',
  image_uris: { normal: 'https://cards.scryfall.io/normal/card.jpg' },
  prices: { usd: '1.25' },
};

describe('Scryfall service', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => card })));
  });

  it('caches card details and avoids a repeated request', async () => {
    expect(await getScryfallCard('card-1')).toEqual(card);
    expect(await getScryfallCard('card-1')).toEqual(card);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('normalizes image, rules text and price for the UI', () => {
    expect(getCardImage(card)).toContain('card.jpg');
    expect(getCardOracleText(card)).toContain('Add');
    expect(getCardPrice(card)).toBe('$1.25');
  });

  it('creates a safe LigaMagic search URL', () => {
    expect(getLigaMagicUrl('Fire // Ice')).toBe(
      'https://www.ligamagic.com.br/?view=cards%2Fcard&card=Fire+%2F%2F+Ice',
    );
  });
});
