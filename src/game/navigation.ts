import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Axis } from "@babylonjs/core/Maths/math.axis";
import { KeyboardEventTypes } from "@babylonjs/core/Events/keyboardEvents";

import type { SystemModel } from "../world/types.ts";

export interface NavigationTelemetry {
  currentSystemName: string;
  destinationName: string;
  destinationDistance: number;
  dockingStatus: "FREE" | "AUTO" | "DOCKED" | "LAUNCH";
  hyperspaceStatus: "READY" | "CHARGING" | "JUMP";
  fuel: number;
  docked: boolean;
}

export interface NavigationController {
  dispose(): void;
}

interface NavigationOptions {
  fuel: number;
  getTimeScale?: () => number;
  onUpdate?: (telemetry: NavigationTelemetry) => void;
  onDocked?: () => void;
  onJumpComplete?: (destination: SystemModel) => void;
}

const SLOT_LOCAL = new Vector3(0, -15.6, 0);

function slotPosition(station: Mesh): Vector3 {
  return Vector3.TransformCoordinates(SLOT_LOCAL, station.getWorldMatrix());
}

function slotNormal(station: Mesh): Vector3 {
  return station.getDirection(Axis.Y).scale(-1).normalize();
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function attachNavigation(
  scene: Scene,
  player: Mesh,
  station: Mesh,
  currentSystem: SystemModel,
  destination: SystemModel,
  destinationDistance: number,
  options: NavigationOptions,
): NavigationController {
  const pressed = new Set<string>();
  let dockingStatus: NavigationTelemetry["dockingStatus"] = "FREE";
  let hyperspaceStatus: NavigationTelemetry["hyperspaceStatus"] = "READY";
  let docked = false;
  let jumpTimer = 0;
  let dockTimer = 0;
  let dockPulseSent = false;

  function telemetry(): NavigationTelemetry {
    return {
      currentSystemName: currentSystem.name,
      destinationName: destination.name,
      destinationDistance,
      dockingStatus,
      hyperspaceStatus,
      fuel: options.fuel,
      docked,
    };
  }

  function startDocking(): void {
    if (docked) {
      docked = false;
      dockPulseSent = false;
      dockingStatus = "LAUNCH";
      player.setEnabled(true);
      player.position.copyFrom(slotPosition(station).add(slotNormal(station).scale(24)));
      return;
    }
    if (dockingStatus === "AUTO") return;
    dockingStatus = "AUTO";
    dockTimer = 0;
  }

  function startJump(): void {
    if (hyperspaceStatus !== "READY" || docked || destinationDistance > options.fuel) return;
    hyperspaceStatus = "CHARGING";
    jumpTimer = 1.35;
  }

  const keyboardObserver = scene.onKeyboardObservable.add((info) => {
    const code = info.event.code;
    if (code !== "KeyC" && code !== "KeyJ") return;
    info.event.preventDefault();

    if (info.type === KeyboardEventTypes.KEYDOWN) {
      const firstPress = !pressed.has(code);
      pressed.add(code);
      if (!firstPress) return;
      if (code === "KeyC") startDocking();
      if (code === "KeyJ") startJump();
    } else if (info.type === KeyboardEventTypes.KEYUP) {
      pressed.delete(code);
    }
  });

  const updateObserver = scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min((scene.getEngine().getDeltaTime() / 1000) * (options.getTimeScale?.() ?? 1), 0.25);
    const slot = slotPosition(station);
    const normal = slotNormal(station);

    if (dockingStatus === "AUTO") {
      dockTimer += dt;
      const staging = slot.add(normal.scale(36));
      const distanceToSlot = Vector3.Distance(player.position, slot);
      const distanceToStaging = Vector3.Distance(player.position, staging);
      const target = distanceToStaging > 3 ? staging : slot;
      const alpha = clamp01(dt * (distanceToStaging > 3 ? 2.2 : 5.2));
      player.position.copyFrom(Vector3.Lerp(player.position, target, alpha));
      player.lookAt(slot.add(normal.scale(-20)));

      if (distanceToSlot < 4.5 || dockTimer > 4.2) {
        docked = true;
        dockingStatus = "DOCKED";
        player.position.copyFrom(slot);
        player.setEnabled(false);
        if (!dockPulseSent) {
          options.onDocked?.();
          dockPulseSent = true;
        }
      }
    } else if (dockingStatus === "DOCKED") {
      player.position.copyFrom(slot);
    } else if (dockingStatus === "LAUNCH") {
      if (Vector3.Distance(player.position, slot) > 22) dockingStatus = "FREE";
    }

    if (hyperspaceStatus === "CHARGING") {
      jumpTimer -= dt;
      if (jumpTimer <= 0) {
        hyperspaceStatus = "JUMP";
        options.onUpdate?.(telemetry());
        options.onJumpComplete?.(destination);
        return;
      }
    }

    options.onUpdate?.(telemetry());
  });

  return {
    dispose(): void {
      scene.onKeyboardObservable.remove(keyboardObserver);
      scene.onBeforeRenderObservable.remove(updateObserver);
      pressed.clear();
    },
  };
}
