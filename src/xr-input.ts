// xr-input.ts — Full XR Controller Input System for Galaga VR
// Handles trigger fire, grip grab, thumbstick menu nav, haptics, pointer visualization

import {
  Group,
  Mesh,
  CylinderGeometry,
  SphereGeometry,
  MeshBasicMaterial,
  Color,
  Vector3,
  Quaternion,
  Matrix4,
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  LineBasicMaterial,
  Line,
} from "@iwsdk/core";

export interface XRInputState {
  isXR: boolean;
  // Per-hand state
  left: HandState;
  right: HandState;
  // Menu navigation
  menuUp: boolean;
  menuDown: boolean;
  menuLeft: boolean;
  menuRight: boolean;
  menuSelect: boolean;
  menuBack: boolean;
}

interface HandState {
  connected: boolean;
  triggerPressed: boolean;
  triggerJustPressed: boolean;
  triggerJustReleased: boolean;
  triggerValue: number;
  gripPressed: boolean;
  gripJustPressed: boolean;
  gripValue: number;
  thumbstickX: number;
  thumbstickY: number;
  thumbstickClicked: boolean;
  buttonA: boolean;
  buttonB: boolean;
  // Aim
  aimPosition: Vector3;
  aimDirection: Vector3;
  aimValid: boolean;
}

function createDefaultHand(): HandState {
  return {
    connected: false,
    triggerPressed: false,
    triggerJustPressed: false,
    triggerJustReleased: false,
    triggerValue: 0,
    gripPressed: false,
    gripJustPressed: false,
    gripValue: 0,
    thumbstickX: 0,
    thumbstickY: 0,
    thumbstickClicked: false,
    buttonA: false,
    buttonB: false,
    aimPosition: new Vector3(),
    aimDirection: new Vector3(0, 0, -1),
    aimValid: false,
  };
}

const _pos = new Vector3();
const _dir = new Vector3();
const _quat = new Quaternion();

export class XRInputManager {
  public state: XRInputState;
  public laserGroup: Group;

  private prevLeft: { trigger: boolean; grip: boolean; thumbY: number } = { trigger: false, grip: false, thumbY: 0 };
  private prevRight: { trigger: boolean; grip: boolean; thumbY: number } = { trigger: false, grip: false, thumbY: 0 };
  private menuNavCooldown = 0;

  // Laser pointer meshes
  private leftLaser: Line | null = null;
  private rightLaser: Line | null = null;
  private leftDot: Mesh | null = null;
  private rightDot: Mesh | null = null;

  constructor() {
    this.state = {
      isXR: false,
      left: createDefaultHand(),
      right: createDefaultHand(),
      menuUp: false,
      menuDown: false,
      menuLeft: false,
      menuRight: false,
      menuSelect: false,
      menuBack: false,
    };

    this.laserGroup = new Group();
    this.laserGroup.name = "xr-laser-pointers";

    // Create laser beams
    this.leftLaser = this.createLaserBeam(0x00aaff);
    this.rightLaser = this.createLaserBeam(0x00ffaa);
    this.leftDot = this.createAimDot(0x00aaff);
    this.rightDot = this.createAimDot(0x00ffaa);

    this.laserGroup.add(this.leftLaser, this.rightLaser, this.leftDot, this.rightDot);
    this.laserGroup.visible = false;
  }

