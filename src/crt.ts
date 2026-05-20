/**
 * CRT/Scanline post-processing overlay
 * Adds retro arcade vibes with scanlines, slight vignette, and chromatic aberration feel
 */
import {
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  DoubleSide,
} from "@iwsdk/core";

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
uniform float uTime;
uniform float uIntensity;
varying vec2 vUv;

void main() {
  // Scanlines
  float scanline = sin(vUv.y * 600.0) * 0.04 * uIntensity;

  // Subtle vignette
  vec2 center = vUv - 0.5;
  float vignette = 1.0 - dot(center, center) * 0.5;

  // Flicker (very subtle)
  float flicker = 1.0 - sin(uTime * 8.0) * 0.005 * uIntensity;

  // CRT curvature distortion (very subtle)
  float curvature = dot(center, center) * 0.02 * uIntensity;

  float alpha = (scanline + curvature) * vignette * flicker;

  // Dark overlay with the scanline pattern
  gl_FragColor = vec4(0.0, 0.0, 0.0, max(0.0, alpha));
}
`;

export function createCRTOverlay(): {
  mesh: Mesh;
  update: (time: number) => void;
  setIntensity: (intensity: number) => void;
} {
  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 1.0 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
    depthTest: false,
  });

  const geometry = new PlaneGeometry(4, 3);
  const mesh = new Mesh(geometry, material);
  mesh.position.set(0, 1.6, -1.5);
  mesh.renderOrder = 999;

  function update(time: number) {
    material.uniforms.uTime.value = time;
  }

  function setIntensity(intensity: number) {
    material.uniforms.uIntensity.value = intensity;
  }

  return { mesh, update, setIntensity };
}
