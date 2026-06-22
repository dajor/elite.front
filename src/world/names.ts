/**
 * Digram-based system-name generation following the original Elite approach:
 * RNG picks an index into a table, each step emits two chars, terminates on '.'
 * or when enough chars are emitted. The original Elite pairs table has sparse
 * '.' terminators distributed to produce the iconic short names (Lave, Diso,
 * Zaonce, Ried). This reconstruction uses the documented digram alphabet with a
 * termination probability calibrated to match the original's average name
 * length (~4–6 chars).
 */

const DIGRAMS =
  "LEXEGEZACEBISO" +
  "USESAMITINESEDEN" +
  "YSEDETIAELLYNTID" +
  "EDARCGERAWFSOELY" +
  "BONTINSTSLDEQJED" +
  "RISALITRANAROLDS" +
  "OUREDALONIABEDELA";

/** Number of distinct digrams available. */
const N = Math.floor(DIGRAMS.length / 2);

export function generateName(rng: { int: (n: number) => number }): string {
  let name = "";
  for (let step = 0; step < 8; step++) {
    const idx = rng.int(N) * 2;
    name += DIGRAMS.slice(idx, idx + 2).toLowerCase();
    // Elite-like early termination: stop once we have a plausible name length.
    // Calibration: ~35% chance to stop each step after the first, biasing short.
    if (name.length >= 3 && rng.int(100) < 35) break;
    if (name.length >= 7) break;
  }
  if (name.length === 0) name = "xxxx";
  return name.charAt(0).toUpperCase() + name.slice(1);
}