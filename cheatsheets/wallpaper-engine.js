/* Wallpaper engine — vanilla WebGL2, shared by the React hub and the static
   cheatsheets. Exposes:

     window.WALLPAPER_KINDS       — ['off','aurora','plasma','voronoi','metaballs','caustics']
     window.mountWallpaper(opts)  — { setKind, setIntensity, refresh, destroy }

   Auto-syncs from docs-hub:tweaks localStorage (unless opts.listenStorage=false).
   Creates its own fixed-position canvas under <body>. */

(function () {
  'use strict';

  const STORAGE_KEY = 'docs-hub:tweaks';
  const KINDS = ['off', 'aurora', 'plasma', 'voronoi', 'metaballs', 'caustics'];

  const VERT = `#version 300 es
in vec2 a;
out vec2 vUv;
void main(){ vUv = a*0.5+0.5; gl_Position = vec4(a, 0.0, 1.0); }`;

  const FRAG_HEAD = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform vec4 uClicks[6];
uniform vec3 uAccent;
uniform vec3 uBg;
uniform float uK;

float hash11(float p){ p = fract(p*0.1031); p *= p+33.33; p *= p+p; return fract(p); }
float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(0.1031,0.103,0.0973)); p3 += dot(p3, p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }

float vnoise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  float a=hash21(i), b=hash21(i+vec2(1,0)), c=hash21(i+vec2(0,1)), d=hash21(i+vec2(1,1));
  vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p){
  float v=0.0, a=0.5;
  for(int i=0;i<5;i++){ v+=a*vnoise(p); p=p*2.05 + 3.7; a*=0.5; }
  return v;
}

