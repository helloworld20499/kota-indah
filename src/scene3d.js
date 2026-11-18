import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { XA, XB, YA, YB, Lw, clamp } from './config.js';
import { LIGHT_MODES, STORYBOOK_THEME } from './themes.js';

const BASE_H = 54;

export class Scene3D {
  constructor(container) {
    this.container = container;
    this.lightMode = 'bright';

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(STORYBOOK_THEME.dayBg);
    this.scene.fog = null;

    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;
    const halfH = BASE_H / 2;
    const halfW = halfH * (w / h);
    this.camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, -120, 320);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
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

    // 3 bright, well-balanced lights
    this.ambLight = new THREE.AmbientLight('#fff4e4', 1.25);
    this.hemiLight = new THREE.HemisphereLight('#ffffff', '#7a6350', 1.05);
    this.dirLight = new THREE.DirectionalLight('#fff6e5', 1.35);
    this.dirLight.position.set(42, 54, 34);
    this.dirLight.castShadow = this.effectiveQuality === 'high';
    this.dirLight.shadow.mapSize.set(1024, 1024);
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 180;
    const d = 56;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0007;
    this.dirLight.target.position.set(17.5, 0, 18);
    this.scene.add(this.ambLight, this.hemiLight, this.dirLight, this.dirLight.target);

    // Orthographic MapControls
    this.controls = new MapControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.screenSpacePanning = false;
    this.controls.maxPolarAngle = Math.PI * 0.42;
    this.controls.minPolarAngle = 0.3;
    this.controls.minZoom = 0.45;
    this.controls.maxZoom = 4.6;
    this.controls.rotateSpeed = 0.72;
    this.controls.zoomSpeed = 1.08;
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

    this.camAnim = null;
    this.controls.addEventListener('start', () => {
      this.camAnim = null;
    });

