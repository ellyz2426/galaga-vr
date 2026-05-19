import {
  Group,
  Mesh,
  BoxGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Color,
  AdditiveBlending,
  LineSegments,
  EdgesGeometry,
  LineBasicMaterial,
  PlaneGeometry,
  DoubleSide,
} from "@iwsdk/core";

export const TUNNEL_WIDTH = 6;
export const TUNNEL_HEIGHT = 4;
export const TUNNEL_DEPTH = 25;
export const TUNNEL_CENTER_Y = 1.5;

export function createTunnel(): Group {
  const group = new Group();

  // Grid floor
  const floorGeo = new PlaneGeometry(TUNNEL_WIDTH, TUNNEL_DEPTH, 30, 125);
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

  // Solid floor underneath
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
  const ceilGeo = new PlaneGeometry(TUNNEL_WIDTH, TUNNEL_DEPTH, 30, 125);
  const ceilMat = new MeshBasicMaterial({
    color: new Color(0x001133),
    wireframe: true,
    transparent: true,
    opacity: 0.15,
  });
  const ceil = new Mesh(ceilGeo, ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, TUNNEL_HEIGHT, -TUNNEL_DEPTH / 2);
  group.add(ceil);

  // Side walls (wireframe)
  const wallGeo = new PlaneGeometry(TUNNEL_DEPTH, TUNNEL_HEIGHT, 125, 20);
  const wallMat = new MeshBasicMaterial({
    color: new Color(0x002244),
    wireframe: true,
    transparent: true,
    opacity: 0.15,
  });

  // Left wall
  const leftWall = new Mesh(wallGeo, wallMat);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-TUNNEL_WIDTH / 2, TUNNEL_HEIGHT / 2, -TUNNEL_DEPTH / 2);
  group.add(leftWall);

  // Right wall
  const rightWall = new Mesh(wallGeo, wallMat.clone());
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(TUNNEL_WIDTH / 2, TUNNEL_HEIGHT / 2, -TUNNEL_DEPTH / 2);
  group.add(rightWall);

  // Glowing horizontal rail lines along the corridor
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
      rail.position.set(
        side * TUNNEL_WIDTH / 2,
        y,
        -TUNNEL_DEPTH / 2
      );
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
    // Bottom cross beam
    const bottomBeam = new Mesh(
      new BoxGeometry(TUNNEL_WIDTH, 0.01, 0.01),
      beamMat
    );
    bottomBeam.position.set(0, 0, z);
    group.add(bottomBeam);

    // Top cross beam
    const topBeam = new Mesh(
      new BoxGeometry(TUNNEL_WIDTH, 0.01, 0.01),
      beamMat
    );
    topBeam.position.set(0, TUNNEL_HEIGHT, z);
    group.add(topBeam);

    // Vertical beams on sides
    for (let side = -1; side <= 1; side += 2) {
      const vBeam = new Mesh(
        new BoxGeometry(0.01, TUNNEL_HEIGHT, 0.01),
        beamMat
      );
      vBeam.position.set(side * TUNNEL_WIDTH / 2, TUNNEL_HEIGHT / 2, z);
      group.add(vBeam);
    }
  }

  return group;
}
