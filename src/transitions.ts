/**
 * Screen transitions — flash, fade, wipe effects between game states
 */
import {
  Mesh,
  PlaneGeometry,
  MeshBasicMaterial,
  Color,
  DoubleSide,
} from "@iwsdk/core";

export function createScreenTransition(): {
  mesh: Mesh;
  fadeIn: (color?: number, duration?: number) => void;
  fadeOut: (color?: number, duration?: number) => void;
  flash: (color?: number, duration?: number) => void;
  update: (delta: number) => void;
} {
  const material = new MeshBasicMaterial({
    color: new Color(0x000000),
    transparent: true,
    opacity: 0,
    side: DoubleSide,
    depthWrite: false,
    depthTest: false,
  });

  const geometry = new PlaneGeometry(6, 4);
  const mesh = new Mesh(geometry, material);
  mesh.position.set(0, 1.6, -1.0);
  mesh.renderOrder = 998;

  let state: "idle" | "fadein" | "fadeout" | "flash_in" | "flash_out" = "idle";
  let timer = 0;
  let duration = 0.5;

  function fadeIn(color: number = 0x000000, dur: number = 0.5) {
    material.color.set(color);
    state = "fadein";
    timer = 0;
    duration = dur;
    material.opacity = 0;
  }

  function fadeOut(color: number = 0x000000, dur: number = 0.5) {
    material.color.set(color);
    state = "fadeout";
    timer = 0;
    duration = dur;
    material.opacity = 1;
  }

  function flash(color: number = 0xffffff, dur: number = 0.4) {
    material.color.set(color);
    state = "flash_in";
    timer = 0;
    duration = dur;
    material.opacity = 0;
  }

  function update(delta: number) {
    if (state === "idle") return;

    timer += delta;
    const t = Math.min(1, timer / (duration * 0.5));

    switch (state) {
      case "fadein":
        material.opacity = Math.min(1, timer / duration);
        if (timer >= duration) {
          material.opacity = 1;
          state = "idle";
        }
        break;

      case "fadeout":
        material.opacity = Math.max(0, 1 - timer / duration);
        if (timer >= duration) {
          material.opacity = 0;
          state = "idle";
        }
        break;

      case "flash_in":
        material.opacity = t;
        if (t >= 1) {
          state = "flash_out";
          timer = 0;
        }
        break;

      case "flash_out":
        material.opacity = 1 - t;
        if (t >= 1) {
          material.opacity = 0;
          state = "idle";
        }
        break;
    }
  }

  return { mesh, fadeIn, fadeOut, flash, update };
}
