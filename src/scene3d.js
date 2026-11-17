import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GX, SX, T_END, T0, XA, XB, YA, YB, Z_SCALE, Lw, clamp } from './config.js';

export class Scene3D {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#232028');
    this.scene.fog = new THREE.FogExp2('#1d1a24', 0.0028);

    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;
    this.camera = new THREE.PerspectiveCamera(34, w / h, 0.5, 420);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    // Quality management: 'auto' | 'high' | 'medium' | 'low'
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 900;
    this.qualityMode = 'auto';
    this.effectiveQuality = isMobile ? 'medium' : 'high';
    this.fpsHistory = [];
    this.fpsAvg = 60;
    this.cutawayEnabled = true;

    // 3 lights only for high performance
    this.ambLight = new THREE.AmbientLight('#ffe9d2', 0.65);
    this.hemiLight = new THREE.HemisphereLight('#a8c4ff', '#4a3525', 0.7);
    this.dirLight = new THREE.DirectionalLight('#fff1d6', 1.45);
    this.dirLight.position.set(42, 46, 36);
    this.dirLight.castShadow = this.effectiveQuality === 'high';
    this.dirLight.shadow.mapSize.set(1024, 1024);
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 160;
    const d = 52;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0008;
    this.dirLight.target.position.set(17.5, 0, 18);
    this.scene.add(this.ambLight, this.hemiLight, this.dirLight, this.dirLight.target);

    // Controls: MapControls aligned with iso world
    this.controls = new MapControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.screenSpacePanning = false;
    this.controls.maxPolarAngle = Math.PI * 0.43;
    this.controls.minPolarAngle = 0.28;
    this.controls.minDistance = 11;
    this.controls.maxDistance = 128;
    this.controls.rotateSpeed = 0.75;
    this.controls.zoomSpeed = 1.05;
    this.controls.panSpeed = 0.95;
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    this.controls.touches = {
      ONE: THREE.TOUCH.PAN,
      TWO: THREE.TOUCH.DOLLY_ROTATE,
    };

    // Cancel auto-glide when user interacts
    this.camAnim = null;
    this.controls.addEventListener('start', () => {
      this.camAnim = null;
    });

