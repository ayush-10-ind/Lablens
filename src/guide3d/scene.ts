/**
 * Procedural Three.js Scene Builder for the Prebuilt 3D Circuit Guide.
 *
 * Strict Architectural Rules (docs/architecture.md §6.0, docs/rules.md §B2-B3):
 * - Strictly prebuilt and procedural: zero glTF/external models, zero network downloads.
 * - Never generated or reconstructed from camera detections.
 * - Displays a static canonical series circuit (Battery, Switch, Resistor, LED).
 * - Total scene vertices kept well below 2,500 vertices for mobile efficiency.
 * - Full memory disposal on cleanup.
 */

import * as THREE from 'three';

export interface GuideSceneHandle {
  setStep: (stepNumber: number) => void;
  setHighlightedComponent: (componentId: string | null) => void;
  setCircuitActive: (active: boolean) => void;
  onResize: (width: number, height: number) => void;
  handlePointerDrag: (deltaX: number) => void;
  getVertexCount: () => number;
  dispose: () => void;
}

export function createCircuitGuideScene(
  container: HTMLElement,
  options: {
    reducedMotion?: boolean;
    onReady?: () => void;
  } = {}
): GuideSceneHandle {
  const { reducedMotion = false } = options;

  // 1. Scene & Renderer setup
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1220); // --bg

  const width = container.clientWidth || 390;
  const height = container.clientHeight || 500;

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 3.8, 4.8);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2));
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  // 2. Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(3, 6, 4);
  scene.add(dirLight);

  // 3. Central Rotatable Group
  const circuitGroup = new THREE.Group();
  scene.add(circuitGroup);

  // Base Plinth (subtle surface)
  const baseGeo = new THREE.CylinderGeometry(2.6, 2.7, 0.1, 24);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x141c2f, roughness: 0.8 }); // --surface
  const baseMesh = new THREE.Mesh(baseGeo, baseMat);
  baseMesh.position.y = -0.05;
  circuitGroup.add(baseMesh);

  // 4. Closed Wire Loop (CatmullRomCurve3)
  // Arranged in rectangular loop: Battery (-1.4, -0.9) -> Switch (1.4, -0.9) -> Resistor (1.4, 0.9) -> LED (-1.4, 0.9)
  const curvePoints = [
    new THREE.Vector3(-1.4, 0.05, -0.9), // Battery
    new THREE.Vector3(0.0, 0.05, -0.9),
    new THREE.Vector3(1.4, 0.05, -0.9),  // Switch
    new THREE.Vector3(1.4, 0.05, 0.0),
    new THREE.Vector3(1.4, 0.05, 0.9),   // Resistor
    new THREE.Vector3(0.0, 0.05, 0.9),
    new THREE.Vector3(-1.4, 0.05, 0.9),  // LED
    new THREE.Vector3(-1.4, 0.05, 0.0),
  ];
  const wireCurve = new THREE.CatmullRomCurve3(curvePoints, true, 'centripetal');

  const wireGeo = new THREE.TubeGeometry(wireCurve, 36, 0.025, 6, true);
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x7aa2ff, metalness: 0.2, roughness: 0.5 });
  const wireMesh = new THREE.Mesh(wireGeo, wireMat);
  circuitGroup.add(wireMesh);

  // 5. Component Primitives
  const componentMeshes: Record<string, THREE.Group> = {};

  // (a) Battery (top-left)
  const batteryGroup = new THREE.Group();
  batteryGroup.position.set(-1.4, 0, -0.9);
  const battBodyGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.6, 16);
  const battBodyMat = new THREE.MeshStandardMaterial({ color: 0xf5c542, roughness: 0.4 }); // --battery
  const battBody = new THREE.Mesh(battBodyGeo, battBodyMat);
  battBody.position.y = 0.3;
  batteryGroup.add(battBody);
  const battCapGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.08, 12);
  const battCapMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8 });
  const battCap = new THREE.Mesh(battCapGeo, battCapMat);
  battCap.position.y = 0.64;
  batteryGroup.add(battCap);
  circuitGroup.add(batteryGroup);
  componentMeshes.battery = batteryGroup;

  // (b) Switch (top-right)
  const switchGroup = new THREE.Group();
  switchGroup.position.set(1.4, 0, -0.9);
  const swBaseGeo = new THREE.BoxGeometry(0.45, 0.1, 0.35);
  const swBaseMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
  const swBase = new THREE.Mesh(swBaseGeo, swBaseMat);
  swBase.position.y = 0.05;
  switchGroup.add(swBase);
  const swLeverGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8);
  const swLeverMat = new THREE.MeshStandardMaterial({ color: 0x7aa2ff, metalness: 0.7 }); // --switch
  const swLever = new THREE.Mesh(swLeverGeo, swLeverMat);
  swLever.position.set(0, 0.15, 0);
  swLever.rotation.x = Math.PI / 6;
  switchGroup.add(swLever);
  circuitGroup.add(switchGroup);
  componentMeshes.switch = switchGroup;

  // (c) Resistor (bottom-right: visibly in series with LED)
  const resistorGroup = new THREE.Group();
  resistorGroup.position.set(1.4, 0, 0.9);
  const resBodyGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.48, 14);
  const resBodyMat = new THREE.MeshStandardMaterial({ color: 0xc08a5b, roughness: 0.5 }); // --resistor
  const resBody = new THREE.Mesh(resBodyGeo, resBodyMat);
  resBody.rotation.z = Math.PI / 2;
  resBody.position.y = 0.12;
  resistorGroup.add(resBody);
  // Colored identifier bands
  const bandColors = [0x991b1b, 0x000000, 0xd97706];
  bandColors.forEach((col, idx) => {
    const bandGeo = new THREE.TorusGeometry(0.125, 0.015, 6, 12);
    const bandMat = new THREE.MeshStandardMaterial({ color: col });
    const bandMesh = new THREE.Mesh(bandGeo, bandMat);
    bandMesh.rotation.y = Math.PI / 2;
    bandMesh.position.set(-0.12 + idx * 0.12, 0.12, 0);
    resistorGroup.add(bandMesh);
  });
  circuitGroup.add(resistorGroup);
  componentMeshes.resistor = resistorGroup;

  // (d) LED (bottom-left)
  const ledGroup = new THREE.Group();
  ledGroup.position.set(-1.4, 0, 0.9);
  const ledDomeGeo = new THREE.SphereGeometry(0.2, 14, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const ledMat = new THREE.MeshStandardMaterial({
    color: 0xff6b9e, // --led
    emissive: 0xff6b9e,
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.9,
  });
  const ledDome = new THREE.Mesh(ledDomeGeo, ledMat);
  ledDome.position.y = 0.22;
  ledGroup.add(ledDome);
  const ledCylGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.15, 14);
  const ledCyl = new THREE.Mesh(ledCylGeo, ledMat);
  ledCyl.position.y = 0.15;
  ledGroup.add(ledCyl);

  // LED Point Light for illumination
  const ledLight = new THREE.PointLight(0xff6b9e, 1.8, 3.0);
  ledLight.position.set(0, 0.4, 0);
  ledGroup.add(ledLight);

  circuitGroup.add(ledGroup);
  componentMeshes.led = ledGroup;

  // 6. Current Flow Particles
  const PARTICLE_COUNT = 24;
  const particleGeo = new THREE.SphereGeometry(0.035, 4, 4);
  const particleMat = new THREE.MeshBasicMaterial({ color: 0x3dd6c6 }); // --accent
  const particles: THREE.Mesh[] = [];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const pMesh = new THREE.Mesh(particleGeo, particleMat);
    circuitGroup.add(pMesh);
    particles.push(pMesh);
  }

  // State flags
  let isCircuitActive = true;
  let highlightedComponent: string | null = null;
  let particleProgress = 0;
  let rafId: number | null = null;

  // Count total scene vertices
  function getVertexCount(): number {
    let count = 0;
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.geometry) {
        const geo = obj.geometry;
        if (geo.attributes.position) {
          count += geo.attributes.position.count;
        }
      }
    });
    return count;
  }

  // Animation Loop
  const animate = () => {
    rafId = requestAnimationFrame(animate);

    // Particle flow animation along curve
    if (isCircuitActive) {
      particleProgress += 0.003;
      if (particleProgress > 1) particleProgress -= 1;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const offset = (particleProgress + i / PARTICLE_COUNT) % 1;
        const pt = wireCurve.getPointAt(offset);
        particles[i].position.copy(pt);
        particles[i].visible = true;
      }
    } else {
      for (const p of particles) {
        p.visible = false;
      }
    }

    // Slow gentle idle rotation if not reduced motion
    if (!reducedMotion) {
      circuitGroup.rotation.y += 0.0015;
    }

    // Highlight pulsing
    if (highlightedComponent && componentMeshes[highlightedComponent]) {
      const scale = 1.0 + Math.sin(Date.now() * 0.006) * 0.06;
      componentMeshes[highlightedComponent].scale.set(scale, scale, scale);
    }

    renderer.render(scene, camera);
  };

  animate();

  return {
    setStep(stepNumber: number) {
      // Step 1: Battery, Step 2: Switch, Step 3: Resistor, Step 4: LED
      const compKeys = ['battery', 'switch', 'resistor', 'led'];
      const target = compKeys[stepNumber - 1] || null;
      this.setHighlightedComponent(target);
    },

    setHighlightedComponent(compKey: string | null) {
      highlightedComponent = compKey;
      Object.keys(componentMeshes).forEach((key) => {
        const mesh = componentMeshes[key];
        if (key === compKey) {
          mesh.scale.set(1.08, 1.08, 1.08);
        } else {
          mesh.scale.set(1.0, 1.0, 1.0);
        }
      });
    },

    setCircuitActive(active: boolean) {
      isCircuitActive = active;
      ledLight.intensity = active ? 1.8 : 0;
      ledMat.emissiveIntensity = active ? 0.8 : 0.05;
    },

    onResize(w: number, h: number) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    },

    handlePointerDrag(deltaX: number) {
      circuitGroup.rotation.y += deltaX * 0.008;
    },

    getVertexCount,

    dispose() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          if (obj.geometry) {
            obj.geometry.dispose();
          }
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => m.dispose());
            } else {
              obj.material.dispose();
            }
          }
        }
      });

      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    },
  };
}

