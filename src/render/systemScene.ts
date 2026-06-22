import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { PointsCloudSystem } from "@babylonjs/core/Particles/pointsCloudSystem";
import type { SolidParticle } from "@babylonjs/core/Particles/solidParticle";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";

import type { SystemModel } from "../world/types.ts";
import { attachCombat, type CombatTelemetry } from "../game/combat.ts";
import { attachPlayerFlight, type FlightTelemetry } from "../game/flight.ts";
import { attachNavigation, type NavigationTelemetry } from "../game/navigation.ts";
import { createPlanet } from "./planet.ts";
import { createCoriolisStation } from "./station.ts";
import { createShipMesh, SHIPS } from "./ship.ts";
import { configurePostFX } from "./postfx.ts";

export interface SystemSceneOptions {
  onFlightUpdate?: (telemetry: FlightTelemetry) => void;
  onCombatUpdate?: (telemetry: CombatTelemetry) => void;
  destination?: SystemModel;
  destinationDistance?: number;
  fuel?: number;
  onNavigationUpdate?: (telemetry: NavigationTelemetry) => void;
  onDocked?: () => void;
  onJumpComplete?: (destination: SystemModel) => void;
}

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

function createStarfield(scene: Scene, system: SystemModel): void {
  const random = seededRandom(system.goatSoupSeed);
  const pcs = new PointsCloudSystem("stars", 2.25, scene);
  pcs.addPoints(3200, (particle: SolidParticle) => {
    const r = 650 + random() * 1750;
    const theta = Math.acos(2 * random() - 1);
    const phi = random() * Math.PI * 2;
    particle.position = new Vector3(
      r * Math.sin(theta) * Math.cos(phi),
      r * Math.sin(theta) * Math.sin(phi),
      r * Math.cos(theta),
    );
    const intensity = 0.55 + random() * 0.45;
    particle.color = new Color4(intensity * 0.75, intensity * 0.9, intensity, 1);
  });

  const starMat = new StandardMaterial("starMat", scene);
  starMat.pointsCloud = true;
  starMat.pointSize = 2.25;
  starMat.emissiveColor = new Color3(0.7, 0.9, 1);
  starMat.disableLighting = true;

  void pcs.buildMeshAsync().then((mesh) => {
    mesh.material = starMat;
    mesh.alwaysSelectAsActiveMesh = true;
  });
}

/**
 * A single Raumsystem scene: starfield + planet + rotating Coriolis station +
 * the player ship (Cobra Mk III placeholder). Camera sits behind the ship.
 */
export function createSystemScene(
  engine: Engine,
  system: SystemModel,
  options: SystemSceneOptions = {},
): Scene {
  const scene = new Scene(engine);
  scene.clearColor.set(0, 0, 0, 1);

  const camera = new UniversalCamera("cam", new Vector3(0, 9, -42), scene);
  camera.setTarget(new Vector3(0, -1, 105));
  camera.fov = 1.1;
  camera.minZ = 0.1;
  camera.maxZ = 6000;
  scene.activeCamera = camera;

  const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
  light.intensity = 0.18;

  createStarfield(scene, system);
  createPlanet(scene, system);

  const station = createCoriolisStation(scene);
  station.position = new Vector3(0, 0, 118);

  const playerShip = createShipMesh(scene, SHIPS.cobra3, "playerCobra");
  playerShip.position = new Vector3(0, -5.4, 18);
  playerShip.rotation.set(-0.08, 0, 0);
  let activeViewDirection = playerShip.getDirection(Vector3.Forward()).normalize();
  attachPlayerFlight(scene, playerShip, camera, SHIPS.cobra3, {
    onUpdate: (telemetry) => {
      activeViewDirection = new Vector3(
        telemetry.viewDirection.x,
        telemetry.viewDirection.y,
        telemetry.viewDirection.z,
      ).normalize();
      options.onFlightUpdate?.(telemetry);
    },
  });

  const traffic = [
    { id: "sidewinder", name: "Sidewinder", def: SHIPS.sidewinder, hostile: true, mesh: createShipMesh(scene, SHIPS.sidewinder, "sidewinderPatrol"), base: new Vector3(-17, 5, 83), phase: 0.2, turn: 0.35 },
    { id: "viper", name: "Viper", def: SHIPS.viper, hostile: false, mesh: createShipMesh(scene, SHIPS.viper, "viperEscort"), base: new Vector3(20, -3, 104), phase: 1.8, turn: -0.55 },
    { id: "python", name: "Python", def: SHIPS.python, hostile: false, mesh: createShipMesh(scene, SHIPS.python, "pythonTrader"), base: new Vector3(-34, -7, 150), phase: 2.7, turn: 0.18 },
    { id: "thargoid", name: "Thargoid", def: SHIPS.thargoid, hostile: true, mesh: createShipMesh(scene, SHIPS.thargoid, "distantThargoid"), base: new Vector3(52, 21, 205), phase: 4.1, turn: -0.24 },
  ];
  traffic[0].mesh.rotation.set(0.1, -0.7, 0.15);
  traffic[1].mesh.rotation.set(-0.08, 0.55, -0.12);
  traffic[2].mesh.rotation.set(0.04, -1.1, 0.04);
  traffic[3].mesh.rotation.set(0.4, 0.2, 0.0);

  attachCombat(scene, playerShip, traffic.map(({ id, name, mesh, def, hostile }) => ({
    id,
    name,
    mesh,
    def,
    hostile,
  })), {
    onUpdate: options.onCombatUpdate,
    getAimDirection: () => activeViewDirection,
  });

  if (options.destination) {
    attachNavigation(
      scene,
      playerShip,
      station,
      system,
      options.destination,
      options.destinationDistance ?? 0,
      {
        fuel: options.fuel ?? 7,
        onUpdate: options.onNavigationUpdate,
        onDocked: options.onDocked,
        onJumpComplete: options.onJumpComplete,
      },
    );
  }

  let elapsed = 0;
  scene.registerBeforeRender(() => {
    const dt = scene.getEngine().getDeltaTime() / 1000;
    elapsed += dt;

    traffic.forEach(({ mesh, base, phase, turn }) => {
      mesh.position.x = base.x + Math.sin(elapsed * 0.45 + phase) * 1.2;
      mesh.position.y = base.y + Math.cos(elapsed * 0.52 + phase) * 0.75;
      mesh.position.z = base.z + Math.sin(elapsed * 0.34 + phase) * 1.5;
      mesh.rotation.y += dt * turn;
      mesh.rotation.z += dt * turn * 0.25;
    });
  });

  configurePostFX(scene);
  return scene;
}
