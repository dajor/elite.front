import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { LinesMesh } from "@babylonjs/core/Meshes/linesMesh";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Axis } from "@babylonjs/core/Maths/math.axis";
import { KeyboardEventTypes } from "@babylonjs/core/Events/keyboardEvents";

import type { ShipDef } from "../render/ship.ts";
import { createNeonMaterial } from "../render/neon.ts";

export interface CombatContact {
  id: string;
  name: string;
  mesh: Mesh;
  def: ShipDef;
  hostile: boolean;
}

export interface RadarContact {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  distance: number;
  hostile: boolean;
  targeted: boolean;
  alive: boolean;
}

export interface CombatTelemetry {
  targetName: string;
  targetDistance: number;
  targetShield: number;
  targetHull: number;
  missileCount: number;
  laserHeat: number;
  contacts: RadarContact[];
}

export interface CombatController {
  dispose(): void;
}

interface CombatOptions {
  getTimeScale?: () => number;
  onUpdate?: (telemetry: CombatTelemetry) => void;
  getAimDirection?: () => Vector3;
}

interface ContactState {
  contact: CombatContact;
  shield: number;
  hull: number;
  alive: boolean;
}

interface Beam {
  mesh: LinesMesh;
  ttl: number;
}

interface Missile {
  mesh: Mesh;
  target: ContactState;
  ttl: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function damageContact(state: ContactState, amount: number): void {
  if (!state.alive) return;
  const shieldDamage = Math.min(state.shield, amount);
  state.shield -= shieldDamage;
  state.hull -= amount - shieldDamage;
  if (state.hull <= 0) {
    state.hull = 0;
    state.alive = false;
    state.contact.mesh.setEnabled(false);
  }
}

function makeHealth(contact: CombatContact): ContactState {
  return {
    contact,
    shield: Math.max(contact.def.shield, Math.round(contact.def.hull * 0.25)),
    hull: contact.def.hull,
    alive: true,
  };
}

function nearestAimTarget(
  player: Mesh,
  contacts: ContactState[],
  aimDirection: Vector3,
  maxRange: number,
  minDot: number,
): ContactState | undefined {
  const origin = player.position;
  const direction = aimDirection.normalize();
  let best: ContactState | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  contacts.forEach((state) => {
    if (!state.alive) return;
    const offset = state.contact.mesh.position.subtract(origin);
    const distance = offset.length();
    if (distance > maxRange) return;
    const dot = Vector3.Dot(direction, offset.normalize());
    if (dot < minDot || distance >= bestDistance) return;
    best = state;
    bestDistance = distance;
  });

  return best;
}

function createBeam(scene: Scene, start: Vector3, end: Vector3): LinesMesh {
  const beam = MeshBuilder.CreateLines("laserBeam", {
    points: [start, end],
    updatable: false,
  }, scene);
  beam.color = new Color3(1, 0.18, 0.08);
  beam.alwaysSelectAsActiveMesh = true;
  return beam;
}

function createMissile(scene: Scene, start: Vector3): Mesh {
  const missile = MeshBuilder.CreateIcoSphere("missile", { radius: 0.7, subdivisions: 1 }, scene);
  missile.position.copyFrom(start);
  missile.material = createNeonMaterial(scene, "missileMat", new Color3(1, 0.88, 0.2), {
    emissiveScale: 1.4,
    wireframe: true,
  });
  missile.alwaysSelectAsActiveMesh = true;
  return missile;
}

function cycleTarget(states: ContactState[], currentIndex: number): number {
  for (let offset = 1; offset <= states.length; offset++) {
    const next = (currentIndex + offset) % states.length;
    if (states[next].alive) return next;
  }
  return currentIndex;
}

export function attachCombat(
  scene: Scene,
  player: Mesh,
  contacts: CombatContact[],
  options: CombatOptions = {},
): CombatController {
  const states = contacts.map(makeHealth);
  const beams: Beam[] = [];
  const missiles: Missile[] = [];
  const pressed = new Set<string>();
  let targetIndex = 0;
  let missileCount = 4;
  let laserHeat = 0;
  let laserCooldown = 0;

  const handledKeys = new Set(["Space", "KeyM", "KeyR"]);

  function currentTarget(): ContactState | undefined {
    return states[targetIndex]?.alive ? states[targetIndex] : states.find((state) => state.alive);
  }

  function fireLaser(): void {
    if (laserCooldown > 0 || laserHeat > 0.96) return;
    const aimDirection = (options.getAimDirection?.() ?? player.getDirection(Axis.Z)).normalize();
    const start = player.position.add(aimDirection.scale(3.8));
    const end = start.add(aimDirection.scale(230));
    beams.push({ mesh: createBeam(scene, start, end), ttl: 0.08 });
    laserHeat = clamp(laserHeat + 0.22, 0, 1);
    laserCooldown = 0.14;

    const hit = nearestAimTarget(player, states, aimDirection, 230, 0.992);
    if (hit) damageContact(hit, 42);
  }

  function fireMissile(): void {
    const target = currentTarget();
    if (!target || missileCount <= 0) return;
    missileCount -= 1;
    const start = player.position.add(player.getDirection(Axis.Z).normalize().scale(5));
    missiles.push({ mesh: createMissile(scene, start), target, ttl: 7.5 });
  }

  const keyboardObserver = scene.onKeyboardObservable.add((info) => {
    const code = info.event.code;
    if (!handledKeys.has(code)) return;
    info.event.preventDefault();

    if (info.type === KeyboardEventTypes.KEYDOWN) {
      const firstPress = !pressed.has(code);
      pressed.add(code);
      if (!firstPress) return;
      if (code === "Space") fireLaser();
      if (code === "KeyM") fireMissile();
      if (code === "KeyR") targetIndex = cycleTarget(states, targetIndex);
    } else if (info.type === KeyboardEventTypes.KEYUP) {
      pressed.delete(code);
    }
  });

  const updateObserver = scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min((scene.getEngine().getDeltaTime() / 1000) * (options.getTimeScale?.() ?? 1), 0.25);
    laserCooldown = Math.max(0, laserCooldown - dt);
    laserHeat = Math.max(0, laserHeat - dt * 0.32);

    for (let i = beams.length - 1; i >= 0; i--) {
      beams[i].ttl -= dt;
      if (beams[i].ttl <= 0) {
        beams[i].mesh.dispose();
        beams.splice(i, 1);
      }
    }

    for (let i = missiles.length - 1; i >= 0; i--) {
      const missile = missiles[i];
      missile.ttl -= dt;
      if (missile.ttl <= 0 || !missile.target.alive) {
        missile.mesh.dispose();
        missiles.splice(i, 1);
        continue;
      }

      const toTarget = missile.target.contact.mesh.position.subtract(missile.mesh.position);
      const distance = toTarget.length();
      if (distance < 2.8) {
        damageContact(missile.target, 145);
        missile.mesh.dispose();
        missiles.splice(i, 1);
        continue;
      }

      const direction = toTarget.normalize();
      missile.mesh.position.addInPlace(direction.scale(96 * dt));
      missile.mesh.rotation.y += dt * 8;
      missile.mesh.rotation.x += dt * 5;
    }

    const right = player.getDirection(Axis.X).normalize();
    const up = player.getDirection(Axis.Y).normalize();
    const forward = player.getDirection(Axis.Z).normalize();
    const target = currentTarget();
    const targetDistance = target ? Vector3.Distance(player.position, target.contact.mesh.position) : 0;

    options.onUpdate?.({
      targetName: target?.contact.name ?? "NONE",
      targetDistance,
      targetShield: target?.shield ?? 0,
      targetHull: target?.hull ?? 0,
      missileCount,
      laserHeat,
      contacts: states.map((state) => {
        const relative = state.contact.mesh.position.subtract(player.position);
        return {
          id: state.contact.id,
          name: state.contact.name,
          x: Vector3.Dot(relative, right),
          y: Vector3.Dot(relative, up),
          z: Vector3.Dot(relative, forward),
          distance: relative.length(),
          hostile: state.contact.hostile,
          targeted: target?.contact.id === state.contact.id,
          alive: state.alive,
        };
      }),
    });
  });

  return {
    dispose(): void {
      scene.onKeyboardObservable.remove(keyboardObserver);
      scene.onBeforeRenderObservable.remove(updateObserver);
      beams.forEach((beam) => beam.mesh.dispose());
      missiles.forEach((missile) => missile.mesh.dispose());
      pressed.clear();
    },
  };
}
