(() => {
  "use strict";
  const { videos, photos, albums, categories } = window.PORTFOLIO;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const pad2 = n => String(n).padStart(2, "0");
  const fmt = s => `${Math.floor(s / 60)}:${pad2(Math.round(s % 60))}`;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const canHover = matchMedia("(hover:hover) and (pointer:fine)").matches;
  const reduceMotion = matchMedia("(prefers-reduced-motion:reduce)").matches;
  const icon = n => `<svg class="ic" aria-hidden="true"><use href="assets/icons.svg#i-${n}"/></svg>`;

  /* ---------- Static numbers ---------- */
  $("#yr").textContent = new Date().getFullYear();
  $("#statVideos").textContent = videos.length;
  $("#statPhotos").textContent = photos.length;
  $("#workCount").textContent = videos.length;
  $("#photoCount").textContent = photos.length;

  /* ---------- Hero poster wall (fallback when WebGL is unavailable) ---------- */
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
      col.innerHTML = list.map(id => `<img src="assets/poster/${id}.jpg" alt="" loading="lazy" decoding="async">`).join("");
      wall.appendChild(col);
    }
  })();

  /* ---------- Image skeletons: mark container loaded when its image arrives ---------- */
  function trackLoad(root) {
    $$("img", root).forEach(img => {
      const box = img.parentElement;
      const done = () => box.classList.add("loaded");
      if (img.complete && img.naturalWidth) done();
      else { img.addEventListener("load", done, { once: true }); img.addEventListener("error", done, { once: true }); }
    });
  }

  /* ---------- Video grid ---------- */
  const grid = $("#videoGrid");
  grid.innerHTML = videos.map((v, i) => `
    <button class="card reveal${v.w > v.h ? " wide" : ""}" data-id="${v.id}" data-cat="${v.cat}" aria-label="Watch ${esc(v.title)}">
      <span class="thumb">
        <img src="assets/poster/${v.id}.jpg" alt="${esc(v.title)} video thumbnail" loading="lazy" decoding="async" width="${v.w > v.h ? 16 : 9}" height="${v.w > v.h ? 9 : 16}">
        <video muted loop playsinline preload="none" data-src="assets/video/${v.id}.mp4"></video>
        <span class="play">${icon("play")}</span>
        <span class="dur mono caption-4">${fmt(v.dur)}</span>
      </span>
      <span class="meta"><b class="title-3">${esc(v.title)}</b><small class="mono caption-4">C${pad2(i + 1)} · ${esc(categories[v.cat] || v.cat)}</small></span>
    </button>`).join("");
  trackLoad(grid);

  // hover preview on desktop only; the file loads on first hover
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
    el.innerHTML = [`<button type="button" aria-pressed="true" data-k="all">All<small>${items.length}</small></button>`,
      ...keys.map(k => `<button type="button" aria-pressed="false" data-k="${k}">${esc(labelMap[k])}<small>${items.filter(i => keyFn(i) === k).length}</small></button>`)].join("");
    el.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      $$("button", el).forEach(x => x.setAttribute("aria-pressed", x === b));
      onChange(b.dataset.k);
    });
  }
  function showEmpty(container, any, text) {
    let e = $(".empty", container);
    if (!any && !e) container.insertAdjacentHTML("beforeend", `<p class="empty body-3">${text}</p>`);
    if (any && e) e.remove();
  }
  buildFilters($("#filters"), videos, categories, v => v.cat, k => {
    let n = 0;
    $$(".card", grid).forEach(c => { const hide = k !== "all" && c.dataset.cat !== k; c.classList.toggle("hide", hide); if (!hide) n++; });
    showEmpty(grid, n > 0, "No clips in this group yet. Choose another group.");
  });

  /* ---------- Photos ---------- */
  const pgrid = $("#photoGrid");
  pgrid.innerHTML = photos.map((p, i) => `
    <button class="photo reveal" data-id="${p.id}" data-album="${p.album}" aria-label="Open photograph ${i + 1} from ${esc(albums[p.album])}">
      <span class="no mono caption-4">${albums[p.album].slice(0, 1)}${pad2(i + 1)}</span>
      <img src="assets/photos/${p.id}-t.jpg" alt="${esc(albums[p.album])} photograph ${i + 1}" loading="lazy" decoding="async" width="${p.w}" height="${p.h}">
    </button>`).join("");
  trackLoad(pgrid);
  buildFilters($("#photoFilters"), photos, albums, p => p.album, k => {
    $$(".photo", pgrid).forEach(c => c.classList.toggle("hide", k !== "all" && c.dataset.album !== k));
  });

  /* ---------- Lightbox ---------- */
  const lb = $("#lightbox"), stage = $("#lbStage"), cap = $("#lbCaption");
  let list = [], idx = 0, lastFocus = null;
  const visibleItems = kind => $$(kind === "video" ? "#videoGrid .card:not(.hide)" : "#photoGrid .photo:not(.hide)").map(el => ({ kind, id: el.dataset.id }));
  function show(i) {
    idx = (i + list.length) % list.length;
    const it = list[idx];
    stage.innerHTML = "";
    if (it.kind === "video") {
      const v = videos.find(x => x.id === it.id);
      const el = document.createElement("video");
      el.src = `assets/video/${v.id}.mp4`; el.poster = `assets/poster/${v.id}.jpg`;
      Object.assign(el, { controls: true, autoplay: true, playsInline: true, loop: true });
      el.addEventListener("error", () => {
        stage.innerHTML = `<p class="lb-error body-3">This video could not be loaded. Check your connection and try again.</p>`;
      });
      stage.appendChild(el); el.play().catch(() => {});
      cap.textContent = `${v.title} · ${categories[v.cat] || ""} · ${idx + 1} of ${list.length}`;
    } else {
      const p = photos.find(x => x.id === it.id);
      const el = new Image(); el.src = `assets/photos/${p.id}.jpg`; el.alt = `${albums[p.album]} photograph`;
      el.addEventListener("error", () => { stage.innerHTML = `<p class="lb-error body-3">This photograph could not be loaded. Check your connection and try again.</p>`; });
      stage.appendChild(el);
      cap.textContent = `${albums[p.album]} · ${idx + 1} of ${list.length}`;
    }
    $$(".lb-nav", lb).forEach(b => b.style.display = list.length < 2 ? "none" : "");
  }
  function open(kind, id) {
    list = visibleItems(kind);
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
    else if (e.key === "Tab") {                               // keep focus inside the dialog
      const f = $$("button", lb).filter(b => b.offsetParent !== null);
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  let sx = null;
  lb.addEventListener("touchstart", e => { sx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", e => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx; sx = null;
    if (Math.abs(dx) > 70) show(idx + (dx < 0 ? 1 : -1));
  });

  /* ---------- Mobile menu ---------- */
  (() => {
    const btn = $("#menuBtn"), menu = $("#menu");
    const set = openIt => {
      menu.classList.toggle("open", openIt);
      menu.setAttribute("aria-hidden", !openIt);
      btn.setAttribute("aria-expanded", openIt);
      btn.setAttribute("aria-label", openIt ? "Close menu" : "Open menu");
      document.body.classList.toggle("menu-open", openIt);
    };
    btn.addEventListener("click", () => set(!menu.classList.contains("open")));
    menu.addEventListener("click", e => { if (e.target.closest("a")) set(false); });
    addEventListener("keydown", e => { if (e.key === "Escape") set(false); });
    addEventListener("resize", () => { if (innerWidth >= 900) set(false); });
  })();

  /* ---------- Scroll reveals (IntersectionObserver, once) ---------- */
  const revealIO = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("in"); revealIO.unobserve(e.target); }
  }), { rootMargin: "0px 0px -8% 0px" });
  $$(".reveal").forEach(el => revealIO.observe(el));

  /* ---------- Tagline: words light up one at a time as they cross the trigger line ---------- */
  (() => {
    const p = $("#tagText"); if (!p) return;
    const words = p.textContent.trim().split(/\s+/);
    p.innerHTML = words.map(w => `<span class="tag-word">${esc(w)}</span>`).join(" ");
    const spans = $$(".tag-word", p);
    if (reduceMotion) { spans.forEach(s => s.classList.add("on")); return; }
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) e.target.classList.add("on");
      else if (e.boundingClientRect.top > 0) e.target.classList.remove("on");   // scrolled back up past the line
    }), { rootMargin: "0px 0px -40% 0px", threshold: 0 });
    spans.forEach(s => io.observe(s));
  })();

  /* ---------- Current section in the nav ---------- */
  (() => {
    const links = new Map($$(".nav-links a").map(a => [a.getAttribute("href").slice(1), a]));
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      links.forEach((a, id) => a.removeAttribute("aria-current"));
      const a = links.get(e.target.id); if (a) a.setAttribute("aria-current", "true");
    }), { rootMargin: "-40% 0px -55% 0px" });
    links.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  })();

  /* ---------- Scroll progress + hero parallax (rAF throttled) ---------- */
  (() => {
    const bar = $("#progress"), inner = $(".hero-inner");
    let ticking = false;
    const update = () => {
      ticking = false;
      const max = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
      if (!reduceMotion && canHover && scrollY < innerHeight * 1.2) {
        inner.style.transform = `translateY(${scrollY * 0.2}px)`;
        inner.style.opacity = Math.max(0, 1 - scrollY / (innerHeight * 0.7));
      }
    };
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  })();

  /* ---------- Viewfinder timecode ---------- */
  (() => {
    const tc = $("#tc"); if (!tc) return;
    const t0 = performance.now();
    const draw = () => {
      const f = Math.floor((performance.now() - t0) / 40);               // 25 fps
      tc.textContent = `${pad2(Math.floor(f / 90000) % 100)}:${pad2(Math.floor(f / 1500) % 60)}:${pad2(Math.floor(f / 25) % 60)}:${pad2(f % 25)}`;
      if (scrollY < innerHeight) requestAnimationFrame(draw); else setTimeout(() => requestAnimationFrame(draw), 400);
    };
    draw();
  })();

  /* ---------- Loading screen ---------- */
  // runs on DOMContentLoaded so the deferred hero3d module has already registered window.__bg
  const startLoader = () => {
    const L = $("#loader"), pctEl = $("#ldPct"), bar = $("#ldBar"), tc = $("#ldTc");
    if (!L) return;
    const t0 = performance.now(), MIN = 1600, MAX = 9000;
    let shown = 0, finished = false, fontsDone = 0;
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => { fontsDone = 1; });
    const realProgress = () => {
      const bg = window.__bg;                                              // undefined when WebGL is off
      const bgP = bg ? Math.min(bg.done / Math.max(bg.need, 1), 1) : 1;
      return 0.25 * fontsDone + 0.75 * bgP;
    };
    function finish() {
      if (finished) return; finished = true;
      L.classList.add("done");
      setTimeout(() => { document.body.classList.remove("loading"); document.body.classList.add("ready"); window.__bgGo = true; }, 450);
      setTimeout(() => { L.style.display = "none"; }, 1300);
    }
    (function loop(now) {
      if (finished) return;
      const el = now - t0;
      shown += (Math.min(realProgress(), el / MIN) - shown) * 0.08;
      pctEl.textContent = Math.min(100, Math.round(shown * 100));
      bar.style.transform = `scaleX(${shown})`;
      const f = Math.floor(el / 40);
      tc.textContent = `00:${pad2(Math.floor(f / 1500) % 60)}:${pad2(Math.floor(f / 25) % 60)}:${pad2(f % 25)}`;
      if ((shown > 0.985 && realProgress() >= 1) || el > MAX) { pctEl.textContent = 100; bar.style.transform = "scaleX(1)"; setTimeout(finish, 250); return; }
      requestAnimationFrame(loop);
    })(t0);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startLoader); else startLoader();
})();
