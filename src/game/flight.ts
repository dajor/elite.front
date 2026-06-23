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
export type AutopilotMode = "MANUAL" | "STATION";

export interface FlightTelemetry {
  throttle: number;
  speed: number;
  timeScale: number;
  autopilotMode: AutopilotMode;
  viewMode: ViewMode;
  viewDirection: {
    x: number;
    y: number;
    z: number;
  };
  velocity: {
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

interface AutopilotTarget {
  name: AutopilotMode;
  getPosition(): Vector3;
  holdDistance: number;
}

interface FlightOptions {
  adjustTimeScale?: (direction: -1 | 1) => number;
  autopilotTarget?: AutopilotTarget;
  getTimeScale?: () => number;
  onUpdate?: (telemetry: FlightTelemetry) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function key(pressed: Set<string>, ...codes: string[]): number {
  return codes.some((code) => pressed.has(code)) ? 1 : 0;
}

function safeDirection(vector: Vector3, fallback: Vector3): Vector3 {
  const length = vector.length();
  return length > 0.001 ? vector.scale(1 / length) : fallback.clone();
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
  const velocity = Vector3.Zero();
  let throttle = 0.18;
  let autopilotMode: AutopilotMode = "MANUAL";
  let viewMode: ViewMode = "FRONT";
  const handledKeys = new Set([
    "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp",
    "Backspace", "Comma", "ControlLeft", "ControlRight", "Equal",
    "Digit1", "Digit2", "Digit3", "Digit4",
    "KeyA", "KeyB", "KeyD", "KeyE", "KeyQ", "KeyS", "KeyW", "KeyX", "KeyY", "KeyZ",
    "Minus", "NumpadAdd", "NumpadSubtract", "Period",
    "ShiftLeft", "ShiftRight",
  ]);

  const maxVelocity = def.maxSpeed / 2.35;
  const maxThrust = 9 + def.maxSpeed / 18;
  const retroThrust = maxThrust * 1.45;

  function setAutopilot(nextMode: AutopilotMode): void {
    autopilotMode = options.autopilotTarget ? nextMode : "MANUAL";
  }

  function applySpeedLimit(): void {
    const speed = velocity.length();
    if (speed > maxVelocity) {
      velocity.scaleInPlace(maxVelocity / speed);
    }
  }

  function applyRetroThrust(dt: number): void {
    const speed = velocity.length();
    if (speed <= 0.01) {
      velocity.set(0, 0, 0);
      return;
    }
    const brake = Math.min(speed, retroThrust * dt);
    velocity.addInPlace(velocity.scale(-brake / speed));
  }

  function applyManualPhysics(dt: number): void {
    const forward = ship.getDirection(Axis.Z).normalize();
    if (throttle > 0) {
      velocity.addInPlace(forward.scale(throttle * maxThrust * dt));
    }
    if (pressed.has("Backspace")) {
      applyRetroThrust(dt);
    }
    applySpeedLimit();
    ship.position.addInPlace(velocity.scale(dt));
  }

  function applyAutopilotPhysics(dt: number): void {
    const target = options.autopilotTarget;
    if (!target) {
      autopilotMode = "MANUAL";
      applyManualPhysics(dt);
      return;
    }

    const offset = target.getPosition().subtract(ship.position);
    const distance = offset.length();
    const toTarget = safeDirection(offset, ship.getDirection(Axis.Z).normalize());
    const stopDistance = Math.max(0, distance - target.holdDistance);
    const desiredSpeed = Math.min(maxVelocity * 0.76, Math.max(3, Math.sqrt(stopDistance * maxThrust * 1.65)));
    const closingSpeed = Vector3.Dot(velocity, toTarget);
    const speedError = desiredSpeed - closingSpeed;

    let accelerationDirection = toTarget;
    let acceleration = Math.min(maxThrust, Math.max(0, speedError * 0.72 + 2));
    const currentSpeed = velocity.length();
    if (speedError < -1 || (distance < target.holdDistance * 1.25 && currentSpeed > 1.5)) {
      accelerationDirection = currentSpeed > 0.01 ? velocity.scale(-1 / currentSpeed) : toTarget.scale(-1);
      acceleration = Math.min(retroThrust, Math.max(1, Math.abs(speedError) * 0.8 + 2));
    }

    if (distance <= target.holdDistance && velocity.length() < 1.8) {
      throttle = 0;
      velocity.scaleInPlace(Math.exp(-dt * 5));
      if (velocity.length() < 0.05) velocity.set(0, 0, 0);
    } else {
      throttle = clamp(acceleration / maxThrust, 0, 1);
      velocity.addInPlace(accelerationDirection.scale(acceleration * dt));
      const facing = safeDirection(accelerationDirection, toTarget);
      ship.lookAt(ship.position.add(facing));
    }

    applySpeedLimit();
    ship.position.addInPlace(velocity.scale(dt));
  }

  const keyboardObserver = scene.onKeyboardObservable.add((info) => {
    const code = info.event.code;
    const keyValue = info.event.key.toLowerCase();
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
      } else if (firstPress && code === "KeyB") {
        setAutopilot(autopilotMode === "MANUAL" ? "STATION" : "MANUAL");
      } else if (firstPress && (code === "KeyX" || keyValue === "x")) {
        options.adjustTimeScale?.(1);
      } else if (firstPress && (code === "KeyZ" || keyValue === "z")) {
        options.adjustTimeScale?.(-1);
      }
      pressed.add(code);
    } else if (info.type === KeyboardEventTypes.KEYUP) {
      pressed.delete(code);
    }
  });

  const flightObserver = scene.onBeforeRenderObservable.add(() => {
    const realDt = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.05);
    const timeScale = options.getTimeScale?.() ?? 1;
    const simDt = realDt * timeScale;
    const pitch = key(pressed, "ArrowDown", "KeyS") - key(pressed, "ArrowUp", "KeyW");
    const yaw = key(pressed, "ArrowRight", "KeyD") - key(pressed, "ArrowLeft", "KeyA");
    const roll = key(pressed, "KeyE", "Period") - key(pressed, "KeyQ", "Comma");
    const throttleInput = key(pressed, "ShiftLeft", "ShiftRight")
      - key(pressed, "ControlLeft", "ControlRight");

    throttle = clamp(throttle + throttleInput * realDt * 0.55, 0, 1);
    if (autopilotMode !== "MANUAL" && (pitch !== 0 || yaw !== 0 || roll !== 0)) {
      autopilotMode = "MANUAL";
    }

    const agility = def.agility / 5;
    if (autopilotMode === "MANUAL") {
      ship.rotate(Axis.X, pitch * agility * 0.9 * realDt, Space.LOCAL);
      ship.rotate(Axis.Y, yaw * agility * 0.55 * realDt, Space.LOCAL);
      ship.rotate(Axis.Z, roll * agility * 1.35 * realDt, Space.LOCAL);
    }

    const steps = Math.max(1, Math.ceil(simDt / 0.04));
    const stepDt = simDt / steps;
    for (let i = 0; i < steps; i++) {
      if (autopilotMode === "MANUAL") {
        applyManualPhysics(stepDt);
      } else {
        applyAutopilotPhysics(stepDt);
      }
    }

    const up = ship.getDirection(Axis.Y).normalize();
    const lookDirection = viewDirection(ship, viewMode);
    const speed = velocity.length();

    const desiredCamera = ship.position
      .subtract(lookDirection.scale(36))
      .add(up.scale(10));
    camera.position = Vector3.Lerp(camera.position, desiredCamera, 1 - Math.exp(-realDt * 8));
    camera.setTarget(ship.position.add(lookDirection.scale(30)));

    options.onUpdate?.({
      throttle,
      speed,
      timeScale,
      autopilotMode,
      viewMode,
      viewDirection: {
        x: lookDirection.x,
        y: lookDirection.y,
        z: lookDirection.z,
      },
      velocity: {
        x: velocity.x,
        y: velocity.y,
        z: velocity.z,
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