    this.raycaster = new THREE.Raycaster();
    this.pickPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.5);

    // Scratch objects for zero-GC updates
    this._hitVec = new THREE.Vector3();
    this._ndc = new THREE.Vector2();
    this._cBg = new THREE.Color();
    this._cAmb = new THREE.Color();
    this._cSky = new THREE.Color();
    this._cGnd = new THREE.Color();
    this._cDir = new THREE.Color();
    this._cTmp = new THREE.Color();
    this._cRain = new THREE.Color('#2a364d');

    this.composer = null;
    this.bloomPass = null;
    this._setupPost(w, h);

    this.overview(true);
    this.applyQuality(this.effectiveQuality);
    this.resize();
  }

  getZoom() {
    return this.camera.zoom || 1;
  }

  setLightMode(mode) {
    if (LIGHT_MODES[mode]) this.lightMode = mode;
  }

  _setupPost(w, h) {
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(Math.max(1, w >> 1), Math.max(1, h >> 1)), 0.16, 0.3, 0.92);
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
    const halfH = BASE_H / 2;
    const halfW = halfH * (w / h);
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
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
    const cx = (XA + XB) / 2 - 1;
    const cz = (YA + YB) / 2;
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;
    const isNarrow = w < 640;
    const zoom = isNarrow ? clamp((w / h) / 1.32, 0.54, 0.92) : 0.92;
    const target = new THREE.Vector3(cx, 0.3, cz);
    const pos = new THREE.Vector3(cx + 58, 52, cz + 58);
    this._moveCam(target, pos, zoom, immediate);
  }

  focusLot(l, immediate = false) {
    const c = Lw(l, l.L / 2, l.D / 2);
    const span = Math.max(l.L, l.D);
    const zoom = clamp(24 / span, 2.15, 3.45);
    const target = new THREE.Vector3(c[0], 0.4, c[1]);
    const curOff = this.camera.position.clone().sub(this.controls.target);
    const hLen = Math.hypot(curOff.x, curOff.z);
    const dist = 78;
    const dx = hLen > 0.1 ? curOff.x / hLen : Math.SQRT1_2;
    const dz = hLen > 0.1 ? curOff.z / hLen : Math.SQRT1_2;
    const pos = new THREE.Vector3(target.x + dx * dist * 0.72, 52, target.z + dz * dist * 0.72);
    this._moveCam(target, pos, zoom, immediate);
  }

  rotate90() {
    const t = this.controls.target.clone();
    const off = this.camera.position.clone().sub(t);
    const pos = new THREE.Vector3(t.x - off.z, this.camera.position.y, t.z + off.x);
    this._moveCam(t, pos, this.camera.zoom, false);
  }

  rotateBy(rad) {
    const t = this.controls.target.clone();
    const off = this.camera.position.clone().sub(t);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    this.camera.position.set(t.x + off.x * cos - off.z * sin, this.camera.position.y, t.z + off.x * sin + off.z * cos);
    this.controls.update();
  }

  _moveCam(target, pos, zoom, immediate) {
    if (immediate) {
      this.controls.target.copy(target);
      this.camera.position.copy(pos);
      this.camera.zoom = zoom;
      this.camera.updateProjectionMatrix();
      this.controls.update();
      this.camAnim = null;
      return;
    }
    this.camAnim = { target, pos, zoom };
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
    for (let i = lots.length - 1; i >= 0; i--) {
      const l = lots[i];
      if (wx >= l.x0 - 0.35 && wx <= l.x1 + 0.35 && wy >= l.y0 - 0.35 && wy <= l.y1 + 0.35) {
        return i;
      }
    }
    return -1;
  }

  updateLighting(G) {
    const theme = STORYBOOK_THEME;
    const lm = LIGHT_MODES[this.lightMode] || LIGHT_MODES.bright;
    const h = this.lightMode === 'day' ? 14.5 : G.t / 60;
    const rain = !!(G.ev && G.ev.rain);

    let ambInt;
    let hemiInt;
    let dirInt;

    if (h < 16.8) {
      // Bright Afternoon
      const k = clamp((h - 14) / 2.8, 0, 1);
      this._cBg.set(theme.dayBg).lerp(this._cTmp.set(theme.duskBg), k * 0.6);
      this._cAmb.setHex(0xfff4e4).lerp(this._cTmp.setHex(0xffe1c2), k);
      ambInt = 1.35 - 0.08 * k;
      this._cSky.setHex(0xffffff).lerp(this._cTmp.setHex(0xffd7b5), k);
      this._cGnd.setHex(0x886c54);
      hemiInt = 1.15 - 0.08 * k;
      this._cDir.setHex(0xfff7e6).lerp(this._cTmp.setHex(0xffc98d), k);
      dirInt = 1.5 - 0.15 * k;
      this.dirLight.position.set(44 - k * 12, 54 - k * 10, 34 + k * 8);
    } else if (h < 19.2) {
      // Golden Sunset -> Luminous Night
      const k = clamp((h - 16.8) / 2.4, 0, 1);
      this._cBg.set(theme.duskBg).lerp(this._cTmp.set(theme.nightBg), k);
      this._cAmb.setHex(0xffe1c2).lerp(this._cTmp.setHex(0xb8c8ff), k);
      ambInt = 1.27 + (lm.nightAmb - 1.27) * k;
      this._cSky.setHex(0xffd7b5).lerp(this._cTmp.setHex(0x8daeff), k);
      this._cGnd.setHex(0x886c54).lerp(this._cTmp.setHex(0x635042), k);
      hemiInt = 1.07 + (lm.nightHemi - 1.07) * k;
      this._cDir.setHex(0xffc98d).lerp(this._cTmp.setHex(0xc8dcff), k);
      dirInt = 1.35 + (lm.nightDir - 1.35) * k;
      this.dirLight.position.set(32 - k * 42, 44 + k * 12, 42 - k * 12);
    } else {
      // Luminous Jakarta Night (3x+ brighter than before, crisp and clear)
      this._cBg.set(theme.nightBg);
      this._cAmb.setHex(0xb8c8ff);
      ambInt = lm.nightAmb;
      this._cSky.setHex(0x8daeff);
      this._cGnd.setHex(0x635042);
      hemiInt = lm.nightHemi;
      this._cDir.setHex(0xc8dcff);
      dirInt = lm.nightDir;
      this.dirLight.position.set(-10, 56, 30);
    }

    if (rain && this.lightMode !== 'day') {
      this._cBg.lerp(this._cRain, 0.3);
      dirInt *= 0.8;
    }

    this.scene.background.copy(this._cBg);
    this.ambLight.color.copy(this._cAmb);
    this.ambLight.intensity = ambInt;
    this.hemiLight.color.copy(this._cSky);
    this.hemiLight.groundColor.copy(this._cGnd);
    this.hemiLight.intensity = hemiInt;
    this.dirLight.color.copy(this._cDir);
    this.dirLight.intensity = dirInt;

    if (this.bloomPass) {
      const nightAmt = this.lightMode === 'day' ? 0 : clamp((h - 17) / 2.4, 0, 1);
      // Very gentle bloom only for intense neon/lasers so paper & pastel colors remain vivid
      this.bloomPass.strength = 0.08 + 0.16 * nightAmt;
      this.bloomPass.threshold = 0.94 - 0.06 * nightAmt;
    }
  }

  step(dtReal, G) {
    this.controls.target.x = clamp(this.controls.target.x, XA - 4, XB + 4);
    this.controls.target.z = clamp(this.controls.target.z, YA - 4, YB + 4);
    this.controls.target.y = clamp(this.controls.target.y, 0, 3);

    if (this.camAnim) {
      const k = Math.min(1, dtReal * 6.5);
      this.controls.target.lerp(this.camAnim.target, k);
      this.camera.position.lerp(this.camAnim.pos, k);
      this.camera.zoom += (this.camAnim.zoom - this.camera.zoom) * k;
      this.camera.updateProjectionMatrix();
      if (
        this.controls.target.distanceToSquared(this.camAnim.target) < 0.02 &&
        this.camera.position.distanceToSquared(this.camAnim.pos) < 0.05 &&
        Math.abs(this.camAnim.zoom - this.camera.zoom) < 0.01
      ) {
        this.controls.target.copy(this.camAnim.target);
        this.camera.position.copy(this.camAnim.pos);
        this.camera.zoom = this.camAnim.zoom;
        this.camera.updateProjectionMatrix();
        this.camAnim = null;
      }
    }

    this.controls.update();
    if (G) this.updateLighting(G);

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
