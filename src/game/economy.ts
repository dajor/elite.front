import type { SystemModel } from "../world/types.ts";

export interface Commodity {
  id: string;
  name: string;
  basePrice: number;
  economyGradient: number;
  baseStock: number;
  stockGradient: number;
  techMinimum: number;
}

export interface MarketItem {
  commodity: Commodity;
  price: number;
  stock: number;
}

export interface CommanderLedger {
  credits: number;
  cargoCapacity: number;
  cargo: Record<string, number>;
}

const SAVE_KEY = "elite.commander.v1";

export const COMMODITIES: Commodity[] = [
  { id: "food", name: "Food", basePrice: 38, economyGradient: -4, baseStock: 28, stockGradient: 5, techMinimum: 1 },
  { id: "textiles", name: "Textiles", basePrice: 68, economyGradient: -2, baseStock: 18, stockGradient: 3, techMinimum: 1 },
  { id: "radioactives", name: "Radioactives", basePrice: 210, economyGradient: -7, baseStock: 12, stockGradient: 2, techMinimum: 2 },
  { id: "slaves", name: "Slaves", basePrice: 440, economyGradient: -8, baseStock: 5, stockGradient: 1, techMinimum: 1 },
  { id: "liquor", name: "Liquor/Wines", basePrice: 265, economyGradient: -5, baseStock: 9, stockGradient: 2, techMinimum: 1 },
  { id: "luxuries", name: "Luxuries", basePrice: 920, economyGradient: 18, baseStock: 6, stockGradient: -1, techMinimum: 5 },
  { id: "narcotics", name: "Narcotics", basePrice: 1580, economyGradient: -12, baseStock: 2, stockGradient: 1, techMinimum: 3 },
  { id: "computers", name: "Computers", basePrice: 875, economyGradient: 22, baseStock: 8, stockGradient: -2, techMinimum: 6 },
  { id: "machinery", name: "Machinery", basePrice: 690, economyGradient: 15, baseStock: 10, stockGradient: -1, techMinimum: 4 },
  { id: "alloys", name: "Alloys", basePrice: 405, economyGradient: 8, baseStock: 13, stockGradient: 0, techMinimum: 3 },
  { id: "firearms", name: "Firearms", basePrice: 1220, economyGradient: 20, baseStock: 4, stockGradient: -1, techMinimum: 5 },
  { id: "furs", name: "Furs", basePrice: 780, economyGradient: -16, baseStock: 7, stockGradient: 2, techMinimum: 1 },
  { id: "minerals", name: "Minerals", basePrice: 145, economyGradient: -4, baseStock: 19, stockGradient: 3, techMinimum: 1 },
  { id: "gold", name: "Gold", basePrice: 3650, economyGradient: 30, baseStock: 2, stockGradient: 0, techMinimum: 4 },
  { id: "platinum", name: "Platinum", basePrice: 4200, economyGradient: 35, baseStock: 1, stockGradient: 0, techMinimum: 6 },
  { id: "gemstones", name: "Gem-Stones", basePrice: 2850, economyGradient: -20, baseStock: 2, stockGradient: 0, techMinimum: 1 },
  { id: "alien-items", name: "Alien Items", basePrice: 6200, economyGradient: 0, baseStock: 0, stockGradient: 0, techMinimum: 12 },
];

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createMarket(system: SystemModel): MarketItem[] {
  const random = seededRandom(system.goatSoupSeed ^ (system.index << 8));
  return COMMODITIES.map((commodity) => {
    const techPenalty = system.techLevel < commodity.techMinimum
      ? (commodity.techMinimum - system.techLevel) * 0.55
      : 0;
    const economyOffset = system.economy - 3.5;
    const jitter = (random() - 0.5) * commodity.basePrice * 0.16;
    const price = Math.max(1, Math.round(
      commodity.basePrice
      + economyOffset * commodity.economyGradient * 8
      + techPenalty * commodity.basePrice
      + jitter,
    ));

    const stockNoise = Math.floor(random() * 6);
    const stock = system.techLevel < commodity.techMinimum
      ? 0
      : Math.max(0, Math.round(
        commodity.baseStock
        + economyOffset * commodity.stockGradient
        + stockNoise,
      ));

    return { commodity, price, stock };
  });
}

export function createCommanderLedger(): CommanderLedger {
  const saved = window.localStorage.getItem(SAVE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as CommanderLedger;
      return {
        credits: Number.isFinite(parsed.credits) ? parsed.credits : 1000,
        cargoCapacity: Number.isFinite(parsed.cargoCapacity) ? parsed.cargoCapacity : 35,
        cargo: parsed.cargo && typeof parsed.cargo === "object" ? parsed.cargo : {},
      };
    } catch {
      window.localStorage.removeItem(SAVE_KEY);
    }
  }

  return { credits: 1000, cargoCapacity: 35, cargo: {} };
}

export function saveCommanderLedger(ledger: CommanderLedger): void {
  window.localStorage.setItem(SAVE_KEY, JSON.stringify(ledger));
}

export function cargoUsed(ledger: CommanderLedger): number {
  return Object.values(ledger.cargo).reduce((total, amount) => total + amount, 0);
}