/**
 * Calculates the exact vertex count of the procedural circuit guide geometry.
 * Can be invoked in Node/test environments without WebGL context.
 */
export function countProceduralSceneVertices(): number {
  let count = 0;
  const countGeo = (geo: THREE.BufferGeometry) => {
    if (geo.attributes.position) {
      count += geo.attributes.position.count;
    }
    geo.dispose();
  };

  // Base plinth
  countGeo(new THREE.CylinderGeometry(2.6, 2.7, 0.1, 24));

  // Wire loop
  const curvePoints = [
    new THREE.Vector3(-1.4, 0.05, -0.9),
    new THREE.Vector3(0.0, 0.05, -0.9),
    new THREE.Vector3(1.4, 0.05, -0.9),
    new THREE.Vector3(1.4, 0.05, 0.0),
    new THREE.Vector3(1.4, 0.05, 0.9),
    new THREE.Vector3(0.0, 0.05, 0.9),
    new THREE.Vector3(-1.4, 0.05, 0.9),
    new THREE.Vector3(-1.4, 0.05, 0.0),
  ];
  const wireCurve = new THREE.CatmullRomCurve3(curvePoints, true, 'centripetal');
  countGeo(new THREE.TubeGeometry(wireCurve, 36, 0.025, 6, true));

  // Battery
  countGeo(new THREE.CylinderGeometry(0.24, 0.24, 0.6, 16));
  countGeo(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 12));

  // Switch
  countGeo(new THREE.BoxGeometry(0.45, 0.1, 0.35));
  countGeo(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8));

  // Resistor
  countGeo(new THREE.CylinderGeometry(0.12, 0.12, 0.48, 14));
  for (let i = 0; i < 3; i++) {
    countGeo(new THREE.TorusGeometry(0.125, 0.015, 6, 12));
  }

  // LED
  countGeo(new THREE.SphereGeometry(0.2, 14, 12, 0, Math.PI * 2, 0, Math.PI / 2));
  countGeo(new THREE.CylinderGeometry(0.2, 0.2, 0.15, 14));

  // Particles (24 particles, 4x4 segments)
  for (let i = 0; i < 24; i++) {
    countGeo(new THREE.SphereGeometry(0.035, 4, 4));
  }

  return count;
}

