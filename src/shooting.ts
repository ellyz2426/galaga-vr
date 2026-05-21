import {
  createComponent,
  createSystem,
  Types,
  Vector3,
  Quaternion,
  Matrix4,
} from "@iwsdk/core";
import {
  createProjectileMesh,
  createHomingMissileMesh,
  createMegaBlastMesh,
  ProjectileTag,
  ProjectileType,
} from "./projectiles";
import { playLaserSound, playSpreadLaserSound, playHomingLockSound, playMegaBlastSound } from "./audio";

export const ShooterTag = createComponent("ShooterTag", {
  cooldown: { type: Types.Float32, default: 0 },
  fireRate: { type: Types.Float32, default: 0.15 },
  rapidFire: { type: Types.Boolean, default: false },
  spreadShot: { type: Types.Boolean, default: false },
  homingMissile: { type: Types.Boolean, default: false },
  megaBlastReady: { type: Types.Boolean, default: false },
  powerUpTimer: { type: Types.Float32, default: 0 },
  // Upgradable stats
  damageLevel: { type: Types.Int32, default: 0 },
  fireRateLevel: { type: Types.Int32, default: 0 },
  spreadLevel: { type: Types.Int32, default: 0 },
  // Homing ammo
  homingAmmo: { type: Types.Int32, default: 0 },
  megaBlastCharges: { type: Types.Int32, default: 0 },
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
  private lastMouseDown = false;
  private lastSpaceDown = false;
  private isXRMode = false;
  private timeSlow = false;
  private xrManaged = false;

  // For stats
  totalShotsFired = 0;

  setTimeSlow(slow: boolean) {
    this.timeSlow = slow;
  }

  /** When true, this system skips its own XR trigger detection — the XRInputManager in index.ts is authoritative. */
  setXRManaged(managed: boolean) {
    this.xrManaged = managed;
  }

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
          entity.setValue(ShooterTag, "homingMissile", false);
          // Reset fire rate to base + upgrades
          const frl = entity.getValue(ShooterTag, "fireRateLevel");
          entity.setValue(ShooterTag, "fireRate", 0.15 - frl * 0.02);
        }
      }

      const cd = entity.getValue(ShooterTag, "cooldown");
      if (cd > 0) {
        entity.setValue(ShooterTag, "cooldown", cd - delta);
      }
    }

    // Check XR controller triggers — skip when XRInputManager is handling XR input
    const input = this.world.input;
    if (!input) return;

    // Try action-backed input (0.4.0+)
    const actions = (input as any).actions;
    if (actions) {
      if (!this.xrManaged) {
        const selectPressed = actions.getButtonPressed("interaction.select");
        if (selectPressed && !this.lastTriggerRight) {
          this.fireFromController("right");
        }
        this.lastTriggerRight = !!selectPressed;
      }

      // Check if we're in XR
      this.isXRMode = true;
      return;
    }

    // Fallback: XR gamepads
    const xrInput = (input as any).xr ?? input;
    const gamepads = xrInput?.gamepads;
    if (gamepads && typeof gamepads[Symbol.iterator] === "function") {
      if (!this.xrManaged) {
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
          // Not in XR
        }
      }
      this.isXRMode = true;
      return;
    }

    // Browser-first input: keyboard + mouse
    this.isXRMode = false;
    const keyboard = (input as any).keyboard;

    // Mouse click to fire
    // We check pointer events on canvas instead
    // Space bar to fire
    if (keyboard) {
      const spaceDown = keyboard.getKeyPressed?.("Space") || keyboard.getKeyDown?.("Space");
      if (spaceDown && !this.lastSpaceDown) {
        this.fireFromBrowser();
      }
      this.lastSpaceDown = !!spaceDown;

      // E key for mega blast
      const eDown = keyboard.getKeyDown?.("KeyE");
      if (eDown) {
        this.fireMegaBlast();
      }

      // Q key for homing missile
      const qDown = keyboard.getKeyDown?.("KeyQ");
      if (qDown) {
        this.fireHomingMissile();
      }
    }
  }

  /** Called from browser click handler */
  onBrowserClick() {
    this.fireFromBrowser();
  }

  /** Called from XR input manager with pre-computed aim */
  fireFromXR(position: Vector3, direction: Vector3) {
    _pos.copy(position);
    _dir.copy(direction);
    this.doFire(_pos, _dir);
  }

  private fireFromBrowser() {
    // Get camera direction for aiming
    const camera = (this.world as any).camera;
    if (!camera) {
      // Fallback: shoot straight down the corridor
      _pos.set(0, 1.5, 0);
      _dir.set(0, 0, -1);
      this.doFire(_pos, _dir);
      return;
    }

    camera.updateWorldMatrix(true, false);
    _pos.setFromMatrixPosition(camera.matrixWorld);
    _dir.set(0, 0, -1);
    _quat.setFromRotationMatrix(camera.matrixWorld);
    _dir.applyQuaternion(_quat);
    _dir.normalize();
    this.doFire(_pos, _dir);
  }

  fireFromController(hand: string) {
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
      } catch (e) { /* fallback */ }
    }

    // Last resort: player head
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
    for (const shooter of this.queries.shooters.entities) {
      const cd = shooter.getValue(ShooterTag, "cooldown");
      if (cd > 0) return;

      const fireRate = shooter.getValue(ShooterTag, "fireRate");
      const spreadShot = shooter.getValue(ShooterTag, "spreadShot");
      const homingMissile = shooter.getValue(ShooterTag, "homingMissile");
      const damageLevel = shooter.getValue(ShooterTag, "damageLevel");
      const spreadLevel = shooter.getValue(ShooterTag, "spreadLevel");

      shooter.setValue(ShooterTag, "cooldown", fireRate);

      const baseDamage = 1 + damageLevel;

      // Check if we should fire homing missiles instead
      if (homingMissile) {
        const ammo = shooter.getValue(ShooterTag, "homingAmmo");
        if (ammo > 0) {
          shooter.setValue(ShooterTag, "homingAmmo", ammo - 1);
          this.spawnHoming(pos, dir, baseDamage);
          playHomingLockSound();
          this.totalShotsFired++;
          if (ammo - 1 <= 0) {
            shooter.setValue(ShooterTag, "homingMissile", false);
          }
          break;
        }
      }

      // Fire main projectile
      this.spawnProjectile(pos, dir, baseDamage);
      playLaserSound();
      this.totalShotsFired++;

      // Spread shot
      if (spreadShot || spreadLevel > 0) {
        const spreadAngle = 0.06 + spreadLevel * 0.01;
        const numSpread = spreadShot ? 2 : spreadLevel;

        for (let s = 1; s <= Math.min(numSpread, 3); s++) {
          const left = dir.clone();
          left.x += spreadAngle * s;
          left.normalize();
          this.spawnProjectile(pos, left, baseDamage);

          const right = dir.clone();
          right.x -= spreadAngle * s;
          right.normalize();
          this.spawnProjectile(pos, right, baseDamage);

          this.totalShotsFired += 2;
        }

        if (spreadShot) playSpreadLaserSound();
      }

      break;
    }
  }

  /** Fire homing from Q key or power-up. Optional aim overrides camera. */
  fireHomingMissile(aimPos?: Vector3, aimDir?: Vector3) {
    for (const shooter of this.queries.shooters.entities) {
      const ammo = shooter.getValue(ShooterTag, "homingAmmo");
      if (ammo <= 0) return;

      shooter.setValue(ShooterTag, "homingAmmo", ammo - 1);
      if (ammo - 1 <= 0) {
        shooter.setValue(ShooterTag, "homingMissile", false);
      }

      if (aimPos && aimDir) {
        _pos.copy(aimPos);
        _dir.copy(aimDir);
      } else {
        // Get aim direction from camera
        const camera = (this.world as any).camera;
        if (camera) {
          camera.updateWorldMatrix(true, false);
          _pos.setFromMatrixPosition(camera.matrixWorld);
          _dir.set(0, 0, -1);
          _quat.setFromRotationMatrix(camera.matrixWorld);
          _dir.applyQuaternion(_quat);
          _dir.normalize();
        } else {
          _pos.set(0, 1.5, 0);
          _dir.set(0, 0, -1);
        }
      }

      this.spawnHoming(_pos, _dir, 2);
      playHomingLockSound();
      this.totalShotsFired++;
      break;
    }
  }

  /** Fire mega blast from E key or power-up. Optional aim overrides camera. */
  fireMegaBlast(aimPos?: Vector3, aimDir?: Vector3) {
    for (const shooter of this.queries.shooters.entities) {
      const charges = shooter.getValue(ShooterTag, "megaBlastCharges");
      if (charges <= 0) return;

      shooter.setValue(ShooterTag, "megaBlastCharges", charges - 1);
      if (charges - 1 <= 0) {
        shooter.setValue(ShooterTag, "megaBlastReady", false);
      }

      if (aimPos && aimDir) {
        _pos.copy(aimPos);
        _dir.copy(aimDir);
      } else {
        const camera = (this.world as any).camera;
        if (camera) {
          camera.updateWorldMatrix(true, false);
          _pos.setFromMatrixPosition(camera.matrixWorld);
          _dir.set(0, 0, -1);
          _quat.setFromRotationMatrix(camera.matrixWorld);
          _dir.applyQuaternion(_quat);
          _dir.normalize();
        } else {
          _pos.set(0, 1.5, 0);
          _dir.set(0, 0, -1);
        }
      }

      this.spawnMegaBlast(_pos, _dir);
      playMegaBlastSound();
      this.totalShotsFired++;
      break;
    }
  }

  private spawnProjectile(pos: Vector3, dir: Vector3, damage: number) {
    const mesh = createProjectileMesh(damage - 1);
    mesh.position.copy(pos);

    const entity = this.world.createTransformEntity(mesh);
    entity.addComponent(ProjectileTag, {
      speed: 20,
      alive: true,
      damage,
      dirX: dir.x,
      dirY: dir.y,
      dirZ: dir.z,
      projType: ProjectileType.Normal,
      age: 0,
      maxAge: 3.0,
    });
  }

  private spawnHoming(pos: Vector3, dir: Vector3, damage: number) {
    const mesh = createHomingMissileMesh();
    mesh.position.copy(pos);

    const entity = this.world.createTransformEntity(mesh);
    entity.addComponent(ProjectileTag, {
      speed: 15,
      alive: true,
      damage: damage + 1,
      dirX: dir.x,
      dirY: dir.y,
      dirZ: dir.z,
      projType: ProjectileType.Homing,
      homingStrength: 5.0,
      age: 0,
      maxAge: 5.0,
    });
  }

  private spawnMegaBlast(pos: Vector3, dir: Vector3) {
    const mesh = createMegaBlastMesh();
    mesh.position.copy(pos);

    const entity = this.world.createTransformEntity(mesh);
    entity.addComponent(ProjectileTag, {
      speed: 12,
      alive: true,
      damage: 10,
      dirX: dir.x,
      dirY: dir.y,
      dirZ: dir.z,
      projType: ProjectileType.MegaBlast,
      age: 0,
      maxAge: 4.0,
    });
  }
}
