export const COMPLETIONS_PER_LEVEL = 2;
export const MAX_GARDEN_LEVEL = 10;

export const GARDEN_STAGES = [
  'Seedling', 'Young sprout', 'First buds', 'First bloom', 'Leaf and bud',
  'Branching in bloom', 'Flowering canopy', 'Fuller blooms', 'Late blossoms', 'Mature flowering plant',
] as const;

export function gardenLevel(lifetime: number): number {
  return Math.min(MAX_GARDEN_LEVEL, 1 + Math.floor(lifetime / COMPLETIONS_PER_LEVEL));
}

export function completionsUntilGrowth(level: number, lifetime: number): number {
  return level >= MAX_GARDEN_LEVEL ? 0 : Math.max(0, level * COMPLETIONS_PER_LEVEL - lifetime);
}

/** Intermediate rewards stretch the existing stem before the next foliage layer arrives. */
export function stemStretch(lifetime: number): number {
  const step = Math.min(lifetime, 18);
  return 1 + step * .004 + (step % 2 ? .12 / (1 + Math.floor(step / 2) * .21) : 0);
}

export const FLOWER_SITES = [
  { bud: 3, open: 4, anchor: .18, angle: .49, reach: .40, rise: .31, size: .17, tint: 0xe8bdab, x: 151, y: 121, branchY: 143 },
  { bud: 5, open: 6, anchor: .35, angle: 2.87, reach: .48, rise: .36, size: .17, tint: 0xf1d7a8, x: 86, y: 105, branchY: 127 },
  { bud: 6, open: 7, anchor: .49, angle: -.85, reach: .51, rise: .38, size: .16, tint: 0xf1ded1, x: 158, y: 91, branchY: 110 },
  { bud: 7, open: 8, anchor: .59, angle: 2.43, reach: .64, rise: .36, size: .16, tint: 0xe7b9aa, x: 74, y: 77, branchY: 94 },
  { bud: 8, open: 9, anchor: .71, angle: -.27, reach: .52, rise: .43, size: .18, tint: 0xf4dbad, x: 161, y: 59, branchY: 80 },
  { bud: 9, open: 10, anchor: .82, angle: 1.59, reach: .16, rise: .49, size: .19, tint: 0xf4d8c3, x: 116, y: 33, branchY: 63 },
] as const;

export function visibleFlowers(level: number) {
  return FLOWER_SITES.filter(site => site.bud <= level).map(site => ({ ...site, blooming: site.open <= level }));
}
