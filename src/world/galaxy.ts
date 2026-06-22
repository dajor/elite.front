import { EliteRng } from "./rng.ts";
import { generateName } from "./names.ts";
import type { GalaxyModel, SystemModel, Economy, Government } from "./types.ts";

/** Base seed constants per galaxy: derived by rotating the seed words. */
const GALAXY_SEEDS: Array<[number, number, number]> = (() => {
  const out: Array<[number, number, number]> = [[0x5a4a, 0x0248, 0xb7fe]];
  for (let g = 1; g < 8; g++) {
    const [s0, s1, s2] = out[g - 1];
    // Rotate the 48-bit seed left by 16 bits → next galaxy seed.
    out.push([s1, s2, s0]);
  }
  return out;
})();

const GALAXY_SIZE = 256;

/** Invert economy (Elite stores rich-agricultural as 0, poor-industrial as 7). */
function deriveEconomy(r: number): Economy {
  // Elite: economy = (seed0_hi & 7), then agricultural/industrial flip.
  const e = r & 7;
  return e as Economy;
}

function deriveGovernment(r: number): Government {
  return (r & 7) as Government;
}

function deriveTechLevel(government: number, economy: number, r: number): number {
  // Elite-ish: tech = base + economy-flip + government contribution + rng jitter.
  const flipEco = economy ^ 7;
  return 1 + flipEco + (government >> 1) + (r & 3);
}

function derivePopulation(tech: number, economy: number, government: number): number {
  return tech * 4 + economy + government + 1;
}

function deriveProductivity(economy: number, government: number, population: number): number {
  return ((economy ^ 3) + 4) * (government + 4) * population * 8;
}

function deriveRadius(r: number): number {
  return 4000 + (r & 0x3fff);
}

function generateSystem(rng: EliteRng, index: number, galaxy: number): SystemModel {
  const a = rng.next();
  const b = rng.next();
  const c = rng.next();

  const x = (a >> 2) & 0xff;
  const y = (b >> 2) & 0xff;

  const economy = deriveEconomy(a);
  const government = deriveGovernment(b);
  const techLevel = Math.min(15, Math.max(1, deriveTechLevel(government, economy, c)));
  const population = derivePopulation(techLevel, economy, government);
  const productivity = deriveProductivity(economy, government, population);
  const radius = deriveRadius(c);
  const goatSoupSeed = ((a << 16) | b) ^ c;

  const name = generateName(rng);

  return {
    index,
    galaxy,
    name,
    x,
    y,
    economy,
    government,
    techLevel,
    population,
    productivity,
    radius,
    goatSoupSeed,
  };
}

export function generateGalaxy(galaxyIndex: number): GalaxyModel {
  const [s0, s1, s2] = GALAXY_SEEDS[galaxyIndex % 8];
  const rng = new EliteRng(s0, s1, s2);
  const systems: SystemModel[] = [];
  for (let i = 0; i < GALAXY_SIZE; i++) {
    systems.push(generateSystem(rng, i, galaxyIndex));
  }
  return { index: galaxyIndex, systems };
}

export function generateAllGalaxies(): GalaxyModel[] {
  return Array.from({ length: 8 }, (_, g) => generateGalaxy(g));
}