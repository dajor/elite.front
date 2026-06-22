import type { NavigationTelemetry } from "../game/navigation.ts";

export interface NavigationHud {
  update(telemetry: NavigationTelemetry): void;
}

function appendRow(root: HTMLElement, label: string): HTMLElement {
  const labelEl = document.createElement("span");
  labelEl.textContent = label;
  const valueEl = document.createElement("strong");
  valueEl.dataset.navValue = label.toLowerCase();
  valueEl.textContent = "0";
  root.append(labelEl, valueEl);
  return valueEl;
}

export function createNavigationHud(host: HTMLElement): NavigationHud {
  const root = document.createElement("section");
  root.id = "navigation-hud";

  const current = appendRow(root, "CUR");
  const destination = appendRow(root, "DST");
  const distance = appendRow(root, "LY");
  const docking = appendRow(root, "DCK");
  const hyperspace = appendRow(root, "HYP");
  const fuel = appendRow(root, "FUEL");

  const overlay = document.createElement("div");
  overlay.id = "hyperspace-overlay";

  host.append(root, overlay);

  return {
    update(telemetry: NavigationTelemetry): void {
      current.textContent = telemetry.currentSystemName.toUpperCase();
      destination.textContent = telemetry.destinationName.toUpperCase();
      distance.textContent = telemetry.destinationDistance.toFixed(1);
      docking.textContent = telemetry.dockingStatus;
      hyperspace.textContent = telemetry.hyperspaceStatus;
      fuel.textContent = telemetry.fuel.toFixed(1);
      overlay.classList.toggle("active", telemetry.hyperspaceStatus !== "READY");
    },
  };
}
