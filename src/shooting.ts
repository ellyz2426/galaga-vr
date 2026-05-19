import {
  createComponent,
  createSystem,
  Types,
  Vector3,
  Quaternion,
  Matrix4,
} from "@iwsdk/core";
import { createProjectileMesh, ProjectileTag } from "./projectiles";

export const ShooterTag = createComponent("ShooterTag", {
  cooldown: { type: Types.Float32, default: 0 },
  fireRate: { type: Types.Float32, default: 0.15 }, // seconds between shots
  rapidFire: { type: Types.Boolean, default: false },
  spreadShot: { type: Types.Boolean, default: false },
  powerUpTimer: { type: Types.Float32, default: 0 },
});

const _dir = new Vector3();
const _pos = new Vector3();
const _quat = new Quaternion();
const _mat = new Matrix4();

export class ShootingSystem extends createSystem({
  shooters: { required: [ShooterTag] },
}) {
  private lastTriggerLeft = false;
  private lastTriggerRight = false;

  update(delta: number) {
    // Update power-up timers
    for (const entity of this.queries.shooters.entities) {
      const timer = entity.getValue(ShooterTag, "powerUpTimer");
      if (timer > 0) {
        const newTimer = timer - delta;
        entity.setValue(ShooterTag, "powerUpTimer", newTimer);
        if (newTimer <= 0) {
          entity.setValue(ShooterTag, "rapidFire", false);
          entity.setValue(ShooterTag, "spreadShot", false);
          entity.setValue(ShooterTag, "fireRate", 0.15);
        }
      }

      // Update cooldown
      const cd = entity.getValue(ShooterTag, "cooldown");
      if (cd > 0) {
        entity.setValue(ShooterTag, "cooldown", cd - delta);
      }
    }

    // Check controller triggers via XR input
    const input = this.world.input;
    if (!input) return;

    // Try the action-backed input system first (0.4.0+)
    const actions = (input as any).actions;
    if (actions) {
      const selectPressed = actions.getButtonPressed('interaction.select');
      if (selectPressed && !this.lastTriggerRight) {
        this.fireFromController("right");
      }
      this.lastTriggerRight = !!selectPressed;
      return;
    }

    // Fallback: access gamepads through the input manager
    const xrInput = (input as any).xr ?? input;
    const gamepads = xrInput?.gamepads;
    if (!gamepads || typeof gamepads[Symbol.iterator] !== 'function') return;

    try {
      for (const [hand, gamepad] of gamepads) {
        if (!gamepad) continue;

        const buttons = gamepad.buttons;
        if (!buttons || buttons.length === 0) continue;

        const triggerValue = buttons[0]?.value ?? 0;
        const triggerPressed = triggerValue > 0.5;

        const lastTrigger = hand === "left" ? this.lastTriggerLeft : this.lastTriggerRight;

        if (triggerPressed && !lastTrigger) {
          this.fireFromController(hand);
        }

        if (hand === "left") {
          this.lastTriggerLeft = triggerPressed;
        } else {
          this.lastTriggerRight = triggerPressed;
        }
      }
    } catch (e) {
      // Gamepads not available outside XR session
    }
  }

  fireFromController(hand: string) {
    // Get controller ray space for aiming direction
    // Try 0.4.0 API first (playerSpaceEntities), fallback to player/input
    const spaces = (this.world as any).playerSpaceEntities;
    
    if (spaces) {
      const raySpaces = spaces.raySpaces;
      if (raySpaces) {
        const raySpace = hand === "left" ? raySpaces.left : raySpaces.right;
        if (raySpace?.object3D) {
          const obj = raySpace.object3D;
          obj.updateWorldMatrix(true, false);
          _pos.setFromMatrixPosition(obj.matrixWorld);
          _dir.set(0, 0, -1);
          _quat.setFromRotationMatrix(obj.matrixWorld);
          _dir.applyQuaternion(_quat);
          _dir.normalize();
          this.doFire(_pos, _dir);
          return;
        }
      }
    }

    // Fallback: use XR input multiPointers for ray origin/direction
    const xrInput = (this.world.input as any).xr ?? this.world.input;
    if (xrInput?.multiPointers) {
      try {
        for (const [inputSource, pointer] of xrInput.multiPointers) {
          const handedness = inputSource?.handedness;
          if (handedness === hand || (hand === "right" && handedness !== "left")) {
            const rayObj = pointer?.object3D ?? pointer;
            if (rayObj?.matrixWorld) {
              rayObj.updateWorldMatrix(true, false);
              _pos.setFromMatrixPosition(rayObj.matrixWorld);
              _dir.set(0, 0, -1);
              _quat.setFromRotationMatrix(rayObj.matrixWorld);
              _dir.applyQuaternion(_quat);
              _dir.normalize();
              this.doFire(_pos, _dir);
              return;
            }
          }
        }
      } catch (e) {
        // Fallback failed
      }
    }

    // Last resort: shoot straight from player head position
    const head = (this.world as any).playerHeadEntity ?? (this.world as any).camera;
    if (head?.object3D || head?.matrixWorld) {
      const obj = head.object3D ?? head;
      obj.updateWorldMatrix(true, false);
      _pos.setFromMatrixPosition(obj.matrixWorld);
      _dir.set(0, 0, -1);
      _quat.setFromRotationMatrix(obj.matrixWorld);
      _dir.applyQuaternion(_quat);
      _dir.normalize();
      this.doFire(_pos, _dir);
    }
  }

  private doFire(pos: Vector3, dir: Vector3) {
    // Check cooldown on first shooter entity
    for (const shooter of this.queries.shooters.entities) {
      const cd = shooter.getValue(ShooterTag, "cooldown");
      if (cd > 0) return;

      const fireRate = shooter.getValue(ShooterTag, "fireRate");
      const spreadShot = shooter.getValue(ShooterTag, "spreadShot");

      shooter.setValue(ShooterTag, "cooldown", fireRate);

      // Fire main projectile
      this.spawnProjectile(_pos, _dir);

      // Spread shot
      if (spreadShot) {
        const spreadAngle = 0.08;
        const left = _dir.clone();
        left.x += spreadAngle;
        left.normalize();
        this.spawnProjectile(_pos, left);

        const right = _dir.clone();
        right.x -= spreadAngle;
        right.normalize();
        this.spawnProjectile(_pos, right);
      }

      break;
    }
  }

  private spawnProjectile(pos: Vector3, dir: Vector3) {
    const mesh = createProjectileMesh();
    mesh.position.copy(pos);

    const entity = this.world.createTransformEntity(mesh);
    entity.addComponent(ProjectileTag, {
      speed: 20,
      alive: true,
      damage: 1,
      dirX: dir.x,
      dirY: dir.y,
      dirZ: dir.z,
    });
  }
}