    // Raycaster & horizontal picking plane
    this.raycaster = new THREE.Raycaster();
    this.pickPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.6);
    // Scratch objects for zero-GC updates
    this._hitVec = new THREE.Vector3();
    this._ndc = new THREE.Vector2();
    this._cBg = new THREE.Color();
    this._cAmb = new THREE.Color();
    this._cSky = new THREE.Color();
    this._cGnd = new THREE.Color();
    this._cDir = new THREE.Color();
    this._cTmp = new THREE.Color();
    this._cRain = new THREE.Color('#151c28');

    // Post-processing (selective bloom for high quality)
    this.composer = null;
    this.bloomPass = null;
    this._setupPost(w, h);

    // Set initial overview camera
    this.overview(true);
    this.applyQuality(this.effectiveQuality);
    this.resize();
  }

  _setupPost(w, h) {
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(Math.max(1, w >> 1), Math.max(1, h >> 1)), 0.28, 0.35, 0.85);
    this.outputPass = new OutputPass();
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.outputPass);
  }

  setQualityMode(mode) {
    this.qualityMode = mode;
    if (mode === 'auto') {
      const isMobile = typeof window !== 'undefined' && window.innerWidth <= 900;
      this.applyQuality(isMobile ? 'medium' : 'high');
    } else {
      this.applyQuality(mode);
    }
  }

  applyQuality(level) {
    this.effectiveQuality = level;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    if (level === 'high') {
      this.renderer.setPixelRatio(Math.min(2, dpr));
      this.renderer.shadowMap.enabled = true;
      this.dirLight.castShadow = true;
    } else if (level === 'medium') {
      this.renderer.setPixelRatio(Math.min(1.5, dpr));
      this.renderer.shadowMap.enabled = false;
      this.dirLight.castShadow = false;
    } else {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
      this.dirLight.castShadow = false;
    }
    this.resize();
  }

  resize() {
    const w = Math.max(100, this.container.clientWidth || 800);
    const h = Math.max(100, this.container.clientHeight || 600);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    if (this.composer) {
      this.composer.setSize(w, h);
      if (this.bloomPass) {
        this.bloomPass.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1));
      }
    }
  }

  overview(immediate = false) {
    const cx = (XA + XB) / 2;
    const cz = (YA + YB) / 2;
    const isNarrow = (this.container.clientWidth || 800) < 620;
    const dist = isNarrow ? 58 : 48;
    const target = new THREE.Vector3(cx - 1.5, 0.4, cz);
    const pos = new THREE.Vector3(cx + dist, isNarrow ? 54 : 44, cz + dist);
    this._moveCam(target, pos, immediate);
  }

  focusLot(l, immediate = false) {
    const c = Lw(l, l.L / 2, l.D / 2);
    const span = Math.max(l.L, l.D);
    const dist = clamp(span * 1.45 + 7, 13, 24);
    const target = new THREE.Vector3(c[0], 1.1, c[1]);
    // Keep current horizontal azimuth around the target if already rotated, else classic southwest view
    const curOff = this.camera.position.clone().sub(this.controls.target);
    const hLen = Math.hypot(curOff.x, curOff.z);
    let dx = 1;
    let dz = 1;
    if (hLen > 0.1) {
      dx = curOff.x / hLen;
      dz = curOff.z / hLen;
    } else {
      dx = Math.SQRT1_2;
      dz = Math.SQRT1_2;
    }
    const pos = new THREE.Vector3(target.x + dx * dist * 0.95, dist * 0.92, target.z + dz * dist * 0.95);
    this._moveCam(target, pos, immediate);
  }

  rotate90() {
    const t = this.controls.target.clone();
    const off = this.camera.position.clone().sub(t);
    const nx = -off.z;
    const nz = off.x;
    const pos = new THREE.Vector3(t.x + nx, this.camera.position.y, t.z + nz);
    this._moveCam(t, pos, false);
  }

  rotateBy(rad) {
    const t = this.controls.target.clone();
    const off = this.camera.position.clone().sub(t);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const nx = off.x * cos - off.z * sin;
    const nz = off.x * sin + off.z * cos;
    this.camera.position.set(t.x + nx, this.camera.position.y, t.z + nz);
    this.controls.update();
  }

  _moveCam(target, pos, immediate) {
    if (immediate) {
      this.controls.target.copy(target);
      this.camera.position.copy(pos);
      this.controls.update();
      this.camAnim = null;
      return;
    }
    this.camAnim = { target, pos };
  }

  pickLotAtClient(clientX, clientY, lots) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return -1;
    this._ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this._ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this._ndc, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.pickPlane, this._hitVec);
    if (!hit) return -1;
    const wx = hit.x;
    const wy = hit.z;
    // Check smaller/higher-priority boxes from end to start (matches S'MART nested in New Sari Ayu)
    for (let i = lots.length - 1; i >= 0; i--) {
      const l = lots[i];
      if (wx >= l.x0 - 0.35 && wx <= l.x1 + 0.35 && wy >= l.y0 - 0.35 && wy <= l.y1 + 0.35) {
        return i;
      }
    }
    return -1;
  }

  updateLighting(G) {
    // Smooth 4-stage tropical lighting with zero heap allocations
    const h = G.t / 60;
    const rain = !!(G.ev && G.ev.rain);

    let ambInt;
    let hemiInt;
    let dirInt;
    let fogDens;

    if (h < 16.8) {
      const k = clamp((h - 14) / 2.8, 0, 1);
      this._cBg.setHex(0x2b2730).lerp(this._cTmp.setHex(0x34252e), k);
      this._cAmb.setHex(0xfff1dc).lerp(this._cTmp.setHex(0xffd3a8), k);
      ambInt = 0.85 - 0.1 * k;
      this._cSky.setHex(0xc8deff).lerp(this._cTmp.setHex(0xffb78c), k);
      this._cGnd.setHex(0x705a46);
      hemiInt = 0.8 - 0.1 * k;
      this._cDir.setHex(0xfff5dd).lerp(this._cTmp.setHex(0xffaa66), k);
      dirInt = 1.65 - 0.25 * k;
      this.dirLight.position.set(44 - k * 14, 48 - k * 16, 32 + k * 10);
      fogDens = 0.0018;
    } else if (h < 19.2) {
      const k = clamp((h - 16.8) / 2.4, 0, 1);
      this._cBg.setHex(0x34252e).lerp(this._cTmp.setHex(0x131422), k);
      this._cAmb.setHex(0xffd3a8).lerp(this._cTmp.setHex(0x5a689c), k);
      ambInt = 0.75 - 0.3 * k;
      this._cSky.setHex(0xffb78c).lerp(this._cTmp.setHex(0x3b4c82), k);
      this._cGnd.setHex(0x705a46).lerp(this._cTmp.setHex(0x2d221c), k);
      hemiInt = 0.7 - 0.22 * k;
      this._cDir.setHex(0xffaa66).lerp(this._cTmp.setHex(0x7e9ef0), k);
      dirInt = 1.4 - 0.78 * k;
      this.dirLight.position.set(30 - k * 45, 32 + k * 18, 42 - k * 14);
      fogDens = 0.0018 + 0.0016 * k;
    } else {
      const late = clamp((h - 24) / 3, 0, 1);
      this._cBg.setHex(0x131422).lerp(this._cTmp.setHex(0x181928), late);
      this._cAmb.setHex(0x5a689c);
      ambInt = 0.45 + 0.06 * late;
      this._cSky.setHex(0x3b4c82);
      this._cGnd.setHex(0x2d221c);
      hemiInt = 0.48;
      this._cDir.setHex(0x7e9ef0);
      dirInt = 0.62;
      this.dirLight.position.set(-15, 50, 28);
      fogDens = 0.0034 + 0.001 * late;
    }

    if (rain) {
      this._cBg.lerp(this._cRain, 0.45);
      dirInt *= 0.65;
      fogDens += 0.0015;
    }

    this.scene.background.copy(this._cBg);
    this.scene.fog.color.copy(this._cBg);
    this.scene.fog.density = fogDens;
    this.ambLight.color.copy(this._cAmb);
    this.ambLight.intensity = ambInt;
    this.hemiLight.color.copy(this._cSky);
    this.hemiLight.groundColor.copy(this._cGnd);
    this.hemiLight.intensity = hemiInt;
    this.dirLight.color.copy(this._cDir);
    this.dirLight.intensity = dirInt;
  }

  step(dtReal, G) {
    // Clamp camera target inside compound bounds
    this.controls.target.x = clamp(this.controls.target.x, XA - 4, XB + 4);
    this.controls.target.z = clamp(this.controls.target.z, YA - 4, YB + 4);
    this.controls.target.y = clamp(this.controls.target.y, 0, 4);

    if (this.camAnim) {
      const k = Math.min(1, dtReal * 6.5);
      this.controls.target.lerp(this.camAnim.target, k);
      this.camera.position.lerp(this.camAnim.pos, k);
      if (
        this.controls.target.distanceToSquared(this.camAnim.target) < 0.02 &&
        this.camera.position.distanceToSquared(this.camAnim.pos) < 0.05
      ) {
        this.controls.target.copy(this.camAnim.target);
        this.camera.position.copy(this.camAnim.pos);
        this.camAnim = null;
      }
    }

    this.controls.update();
    if (G) this.updateLighting(G);

    // Track rolling FPS for auto quality scaler
    if (dtReal > 0.001 && dtReal < 0.25) {
      const fps = 1 / dtReal;
      this.fpsHistory.push(fps);
      if (this.fpsHistory.length > 90) this.fpsHistory.shift();
      let sum = 0;
      for (let i = 0; i < this.fpsHistory.length; i++) sum += this.fpsHistory[i];
      this.fpsAvg = sum / this.fpsHistory.length;

      if (this.qualityMode === 'auto' && this.fpsHistory.length === 90) {
        if (this.effectiveQuality === 'high' && this.fpsAvg < 42) {
          this.applyQuality('medium');
          this.fpsHistory.length = 0;
        } else if (this.effectiveQuality === 'medium' && this.fpsAvg < 32) {
          this.applyQuality('low');
          this.fpsHistory.length = 0;
        }
      }
    }
  }

  render() {
    if (this.effectiveQuality === 'high' && this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  getDrawCalls() {
    return this.renderer.info.render.calls;
  }
}
