export type Economy = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Government = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface SystemModel {
  index: number;          // 0..255 within galaxy
  galaxy: number;        // 0..7
  name: string;
  x: number;             // 0..256 galactic coords
  y: number;
  economy: Economy;      // 0 rich industrial .. 7 poor agricultural
  government: Government;// 0 anarchy .. 7 corporate state
  techLevel: number;     // 1..15
  population: number;    // in hundreds of millions (billions / 10)
  productivity: number;  // MCr
  radius: number;        // km
  goatSoupSeed: number;  // for flavour-text generation
}

export interface GalaxyModel {
  index: number;
  systems: SystemModel[];
}