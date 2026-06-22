import { generateGalaxy } from "./galaxy.ts";

const g = generateGalaxy(0);
console.log(`Galaxy ${g.index}: ${g.systems.length} systems`);
for (const s of g.systems.slice(0, 8)) {
  console.log(
    `  #${String(s.index).padStart(3, "0")} ${s.name.padEnd(10)} ` +
      `pos=(${s.x},${s.y}) eco=${s.economy} gov=${s.government} ` +
      `tech=${s.techLevel} pop=${s.population} prod=${s.productivity} r=${s.radius}`,
  );
}

// Determinism check: two runs must match.
const g2 = generateGalaxy(0);
const same = g.systems.every((s, i) => s.name === g2.systems[i].name);
console.log(`determinism: ${same ? "OK" : "FAIL"}`);

// Range checks
const oob = g.systems.filter(
  (s) =>
    s.techLevel < 1 || s.techLevel > 15 ||
    s.economy < 0 || s.economy > 7 ||
    s.government < 0 || s.government > 7,
);
console.log(`range-violations: ${oob.length === 0 ? "OK" : oob.length + " FAIL"}`);