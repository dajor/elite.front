import { Scene } from "@babylonjs/core/scene";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import "@babylonjs/core/Rendering/edgesRenderer";

interface NeonMaterialOptions {
  alpha?: number;
  emissiveScale?: number;
  wireframe?: boolean;
}

export function createNeonMaterial(
  scene: Scene,
  name: string,
  color: Color3,
  options: NeonMaterialOptions = {},
): StandardMaterial {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = color.scale(0.04);
  mat.emissiveColor = color.scale(options.emissiveScale ?? 1);
  mat.specularColor = new Color3(0, 0, 0);
  mat.disableLighting = true;
  mat.wireframe = options.wireframe ?? true;
  mat.alpha = options.alpha ?? 1;
  return mat;
}

export function applyNeonEdges(mesh: AbstractMesh, color: Color3, width = 2.5): void {
  mesh.enableEdgesRendering(0.98);
  mesh.edgesWidth = width;
  mesh.edgesColor = new Color4(color.r, color.g, color.b, 1);
}
