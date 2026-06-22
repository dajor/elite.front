import { Scene } from "@babylonjs/core/scene";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";

/**
 * Neon-Vektor PostFX: a GlowLayer gives emissive vector lines a soft halo
 * without the full-screen default pipeline, which can wash out the frame.
 */
export function configurePostFX(scene: Scene): GlowLayer {
  const glow = new GlowLayer("glow", scene);
  glow.intensity = 1.2;
  return glow;
}
