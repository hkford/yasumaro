/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { calculateTextScore, findMainContentCandidates } from '../scoring.js';

describe('contentExtractor/scoring', () => {
  describe('calculateTextScore', () => {
    it('calculates basic score based on text length', () => {
      document.body.innerHTML = '<div>This is a relatively long test text to ensure it passes the minimal length check in some contexts.</div>';
      const el = document.querySelector('div')!;
      // Text length is ~100. 100 / 10 = 10.
      expect(calculateTextScore(el)).toBeGreaterThan(0);
    });

    it('gives bonus for sentence markers', () => {
      // 句読点が含まれる場合
      document.body.innerHTML = '<div>This is a sentence. And another sentence.</div>';
      const el1 = document.querySelector('div')!;
      const score1 = calculateTextScore(el1);

      document.body.innerHTML = '<div>This is just some text without markers</div>';
      const el2 = document.querySelector('div')!;
      const score2 = calculateTextScore(el2);

      expect(score1).toBeGreaterThan(score2);
    });

    it('penalizes high link density', () => {
      document.body.innerHTML = `
        <div>
          <a href="#">Link 1</a>
          <a href="#">Link 2</a>
          <a href="#">Link 3</a>
        </div>
      `;
      const el = document.querySelector('div')!;
      expect(calculateTextScore(el)).toBeLessThan(1); // Very low score due to mostly links
    });
  });

  describe('findMainContentCandidates', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });

    it('finds candidates by bubbling up scores', () => {
      document.body.innerHTML = `
        <div class="outer">
          <div class="inner">
            <p>${'Sentence one. Sentence two. Sentence three. '.repeat(10)}</p>
          </div>
        </div>
      `;
      const candidates = findMainContentCandidates();
      expect(candidates.length).toBeGreaterThan(0);
      // The outer or inner div should be a candidate
      expect(['DIV', 'P']).toContain(candidates[0].tagName);
    });

    it('returns body as fallback when no candidates found', () => {
      document.body.innerHTML = 'short';
      const candidates = findMainContentCandidates();
      expect(candidates).toEqual([document.body]);
    });

    it('excludes elements with exclude keywords via bubbling penalty', () => {
      document.body.innerHTML = `
        <div class="content"><p>${'Main text. '.repeat(50)}</p></div>
        <div class="sidebar"><p>${'Sidebar text. '.repeat(50)}</p></div>
      `;
      const candidates = findMainContentCandidates();
      // Class name penalties make 'sidebar' less likely than 'content'
      expect(candidates[0].className).not.toContain('sidebar');
    });

    it('sorts candidates by text score descending', () => {
      document.body.innerHTML = `
        <article class="short">Short.</article>
        <article class="long">
          <p>${'Significant content paragraph one. '.repeat(10)}</p>
          <p>${'Significant content paragraph two. '.repeat(10)}</p>
          <p>${'Significant content paragraph three. '.repeat(10)}</p>
        </article>
      `;
      const candidates = findMainContentCandidates();
      expect(candidates.length).toBeGreaterThanOrEqual(1);
      expect(candidates[0].className).toBe('long');
    });

    it('returns document.body as fallback instead of empty array', () => {
      document.body.innerHTML = '';
      const candidates = findMainContentCandidates();
      expect(candidates).toEqual([document.body]);
    });
  });
});
