/* Smooth procedural 3D hand surface driven by 21 hidden landmarks. */
(() => {
  "use strict";
  const THREE = globalThis.THREE;
  if (!THREE) return;

  const RAD = Math.PI / 180;
  const FINGER_BASES = [-19, -6, 7, 20];
  const TUBE_SPECS = [
    { ids: [0, 1, 2, 3, 4], baseRadius: 8.6, tipRadius: 4.6, steps: 22 },
    { ids: [5, 6, 7, 8], baseRadius: 8.1, tipRadius: 4.4, steps: 18 },
    { ids: [9, 10, 11, 12], baseRadius: 8.4, tipRadius: 4.6, steps: 18 },
    { ids: [13, 14, 15, 16], baseRadius: 7.9, tipRadius: 4.3, steps: 18 },
    { ids: [17, 18, 19, 20], baseRadius: 7.3, tipRadius: 4.0, steps: 18 },
  ];

  function mix(a, b, t) { return a + (b - a) * t; }
  function mixPoint(a, b, t) { return [mix(a[0], b[0], t), mix(a[1], b[1], t)]; }
  function cubic(a, b, c, d, t) {
    const u = 1 - t;
    return [
      u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
      u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
    ];
  }
  function sampleFingerPath(p, t) {
    return t < 0.5
      ? cubic(p[0], p[1], p[2], p[3], t * 2)
      : cubic(p[3], p[4], p[5], p[6], (t - 0.5) * 2);
  }

  function makeLandmarks(config) {
    const points = Array.from({ length: 21 }, () => new THREE.Vector3());
    const curls = config?.curl || [0.2, 0.2, 0.2, 0.2];
    const lengths = config?.lengths || [0.8, 0.9, 0.85, 0.72];
    const spread = Number(config?.spread ?? 0.3);

    for (let i = 0; i < 4; i++) {
      const bx = FINGER_BASES[i];
      const fan = (i < 2 ? -1 : 1) * spread * (i === 0 || i === 3 ? 10 : 4);
      const tipY = -43 - 64 * lengths[i];
      const open = [
        [bx, -43], [bx + fan * 0.12, -58], [bx + fan * 0.2, -73],
        [bx + fan * 0.28, -78], [bx + fan * 0.45, -84],
        [bx + fan * 0.8, tipY + 8], [bx + fan, tipY],
      ];
      const curled = [
        [bx, -43], [bx - 5, -55], [bx - 2, -67], [bx + 8, -64],
        [bx + 20, -61], [bx + 24, -51], [bx + 8, -50],
      ];
      const curve = open.map((p, j) => mixPoint(p, curled[j], curls[i]));
      const base = 5 + i * 4;
      [0, 0.34, 0.68, 1].forEach((t, j) => {
        const xy = sampleFingerPath(curve, t);
        points[base + j].set(xy[0], -xy[1], (i - 1.5) * 1.8 + (j === 3 ? 1 : 0));
      });
    }

    const thumbShapes = {
      open: [[-22, -30], [-29, -36], [-36, -44], [-42, -53]],
      relaxed: [[-22, -31], [-30, -37], [-39, -45], [-46, -54]],
      across: [[-23, -32], [-13, -41], [2, -45], [19, -48]],
      tucked: [[-23, -32], [-18, -38], [-12, -45], [-10, -54]],
      f: [[-22, -30], [-15, -38], [-6, -48], [5, -59]],
      round: [[-22, -30], [-13, -39], [-5, -50], [-7, -62]],
      up: [[-20, -39], [-26, -53], [-27, -68], [-23, -84]],
    };
    const thumb = thumbShapes[config?.thumb] || thumbShapes.relaxed;
    thumb.forEach((xy, i) => points[i + 1].set(xy[0], -xy[1], 2 + i * 0.8));
    points[0].set(0, 0, 0);
    return points;
  }

  function createSmoothTube(points, baseRadius, tipRadius, steps = 18, radialSegments = 12) {
    const curve = new THREE.CatmullRomCurve3(points, false, "centripetal", 0.18);
    const frames = curve.computeFrenetFrames(steps, false);
    const vertices = new Float32Array((steps + 1) * (radialSegments + 1) * 3);
    const indices = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const eased = t * t * (3 - 2 * t);
      const radius = mix(baseRadius, tipRadius, eased);
      const center = curve.getPointAt(t);
      for (let j = 0; j <= radialSegments; j++) {
        const angle = (j / radialSegments) * Math.PI * 2;
        const normal = frames.normals[i].clone().multiplyScalar(Math.cos(angle))
          .addScaledVector(frames.binormals[i], Math.sin(angle));
        const vertex = center.clone().addScaledVector(normal, radius);
        const offset = (i * (radialSegments + 1) + j) * 3;
        vertices[offset] = vertex.x;
        vertices[offset + 1] = vertex.y;
        vertices[offset + 2] = vertex.z;
        if (i < steps && j < radialSegments) {
          const a = i * (radialSegments + 1) + j;
          const b = a + radialSegments + 1;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  function replaceGeometry(mesh, geometry) {
    const previous = mesh.geometry;
    mesh.geometry = geometry;
    if (previous && previous !== geometry) previous.dispose();
  }

  function create(canvas) {
    if (!canvas) return null;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
      premultipliedAlpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const scene = new THREE.Scene();
    // Match the expanded transparent viewBox while keeping the original 420×300 art scale.
    const camera = new THREE.OrthographicCamera(-270, 270, 195, -195, 1, 1000);
    camera.position.set(0, 0, 520);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xd9ebff, 0x27508b, 1.05));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(-110, 150, 230);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x79b8ff, 0.35);
    fillLight.position.set(150, -50, 160);
    scene.add(fillLight);

    const skin = new THREE.MeshStandardMaterial({
      color: 0x4389e3,
      emissive: 0x164984,
      emissiveIntensity: 0.28,
      roughness: 0.38,
      metalness: 0.005,
    });
    const palmGeometry = new THREE.SphereGeometry(1, 32, 24);
    const tipGeometry = new THREE.SphereGeometry(1, 20, 14);
    const rigs = {};

    function createRig(side) {
      const root = new THREE.Group();
      const palm = new THREE.Mesh(palmGeometry, skin);
      palm.scale.set(30, 39, 15);
      palm.position.set(0, 25, 0);
      root.add(palm);

      const fingers = TUBE_SPECS.map((spec) => {
        const mesh = new THREE.Mesh(new THREE.BufferGeometry(), skin);
        const tip = new THREE.Mesh(tipGeometry, skin);
        root.add(mesh, tip);
        return { mesh, tip, spec };
      });
      scene.add(root);
      root.visible = false;
      return { side, root, palm, fingers, points: null };
    }
    rigs.left = createRig("left");
    rigs.right = createRig("right");

    function screenPoint(x, y, z) {
      return new THREE.Vector3(x - 210, 150 - y, z);
    }

    function setHand(side, frame, mirror, poseDefinitions) {
      const rig = rigs[side === "left" ? "left" : "right"];
      if (!frame) {
        rig.root.visible = false;
        rig.points = null;
        return;
      }
      // Swap screen positions: the logical left hand is displayed on the right and vice versa.
      const base = side === "left"
        ? { x: 324, y: 218 }
        : { x: 96, y: 218 };
      // Keep the full 3D hand silhouette inside the expanded -60..480, -45..345 canvas.
      const wristX = Math.min(410, Math.max(10, base.x + frame.x));
      const wristY = Math.min(330, Math.max(50, base.y + frame.y));
      const wristWorld = screenPoint(wristX, wristY, 57);

      rig.root.visible = true;
      rig.root.position.copy(wristWorld);
      rig.root.rotation.order = "ZYX";
      rig.root.rotation.set(0, -(frame.yaw || 0) * RAD, -(frame.rot || 0) * RAD);
      const handScale = 0.86;
      const mirrorSign = mirror ? -1 : 1;
      rig.root.scale.set(handScale * mirrorSign, handScale, handScale);

      const currentConfig = poseDefinitions?.[frame.pose] || poseDefinitions?.relax;
      let points = makeLandmarks(currentConfig);
      if (frame.nextPose && frame.fade > 0) {
        const nextConfig = poseDefinitions?.[frame.nextPose];
        if (nextConfig) {
          const nextPoints = makeLandmarks(nextConfig);
          const amount = Math.max(0, Math.min(1, frame.fade));
          points = points.map((p, i) => p.lerp(nextPoints[i], amount));
        }
      }
      rig.points = points;

      for (const { mesh, tip, spec } of rig.fingers) {
        const chain = spec.ids.map((id) => points[id].clone());
        replaceGeometry(mesh, createSmoothTube(chain, spec.baseRadius, spec.tipRadius, spec.steps, 12));
        mesh.visible = true;
        const tipPoint = chain[chain.length - 1];
        tip.position.copy(tipPoint);
        tip.scale.setScalar(spec.tipRadius * 0.78);
        tip.visible = true;
      }
    }

    function getLandmarks(side) {
      const rig = rigs[side === "left" ? "left" : "right"];
      if (!rig.points || !rig.root.visible) return null;
      rig.root.updateMatrixWorld(true);
      return rig.points.map((point, id) => {
        const world = point.clone().applyMatrix4(rig.root.matrixWorld);
        return { id, x: world.x + 210, y: 150 - world.y, z: world.z };
      });
    }

    function resize(size) {
      const width = Math.max(120, Number(size) || 260);
      const height = width * 390 / 540;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      renderer.setSize(width, height, false);
      renderer.render(scene, camera);
    }

    function render() {
      for (const rig of Object.values(rigs)) rig.root.updateMatrixWorld(true);
      renderer.render(scene, camera);
    }

    resize(260 * 540 / 420);
    return { setHand, getLandmarks, resize, render, dispose: () => renderer.dispose() };
  }

  window.SurdoHand3D = { create };
})();
