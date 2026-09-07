import { describe, expect, it } from 'vitest';
import { RecognitionDeduplicator } from './cardRecognition';

describe('card recognition deduplication', () => {
  it('does not accept the same card repeatedly while it stays in view', () => {
    const deduplicator = new RecognitionDeduplicator();

    expect(deduplicator.accept('oracle-sol-ring')).toBe(true);
    expect(deduplicator.accept('oracle-sol-ring')).toBe(false);
    deduplicator.observeFrame(true);
    expect(deduplicator.accept('oracle-sol-ring')).toBe(false);
  });

  it('accepts the card again after it leaves the frame', () => {
    const deduplicator = new RecognitionDeduplicator();

    expect(deduplicator.accept('oracle-sol-ring')).toBe(true);
    deduplicator.observeFrame(false);
    deduplicator.observeFrame(false);
    expect(deduplicator.accept('oracle-sol-ring')).toBe(false);
    deduplicator.observeFrame(false);
    expect(deduplicator.accept('oracle-sol-ring')).toBe(true);
  });

  it('accepts a different card immediately', () => {
    const deduplicator = new RecognitionDeduplicator();
    expect(deduplicator.accept('oracle-sol-ring')).toBe(true);
    expect(deduplicator.accept('oracle-rhystic-study')).toBe(true);
  });
});
