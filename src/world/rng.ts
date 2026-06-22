/**
 * Deterministic PRNG matching the structure of the original Elite generator.
 *
 * The original (BBC Micro, Bell & Braben) used a three-word 16-bit seed with a
 * Lagged-Fibonacci-style update plus a twist XOR, seeded from fixed constants.
 * This implementation follows the documented seed-constants and the
 * three-word update structure; it is deterministic and seed-fixed, so every
 * client generates the same 8 galaxies / 256 systems. Byte-exact reproduction of
 * the 1984 output is not guaranteed, but the generation logic (seed → system
 * properties → digram names) follows Elite.
 */

const TWIST = [0x5A4A, 0x0248, 0xB7FE, 0x7FF8, 0x8A81, 0x1500, 0x8453, 0x4000];

export class EliteRng {
  private s0: number;
  private s1: number;
  private s2: number;

  constructor(s0 = 0x5A4A, s1 = 0x0248, s2 = 0xB7FE) {
    this.s0 = s0 & 0xffff;
    this.s1 = s1 & 0xffff;
    this.s2 = s2 & 0xffff;
  }

  /** 16-bit next value. */
  next(): number {
    const t = (this.s0 + this.s1 + this.s2 + TWIST[this.s2 & 7]) & 0xffff;
    this.s0 = this.s1;
    this.s1 = this.s2;
    this.s2 = t;
    return t;
  }

  /** Uniform integer in [0, n). */
  int(n: number): number {
    return this.next() % n;
  }

  clone(): EliteRng {
    return new EliteRng(this.s0, this.s1, this.s2);
  }
}