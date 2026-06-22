import { Scene } from "@babylonjs/core/scene";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";

import { applyNeonEdges, createNeonMaterial } from "./neon.ts";

export interface ShipDef {
  id: string;
  name: string;
  cargo: number;
  maxSpeed: number;
  agility: number;
  hull: number;
  shield: number;
  price: number;
  size: { length: number; width: number; depth: number };
  color: Color3;
}

export const SHIPS: Record<string, ShipDef> = {
  cobra3: {
    id: "cobra3", name: "Cobra Mk III", cargo: 35, maxSpeed: 320, agility: 5,
    hull: 256, shield: 0, price: 390000,
    size: { length: 6, width: 4, depth: 2 }, color: new Color3(0.2, 0.6, 1.0),
  },
  sidewinder: {
    id: "sidewinder", name: "Sidewinder", cargo: 10, maxSpeed: 280, agility: 7,
    hull: 80, shield: 0, price: 73000,
    size: { length: 4, width: 3, depth: 1.5 }, color: new Color3(1.0, 0.3, 0.2),
  },
  viper: {
    id: "viper", name: "Viper", cargo: 20, maxSpeed: 360, agility: 8,
    hull: 180, shield: 0, price: 85000,
    size: { length: 5, width: 3, depth: 1.5 }, color: new Color3(0.3, 0.4, 1.0),
  },
  python: {
    id: "python", name: "Python", cargo: 100, maxSpeed: 200, agility: 3,
    hull: 400, shield: 0, price: 180000,
    size: { length: 8, width: 5, depth: 3 }, color: new Color3(0.8, 0.7, 0.3),
  },
  anaconda: {
    id: "anaconda", name: "Anaconda", cargo: 175, maxSpeed: 180, agility: 2,
    hull: 600, shield: 0, price: 410000,
    size: { length: 11, width: 6, depth: 4 }, color: new Color3(0.6, 0.6, 0.5),
  },
  thargoid: {
    id: "thargoid", name: "Thargoid", cargo: 0, maxSpeed: 300, agility: 6,
    hull: 800, shield: 100, price: 0,
    size: { length: 6, width: 6, depth: 2 }, color: new Color3(0.3, 1.0, 0.4),
  },
};

type HullPoint = [x: number, y: number, z: number];
type HullFace = [a: number, b: number, c: number];

interface HullDef {
  points: HullPoint[];
  faces: HullFace[];
}

const WEDGE_HULL: HullDef = {
  points: [
    [0, 0.02, 0.58],
    [-0.5, -0.04, 0.04],
    [0.5, -0.04, 0.04],
    [-0.4, 0.1, -0.52],
    [0.4, 0.1, -0.52],
    [0, 0.35, -0.2],
    [0, -0.32, -0.28],
  ],
  faces: [
    [0, 1, 5],
    [0, 5, 2],
    [0, 2, 6],
    [0, 6, 1],
    [1, 3, 5],
    [5, 4, 2],
    [1, 6, 3],
    [6, 2, 4],
    [3, 4, 5],
    [3, 6, 4],
  ],
};

const NEEDLE_HULL: HullDef = {
  points: [
    [0, 0, 0.6],
    [-0.42, -0.06, 0.0],
    [0.42, -0.06, 0.0],
    [-0.24, 0.18, -0.46],
    [0.24, 0.18, -0.46],
    [0, -0.22, -0.5],
    [0, 0.34, -0.18],
  ],
  faces: [
    [0, 1, 6],
    [0, 6, 2],
    [0, 2, 5],
    [0, 5, 1],
    [1, 3, 6],
    [6, 4, 2],
    [1, 5, 3],
    [5, 2, 4],
    [3, 4, 6],
    [3, 5, 4],
  ],
};

const FREIGHTER_HULL: HullDef = {
  points: [
    [0, 0.12, 0.56],
    [-0.36, -0.18, 0.32],
    [0.36, -0.18, 0.32],
    [-0.5, 0.08, -0.34],
    [0.5, 0.08, -0.34],
    [-0.24, 0.32, -0.54],
    [0.24, 0.32, -0.54],
    [0, -0.34, -0.52],
  ],
  faces: [
    [0, 1, 2],
    [0, 3, 1],
    [0, 2, 4],
    [0, 5, 3],
    [0, 4, 6],
    [0, 6, 5],
    [1, 3, 7],
    [2, 7, 4],
    [3, 5, 7],
    [5, 6, 7],
    [6, 4, 7],
    [1, 7, 2],
  ],
};

function octagonHull(): HullDef {
  const points: HullPoint[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 * i) / 8 + Math.PI / 8;
    points.push([Math.cos(angle) * 0.5, 0.08, Math.sin(angle) * 0.5]);
  }
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 * i) / 8 + Math.PI / 8;
    points.push([Math.cos(angle) * 0.42, -0.08, Math.sin(angle) * 0.42]);
  }
  points.push([0, 0.24, 0], [0, -0.24, 0]);

  const top = 16;
  const bottom = 17;
  const faces: HullFace[] = [];
  for (let i = 0; i < 8; i++) {
    const next = (i + 1) % 8;
    faces.push([top, i, next]);
    faces.push([bottom, next + 8, i + 8]);
    faces.push([i, i + 8, next]);
    faces.push([next, i + 8, next + 8]);
  }
  return { points, faces };
}

function hullForShip(def: ShipDef): HullDef {
  switch (def.id) {
    case "sidewinder":
      return NEEDLE_HULL;
    case "viper":
      return NEEDLE_HULL;
    case "python":
    case "anaconda":
      return FREIGHTER_HULL;
    case "thargoid":
      return octagonHull();
    case "cobra3":
    default:
      return WEDGE_HULL;
  }
}

function applyHull(mesh: Mesh, def: ShipDef, hull: HullDef): void {
  const positions = hull.points.flatMap(([x, y, z]) => [
    x * def.size.width,
    y * def.size.depth,
    z * def.size.length,
  ]);
  const indices = hull.faces.flatMap(([a, b, c]) => [a, b, c]);
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);

  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.applyToMesh(mesh);
}

export function createShipMesh(scene: Scene, def: ShipDef, name = def.id): Mesh {
  const hull = hullForShip(def);
  const mesh = new Mesh(name, scene);
  applyHull(mesh, def, hull);

  const mat = createNeonMaterial(scene, `${name}Mat`, def.color, { wireframe: true });
  mesh.material = mat;
  mesh.alwaysSelectAsActiveMesh = true;
  applyNeonEdges(mesh, def.color, def.id === "thargoid" ? 3.5 : 2.5);

  if (def.id !== "thargoid") {
    const engineGlow = MeshBuilder.CreateDisc(`${name}EngineGlow`, {
      radius: Math.max(0.25, def.size.width * 0.14),
      tessellation: 16,
    }, scene);
    engineGlow.parent = mesh;
    engineGlow.position.z = -def.size.length * 0.52;
    engineGlow.rotation.y = Math.PI;
    engineGlow.material = createNeonMaterial(scene, `${name}EngineMat`, new Color3(0.1, 0.85, 1), {
      alpha: 0.72,
      emissiveScale: 1.5,
      wireframe: false,
    });
  }

  return mesh;
}
