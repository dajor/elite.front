import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Axis, Space } from "@babylonjs/core/Maths/math.axis";
import { KeyboardEventTypes } from "@babylonjs/core/Events/keyboardEvents";

import type { ShipDef } from "../render/ship.ts";

interface FlightController {
  dispose(): void;
}

export type ViewMode = "FRONT" | "REAR" | "LEFT" | "RIGHT";

export interface FlightTelemetry {
  throttle: number;
  speed: number;
  viewMode: ViewMode;
  viewDirection: {
    x: number;
    y: number;
    z: number;
  };
  position: {
    x: number;
    y: number;
    z: number;
  };
}

interface FlightOptions {
  onUpdate?: (telemetry: FlightTelemetry) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function key(pressed: Set<string>, ...codes: string[]): number {
  return codes.some((code) => pressed.has(code)) ? 1 : 0;
}

function viewDirection(ship: Mesh, viewMode: ViewMode): Vector3 {
  switch (viewMode) {
    case "REAR":
      return ship.getDirection(Axis.Z).normalize().scale(-1);
    case "LEFT":
      return ship.getDirection(Axis.X).normalize().scale(-1);
    case "RIGHT":
      return ship.getDirection(Axis.X).normalize();
    case "FRONT":
    default:
      return ship.getDirection(Axis.Z).normalize();
  }
}

export function attachPlayerFlight(
  scene: Scene,
  ship: Mesh,
  camera: UniversalCamera,
  def: ShipDef,
  options: FlightOptions = {},
): FlightController {
  const pressed = new Set<string>();
  let throttle = 0.18;
  let speed = 0;
  let viewMode: ViewMode = "FRONT";
  const handledKeys = new Set([
    "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp",
    "Comma", "ControlLeft", "ControlRight", "Equal",
    "Digit1", "Digit2", "Digit3", "Digit4",
    "KeyA", "KeyD", "KeyE", "KeyQ", "KeyS", "KeyW",
    "Minus", "NumpadAdd", "NumpadSubtract", "Period",
    "ShiftLeft", "ShiftRight",
  ]);

  const keyboardObserver = scene.onKeyboardObservable.add((info) => {
    const code = info.event.code;
    if (handledKeys.has(code)) info.event.preventDefault();
    if (info.type === KeyboardEventTypes.KEYDOWN) {
      const firstPress = !pressed.has(code);
      if (firstPress && (code === "Equal" || code === "NumpadAdd")) {
        throttle = clamp(throttle + 0.08, 0, 1);
      } else if (firstPress && (code === "Minus" || code === "NumpadSubtract")) {
        throttle = clamp(throttle - 0.08, 0, 1);
      } else if (firstPress && code === "Digit1") {
        viewMode = "FRONT";
      } else if (firstPress && code === "Digit2") {
        viewMode = "REAR";
      } else if (firstPress && code === "Digit3") {
        viewMode = "LEFT";
      } else if (firstPress && code === "Digit4") {
        viewMode = "RIGHT";
      }
      pressed.add(code);
    } else if (info.type === KeyboardEventTypes.KEYUP) {
      pressed.delete(code);
    }
  });

  const flightObserver = scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.05);
    const pitch = key(pressed, "ArrowDown", "KeyS") - key(pressed, "ArrowUp", "KeyW");
    const yaw = key(pressed, "ArrowRight", "KeyD") - key(pressed, "ArrowLeft", "KeyA");
    const roll = key(pressed, "KeyE", "Period") - key(pressed, "KeyQ", "Comma");
    const throttleInput = key(pressed, "ShiftLeft", "ShiftRight")
      - key(pressed, "ControlLeft", "ControlRight");

    throttle = clamp(throttle + throttleInput * dt * 0.55, 0, 1);

    const agility = def.agility / 5;
    ship.rotate(Axis.X, pitch * agility * 0.9 * dt, Space.LOCAL);
    ship.rotate(Axis.Y, yaw * agility * 0.55 * dt, Space.LOCAL);
    ship.rotate(Axis.Z, roll * agility * 1.35 * dt, Space.LOCAL);

    const maxWorldSpeed = def.maxSpeed / 12;
    const targetSpeed = maxWorldSpeed * (0.08 + throttle * 0.92);
    speed += (targetSpeed - speed) * (1 - Math.exp(-dt * 2.6));

    const forward = ship.getDirection(Axis.Z).normalize();
    const up = ship.getDirection(Axis.Y).normalize();
    const lookDirection = viewDirection(ship, viewMode);
    ship.position.addInPlace(forward.scale(speed * dt));

    const desiredCamera = ship.position
      .subtract(lookDirection.scale(36))
      .add(up.scale(10));
    camera.position = Vector3.Lerp(camera.position, desiredCamera, 1 - Math.exp(-dt * 8));
    camera.setTarget(ship.position.add(lookDirection.scale(30)));

    options.onUpdate?.({
      throttle,
      speed,
      viewMode,
      viewDirection: {
        x: lookDirection.x,
        y: lookDirection.y,
        z: lookDirection.z,
      },
      position: {
        x: ship.position.x,
        y: ship.position.y,
        z: ship.position.z,
      },
    });
  });

  return {
    dispose(): void {
      scene.onKeyboardObservable.remove(keyboardObserver);
      scene.onBeforeRenderObservable.remove(flightObserver);
      pressed.clear();
    },
  };
}
