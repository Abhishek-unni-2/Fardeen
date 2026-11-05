(() => {
  "use strict";
  const { videos, photos, albums, categories } = window.PORTFOLIO;
  const $ = (s, r = document) => r.querySelector(s);
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const canHover = matchMedia("(hover:hover)").matches;
  const reduceMotion = matchMedia("(prefers-reduced-motion:reduce)").matches;

  /* ---------- Nav + footer ---------- */
  const nav = $("#nav");
  const onScroll = () => nav.classList.toggle("scrolled", scrollY > 30);
  addEventListener("scroll", onScroll, { passive: true }); onScroll();
  $("#yr").textContent = new Date().getFullYear();
  $("#statVideos").textContent = videos.length;

  /* ---------- Hero poster wall ---------- */
  (() => {
    const wall = $("#heroReel");
    const pool = videos.filter(v => v.h > v.w).map(v => v.id);
    if (!pool.length) return;
    const cols = innerWidth < 700 ? 3 : 6;
    for (let c = 0; c < cols; c++) {
      const mine = pool.filter((_, i) => i % cols === c);
      const list = (mine.length ? mine : pool).slice(0, 5);
      const col = document.createElement("div");
      col.className = "hero-col";
      // duplicate the stack so the -50% drift loops seamlessly
      col.innerHTML = [...list, ...list].map(id => `<img src="assets/poster/${id}.jpg" alt="" loading="lazy" decoding="async">`).join("");
      wall.appendChild(col);
    }
  })();

  /* ---------- Video grid ---------- */
  const grid = $("#videoGrid");
  const pad = n => String(n).padStart(2, "0");
  grid.innerHTML = videos.map((v, i) => `
    <button class="card reveal${v.w > v.h ? " wide" : ""}" data-id="${v.id}" data-cat="${v.cat}" aria-label="Play ${esc(v.title)}">
      <span class="thumb">
        <img src="assets/poster/${v.id}.jpg" alt="${esc(v.title)} — thumbnail" loading="lazy" decoding="async" width="${v.w > v.h ? 16 : 9}" height="${v.w > v.h ? 9 : 16}">
        <video muted loop playsinline preload="none" data-src="assets/video/${v.id}.mp4"></video>
        <span class="play">PLAY</span><span class="dur">${fmt(v.dur)}</span>
      </span>
      <span class="meta"><b>${esc(v.title)}</b><small>C${pad(i + 1)} · ${esc(categories[v.cat] || v.cat)}</small></span>
    </button>`).join("");
  $("#workCount").textContent = videos.length;
  $("#photoCount").textContent = photos.length;

  // hover-to-preview (desktop only) — loads the file lazily on first hover
  if (canHover && !reduceMotion) {
    grid.addEventListener("pointerover", e => {
      const card = e.target.closest(".card"); if (!card || card.contains(e.relatedTarget)) return;
      const vid = $("video", card);
      if (!vid.src) vid.src = vid.dataset.src;
      vid.play().then(() => card.classList.add("playing")).catch(() => {});
    });
    grid.addEventListener("pointerout", e => {
      const card = e.target.closest(".card"); if (!card || card.contains(e.relatedTarget)) return;
      const vid = $("video", card);
      vid.pause(); vid.currentTime = 0; card.classList.remove("playing");
    });
  }

  /* ---------- Filters ---------- */
  function buildFilters(el, items, labelMap, keyFn, onChange) {
    const keys = Object.keys(labelMap).filter(k => items.some(i => keyFn(i) === k));
    el.innerHTML = [`<button role="tab" aria-selected="true" data-k="all">All<small>${items.length}</small></button>`,
      ...keys.map(k => `<button role="tab" aria-selected="false" data-k="${k}">${esc(labelMap[k])}<small>${items.filter(i => keyFn(i) === k).length}</small></button>`)].join("");
    el.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      el.querySelectorAll("button").forEach(x => x.setAttribute("aria-selected", x === b));
      onChange(b.dataset.k);
    });
  }
  buildFilters($("#filters"), videos, categories, v => v.cat, k => {
    grid.querySelectorAll(".card").forEach(c => c.classList.toggle("hide", k !== "all" && c.dataset.cat !== k));
  });

  /* ---------- Photos ---------- */
  const pgrid = $("#photoGrid");
  pgrid.innerHTML = photos.map(p => `
    <button class="photo reveal" data-id="${p.id}" data-album="${p.album}" aria-label="Open photo from ${esc(albums[p.album])}">
      <span class="no">${albums[p.album].slice(0, 1)}${String(photos.indexOf(p) + 1).padStart(2, "0")}</span><img src="assets/photos/${p.id}-t.jpg" alt="${esc(albums[p.album])} — photograph" loading="lazy" decoding="async" width="${p.w}" height="${p.h}">
    </button>`).join("");
  buildFilters($("#photoFilters"), photos, albums, p => p.album, k => {
    pgrid.querySelectorAll(".photo").forEach(c => c.classList.toggle("hide", k !== "all" && c.dataset.album !== k));
  });

  /* ---------- Lightbox (videos + photos) ---------- */
  const lb = $("#lightbox"), stage = $("#lbStage"), cap = $("#lbCaption");
  let list = [], idx = 0, lastFocus = null;

  function visibleItems(kind) {
    const sel = kind === "video" ? "#videoGrid .card:not(.hide)" : "#photoGrid .photo:not(.hide)";
    return [...document.querySelectorAll(sel)].map(el => ({ kind, id: el.dataset.id }));
  }
  function show(i) {
    idx = (i + list.length) % list.length;
    const it = list[idx];
    stage.innerHTML = "";
    if (it.kind === "video") {
      const v = videos.find(x => x.id === it.id);
      const el = document.createElement("video");
      el.src = `assets/video/${v.id}.mp4`; el.poster = `assets/poster/${v.id}.jpg`;
      el.controls = true; el.autoplay = true; el.playsInline = true; el.loop = true;
      stage.appendChild(el); el.play().catch(() => {});
      cap.textContent = `${v.title} · ${categories[v.cat] || ""}`;
    } else {
      const p = photos.find(x => x.id === it.id);
      const el = new Image(); el.src = `assets/photos/${p.id}.jpg`; el.alt = `${albums[p.album]} photograph`;
      stage.appendChild(el);
      cap.textContent = `${albums[p.album]} · ${idx + 1} / ${list.length}`;
    }
    const single = list.length < 2;
    lb.querySelectorAll(".lb-nav").forEach(b => b.style.display = single ? "none" : "");
  }
  function open(kind, id) {
    list = visibleItems(kind);
    // opening from the hero button: item may be filtered out, so fall back to the full list
    if (!list.some(x => x.id === id)) list = (kind === "video" ? videos : photos).map(x => ({ kind, id: x.id }));
    lastFocus = document.activeElement;
    lb.hidden = false; document.body.style.overflow = "hidden";
    show(list.findIndex(x => x.id === id));
    $(".lb-close", lb).focus();
  }
  function close() {
    stage.innerHTML = ""; lb.hidden = true; document.body.style.overflow = "";
    lastFocus && lastFocus.focus();
  }
  grid.addEventListener("click", e => { const c = e.target.closest(".card"); if (c) open("video", c.dataset.id); });
  pgrid.addEventListener("click", e => { const c = e.target.closest(".photo"); if (c) open("photo", c.dataset.id); });
  document.addEventListener("click", e => { const b = e.target.closest("[data-play]"); if (b) open("video", b.dataset.play); });
  $(".lb-close", lb).addEventListener("click", close);
  $(".prev", lb).addEventListener("click", () => show(idx - 1));
  $(".next", lb).addEventListener("click", () => show(idx + 1));
  lb.addEventListener("click", e => { if (e.target === lb || e.target === stage) close(); });
  addEventListener("keydown", e => {
    if (lb.hidden) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") show(idx - 1);
    else if (e.key === "ArrowRight") show(idx + 1);
  });
  // swipe navigation on touch devices
  let sx = null;
  lb.addEventListener("touchstart", e => { sx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", e => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx; sx = null;
    if (Math.abs(dx) > 70) show(idx + (dx < 0 ? 1 : -1));
  });

  /* ---------- Viewfinder timecode ---------- */
  (() => {
    const tc = $("#tc"); if (!tc) return;
    const t0 = performance.now(), p2 = n => String(n).padStart(2, "0");
    const draw = () => {
      const f = Math.floor((performance.now() - t0) / 40);             // 25 fps
      tc.textContent = `${p2(Math.floor(f / 90000) % 100)}:${p2(Math.floor(f / 1500) % 60)}:${p2(Math.floor(f / 25) % 60)}:${p2(f % 25)}`;
      if (scrollY < innerHeight) requestAnimationFrame(draw); else setTimeout(() => requestAnimationFrame(draw), 400);
    };
    draw();
  })();

  /* ---------- Mobile menu ---------- */
  (() => {
    const btn = $("#menuBtn"), menu = $("#menu");
    const set = open => {
      menu.hidden = !open; btn.setAttribute("aria-expanded", open);
      btn.firstElementChild.textContent = open ? "Close" : "Menu";
      document.body.classList.toggle("menu-open", open);
    };
    btn.addEventListener("click", () => set(menu.hidden));
    menu.addEventListener("click", e => { if (e.target.closest("a")) set(false); });
    addEventListener("keydown", e => { if (e.key === "Escape" && !menu.hidden) set(false); });
  })();

  /* ---------- Scroll progress + hero parallax ---------- */
  const bar = $("#progress"), heroInner = $(".hero-inner");
  const onScroll2 = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
    if (!reduceMotion && canHover && scrollY < innerHeight * 1.2) {
      heroInner.style.transform = `translateY(${scrollY * 0.25}px)`;
      heroInner.style.opacity = Math.max(0, 1 - scrollY / (innerHeight * 0.7));
    }
  };
  addEventListener("scroll", onScroll2, { passive: true }); onScroll2();

  /* ---------- Custom cursor ---------- */
  if (canHover && matchMedia("(pointer:fine)").matches && !reduceMotion) {
    const cur = $("#cursor"), lab = $("#cursorLabel");
    let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy;
    document.body.classList.add("cursor-on");
    addEventListener("pointermove", e => {
      tx = e.clientX; ty = e.clientY;
      const t = e.target.closest(".card,.photo,a,button,[data-play]");
      cur.classList.toggle("big", !!(t && t.matches(".card,.photo")));
      cur.classList.toggle("link", !!(t && !t.matches(".card,.photo")));
      lab.textContent = t ? (t.matches(".card") ? "PLAY" : t.matches(".photo") ? "VIEW" : "") : "";
    }, { passive: true });
    (function loop() { cx += (tx - cx) * .22; cy += (ty - cy) * .22; cur.style.transform = `translate(${cx}px,${cy}px)`; requestAnimationFrame(loop); })();
  }

  /* ---------- Scroll reveal ---------- */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }), { rootMargin: "0px 0px -6% 0px" });
  document.querySelectorAll(".reveal").forEach(el => io.observe(el));

  /* ---------- Loading screen ---------- */
  // runs on DOMContentLoaded so the deferred hero3d module has already registered window.__bg
  const startLoader = () => {
    const L = $("#loader"), pctEl = $("#ldPct"), bar = $("#ldBar"), tc = $("#ldTc");
    if (!L) return;
    const t0 = performance.now(), MIN = 1600, MAX = 9000;
    let shown = 0, finished = false;
    const fontsP = document.fonts && document.fonts.ready ? document.fonts.ready.then(() => 1) : Promise.resolve(1);
    let fontsDone = 0; fontsP.then(() => { fontsDone = 1; });
    const p2 = n => String(n).padStart(2, "0");
    function realProgress() {
      const bg = window.__bg;                                  // set by hero3d.js (undefined if WebGL is off)
      const bgP = bg ? Math.min(bg.done / Math.max(bg.need, 1), 1) : 1;
      return 0.25 * fontsDone + 0.75 * bgP;
    }
    function finish() {
      if (finished) return; finished = true;
      L.classList.add("done");
      setTimeout(() => {                                       // intro starts as the curtain lifts
        document.body.classList.remove("loading"); document.body.classList.add("ready");
        window.__bgGo = true;
      }, 450);
      setTimeout(() => { L.style.display = "none"; }, 1300);
    }
    (function loop(now) {
      if (finished) return;
      const el = now - t0;
      const target = Math.min(realProgress(), el / MIN);       // never faster than the minimum display time
      shown += (target - shown) * 0.08;                        // eased so it never jumps
      const v = Math.min(100, Math.round(shown * 100));
      pctEl.textContent = v; bar.style.transform = `scaleX(${shown})`;
      const f = Math.floor(el / 40);
      tc.textContent = `00:${p2(Math.floor(f / 1500) % 60)}:${p2(Math.floor(f / 25) % 60)}:${p2(f % 25)}`;
      if ((shown > 0.985 && realProgress() >= 1) || el > MAX) {
        pctEl.textContent = 100; bar.style.transform = "scaleX(1)"; setTimeout(finish, 250); return;
      }
      requestAnimationFrame(loop);
    })(t0);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startLoader); else startLoader();
})();
