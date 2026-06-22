import type { CombatTelemetry, RadarContact } from "../game/combat.ts";

export interface CombatHud {
  update(telemetry: CombatTelemetry): void;
}

function appendHudRow(root: HTMLElement, label: string): HTMLElement {
  const labelEl = document.createElement("span");
  labelEl.textContent = label;
  const valueEl = document.createElement("strong");
  valueEl.dataset.combatValue = label.toLowerCase();
  valueEl.textContent = "0";
  root.append(labelEl, valueEl);
  return valueEl;
}

function formatDistance(distance: number): string {
  return distance >= 1000 ? `${(distance / 1000).toFixed(1)}K` : distance.toFixed(0);
}

function placeDot(radar: HTMLElement, contact: RadarContact): void {
  const range = 260;
  const dot = document.createElement("i");
  dot.className = [
    "radar-dot",
    contact.hostile ? "hostile" : "neutral",
    contact.targeted ? "targeted" : "",
    contact.alive ? "" : "dead",
  ].filter(Boolean).join(" ");

  const x = Math.max(-1, Math.min(1, contact.x / range));
  const y = Math.max(-1, Math.min(1, contact.z / range));
  dot.style.left = `${50 + x * 43}%`;
  dot.style.top = `${50 - y * 43}%`;
  dot.style.opacity = contact.z >= 0 ? "1" : "0.42";
  dot.style.transform = `translate(-50%, -50%) scale(${Math.max(0.72, Math.min(1.35, 1.2 - Math.abs(contact.y) / 180))})`;
  dot.title = contact.name;
  radar.appendChild(dot);
}

export function createCombatHud(host: HTMLElement): CombatHud {
  const root = document.createElement("section");
  root.id = "combat-hud";

  const target = appendHudRow(root, "TGT");
  const range = appendHudRow(root, "RNG");
  const shield = appendHudRow(root, "SHD");
  const hull = appendHudRow(root, "HUL");
  const missiles = appendHudRow(root, "MSL");
  const heat = appendHudRow(root, "HT");

  const radar = document.createElement("div");
  radar.id = "radar";
  radar.appendChild(document.createElement("b"));
  root.appendChild(radar);

  host.appendChild(root);

  return {
    update(telemetry: CombatTelemetry): void {
      target.textContent = telemetry.targetName.toUpperCase();
      range.textContent = formatDistance(telemetry.targetDistance);
      shield.textContent = Math.round(telemetry.targetShield).toString();
      hull.textContent = Math.round(telemetry.targetHull).toString();
      missiles.textContent = telemetry.missileCount.toString();
      heat.textContent = `${Math.round(telemetry.laserHeat * 100)}%`;

      radar.replaceChildren(document.createElement("b"));
      telemetry.contacts.forEach((contact) => placeDot(radar, contact));
    },
  };
}
