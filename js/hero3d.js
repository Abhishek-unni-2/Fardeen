// Full-page WebGL world: one tunnel of video frames + photos that you travel through
// for the whole length of the page. Scroll position = camera position; scroll speed = warp.
import * as THREE from "../vendor/three.module.min.js";

const canvas = document.getElementById("hero3d");
const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;

(function init() {
  if (!canvas || reduce) return;
  let renderer;
  const lite = innerWidth < 800;   // phones get a lighter scene
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !lite, alpha: true, powerPreference: "high-performance" });
  } catch (e) { return; }                       // no WebGL → CSS poster wall stays as fallback

  const mobile = lite;
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 1.75));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 140);

  /* ---- content: videos first, then photos mixed in as you go deeper ---- */
  const P = window.PORTFOLIO;
  const vids = P.videos.filter(v => v.h > v.w).map(v => ({ src: `assets/poster/${v.id}.jpg`, ar: v.w / v.h }));
  const pics = P.photos.map(p => ({ src: `assets/photos/${p.id}-t.jpg`, ar: p.w / p.h }));
  const items = [];
  const total = mobile ? 16 : 44;
  for (let i = 0; i < total; i++) {
    const useVid = i < 10 || i % 2 === 0 ? vids.length : 0;
    const pool = useVid && vids.length ? vids : pics.length ? pics : vids;
    items.push(pool[(i * 7 + (useVid ? 0 : 3)) % pool.length]);
  }

  const loader = new THREE.TextureLoader();
  // loading progress for the loading screen: wait for the first screenful of frames, the rest fade in later
  window.__bg = { done: 0, need: Math.min(total, mobile ? 8 : 12) };
  const vert = `varying vec2 vUv; varying float vDepth;
    void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.); vDepth=-mv.z; gl_Position=projectionMatrix*mv; }`;
  const frag = `uniform sampler2D map; uniform float uLoaded,uBright,uAspect,uOpacity; uniform vec3 uRim; varying vec2 vUv; varying float vDepth;
    void main(){
      vec2 p=(vUv-.5)*vec2(.5625,1.); vec2 b=vec2(.5625,1.)*.5-.06;
      vec2 d=abs(p)-b; float sd=length(max(d,0.))+min(max(d.x,d.y),0.)-.06;
      if(sd>0.) discard;
      // "cover" crop so any photo aspect fills the 9:16 frame
      float pa=.5625; vec2 uv=vUv;
      if(uAspect>pa){ float k=pa/uAspect; uv.x=.5+(uv.x-.5)*k; } else { float k=uAspect/pa; uv.y=.5+(uv.y-.5)*k; }
      vec3 c=mix(vec3(.09,.09,.1),texture2D(map,uv).rgb,uLoaded)*uBright;
      float rim=smoothstep(-.025,0.,sd); c+=rim*uRim*.7;
      float fade=1.-smoothstep(20.,58.,vDepth); float near=smoothstep(.8,3.,vDepth);
      gl_FragColor=vec4(c*fade, fade*near*uOpacity); }`;
  const geo = new THREE.PlaneGeometry(2.25, 4);
  const rim = new THREE.Color(1, .35, .2);                 // shared uniform value → recoloured per section
  const opacity = { value: 1 };
  const frames = items.map((it, i) => {
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: null }, uLoaded: { value: 0 }, uBright: { value: 1 }, uAspect: { value: it.ar },
                  uOpacity: opacity, uRim: { value: rim } },
      vertexShader: vert, fragmentShader: frag, transparent: true, side: THREE.DoubleSide, depthWrite: false
    });
    const settle = () => { window.__bg.done++; };
    loader.load(it.src, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; mat.uniforms.map.value = t; mat.userData.ready = true; settle(); }, undefined, settle);
    const m = new THREE.Mesh(geo, mat);
    const s = 0.85 + (i * 37 % 10) / 10 * .6;
    m.scale.setScalar(s);
    m.userData = { a0: i * 0.95, r: 3.6 + (i % 4) * .8, z: -i * 1.7, roll: Math.sin(i * 12.9) * .3, ph: i * 1.7 };
    scene.add(m); return m;
  });
  const span = total * 1.7;

  /* ---- dust (long streaks feel like speed) ---- */
  const dn = mobile ? 300 : 1100, pos = new Float32Array(dn * 3);
  for (let i = 0; i < dn; i++) pos.set([(Math.random() - .5) * 26, (Math.random() - .5) * 16, 8 - Math.random() * (span + 20)], i * 3);
  const dg = new THREE.BufferGeometry(); dg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const spr = document.createElement("canvas"); spr.width = spr.height = 64;
  const sc = spr.getContext("2d"), g = sc.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "#fff"); g.addColorStop(.35, "rgba(255,255,255,.5)"); g.addColorStop(1, "rgba(255,255,255,0)");
  sc.fillStyle = g; sc.fillRect(0, 0, 64, 64);                       // soft round glow instead of squares
  const dmat = new THREE.PointsMaterial({ map: new THREE.CanvasTexture(spr), color: 0xff7a4d, size: 0.09, alphaTest: .01, transparent: true, opacity: .75, depthWrite: false, blending: THREE.AdditiveBlending });
  const dust = new THREE.Points(dg, dmat);
  scene.add(dust);

  /* ---- section colour themes (rim light + dust) ---- */
  const themes = { top: [1, .35, .2], work: [.55, .35, 1], photography: [.15, .8, 1], about: [1, .7, .25], contact: [1, .3, .45] };
  const secs = ["work", "photography", "about", "contact"].map(id => document.getElementById(id)).filter(Boolean);
  const target = new THREE.Color(), dTarget = new THREE.Color();
  function themeAt(y) {
    let key = "top";
    for (const s of secs) if (y >= s.offsetTop - innerHeight * .4) key = s.id;
    return themes[key];
  }

  /* ---- state ---- */
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  addEventListener("pointermove", e => { mouse.x = e.clientX / innerWidth * 2 - 1; mouse.y = e.clientY / innerHeight * 2 - 1; }, { passive: true });
  let lastY = scrollY, vel = 0, progS = 0, active = true;
  const maxScroll = () => Math.max(1, document.documentElement.scrollHeight - innerHeight);

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  }
  addEventListener("resize", resize); resize();

  const clock = new THREE.Clock();
  let lastFrame = 0, intro = 0;
  function tick(now) {
    if (document.hidden) return;
    if (mobile && now - lastFrame < 33) { requestAnimationFrame(tick); return; }   // ~30fps on phones, saves battery
    lastFrame = now;
    const t = clock.getElapsedTime();
    // intro: after the loading screen lifts, the world eases in slowly (opacity, distance, spin)
    if (window.__bgGo) intro += (1 - intro) * 0.012;
    const ease = intro * intro * (3 - 2 * intro);
    const y = scrollY, prog = Math.min(Math.max(y / maxScroll(), 0), 1);
    vel += ((Math.abs(y - lastY)) - vel) * .12; lastY = y;          // smoothed px/frame
    const warp = Math.min(vel / 60, 1);
    progS += (prog - progS) * .07;
    mouse.sx += (mouse.x - mouse.sx) * .05; mouse.sy += (mouse.y - mouse.sy) * .05;

    // camera travels the whole tunnel, weaving and rolling as the page goes on
    const camZ = 6 - progS * (span - 8) + (1 - ease) * 16;
    camera.position.set(mouse.sx * 1.2 + Math.sin(progS * 7) * 1.4, -mouse.sy * .7 + Math.cos(progS * 5) * .6, camZ - Math.sin(t * .3) * .4);
    camera.rotation.set(mouse.sy * .06, -mouse.sx * .12 + Math.sin(progS * 7) * .08, progS * 3.2 + Math.sin(t * .2) * .03);
    camera.fov = 62 + warp * 22; camera.updateProjectionMatrix();     // fov kick = speed rush

    frames.forEach((m, i) => {
      const u = m.userData;
      const un = m.material.uniforms.uLoaded;                          // textures fade in instead of popping
      if (m.material.userData.ready && un.value < 1) un.value = Math.min(1, un.value + 0.02);
      const breathe = 1 + .38 * Math.sin(progS * 9 + i * .3);          // tunnel breathes in/out
      const a = u.a0 + t * .12 * (.3 + .7 * ease) + progS * 7 + (1 - ease) * 1.2;
      m.position.set(Math.cos(a) * u.r * breathe, Math.sin(a) * u.r * .6 * breathe + Math.sin(t * .8 + u.ph) * .25, u.z);
      m.lookAt(0, 0, u.z);
      m.rotateZ(u.roll + Math.sin(t * .5 + u.ph) * .04 + warp * Math.sin(u.ph) * .5);
      m.material.uniforms.uBright.value = 1 + Math.max(0, Math.sin(t * .6 + u.ph)) * .35;
    });

    // frames glow brightest in the hero, quieter behind text-heavy sections
    const heroK = 1 - Math.min(y / (innerHeight * .9), 1);
    opacity.value += (((.8 + .2 * heroK + warp * .2) * ease) - opacity.value) * .08;

    // recolour per section
    target.setRGB(...themeAt(y + innerHeight * .5));
    rim.lerp(target, .04); dTarget.copy(rim); dmat.color.lerp(dTarget, .05);
    dmat.size = .09 + warp * .08;
    dust.rotation.z = t * .02 + progS * 1.5;

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) requestAnimationFrame(tick); });
  document.body.classList.add("webgl");
  requestAnimationFrame(tick);
})();
