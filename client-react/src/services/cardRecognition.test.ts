import { describe, expect, it } from 'vitest';
import {
  MAX_CAPTURE_ZOOM,
  MIN_CAPTURE_ZOOM,
  CollectorVisionRecognitionService,
  RecognitionDeduplicator,
} from './cardRecognition';

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

describe('camera capture zoom', () => {
  it('keeps zoom inside the supported software range', () => {
    const service = new CollectorVisionRecognitionService();

    expect(service.setZoom(99)).toBe(MAX_CAPTURE_ZOOM);
    expect(service.setZoom(0)).toBe(MIN_CAPTURE_ZOOM);
  });
});
