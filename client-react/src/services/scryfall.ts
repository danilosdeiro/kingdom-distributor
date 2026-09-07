const API_URL = 'https://api.scryfall.com';
const CACHE_PREFIX = 'meukingdom:scryfall:';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export interface ScryfallCard {
  id: string;
  oracle_id?: string;
  name: string;
  mana_cost?: string;
  type_line: string;
  oracle_text?: string;
  set_name: string;
  set: string;
  collector_number: string;
  scryfall_uri: string;
  image_uris?: { normal?: string; small?: string };
  card_faces?: Array<{
    name: string;
    mana_cost?: string;
    oracle_text?: string;
    image_uris?: { normal?: string; small?: string };
  }>;
  prices?: { usd?: string | null; usd_foil?: string | null; eur?: string | null };
}

interface CachedCard {
  expiresAt: number;
  card: ScryfallCard;
}

async function fetchScryfall<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Accept: 'application/json;q=0.9,*/*;q=0.8' },
  });
  if (!response.ok) throw new Error('O Scryfall não respondeu à consulta.');
  return response.json() as Promise<T>;
}

function readCardCache(id: string) {
  try {
    const cached = JSON.parse(localStorage.getItem(`${CACHE_PREFIX}${id}`) || 'null') as CachedCard | null;
    return cached && cached.expiresAt > Date.now() ? cached.card : null;
  } catch {
    return null;
  }
}

function writeCardCache(card: ScryfallCard) {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${card.id}`, JSON.stringify({
      expiresAt: Date.now() + CACHE_TTL_MS,
      card,
    } satisfies CachedCard));
  } catch {
    // Browser HTTP caching still applies if local storage is full or unavailable.
  }
}

export async function getScryfallCard(id: string) {
  const cached = readCardCache(id);
  if (cached) return cached;
  const card = await fetchScryfall<ScryfallCard>(`/cards/${encodeURIComponent(id)}`);
  writeCardCache(card);
  return card;
}

export async function searchScryfallNames(query: string) {
  const normalized = query.trim();
  if (normalized.length < 2) return [];
  const result = await fetchScryfall<{ data: string[] }>(
    `/cards/autocomplete?q=${encodeURIComponent(normalized)}&include_extras=true`,
  );
  return result.data.slice(0, 8);
}

export async function getScryfallCardByName(name: string) {
  const card = await fetchScryfall<ScryfallCard>(`/cards/named?exact=${encodeURIComponent(name)}`);
  writeCardCache(card);
  return card;
}

export function getCardImage(card: ScryfallCard) {
  return card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal || '';
}

export function getCardOracleText(card: ScryfallCard) {
  return card.oracle_text || card.card_faces?.map((face) => face.oracle_text).filter(Boolean).join('\n\n') || '';
}

export function getCardPrice(card: ScryfallCard) {
  if (card.prices?.usd) return `$${card.prices.usd}`;
  if (card.prices?.usd_foil) return `$${card.prices.usd_foil} foil`;
  if (card.prices?.eur) return `€${card.prices.eur}`;
  return null;
}
