import { stemStretch, visibleFlowers, wateringsUntilGrowth } from './botanical-growth';
import { FIRST_IMPACT, WATERING_DURATION, RECONCILE_DURATION, fruitAmount, transitionFrame, stageAmount, wateringFrame } from './watering-motion';

describe('Botanical growth', () => {
  it('counts remaining waterings and stretches the stem monotonically between levels', () => {
    expect(wateringsUntilGrowth(1, 0)).toBe(2);
    expect(wateringsUntilGrowth(1, 1)).toBe(1);
    expect(wateringsUntilGrowth(2, 2)).toBe(2);
    expect(wateringsUntilGrowth(10, 18)).toBe(0);
    for (let growth = 1; growth <= 18; growth++) {
      expect(stemStretch(growth)).toBeGreaterThan(stemStretch(growth - 1));
    }
  });

  it('keeps all previous nodes intact and starts extending the new node only after soil impact', () => {
    const before = { level: 3, growth: 5 };
    const after = { level: 4, growth: 6 };
    expect(wateringFrame(FIRST_IMPACT - 1).growth).toBe(0);
    expect(wateringFrame(FIRST_IMPACT).growth).toBe(0);
    const middle = wateringFrame((FIRST_IMPACT + WATERING_DURATION) / 2).growth;
    expect(middle).toBe(.5);
    expect(stageAmount(3, before, after, middle)).toBe(1);
    expect(stageAmount(4, before, after, middle)).toBe(.5);
    expect(stageAmount(5, before, after, middle)).toBe(0);
    expect(wateringFrame(WATERING_DURATION).growth).toBe(1);
  });

  it('uses one visible bud and flower schedule for WebGL and the illustration', () => {
    const counts = Array.from({ length: 10 }, (_, index) => {
      const flowers = visibleFlowers(index + 1);
      return [flowers.filter(flower => !flower.blooming).length, flowers.filter(flower => flower.blooming).length];
    });
    expect(counts).toEqual([[0, 0], [0, 0], [1, 0], [0, 1], [1, 1],
      [1, 2], [1, 3], [1, 4], [1, 5], [0, 6]]);
  });

  it('retracts retired nodes and scales only fruit affected by a streak change', () => {
    expect(stageAmount(4, { level: 4 }, { level: 3 }, .5)).toBe(.5);
    expect(stageAmount(3, { level: 4 }, { level: 3 }, .5)).toBe(1);
    const halfway = transitionFrame(RECONCILE_DURATION / 2, 'reconcile');
    expect(halfway.arrival).toBe(0);
    expect(fruitAmount(0, 2, 1, halfway.growth)).toBe(1);
    expect(fruitAmount(1, 2, 1, halfway.growth)).toBeGreaterThan(0);
    expect(fruitAmount(1, 2, 1, 1)).toBe(0);
  });

});
