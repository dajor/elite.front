import { Scene } from "@babylonjs/core/scene";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Axis, Space } from "@babylonjs/core/Maths/math.axis";

import { applyNeonEdges, createNeonMaterial } from "./neon.ts";

/**
 * Coriolis station: octagonal prism (original Elite silhouette), rotating
 * around Y. A docking slot is implied on one face; real docking logic lands in
 * Phase 7. Here we only build the visual.
 */
export function createCoriolisStation(scene: Scene): Mesh {
  const stationColor = new Color3(0.12, 0.78, 1.0);
  const slotColor = new Color3(1.0, 0.45, 0.12);
  const station = MeshBuilder.CreateCylinder("station", {
    diameter: 60,
    height: 30,
    tessellation: 8,
  }, scene);
  station.rotation.x = Math.PI / 2;

  station.material = createNeonMaterial(scene, "stationMat", stationColor, { wireframe: true });
  station.alwaysSelectAsActiveMesh = true;
  applyNeonEdges(station, stationColor, 2.2);

  const slotMat = createNeonMaterial(scene, "stationSlotMat", slotColor, {
    emissiveScale: 1.4,
    wireframe: false,
  });
  const slotBars = [
    MeshBuilder.CreateBox("slotTop", { width: 19, height: 0.5, depth: 1.2 }, scene),
    MeshBuilder.CreateBox("slotBottom", { width: 19, height: 0.5, depth: 1.2 }, scene),
    MeshBuilder.CreateBox("slotLeft", { width: 0.7, height: 0.5, depth: 7.2 }, scene),
    MeshBuilder.CreateBox("slotRight", { width: 0.7, height: 0.5, depth: 7.2 }, scene),
  ];
  const slotPositions: Array<[number, number, number]> = [
    [0, -15.6, 4.1],
    [0, -15.6, -4.1],
    [-9.8, -15.6, 0],
    [9.8, -15.6, 0],
  ];
  slotBars.forEach((bar, index) => {
    const [x, y, z] = slotPositions[index];
    bar.parent = station;
    bar.position.set(x, y, z);
    bar.material = slotMat;
    applyNeonEdges(bar, slotColor, 3);
  });

  scene.registerBeforeRender(() => {
    station.rotate(Axis.Y, 0.003, Space.LOCAL);
  });

  return station;
}
