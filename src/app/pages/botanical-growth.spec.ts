import { completionsUntilGrowth, gardenLevel, stemStretch, visibleFlowers } from './botanical-growth';

describe('Botanical growth', () => {
  it('advances every two unique completions and caps at ten', () => {
    const counts = [0, 1, 2, 3, 4, 6, 10, 18, 19, 90];
    expect(counts.map(gardenLevel)).toEqual([1, 1, 2, 2, 3, 4, 6, 10, 10, 10]);
    expect(counts.map(lifetime => completionsUntilGrowth(gardenLevel(lifetime), lifetime)))
      .toEqual([2, 1, 2, 1, 2, 2, 2, 0, 0, 0]);
    expect(stemStretch(1)).toBeGreaterThan(stemStretch(0));
    expect(stemStretch(3)).toBeGreaterThan(stemStretch(2));
    expect(stemStretch(19)).toBe(stemStretch(18));
  });

  it('uses one visible bud and flower schedule for WebGL and the illustration', () => {
    const counts = Array.from({ length: 10 }, (_, index) => {
      const flowers = visibleFlowers(index + 1);
      return [flowers.filter(flower => !flower.blooming).length, flowers.filter(flower => flower.blooming).length];
    });
    expect(counts).toEqual([[0, 0], [0, 0], [1, 0], [0, 1], [1, 1],
      [1, 2], [1, 3], [1, 4], [1, 5], [0, 6]]);
  });
});
