import {
  Group,
  Mesh,
  BoxGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Color,
  AdditiveBlending,
  PlaneGeometry,
  DoubleSide,
  PointLight,
  SphereGeometry,
} from "@iwsdk/core";

export const TUNNEL_WIDTH = 6;
export const TUNNEL_HEIGHT = 4;
export const TUNNEL_DEPTH = 30;
export const TUNNEL_CENTER_Y = 1.5;

export function createTunnel(): Group {
  const group = new Group();

  // Grid floor
  const floorGeo = new PlaneGeometry(TUNNEL_WIDTH, TUNNEL_DEPTH, 30, 150);
  const floorMat = new MeshBasicMaterial({
    color: new Color(0x001133),
    wireframe: true,
    transparent: true,
    opacity: 0.3,
  });
  const floor = new Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -TUNNEL_DEPTH / 2);
  group.add(floor);

  // Solid floor
  const solidFloorGeo = new PlaneGeometry(TUNNEL_WIDTH, TUNNEL_DEPTH);
  const solidFloorMat = new MeshStandardMaterial({
    color: new Color(0x000811),
    metalness: 0.8,
    roughness: 0.3,
  });
  const solidFloor = new Mesh(solidFloorGeo, solidFloorMat);
  solidFloor.rotation.x = -Math.PI / 2;
  solidFloor.position.set(0, -0.01, -TUNNEL_DEPTH / 2);
  group.add(solidFloor);

  // Grid ceiling
  const ceilGeo = new PlaneGeometry(TUNNEL_WIDTH, TUNNEL_DEPTH, 30, 150);
  const ceilMat = new MeshBasicMaterial({
    color: new Color(0x001133),
    wireframe: true,
    transparent: true,
    opacity: 0.12,
  });
  const ceil = new Mesh(ceilGeo, ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, TUNNEL_HEIGHT, -TUNNEL_DEPTH / 2);
  group.add(ceil);

  // Side walls
  const wallGeo = new PlaneGeometry(TUNNEL_DEPTH, TUNNEL_HEIGHT, 150, 20);
  const wallMat = new MeshBasicMaterial({
    color: new Color(0x002244),
    wireframe: true,
    transparent: true,
    opacity: 0.12,
  });

  const leftWall = new Mesh(wallGeo, wallMat);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-TUNNEL_WIDTH / 2, TUNNEL_HEIGHT / 2, -TUNNEL_DEPTH / 2);
  group.add(leftWall);

  const rightWall = new Mesh(wallGeo, wallMat.clone());
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(TUNNEL_WIDTH / 2, TUNNEL_HEIGHT / 2, -TUNNEL_DEPTH / 2);
  group.add(rightWall);

  // Glowing edge rails
  const railMat = new MeshBasicMaterial({
    color: new Color(0x0088ff),
    transparent: true,
    opacity: 0.6,
    blending: AdditiveBlending,
  });

  for (let side = -1; side <= 1; side += 2) {
    for (let y = 0; y <= TUNNEL_HEIGHT; y += TUNNEL_HEIGHT) {
      const rail = new Mesh(
        new BoxGeometry(0.02, 0.02, TUNNEL_DEPTH),
        railMat
      );
      rail.position.set(side * TUNNEL_WIDTH / 2, y, -TUNNEL_DEPTH / 2);
      group.add(rail);
    }
  }

  // Cross beams every 2 meters
  const beamMat = new MeshBasicMaterial({
    color: new Color(0x003366),
    transparent: true,
    opacity: 0.3,
    blending: AdditiveBlending,
  });

  for (let z = 0; z > -TUNNEL_DEPTH; z -= 2) {
    const bottomBeam = new Mesh(new BoxGeometry(TUNNEL_WIDTH, 0.01, 0.01), beamMat);
    bottomBeam.position.set(0, 0, z);
    group.add(bottomBeam);

    const topBeam = new Mesh(new BoxGeometry(TUNNEL_WIDTH, 0.01, 0.01), beamMat);
    topBeam.position.set(0, TUNNEL_HEIGHT, z);
    group.add(topBeam);

    for (let side = -1; side <= 1; side += 2) {
      const vBeam = new Mesh(new BoxGeometry(0.01, TUNNEL_HEIGHT, 0.01), beamMat);
      vBeam.position.set(side * TUNNEL_WIDTH / 2, TUNNEL_HEIGHT / 2, z);
      group.add(vBeam);
    }
  }

  // ============================
  // ENHANCED: Running lights along floor edges
  // ============================
  const runningLightMat = new MeshBasicMaterial({
    color: new Color(0x0044aa),
    transparent: true,
    opacity: 0.7,
    blending: AdditiveBlending,
  });

  for (let z = 0; z > -TUNNEL_DEPTH; z -= 1.5) {
    for (let side = -1; side <= 1; side += 2) {
      const light = new Mesh(new SphereGeometry(0.02, 4, 4), runningLightMat);
      light.position.set(side * (TUNNEL_WIDTH / 2 - 0.05), 0.02, z);
      group.add(light);
    }
  }

  // ============================
  // ENHANCED: Ceiling accent lights
  // ============================
  const ceilingLightMat = new MeshBasicMaterial({
    color: new Color(0x002266),
    transparent: true,
    opacity: 0.5,
    blending: AdditiveBlending,
  });

  for (let z = -2; z > -TUNNEL_DEPTH; z -= 4) {
    const cLight = new Mesh(new BoxGeometry(1.5, 0.005, 0.05), ceilingLightMat);
    cLight.position.set(0, TUNNEL_HEIGHT - 0.01, z);
    group.add(cLight);
  }

  // ============================
  // ENHANCED: Corner accent strips
  // ============================
  const accentMat = new MeshBasicMaterial({
    color: new Color(0x004488),
    transparent: true,
    opacity: 0.4,
    blending: AdditiveBlending,
  });

  for (let side = -1; side <= 1; side += 2) {
    // Floor-wall joint strip
    const floorStrip = new Mesh(
      new BoxGeometry(0.01, 0.01, TUNNEL_DEPTH),
      accentMat
    );
    floorStrip.position.set(side * (TUNNEL_WIDTH / 2 - 0.15), 0.005, -TUNNEL_DEPTH / 2);
    group.add(floorStrip);

    // Ceiling-wall joint strip
    const ceilStrip = new Mesh(
      new BoxGeometry(0.01, 0.01, TUNNEL_DEPTH),
      accentMat
    );
    ceilStrip.position.set(side * (TUNNEL_WIDTH / 2 - 0.15), TUNNEL_HEIGHT - 0.005, -TUNNEL_DEPTH / 2);
    group.add(ceilStrip);
  }

  // ============================
  // ENHANCED: Danger zone indicator at far end
  // ============================
  const dangerMat = new MeshBasicMaterial({
    color: new Color(0xff0022),
    transparent: true,
    opacity: 0.15,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
  const dangerPlane = new Mesh(
    new PlaneGeometry(TUNNEL_WIDTH, TUNNEL_HEIGHT),
    dangerMat
  );
  dangerPlane.position.set(0, TUNNEL_HEIGHT / 2, -TUNNEL_DEPTH);
  group.add(dangerPlane);

  // Danger zone wireframe
  const dangerWire = new Mesh(
    new PlaneGeometry(TUNNEL_WIDTH, TUNNEL_HEIGHT, 6, 4),
    new MeshBasicMaterial({
      color: new Color(0xff0022),
      wireframe: true,
      transparent: true,
      opacity: 0.2,
      side: DoubleSide,
    })
  );
  dangerWire.position.set(0, TUNNEL_HEIGHT / 2, -TUNNEL_DEPTH);
  group.add(dangerWire);

  return group;
}

/**
 * Animated tunnel runner that pulses the running lights
 */
export function createTunnelAnimator(tunnel: Group) {
  let phase = 0;

  function update(delta: number, time: number) {
    phase += delta;

    // Animate running lights along the floor
    let lightIdx = 0;
    tunnel.traverse((child) => {
      if (child instanceof Mesh && child.geometry instanceof SphereGeometry) {
        const mat = child.material as MeshBasicMaterial;
        if (mat.blending === AdditiveBlending && child.position.y < 0.1) {
          // Running light - pulse
          const brightness = 0.3 + Math.sin(time * 4 + lightIdx * 0.5) * 0.4;
          mat.opacity = Math.max(0.1, brightness);
          lightIdx++;
        }
      }
    });
  }

  return { update };
}