  private createLaserBeam(color: number): Line {
    const geom = new BufferGeometry();
    const positions = new Float32Array([0, 0, 0, 0, 0, -15]);
    geom.setAttribute('position', new Float32BufferAttribute(positions, 3));
    const mat = new LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.6,
      blending: AdditiveBlending,
    });
    const line = new Line(geom, mat);
    line.visible = false;
    line.frustumCulled = false;
    return line;
  }

  private createAimDot(color: number): Mesh {
    const geom = new SphereGeometry(0.015, 8, 8);
    const mat = new MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.8,
      blending: AdditiveBlending,
    });
    const dot = new Mesh(geom, mat);
    dot.visible = false;
    dot.frustumCulled = false;
    return dot;
  }

  update(world: any, delta: number) {
    const input = world.input;
    if (!input) return;

    // Reset per-frame flags
    this.state.menuUp = false;
    this.state.menuDown = false;
    this.state.menuLeft = false;
    this.state.menuRight = false;
    this.state.menuSelect = false;
    this.state.menuBack = false;

    if (this.menuNavCooldown > 0) {
      this.menuNavCooldown -= delta;
    }

    // Try action-backed input first (IWSDK 0.4.x)
    const actions = input.actions;
    if (actions) {
      this.updateFromActions(world, actions);
      return;
    }

    // Fallback: raw XR gamepads
    const xrInput = input.xr ?? input;
    const gamepads = xrInput?.gamepads;
    if (gamepads && typeof gamepads[Symbol.iterator] === 'function') {
      this.updateFromGamepads(world, gamepads);
      return;
    }

    // Not in XR
    this.state.isXR = false;
    this.laserGroup.visible = false;
  }

  private updateFromActions(world: any, actions: any) {
    this.state.isXR = true;
    this.laserGroup.visible = true;

    // Read action states
    const selectPressed = !!actions.getButtonPressed?.('interaction.select');

    // Update right hand (primary fire)
    const prevRightTrigger = this.prevRight.trigger;
    this.state.right.triggerPressed = selectPressed;
    this.state.right.triggerJustPressed = selectPressed && !prevRightTrigger;
    this.state.right.triggerJustReleased = !selectPressed && prevRightTrigger;
    this.state.right.triggerValue = selectPressed ? 1 : 0;
    this.state.right.connected = true;
    this.prevRight.trigger = selectPressed;

    // Get aim from ray spaces
    const spaces = world.playerSpaceEntities;
    if (spaces) {
      this.updateHandAim(this.state.right, spaces.raySpaces?.right, this.rightLaser!, this.rightDot!);
      this.updateHandAim(this.state.left, spaces.raySpaces?.left, this.leftLaser!, this.leftDot!);
    }

    // Read XR gamepads for thumbstick and grip (actions don't cover all buttons)
    const xrInput = world.input?.xr ?? world.input;
    const gamepads = xrInput?.gamepads;
    if (gamepads && typeof gamepads[Symbol.iterator] === 'function') {
      try {
        for (const [hand, gamepad] of gamepads) {
          if (!gamepad?.buttons) continue;
          const hs = hand === 'left' ? this.state.left : this.state.right;
          const prev = hand === 'left' ? this.prevLeft : this.prevRight;

          // Trigger (button 0)
          if (hand === 'left') {
            const trig = (gamepad.buttons[0]?.value ?? 0) > 0.5;
            hs.triggerJustPressed = trig && !prev.trigger;
            hs.triggerJustReleased = !trig && prev.trigger;
            hs.triggerPressed = trig;
            hs.triggerValue = gamepad.buttons[0]?.value ?? 0;
            hs.connected = true;
            prev.trigger = trig;
          }

          // Grip (button 1)
          const gripVal = gamepad.buttons[1]?.value ?? 0;
          const gripPressed = gripVal > 0.5;
          hs.gripJustPressed = gripPressed && !prev.grip;
          hs.gripPressed = gripPressed;
          hs.gripValue = gripVal;
          prev.grip = gripPressed;

          // Thumbstick (axes 2, 3)
          if (gamepad.axes && gamepad.axes.length >= 4) {
            hs.thumbstickX = gamepad.axes[2] ?? 0;
            hs.thumbstickY = gamepad.axes[3] ?? 0;
          }

          // Buttons A/B (buttons 4, 5)
          hs.buttonA = (gamepad.buttons[4]?.pressed) ?? false;
          hs.buttonB = (gamepad.buttons[5]?.pressed) ?? false;

          // Thumbstick click (button 3)
          hs.thumbstickClicked = (gamepad.buttons[3]?.pressed) ?? false;
        }
      } catch (e) { /* ignore */ }
    }

    // Menu navigation from thumbstick
    this.updateMenuNavigation();
  }

  private updateFromGamepads(world: any, gamepads: any) {
    this.state.isXR = true;
    this.laserGroup.visible = true;

    try {
      for (const [hand, gamepad] of gamepads) {
        if (!gamepad?.buttons) continue;
        const hs = hand === 'left' ? this.state.left : this.state.right;
        const prev = hand === 'left' ? this.prevLeft : this.prevRight;

        hs.connected = true;

        // Trigger
        const trigVal = gamepad.buttons[0]?.value ?? 0;
        const trigPressed = trigVal > 0.5;
        hs.triggerJustPressed = trigPressed && !prev.trigger;
        hs.triggerJustReleased = !trigPressed && prev.trigger;
        hs.triggerPressed = trigPressed;
        hs.triggerValue = trigVal;
        prev.trigger = trigPressed;

        // Grip
        const gripVal = gamepad.buttons[1]?.value ?? 0;
        const gripPressed = gripVal > 0.5;
        hs.gripJustPressed = gripPressed && !prev.grip;
        hs.gripPressed = gripPressed;
        hs.gripValue = gripVal;
        prev.grip = gripPressed;

        // Thumbstick
        if (gamepad.axes?.length >= 4) {
          hs.thumbstickX = gamepad.axes[2] ?? 0;
          hs.thumbstickY = gamepad.axes[3] ?? 0;
        }

        // Buttons
        hs.buttonA = gamepad.buttons[4]?.pressed ?? false;
        hs.buttonB = gamepad.buttons[5]?.pressed ?? false;
        hs.thumbstickClicked = gamepad.buttons[3]?.pressed ?? false;
      }
    } catch (e) { /* ignore */ }

    // Get aim from ray spaces or multiPointers
    const spaces = world.playerSpaceEntities;
    if (spaces?.raySpaces) {
      this.updateHandAim(this.state.right, spaces.raySpaces.right, this.rightLaser!, this.rightDot!);
      this.updateHandAim(this.state.left, spaces.raySpaces.left, this.leftLaser!, this.leftDot!);
    } else {
      const xrInput = world.input?.xr ?? world.input;
      if (xrInput?.multiPointers) {
        try {
          for (const [inputSource, pointer] of xrInput.multiPointers) {
            const h = inputSource?.handedness;
            const hs = h === 'left' ? this.state.left : this.state.right;
            const laser = h === 'left' ? this.leftLaser! : this.rightLaser!;
            const dot = h === 'left' ? this.leftDot! : this.rightDot!;

            const rayObj = pointer?.object3D ?? pointer;
            if (rayObj?.matrixWorld) {
              this.updateHandAimFromMatrix(hs, rayObj.matrixWorld, laser, dot);
            }
          }
        } catch (e) { /* ignore */ }
      }
    }

    this.updateMenuNavigation();
  }

  private updateHandAim(hs: HandState, rayEntity: any, laser: Line, dot: Mesh) {
    if (!rayEntity?.object3D) {
      hs.aimValid = false;
      laser.visible = false;
      dot.visible = false;
      return;
    }

    const obj = rayEntity.object3D;
    obj.updateWorldMatrix(true, false);
    this.updateHandAimFromMatrix(hs, obj.matrixWorld, laser, dot);
  }

  private updateHandAimFromMatrix(hs: HandState, mat: Matrix4, laser: Line, dot: Mesh) {
    _pos.setFromMatrixPosition(mat);
    _dir.set(0, 0, -1);
    _quat.setFromRotationMatrix(mat);
    _dir.applyQuaternion(_quat).normalize();

    hs.aimPosition.copy(_pos);
    hs.aimDirection.copy(_dir);
    hs.aimValid = true;

    // Update laser visual
    laser.visible = true;
    laser.position.copy(_pos);
    laser.quaternion.copy(_quat);

    // Put dot at aim endpoint
    dot.visible = true;
    dot.position.copy(_pos).addScaledVector(_dir, 12);
  }

  private updateMenuNavigation() {
    // Use right thumbstick for menu navigation
    const rhs = this.state.right;
    if (this.menuNavCooldown <= 0) {
      if (rhs.thumbstickY < -0.5) {
        this.state.menuUp = true;
        this.menuNavCooldown = 0.25;
      } else if (rhs.thumbstickY > 0.5) {
        this.state.menuDown = true;
        this.menuNavCooldown = 0.25;
      }
      if (rhs.thumbstickX < -0.5) {
        this.state.menuLeft = true;
        this.menuNavCooldown = 0.2;
      } else if (rhs.thumbstickX > 0.5) {
        this.state.menuRight = true;
        this.menuNavCooldown = 0.2;
      }
    }

    // A button or trigger for select
    if (rhs.triggerJustPressed || rhs.buttonA) {
      this.state.menuSelect = true;
    }
    // B button for back
    if (rhs.buttonB || this.state.left.buttonB) {
      this.state.menuBack = true;
    }
  }

  /** Trigger haptic feedback on a controller */
  triggerHaptic(world: any, hand: 'left' | 'right', intensity: number = 0.5, duration: number = 50) {
    try {
      const xrInput = world.input?.xr ?? world.input;
      const gamepads = xrInput?.gamepads;
      if (!gamepads) return;

      for (const [h, gamepad] of gamepads) {
        if (h === hand && gamepad?.hapticActuators?.[0]) {
          gamepad.hapticActuators[0].pulse(intensity, duration);
        }
        // Also try vibrationActuator (newer API)
        if (h === hand && gamepad?.vibrationActuator) {
          gamepad.vibrationActuator.playEffect?.('dual-rumble', {
            duration,
            strongMagnitude: intensity,
            weakMagnitude: intensity * 0.5,
          });
        }
      }
    } catch (e) { /* haptics not available */ }
  }

  /** Get the best aim direction (right hand preferred, fallback to camera) */
  getBestAim(world: any): { position: Vector3; direction: Vector3 } {
    if (this.state.isXR) {
      if (this.state.right.aimValid) {
        return { position: this.state.right.aimPosition.clone(), direction: this.state.right.aimDirection.clone() };
      }
      if (this.state.left.aimValid) {
        return { position: this.state.left.aimPosition.clone(), direction: this.state.left.aimDirection.clone() };
      }
    }

    // Fallback to camera
    const camera = world.camera;
    if (camera) {
      camera.updateWorldMatrix(true, false);
      _pos.setFromMatrixPosition(camera.matrixWorld);
      _dir.set(0, 0, -1);
      _quat.setFromRotationMatrix(camera.matrixWorld);
      _dir.applyQuaternion(_quat).normalize();
      return { position: _pos.clone(), direction: _dir.clone() };
    }

    return { position: new Vector3(0, 1.5, 0), direction: new Vector3(0, 0, -1) };
  }

  /** Update laser colors based on game state */
  setLaserColor(color: number) {
    if (this.leftLaser) (this.leftLaser.material as LineBasicMaterial).color.set(color);
    if (this.rightLaser) (this.rightLaser.material as LineBasicMaterial).color.set(color);
    if (this.leftDot) ((this.leftDot.material as MeshBasicMaterial)).color.set(color);
    if (this.rightDot) ((this.rightDot.material as MeshBasicMaterial)).color.set(color);
  }

  /** Pulse laser brightness on fire */
  flashLaser(hand: 'left' | 'right') {
    const laser = hand === 'left' ? this.leftLaser : this.rightLaser;
    if (laser) {
      const mat = laser.material as LineBasicMaterial;
      mat.opacity = 1.0;
      setTimeout(() => { mat.opacity = 0.6; }, 80);
    }
  }
}
