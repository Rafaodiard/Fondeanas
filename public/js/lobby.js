// Lobby 3D: el personaje del jugador sobre una plataforma, con el bus volador pasando de fondo, nubes y chispas.
// Comparte el renderer con el juego: main.js llama a render() mientras no se está en una sala.
import * as THREE from 'three';
import { createCharacter, animateCharacter, createBus } from './models.js';

export function crearLobby({ renderer, canvas }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 400);

  // ---- cielo: domo con degradado (atardecer violeta a azul) y estrellas
  const cielo = new THREE.Mesh(new THREE.SphereGeometry(200, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { arriba: { value: new THREE.Color('#0c1440') }, medio: { value: new THREE.Color('#3a2d8f') }, abajo: { value: new THREE.Color('#ff8a5c') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 arriba; uniform vec3 medio; uniform vec3 abajo; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = h > 0.08 ? mix(medio, arriba, smoothstep(0.08, 0.6, h)) : mix(abajo, medio, smoothstep(-0.12, 0.08, h));
      gl_FragColor = vec4(c, 1.0); }`,
  }));
  scene.add(cielo);
  {
    const n = 500, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, y = 0.15 + Math.random() * 0.85, r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(a) * r * 180, y * 180, Math.sin(a) * r * 180], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 0.9, sizeAttenuation: true, transparent: true, opacity: 0.7, fog: false })));
  }
  scene.fog = new THREE.Fog('#2a2470', 30, 160);

  // ---- luces: principal cálida, contraluz celeste y relleno violeta
  scene.add(new THREE.HemisphereLight('#b9c6ff', '#3a1f4a', 0.9));
  const sol = new THREE.DirectionalLight('#ffe2c4', 2.6);
  sol.position.set(3, 6, 5); sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  Object.assign(sol.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 20 });
  sol.shadow.bias = -0.0004;
  scene.add(sol);
  const contra = new THREE.DirectionalLight('#5fd4ff', 2.2); contra.position.set(-3, 3, -4); scene.add(contra);
  const relleno = new THREE.PointLight('#c77dff', 6, 8, 2); relleno.position.set(-1.8, 1.2, 1.6); scene.add(relleno);

  // ---- plataforma: disco de metal con anillo dorado que brilla y piso lejano
  const plat = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: '#2b3157', metalness: 0.7, roughness: 0.35 });
  const tapa = new THREE.MeshStandardMaterial({ color: '#3c4475', metalness: 0.5, roughness: 0.5 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.75, 0.32, 64), metal); base.position.y = -0.16; base.receiveShadow = true; plat.add(base);
  const sup = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.02, 64), tapa); sup.position.y = 0.0; sup.receiveShadow = true; plat.add(sup);
  const anilloMat = new THREE.MeshStandardMaterial({ color: '#ffd23f', emissive: '#ffb020', emissiveIntensity: 1.6, metalness: 0.3, roughness: 0.3 });
  const anillo = new THREE.Mesh(new THREE.TorusGeometry(1.53, 0.035, 12, 96), anilloMat); anillo.rotation.x = Math.PI / 2; anillo.position.y = 0.01; plat.add(anillo);
  const anillo2 = new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.02, 8, 96), new THREE.MeshBasicMaterial({ color: '#7fe7ff' })); anillo2.rotation.x = Math.PI / 2; anillo2.position.y = -0.3; plat.add(anillo2);
  // halo de luz que sube desde el borde
  const haloMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { t: { value: 0 }, color: { value: new THREE.Color('#ffcf4a') } },
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float t; uniform vec3 color; varying vec2 vU; void main(){ float a = pow(1.0 - vU.y, 3.0) * (0.16 + 0.05 * sin(t * 2.0 + vU.x * 40.0)); gl_FragColor = vec4(color, a); }',
  });
  const halo = new THREE.Mesh(new THREE.CylinderGeometry(1.53, 1.53, 0.7, 64, 1, true), haloMat); halo.position.y = 0.35; plat.add(halo);
  scene.add(plat);
  const piso = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshStandardMaterial({ color: '#1b1846', roughness: 0.9 }));
  piso.rotation.x = -Math.PI / 2; piso.position.y = -0.32; piso.receiveShadow = true; scene.add(piso);

  // ---- chispas que suben alrededor de la plataforma
  const NCH = 70;
  const chPos = new Float32Array(NCH * 3), chVel = [];
  for (let i = 0; i < NCH; i++) { chVel.push(0.2 + Math.random() * 0.5); reiniciarChispa(i, Math.random() * 2.5); }
  function reiniciarChispa(i, y = 0) {
    const a = Math.random() * Math.PI * 2, r = 1.1 + Math.random() * 0.8;
    chPos.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3);
  }
  const chGeo = new THREE.BufferGeometry(); chGeo.setAttribute('position', new THREE.BufferAttribute(chPos, 3));
  const chispas = new THREE.Points(chGeo, new THREE.PointsMaterial({ color: '#ffe08a', size: 0.045, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(chispas);

  // ---- nubes bajas lejos y el bus volador que pasa de fondo
  const nubeMat = new THREE.MeshStandardMaterial({ color: '#b7a8ff', flatShading: true, roughness: 1, emissive: '#5a3fa0', emissiveIntensity: 0.35, transparent: true, opacity: 0.9 });
  const nubes = new THREE.Group();
  for (let c = 0; c < 14; c++) {
    const g = new THREE.Group();
    for (let p = 0; p < 5; p++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), nubeMat);
      const s = 2 + Math.random() * 2.5;
      m.scale.set(s * 1.6, s * 0.7, s); m.position.set((Math.random() - 0.5) * 8, Math.random() * 1.5, (Math.random() - 0.5) * 3);
      g.add(m);
    }
    const a = (c / 14) * Math.PI * 2 + Math.random() * 0.3;
    g.position.set(Math.cos(a) * (45 + Math.random() * 25), -2 + Math.random() * 6, Math.sin(a) * (45 + Math.random() * 25) - 20);
    nubes.add(g);
  }
  scene.add(nubes);
  const bus = createBus();
  bus.scale.setScalar(0.55);
  scene.add(bus);

  // ---- personaje
  let pj = null, yaw = -0.3, yawVel = 0, bailar = false, arrastrando = false, ultX = 0, quieto = 0;
  function ponerPersonaje(color, skin = null) {
    if (pj) scene.remove(pj);
    pj = createCharacter(color, skin);
    pj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    scene.add(pj);
  }

  // arrastrar con el mouse (o el dedo) gira el personaje
  canvas.addEventListener('pointerdown', (e) => { if (!activo) return; arrastrando = true; ultX = e.clientX; });
  window.addEventListener('pointermove', (e) => {
    if (!arrastrando) return;
    yawVel = (e.clientX - ultX) * 0.012; yaw += yawVel; ultX = e.clientX; quieto = 0;
  });
  window.addEventListener('pointerup', () => { arrastrando = false; });

  let activo = false, t = 0;
  function render(dt) {
    t += dt;
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    // en pantallas anchas el personaje va a la derecha (los botones quedan a la izquierda); en el celular, arriba al centro
    const ancho = camera.aspect > 1.15;
    const corrida = ancho ? -Math.min(1.9, (camera.aspect - 1) * 1.25) : 0;
    camera.fov = ancho ? 30 : 40;
    camera.position.set(corrida, ancho ? 1.7 : 2.0, ancho ? 7.6 : 8.4);
    camera.lookAt(corrida, ancho ? 0.95 : 0.2, 0);
    camera.updateProjectionMatrix();

    if (pj) {
      if (!arrastrando) {
        yawVel *= Math.exp(-dt * 4);
        yaw += yawVel;
        quieto += dt;
        // si nadie lo toca, vuelve despacio a mirar a cámara, un poco de costado
        if (quieto > 2.5) yaw += (-0.3 + Math.sin(t * 0.4) * 0.25 - yaw) * Math.min(1, dt * 0.8);
      }
      pj.rotation.y = Math.PI + yaw; // el personaje mira a -Z: lo damos vuelta para que mire a cámara
      pj.position.set(0, 0.01, 0);
      animateCharacter(pj, 'ground', 0, dt, false, { air: false, vy: 0, pitch: 0, dance: bailar });
    }
    anilloMat.emissiveIntensity = 1.3 + Math.sin(t * 2.2) * 0.4;
    haloMat.uniforms.t.value = t;
    for (let i = 0; i < NCH; i++) {
      chPos[i * 3 + 1] += chVel[i] * dt;
      if (chPos[i * 3 + 1] > 2.6) reiniciarChispa(i);
    }
    chGeo.attributes.position.needsUpdate = true;
    nubes.rotation.y = t * 0.01;
    // el bus cruza el cielo de fondo cada 26 s
    const k = (t % 26) / 26;
    bus.position.set(-70 + k * 140, 14 + Math.sin(k * Math.PI) * 4, -55);
    bus.rotation.set(0, -Math.PI / 2, Math.sin(t * 0.8) * 0.05);
    for (const p of bus.userData.props || []) p.rotation.z += dt * 30;
    renderer.render(scene, camera);
  }

  return {
    render, ponerPersonaje,
    set activo(v) { activo = v; if (!v) arrastrando = false; }, get activo() { return activo; },
    set bailar(v) { bailar = v; }, get bailar() { return bailar; },
  };
}
