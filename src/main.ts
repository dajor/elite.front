import { Engine } from "@babylonjs/core/Engines/engine";
import type { Scene } from "@babylonjs/core/scene";
import { generateGalaxy } from "./world/galaxy.ts";
import type { GalaxyModel, SystemModel } from "./world/types.ts";
import { createSystemScene } from "./render/systemScene.ts";
import type { CombatTelemetry } from "./game/combat.ts";
import type { FlightTelemetry } from "./game/flight.ts";
import type { NavigationTelemetry } from "./game/navigation.ts";
import { createCommanderLedger, createMarket } from "./game/economy.ts";
import { createCombatHud } from "./ui/combatHud.ts";
import { createNavigationHud } from "./ui/navigationHud.ts";
import { createHelpOverlay } from "./ui/helpOverlay.ts";
import { createTradePanel, type TradePanel } from "./ui/tradePanel.ts";

interface Hud {
  setSystem(systemName: string): void;
  update(telemetry: FlightTelemetry): void;
}

const MAX_FUEL = 7;

function appendHudRow(root: HTMLElement, label: string): HTMLElement {
  const labelEl = document.createElement("span");
  labelEl.textContent = label;
  const valueEl = document.createElement("strong");
  valueEl.dataset.value = label.toLowerCase();
  valueEl.textContent = "0";
  root.append(labelEl, valueEl);
  return valueEl;
}

function createHud(host: HTMLElement, systemName: string): Hud {
  const root = document.createElement("div");
  root.id = "hud";

  const systemLabel = document.createElement("span");
  systemLabel.textContent = "SYS";
  const systemValue = document.createElement("strong");
  systemValue.textContent = systemName.toUpperCase();
  root.append(systemLabel, systemValue);

  const speed = appendHudRow(root, "SPD");
  const throttle = appendHudRow(root, "THR");
  const time = appendHudRow(root, "TIM");
  const autopilot = appendHudRow(root, "AP");
  const view = appendHudRow(root, "VIEW");
  const position = appendHudRow(root, "POS");
  host.appendChild(root);

  return {
    setSystem(nextSystemName: string): void {
      systemValue.textContent = nextSystemName.toUpperCase();
    },
    update(telemetry: FlightTelemetry): void {
      speed.textContent = telemetry.speed.toFixed(1);
      throttle.textContent = `${Math.round(telemetry.throttle * 100)}%`;
      time.textContent = `${telemetry.timeScale}X`;
      autopilot.textContent = telemetry.autopilotMode;
      view.textContent = telemetry.viewMode;
      position.textContent = `${telemetry.position.x.toFixed(0)} ${telemetry.position.y.toFixed(0)} ${telemetry.position.z.toFixed(0)}`;
    },
  };
}

function systemDistanceLj(a: SystemModel, b: SystemModel): number {
  return Math.hypot(a.x - b.x, a.y - b.y) / 4;
}

function nextReachableSystem(galaxy: GalaxyModel, current: SystemModel): { system: SystemModel; distance: number } {
  const candidates = galaxy.systems
    .filter((system) => system.index !== current.index)
    .map((system) => ({ system, distance: systemDistanceLj(current, system) }))
    .filter(({ distance }) => distance > 0 && distance <= MAX_FUEL)
    .sort((a, b) => a.distance - b.distance || a.system.index - b.system.index);

  if (candidates[0]) return candidates[0];
  const fallback = galaxy.systems[(current.index + 1) % galaxy.systems.length];
  return { system: fallback, distance: systemDistanceLj(current, fallback) };
}

/** Entry point: build galaxy 0, drop the player at system 0 (Lave-analog). */
function boot(): void {
  const host = document.getElementById("app");
  if (!host) throw new Error("#app mount not found");
  const appHost = host;

  const canvas = document.createElement("canvas");
  canvas.tabIndex = 0;
  canvas.style.backgroundColor = "#000";
  appHost.appendChild(canvas);
  canvas.focus();

  const engine = new Engine(canvas, true, {
    alpha: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    stencil: true,
  });
  const galaxy = generateGalaxy(0);
  const startSystem = galaxy.systems[0];
  const ledger = createCommanderLedger();
  const hud = createHud(appHost, startSystem.name);
  const combatHud = createCombatHud(appHost);
  const navigationHud = createNavigationHud(appHost);
  const helpOverlay = createHelpOverlay(appHost, () => canvas.focus());
  let activeScene: Scene | undefined;
  let tradePanel: TradePanel | undefined;

  function loadSystem(system: SystemModel): void {
    const previousScene = activeScene;
    tradePanel?.dispose();
    hud.setSystem(system.name);

    tradePanel = createTradePanel(appHost, createMarket(system), ledger);
    if (window.location.hash === "#trade") tradePanel.setOpen(true);

    const destination = nextReachableSystem(galaxy, system);
    const nextScene = createSystemScene(engine, system, {
      destination: destination.system,
      destinationDistance: destination.distance,
      fuel: MAX_FUEL,
      onFlightUpdate: (telemetry) => hud.update(telemetry),
      onCombatUpdate: (telemetry: CombatTelemetry) => combatHud.update(telemetry),
      onNavigationUpdate: (telemetry: NavigationTelemetry) => navigationHud.update(telemetry),
      onDocked: () => tradePanel?.setOpen(true),
      onJumpComplete: (nextSystem) => {
        window.location.hash = "";
        loadSystem(nextSystem);
      },
    });
    activeScene = nextScene;
    if (previousScene) {
      window.setTimeout(() => previousScene.dispose(), 0);
    }
  }

  hud.setSystem(startSystem.name);
  window.addEventListener("keydown", (event) => {
    if (event.code === "KeyH" || event.key === "?") {
      event.preventDefault();
      helpOverlay.toggle();
    }
    if (event.code === "KeyT") {
      event.preventDefault();
      tradePanel?.toggle();
    }
    if (event.code === "Escape") {
      helpOverlay.setOpen(false);
      tradePanel?.setOpen(false);
    }
  });

  loadSystem(startSystem);

  engine.runRenderLoop(() => activeScene?.render());
  window.addEventListener("resize", () => engine.resize());

  console.info(`[elite] started at ${startSystem.name} (sys #${startSystem.index}, galaxy ${startSystem.galaxy})`);
}

boot();
