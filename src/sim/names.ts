import { MALE_NAMES } from '../data/maleNames';
import { FEMALE_NAMES } from '../data/femaleNames';

/** English villager names — 1000 per sex, matched to the villager's sex (owner rule). */

export function randomName(sex: 'male' | 'female'): string {
  const pool = sex === 'male' ? MALE_NAMES : FEMALE_NAMES;
  return pool[Math.floor(Math.random() * pool.length)];
}
