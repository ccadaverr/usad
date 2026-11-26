import type { GardenState } from './garden.service';

export type PlantStage = Pick<GardenState, 'level' | 'growth' | 'streak'>;

export interface WateringTransition {
  before: PlantStage;
  after: PlantStage;
  startedAt: number;
  kind: 'watering' | 'reconcile';
}

export const WATERING_DURATION = 2480;
export const RECONCILE_DURATION = 770;
export const FRUIT_LIMIT = 4;
export const POUR_START = 510;
export const DROP_INTERVAL = 38;
export const DROP_COUNT = 18;
export const DROP_FLIGHT = 480;
export const FIRST_IMPACT = POUR_START + DROP_FLIGHT;
const LAST_DROP = POUR_START + (DROP_COUNT - 1) * DROP_INTERVAL;
export const WATER_IMPACTS = [0, 5, 10, 15];
export const CAN_ANCHOR_BOTTOM = 34;
export const CAN_DISPLAY_WIDTH = 70;
export const CAN_SPACE = 74;

export const unit = (value: number) => Math.max(0, Math.min(1, value));
export const mix = (from: number, to: number, step: number) => from + (to - from) * step;
export const smooth = (value: number) => {
  const t = unit(value);
  return t * t * (3 - 2 * t);
};

export function dropAge(elapsed: number, index: number) {
  return (elapsed - POUR_START - index * DROP_INTERVAL) / DROP_FLIGHT;
}

export function waterFlow(elapsed: number) {
  return {
    start: unit(dropAge(elapsed, DROP_COUNT - 1)),
    end: unit(dropAge(elapsed, 0)),
    opacity: smooth((elapsed - POUR_START) / 110) * (1 - smooth((elapsed - LAST_DROP) / 300)),
  };
}

export function fallingDistance(age: number) {
  return age * (.24 + .76 * age);
}

export function wateringFrame(elapsed: number) {
  const impact = unit((elapsed - FIRST_IMPACT) / 670);
  const arrival = smooth(elapsed / 460) * (1 - smooth((elapsed - 1320) / 490));
  return {
    arrival,
    lateral: smooth(arrival / .64),
    arc: Math.sin(arrival * Math.PI),
    tilt: smooth((elapsed - 190) / 320) * (1 - smooth((elapsed - LAST_DROP) / 360)),
    growth: smooth((elapsed - FIRST_IMPACT) / (WATERING_DURATION - FIRST_IMPACT)),
    sway: Math.sin(impact * Math.PI * 2) * (1 - impact) * .032,
  };
}

export function transitionDuration(kind: WateringTransition['kind']) {
  return kind === 'watering' ? WATERING_DURATION : RECONCILE_DURATION;
}

export function transitionFrame(elapsed: number, kind: WateringTransition['kind']) {
  if (kind === 'watering') return wateringFrame(elapsed);
  return { arrival: 0, lateral: 0, arc: 0, tilt: 0, growth: smooth(elapsed / RECONCILE_DURATION), sway: 0 };
}

export function stageAmount(stage: number, before: { level: number }, after: { level: number }, progress: number) {
  return mix(Number(stage <= before.level), Number(stage <= after.level), progress);
}

export function fruitAmount(index: number, before: number, after: number, progress: number) {
  const step = smooth((progress - index * .07) / (1 - index * .07));
  return mix(Number(index < before), Number(index < after), step);
}
