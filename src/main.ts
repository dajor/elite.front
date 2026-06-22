import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { PointsCloudSystem } from "@babylonjs/core/Particles/pointsCloudSystem";
import type { SolidParticle } from "@babylonjs/core/Particles/solidParticle";

/**
 * Phase 1 bootstrap: engine + scene + starfield.
 * Placeholder until Phase 3 render layer lands.
 */
function boot(): void {
  const host = document.getElementById("app");
  if (!host) throw new Error("#app mount not found");

  const canvas = document.createElement("canvas");
  host.appendChild(canvas);

  const engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true });
  const scene = new Scene(engine);
  scene.clearColor.set(0, 0, 0, 1);

  const camera = new FreeCamera("cam", new Vector3(0, 0, -50), scene);
  camera.setTarget(Vector3.Zero());
  camera.attachControl(canvas, true);

  const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
  light.intensity = 0.4;

  // Starfield: ~3000 points on a large sphere.
  const pcs = new PointsCloudSystem("stars", 2, scene);
  pcs.addPoints(3000, (particle: SolidParticle) => {
    const r = 500 + Math.random() * 500;
    const theta = Math.acos(2 * Math.random() - 1);
    const phi = Math.random() * Math.PI * 2;
    particle.position = new Vector3(
      r * Math.sin(theta) * Math.cos(phi),
      r * Math.sin(theta) * Math.sin(phi),
      r * Math.cos(theta),
    );
  });
  pcs.buildMeshAsync().then(() => {
    console.info("[elite] starfield ready");
  });

  engine.runRenderLoop(() => scene.render());
  window.addEventListener("resize", () => engine.resize());
}

boot();