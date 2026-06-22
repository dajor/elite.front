import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { SystemModel } from "../world/types.ts";

import { applyNeonEdges, createNeonMaterial } from "./neon.ts";

function planetColor(economy: number): Color3 {
  if (economy <= 3) return new Color3(0.2, 0.5, 0.3);
  if (economy <= 5) return new Color3(0.45, 0.35, 0.2);
  return new Color3(0.3, 0.55, 0.35);
}

export function createPlanet(scene: Scene, system: SystemModel): Mesh {
  const color = planetColor(system.economy);
  const planet = MeshBuilder.CreateIcoSphere("planet", { radius: 42, subdivisions: 3 }, scene);
  planet.position = new Vector3(135, -18, 310);
  planet.rotation.x = 0.34;
  planet.rotation.z = -0.18;

  planet.material = createNeonMaterial(scene, "planetMat", color, {
    alpha: 0.92,
    emissiveScale: 0.75,
    wireframe: true,
  });
  planet.alwaysSelectAsActiveMesh = true;
  applyNeonEdges(planet, color, 1.4);

  const ringMat = createNeonMaterial(scene, "planetGridMat", color.scale(1.35), {
    alpha: 0.55,
    wireframe: true,
  });
  const rings = [
    MeshBuilder.CreateTorus("planetEquator", { diameter: 85, thickness: 0.18, tessellation: 72 }, scene),
    MeshBuilder.CreateTorus("planetMeridianA", { diameter: 85, thickness: 0.14, tessellation: 72 }, scene),
    MeshBuilder.CreateTorus("planetMeridianB", { diameter: 85, thickness: 0.14, tessellation: 72 }, scene),
  ];
  rings[1].rotation.x = Math.PI / 2;
  rings[2].rotation.y = Math.PI / 2;
  rings.forEach((ring) => {
    ring.parent = planet;
    ring.material = ringMat;
  });

  scene.registerBeforeRender(() => {
    planet.rotation.y += 0.0008;
  });

  return planet;
}
