// ---- dev preview: render generated characters ----
(function preview() {
  const params = new URLSearchParams(location.search);
  const W = innerWidth, Hh = innerHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(W, Hh); renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xd8d8d8);
  const cam = new THREE.PerspectiveCamera(35, W / Hh, 0.05, 100);
  window.__cam = cam;
  const hemi = new THREE.HemisphereLight(0xffffff, 0x9a9a9a, 1.2); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(2, 6, 4); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -6; sun.shadow.camera.right = 6; sun.shadow.camera.top = 6; sun.shadow.camera.bottom = -6;
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02; scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.6); fill.position.set(-3, 3, 2); scene.add(fill);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.6 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene(); envScene.background = new THREE.Color(0xbbbbbb);
  const lightBox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  lightBox.scale.set(8, 0.2, 8); lightBox.position.set(0, 5, 0); envScene.add(lightBox);
  scene.environment = pmrem.fromScene(envScene, 0.04).texture;
  const n = parseInt(params.get('n') || '6');
  const seed0 = parseInt(params.get('seed') || '1000');
  const quality = params.get('q') || 'high';
  const pose = params.get('pose') || 'down';
  const chars = [];
  const t0 = performance.now();
  let verts = 0;
  for (let i = 0; i < n; i++) {
    const ov = {};
    if (params.get('g')) ov.gender = params.get('g');
    if (params.get('hair')) ov.hairStyle = params.get('hair');
    if (params.get('outfit')) ov.outfit = params.get('outfit');
    if (params.get('fh')) ov.facialHair = params.get('fh');
    const app = HT.generateAppearance(seed0 + i * 7919, ov);
    const rig = HT.buildRigSpec(app);
    const geo = HT.buildCharacterGeometry(app, rig, quality);
    verts += geo.userData.vertexCount;
    const bones = [];
    for (let b = 0; b < BONE_NAMES.length; b++) {
      const bone = new THREE.Bone(); bone.name = BONE_NAMES[b]; bone.position.copy(rig.localOffset[b]); bones.push(bone);
      if (BONE_PARENT[b] >= 0) bones[BONE_PARENT[b]].add(bone);
    }
    const mesh = new THREE.SkinnedMesh(geo, createCharacterMaterial());
    mesh.add(bones[0]);
    mesh.bind(new THREE.Skeleton(bones));
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    const spacing = 0.75;
    bones[0].position.x = (i - (n - 1) / 2) * spacing;
    if (pose === 'down') {
      bones[B.upperarm_L].quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -24 * Math.PI / 180);
      bones[B.upperarm_R].quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), 24 * Math.PI / 180);
      bones[B.forearm_L].quaternion.setFromAxisAngle(rig.elbowAxis[0], 0.15);
      bones[B.forearm_R].quaternion.setFromAxisAngle(rig.elbowAxis[1], 0.15);
    }
    if (params.get('jaw')) bones[B.jaw].quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), parseFloat(params.get('jaw')));
    if (params.get('zombie')) mesh.material.userData.u.uZombie.value = 1;
    scene.add(mesh);
    chars.push({ app, rig, mesh });
  }
  const genMs = performance.now() - t0;
  const view = params.get('view') || 'front';
  let tgtY = parseFloat(params.get('ty') || '1.0');
  if (params.get('face')) tgtY = chars[0].rig.eyeY - 0.03;
  const dist = parseFloat(params.get('d') || (2.2 + n * 0.55));
  const ang = { front: 0, side: Math.PI / 2, back: Math.PI, q: Math.PI / 4, q2: -Math.PI / 4 }[view] || 0;
  const tx = parseFloat(params.get('tx') || '0');
  cam.position.set(tx + Math.sin(ang) * dist, tgtY + parseFloat(params.get('cy') || '0.15'), Math.cos(ang) * dist);
  cam.lookAt(tx, tgtY, 0);
  if (params.get('fov')) { cam.fov = parseFloat(params.get('fov')); cam.updateProjectionMatrix(); }
  renderer.render(scene, cam);
  window.__info = { genMs, verts, n, apps: chars.map(c => ({ name: c.app.name, gender: c.app.gender, h: c.app.height.toFixed(2), build: c.app.build, hair: c.app.hairStyle, outfit: c.app.top.type + '/' + (c.app.bottom ? c.app.bottom.type : '-') + '/' + c.app.shoes.type, fh: c.app.facialHair, skin: c.app.skin.name })) };
  window.__done = true;
})();
