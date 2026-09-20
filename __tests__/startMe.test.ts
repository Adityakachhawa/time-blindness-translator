import { describe, it, expect } from 'vitest';
import { generateTinyStep } from '../lib/startMe';

describe('Start Me - Tiny Step Generator', () => {
  it('identifies cleaning tasks', () => {
    expect(generateTinyStep('clean my room')).toBe('Pick up 5 things from the floor.');
    expect(generateTinyStep('Tidy up the desk')).toBe('Pick up 5 things from the floor.');
  });

  it('identifies writing tasks', () => {
    expect(generateTinyStep('write an email')).toBe('Open a blank draft and write one sentence.');
    expect(generateTinyStep('Reply to John')).toBe('Open a blank draft and write one sentence.');
  });

  it('identifies kitchen/dish tasks', () => {
    expect(generateTinyStep('do the dishes')).toBe('Wash one dish.');
    expect(generateTinyStep('cook dinner in kitchen')).toBe('Wash one dish.');
  });

  it('identifies workout tasks', () => {
    expect(generateTinyStep('go for a run')).toBe('Put on your workout shoes.');
    expect(generateTinyStep('workout at the gym')).toBe('Put on your workout shoes.');
  });

  it('provides a fallback for unknown tasks', () => {
    expect(generateTinyStep('file taxes')).toBe('Gather what you need and put it in front of you.');
    expect(generateTinyStep('call mom')).toBe('Gather what you need and put it in front of you.');
  });
});