vec2 clickToAR(vec2 c){ return (c*uRes - 0.5*uRes) / uRes.y; }
`;

  const SHADERS = {
    aurora: `${FRAG_HEAD}
    void main(){
      vec2 uv = (vUv*uRes - 0.5*uRes)/uRes.y;
      vec2 m = uMouse - 0.5;
      vec2 p = vec2(uv.x*0.9, uv.y*2.2 - m.y*1.2);
      p.x += uTime*0.04;
      float w = fbm(p*0.9 + vec2(0.0, uTime*0.06));
      p.y += (w-0.5)*1.4 + m.x*sin(p.x*1.3 + uTime*0.2)*0.6;
      float band1 = fbm(p*1.4 + vec2(uTime*0.05, 0.0));
      float band2 = fbm(p*2.3 + vec2(-uTime*0.07, 1.7));
      float a1 = smoothstep(0.45, 0.72, band1);
      float a2 = smoothstep(0.55, 0.82, band2);
      float curtain = smoothstep(0.9, 0.0, abs(uv.y - 0.05 + (w-0.5)*0.6));
      vec3 c1 = uAccent;
      vec3 c2 = mix(uAccent.bgr, vec3(0.45, 0.85, 0.75), 0.55);
      vec3 c3 = mix(uAccent, vec3(0.7, 0.55, 0.95), 0.55);
      vec3 col = uBg;
      col += c1 * a1 * 0.55 * curtain;
      col += c2 * a2 * 0.45 * curtain;
      col += c3 * pow(a1*a2, 1.4) * 0.7 * curtain;
      col += uAccent * 0.18 * smoothstep(-0.7, 0.2, -uv.y);
      for (int i=0;i<6;i++){
        vec4 c = uClicks[i];
        if (c.w <= 0.0) continue;
        vec2 cp = clickToAR(c.xy);
        float age = c.z;
        float r = 0.05 + age*0.45;
        float d = length(uv - cp);
        float ring = exp(-pow((d-r)*8.0, 2.0)) + exp(-d*4.0)*0.4;
        col += (c1+c3)*0.5 * ring * exp(-age*1.1) * c.w * 0.9;
      }
      vec2 sp = floor(vUv * uRes / 3.0);
      float star = step(0.997, hash21(sp));
      col += vec3(star) * 0.25 * (0.6 + 0.4*sin(uTime*2.0 + sp.x));
      col = mix(uBg, col, uK);
      fragColor = vec4(col, 1.0);
    }`,
    plasma: `${FRAG_HEAD}
    void main(){
      vec2 uv = (vUv*uRes - 0.5*uRes)/uRes.y;
      vec2 mp = clickToAR(uMouse);
      vec2 toM = mp - uv;
      float dM = length(toM);
      vec2 p = uv + toM * 0.18 / (0.08 + dM);
      float t = uTime*0.45;
      float v = 0.0;
      v += sin(p.x*3.4 + t*1.1);
      v += sin(p.y*4.1 - t*0.9 + cos(p.x*2.2 + t*0.4));
      v += sin(length(p + 0.4*vec2(sin(t*0.7), cos(t*0.5)))*5.5 - t*1.8);
      v += sin((p.x*1.3 + p.y*1.7)*3.2 + t*1.3);
      v *= 0.25;
      float shock = 0.0;
      for (int i=0;i<6;i++){
        vec4 c = uClicks[i];
        if (c.w <= 0.0) continue;
        vec2 cp = clickToAR(c.xy);
        float age = c.z;
        float d = length(uv - cp);
        shock += sin(d*38.0 - age*14.0) * exp(-age*1.8) * exp(-max(d-age*0.4,0.0)*4.0) * c.w * 0.55;
      }
      v += shock;
      float halo = exp(-dM*2.4)*0.45;
      float n = 0.5 + 0.5*sin(v*3.14159 + uTime*0.6);
      vec3 c1 = uAccent;
      vec3 c2 = mix(uAccent, vec3(0.95, 0.55, 0.35), 0.7);
      vec3 c3 = mix(uAccent.bgr, vec3(0.25, 0.45, 0.85), 0.6);
      vec3 col = uBg;
      col = mix(col, c1, n*0.55);
      col = mix(col, c2, smoothstep(0.55, 0.95, n)*0.6);
      col += c3 * smoothstep(-0.6, 0.4, sin(v*4.0))*0.18;
      col += uAccent * halo;
      col = mix(uBg, col, uK);
      fragColor = vec4(col, 1.0);
    }`,
    voronoi: `${FRAG_HEAD}
    void main(){
      vec2 uv = (vUv*uRes - 0.5*uRes)/uRes.y;
      vec2 mp = clickToAR(uMouse);
      vec2 toM = mp - uv;
      float dM = length(toM);
      uv += toM * 0.07 / (0.08 + dM);
      float scale = 5.5;
      vec2 p = uv*scale;
      vec2 ip = floor(p);
      vec2 fp = fract(p);
      float minD = 10.0, secondD = 10.0;
      vec2 closest = ip;
      for (int y=-1;y<=1;y++){
        for (int x=-1;x<=1;x++){
          vec2 g = vec2(float(x), float(y));
          vec2 o = hash22(ip+g);
          o = 0.5 + 0.5*sin(uTime*0.35 + 6.2831*o);
          vec2 r = g + o - fp;
          float d = dot(r,r);
          if (d < minD){ secondD = minD; minD = d; closest = ip+g; }
          else if (d < secondD){ secondD = d; }
        }
      }
      float edge = sqrt(secondD) - sqrt(minD);
      vec2 ch = hash22(closest+11.0);
      vec3 c1 = uAccent;
      vec3 c2 = mix(uAccent.bgr, vec3(0.55, 0.45, 0.85), 0.6);
      vec3 cellFill = mix(uBg, mix(c1, c2, ch.x), 0.18 + 0.55*ch.y);
      vec3 col = cellFill;
      col += uAccent * smoothstep(0.05, 0.0, edge) * 0.9;
      col += c2 * smoothstep(0.18, 0.0, edge) * 0.12;
      for (int k=0;k<6;k++){
        vec4 c = uClicks[k];
        if (c.w <= 0.0) continue;
        vec2 cp = clickToAR(c.xy);
        float age = c.z;
        float r = age*0.9;
        float d = length(uv - cp);
        float band = smoothstep(0.12, 0.0, abs(d-r));
        col += uAccent * band * exp(-age*0.9) * c.w * 1.1;
        float inside = smoothstep(r, r-0.15, d) * smoothstep(0.0, 0.05, r-0.05);
        col += c2 * inside * exp(-age*1.5) * c.w * 0.25;
      }
      col = mix(uBg, col, uK);
      fragColor = vec4(col, 1.0);
    }`,
    metaballs: `${FRAG_HEAD}
    void main(){
      vec2 uv = (vUv*uRes - 0.5*uRes)/uRes.y;
      vec2 mp = clickToAR(uMouse);
      float t = uTime*0.4;
      vec2 b1 = vec2(sin(t)*0.7, cos(t*0.7)*0.45);
      vec2 b2 = vec2(cos(t*0.55)*0.55, sin(t*0.83)*0.55);
      vec2 b3 = vec2(sin(t*0.92 + 1.2)*0.75, cos(t*0.6 + 1.0)*0.4);
      vec2 b4 = vec2(cos(t*0.38 - 0.7)*0.6, sin(t*0.49 + 2.1)*0.5);
      float f = 0.0;
      f += 0.045 / max(dot(uv-b1, uv-b1), 0.001);
      f += 0.045 / max(dot(uv-b2, uv-b2), 0.001);
      f += 0.045 / max(dot(uv-b3, uv-b3), 0.001);
      f += 0.035 / max(dot(uv-b4, uv-b4), 0.001);
      f += 0.08 / max(dot(uv-mp, uv-mp), 0.001);
      for (int i=0;i<6;i++){
        vec4 c = uClicks[i];
        if (c.w <= 0.0) continue;
        vec2 cp = clickToAR(c.xy);
        float fade = exp(-c.z*0.55);
        f += 0.07 * fade * c.w / max(dot(uv-cp, uv-cp), 0.001);
      }
      vec3 inner = uAccent;
      vec3 glow  = mix(uAccent, vec3(0.95, 0.55, 0.75), 0.45);
      vec3 hot   = mix(uAccent, vec3(1.0, 0.85, 0.55), 0.55);
      vec3 col = uBg;
      col += glow * smoothstep(0.4, 1.0, f) * 0.35;
      col = mix(col, inner, smoothstep(0.8, 1.05, f));
      col = mix(col, hot,   smoothstep(1.3, 2.2, f));
      col += hot * smoothstep(2.5, 4.0, f) * 0.6;
      col = mix(uBg, col, uK);
      fragColor = vec4(col, 1.0);
    }`,
    caustics: `${FRAG_HEAD}
    void main(){
      vec2 uv = (vUv*uRes - 0.5*uRes)/uRes.y;
      vec2 m = uMouse - 0.5;
      float t = uTime*0.35;
      vec2 p = uv*1.4 - m*0.6;
      vec2 disp = vec2(0.0);
      for (int i=0;i<6;i++){
        vec4 c = uClicks[i];
        if (c.w <= 0.0) continue;
        vec2 cp = clickToAR(c.xy);
        vec2 dv = uv - cp;
        float d = length(dv);
        float age = c.z;
        float w = sin(d*28.0 - age*9.0) * exp(-age*1.3) * exp(-d*2.5) * 0.05 * c.w;
        disp += normalize(dv + 1e-4) * w;
      }
      p += disp;
      vec2 q = p;
      for (int i=1;i<5;i++){
        float fi = float(i);
        q += vec2(0.6/fi*sin(fi*q.y*1.3 + t + fi),
                  0.6/fi*cos(fi*q.x*1.3 + t*0.9));
      }
      float c1 = sin(q.x*3.0 + t)*sin(q.y*3.0 - t*0.8);
      float caust = pow(1.0 - clamp(abs(c1), 0.0, 1.0), 5.5);
      vec2 q2 = p*1.7 + vec2(t*0.3, -t*0.2);
      for (int i=1;i<3;i++){
        float fi=float(i);
        q2 += vec2(0.4/fi*sin(fi*q2.y + t*1.3),
                   0.4/fi*cos(fi*q2.x + t*0.7));
      }
      float caust2 = pow(1.0 - clamp(abs(sin(q2.x*2.3)*sin(q2.y*2.3)), 0.0, 1.0), 4.0);
      vec3 cool = mix(uBg, uAccent.bgr*0.6 + vec3(0.05,0.15,0.25), 0.8);
      vec3 col = mix(cool, uBg, 0.4);
      col += uAccent * caust * 0.9;
      col += mix(uAccent, vec3(0.7, 0.9, 1.0), 0.6) * caust2 * 0.45;
      for (int i=0;i<6;i++){
        vec4 c = uClicks[i];
        if (c.w <= 0.0) continue;
        vec2 cp = clickToAR(c.xy);
        float d = length(uv - cp);
        float age = c.z;
        float crest = exp(-pow((d - age*0.55)*9.0, 2.0)) * exp(-age*1.1);
        col += uAccent * crest * c.w * 0.6;
      }
      col = mix(uBg, col, uK);
      fragColor = vec4(col, 1.0);
    }`
  };

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('shader compile error:', gl.getShaderInfoLog(s), '\n', src);
      return null;
    }
    return s;
  }
  function link(gl, vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.bindAttribLocation(p, 0, 'a');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error('program link error:', gl.getProgramInfoLog(p));
      return null;
    }
    return p;
  }

  function readCssColor(varName, fb) {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
      if (!v) return fb;
      const el = document.createElement('span');
      el.style.color = v;
      el.style.display = 'none';
      document.body.appendChild(el);
      const cs = getComputedStyle(el).color;
      document.body.removeChild(el);
      const m = cs.match(/rgba?\(([^)]+)\)/);
      if (!m) return fb;
      const parts = m[1].split(',').map((s) => parseFloat(s.trim()));
      return [parts[0] / 255, parts[1] / 255, parts[2] / 255];
    } catch (e) { return fb; }
  }

  function readPersisted() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) { return {}; }
  }

  function isValidKind(k) {
    return KINDS.indexOf(k) >= 0;
  }

  window.WALLPAPER_KINDS = KINDS.slice();

  /** Mount the wallpaper engine. Returns a controller with setKind/setIntensity/refresh/destroy. */
  window.mountWallpaper = function (opts) {
    opts = opts || {};
    const persisted = readPersisted();
    let kind = isValidKind(opts.kind) ? opts.kind : (isValidKind(persisted.wallpaper) ? persisted.wallpaper : 'aurora');
    let intensity = typeof opts.intensity === 'number'
      ? opts.intensity
      : (typeof persisted.wallpaperIntensity === 'number' ? persisted.wallpaperIntensity : 0.85);
    const listenStorage = opts.listenStorage !== false;

    // mutable shared state
    const state = {
      target: [0.5, 0.55],
      mouse: [0.5, 0.55],
      clicks: [],
      accent: [0.92, 0.74, 0.73],
      bg: [0.10, 0.09, 0.14]
    };

    // global pointer listeners (always-on; cheap)
    const onMove = (e) => {
      state.target[0] = e.clientX / window.innerWidth;
      state.target[1] = 1.0 - e.clientY / window.innerHeight;
    };
    const onDown = (e) => {
      state.clicks.push({
        ux: e.clientX / window.innerWidth,
        uy: 1.0 - e.clientY / window.innerHeight,
        t0: performance.now() / 1000,
        w: 1.0
      });
      if (state.clicks.length > 6) state.clicks.shift();
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });

    let onStorage = null;
    if (listenStorage) {
      onStorage = (e) => {
        if (e.key !== STORAGE_KEY) return;
        const p = readPersisted();
        if (isValidKind(p.wallpaper) && p.wallpaper !== kind) controller.setKind(p.wallpaper);
        if (typeof p.wallpaperIntensity === 'number' && p.wallpaperIntensity !== intensity) {
          controller.setIntensity(p.wallpaperIntensity);
        }
      };
      window.addEventListener('storage', onStorage);
    }

    // active webgl render state (rebuilt on setKind)
    let active = null;

    function refreshColors() {
      state.accent = readCssColor('--rose', state.accent);
      state.bg = readCssColor('--base', state.bg);
    }

    function startActive(k) {
      if (k === 'off' || !isValidKind(k)) return null;

      const canvas = document.createElement('canvas');
      canvas.className = 'wallpaper-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      document.body.appendChild(canvas);

      const gl = canvas.getContext('webgl2', {
        antialias: false,
        premultipliedAlpha: false,
        powerPreference: 'high-performance'
      });
      if (!gl) {
        console.warn('WebGL2 unavailable — wallpaper disabled');
        canvas.remove();
        return null;
      }

      const vs = compile(gl, gl.VERTEX_SHADER, VERT);
      const fs = compile(gl, gl.FRAGMENT_SHADER, SHADERS[k]);
      if (!vs || !fs) { canvas.remove(); return null; }
      const prog = link(gl, vs, fs);
      if (!prog) { canvas.remove(); return null; }

      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      const u = {
        time:   gl.getUniformLocation(prog, 'uTime'),
        res:    gl.getUniformLocation(prog, 'uRes'),
        mouse:  gl.getUniformLocation(prog, 'uMouse'),
        clicks: gl.getUniformLocation(prog, 'uClicks'),
        accent: gl.getUniformLocation(prog, 'uAccent'),
        bg:     gl.getUniformLocation(prog, 'uBg'),
        k:      gl.getUniformLocation(prog, 'uK')
      };
      gl.useProgram(prog);

      const t0 = performance.now();
      let lastT = t0;

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
        const w = Math.floor(window.innerWidth * dpr);
        const h = Math.floor(window.innerHeight * dpr);
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
          gl.viewport(0, 0, w, h);
        }
      };
      resize();
      window.addEventListener('resize', resize);

      const clickBuf = new Float32Array(24);
      let raf = 0;

      const render = (now) => {
        const dt = Math.min(0.05, (now - lastT) / 1000);
        lastT = now;
        const t = (now - t0) / 1000;

        // smooth mouse
        const ease = 1 - Math.exp(-dt * 8.0);
        state.mouse[0] += (state.target[0] - state.mouse[0]) * ease;
        state.mouse[1] += (state.target[1] - state.mouse[1]) * ease;

        // age clicks
        const nowS = now / 1000;
        const live = [];
        for (let i = 0; i < state.clicks.length; i++) {
          const c = state.clicks[i];
          const age = nowS - c.t0;
          if (age < 4.0) live.push({ ux: c.ux, uy: c.uy, age, w: c.w });
        }
        state.clicks = live.map((c) => ({ ux: c.ux, uy: c.uy, t0: nowS - c.age, w: c.w }));

        // fill click uniform
        for (let i = 0; i < 6; i++) {
          const idx = i * 4;
          if (i < live.length) {
            clickBuf[idx]     = live[i].ux;
            clickBuf[idx + 1] = live[i].uy;
            clickBuf[idx + 2] = live[i].age;
            clickBuf[idx + 3] = live[i].w;
          } else {
            clickBuf[idx] = clickBuf[idx+1] = clickBuf[idx+2] = clickBuf[idx+3] = 0;
          }
        }

        gl.uniform1f(u.time, t);
        gl.uniform2f(u.res, canvas.width, canvas.height);
        gl.uniform2f(u.mouse, state.mouse[0], state.mouse[1]);
        gl.uniform4fv(u.clicks, clickBuf);
        gl.uniform3fv(u.accent, state.accent);
        gl.uniform3fv(u.bg, state.bg);
        gl.uniform1f(u.k, intensity);

        gl.drawArrays(gl.TRIANGLES, 0, 3);
        raf = requestAnimationFrame(render);
      };
      raf = requestAnimationFrame(render);

      return {
        canvas,
        gl,
        cleanup: () => {
          cancelAnimationFrame(raf);
          window.removeEventListener('resize', resize);
          try {
            gl.deleteProgram(prog);
            gl.deleteShader(vs);
            gl.deleteShader(fs);
            gl.deleteBuffer(vbo);
            gl.deleteVertexArray(vao);
          } catch (e) { /* context may already be lost */ }
          canvas.remove();
        }
      };
    }

    function stopActive() {
      if (active) {
        active.cleanup();
        active = null;
      }
    }

    refreshColors();
    active = startActive(kind);

    const controller = {
      setKind(k) {
        if (!isValidKind(k) || k === kind) return;
        kind = k;
        stopActive();
        refreshColors();
        active = startActive(kind);
      },
      setIntensity(i) {
        if (typeof i !== 'number') return;
        intensity = Math.max(0, Math.min(1.5, i));
      },
      refresh() { refreshColors(); },
      destroy() {
        stopActive();
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerdown', onDown);
        if (onStorage) window.removeEventListener('storage', onStorage);
      }
    };
    return controller;
  };
})();
