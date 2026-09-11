/* =====================================================================
   INTEGRITY RESTORATIONS & REMODELING
   Vanilla JS + GSAP (ScrollTrigger, SplitText). No build step.
   Order: plugins -> helpers -> nav -> hero intro -> rolling text -> scroll
   ===================================================================== */

gsap.registerPlugin(ScrollTrigger, SplitText);

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- NAV: hamburger + scrolled state ---------- */
const header = document.querySelector(".site-header");
const toggle = document.querySelector(".nav__toggle");
const menu   = document.getElementById("nav-menu");

function setMenu(open) {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menu.classList.toggle("is-open", open);
    document.body.style.overflow = open ? "hidden" : "";
}
toggle.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
menu.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

/* the header is transparent over the hero; once the hero's bottom passes
   the top of the viewport, it gets the grey bar. ScrollTrigger owns the
   crossing point so it stays correct on resize and re-layout */
ScrollTrigger.create({
    trigger: ".hero",
    start: "bottom top+=1",
    onEnter: () => header.classList.add("is-scrolled"),
    onLeaveBack: () => header.classList.remove("is-scrolled")
});

/* ---------- ROLLING TEXT (Trey's hover roll) ----------
   Each character becomes a 1lh window with a 2-copy track inside.
   Hover rolls the track up by half its height, left-first; leaving
   rolls it back down, also left-first (a conveyor, not a rewind).
   type "words,chars" keeps word boundaries so spaces survive. */
function rollingText(el) {
    const split = new SplitText(el, { type: "words,chars", wordsClass: "word", charsClass: "letterWindow" });
    split.chars.forEach((char) => {
        const letter = char.textContent;
        char.innerHTML =
            `<span class="letterTrack">` +
                `<span class="trackContent">${letter}</span>` +
                `<span class="trackContent" aria-hidden="true">${letter}</span>` +
            `</span>`;
    });
    if (reduceMotion) return;

    const tracks = el.querySelectorAll(".letterTrack");
    const rollUp   = gsap.to(tracks, { yPercent: -50, stagger: 0.03, ease: "back.inOut", paused: true });
    const rollDown = gsap.to(tracks, { yPercent: 0,   stagger: 0.03, ease: "back.inOut", paused: true });

    el.addEventListener("mouseenter", () => rollUp.restart());
    el.addEventListener("mouseleave", () => rollDown.restart());
    el.addEventListener("focus",      () => rollUp.restart());
    el.addEventListener("blur",       () => rollDown.restart());
}

/* ---------- HERO INTRO ----------
   The slogan types itself in word by word; "a success" lands last with
   a stamp. Runs after fonts load so SplitText measures the real glyphs. */
function heroIntro() {
    const title = document.querySelector(".hero__title");
    const rest  = [".hero__note", ".hero__actions", ".trust", ".nav__list", ".nav__brand"];

    if (!reduceMotion) gsap.set(rest, { autoAlpha: 0 });

    SplitText.create(title, {
        type: "lines,words",
        mask: "lines",          /* overflow:hidden line wrappers: words rise out of them */
        linesClass: "line",
        wordsClass: "word",
        autoSplit: true,        /* re-split on resize / font swap, replaying via onSplit */
        onSplit(self) {
            /* Continuous gradient across split words: each word paints
               the full-width gradient, shifted left by its own x. The
               red words measure against the .hl span instead, so the
               brand ramp runs across "a success" alone.
               Measure BEFORE the tweens below apply any transform. */
            const titleBox = title.getBoundingClientRect();
            self.words.forEach((w) => {
                const hl  = w.closest(".hl");
                const ref = hl ? hl.getBoundingClientRect() : titleBox;
                const box = w.getBoundingClientRect();
                w.style.backgroundSize = `${ref.width}px 100%`;
                w.style.backgroundPosition = `${ref.left - box.left}px 0`;
            });

            if (reduceMotion) return;

            const stamp = self.words.filter((w) => w.closest(".hl"));
            const words = self.words.filter((w) => !stamp.includes(w));

            const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
            tl.from(words, {
                    yPercent: 110, duration: 0.7, stagger: 0.09,
                    force3D: false          /* keep words 2D so the gradient clip holds */
                })
              .from(stamp, {
                    scale: 1.7, autoAlpha: 0, transformOrigin: "50% 60%",
                    duration: 0.55, ease: "back.out(2.2)", stagger: 0.08,
                    force3D: false
                }, "-=0.15")
              .to(rest, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.08 }, "-=0.25");
            return tl;              /* returned so autoSplit can revert + replay it cleanly */
        }
    });
}

/* ---------- OUR WORK: segments (tabs), filters, before/after flips ----------
   Nothing here injects markup. Tabs flip the hidden attribute, the
   filter writes one data attribute the CSS reads, and the flip button
   toggles a class. The DOM is the source of truth, JS just points at it. */
function ourWork() {
    const tabs    = [...document.querySelectorAll(".segment")];
    const panels  = tabs.map((t) => document.getElementById(t.getAttribute("aria-controls")));
    const gallery = document.querySelector(".gallery");
    const filters = [...document.querySelectorAll(".filter")];

    function fadeIn(el) {
        if (reduceMotion) return;
        gsap.fromTo(el, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out", clearProps: "transform" });
    }

    function selectTab(index, focus = false) {
        tabs.forEach((tab, i) => {
            const on = i === index;
            tab.classList.toggle("is-active", on);
            tab.setAttribute("aria-selected", String(on));
            tab.tabIndex = on ? 0 : -1;          /* roving tabindex: one tab stop for the group */
            panels[i].hidden = !on;
        });
        if (focus) tabs[index].focus();
        fadeIn(panels[index]);
        ScrollTrigger.refresh();                 /* the section changed height */
    }
    tabs.forEach((tab, i) => {
        tab.addEventListener("click", () => selectTab(i));
        tab.addEventListener("keydown", (e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                selectTab((i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length, true);
            }
        });
    });

    filters.forEach((btn) => {
        btn.addEventListener("click", () => {
            filters.forEach((b) => {
                const on = b === btn;
                b.classList.toggle("is-active", on);
                b.setAttribute("aria-pressed", String(on));
            });
            gallery.dataset.filter = btn.dataset.filter;
            fadeIn(gallery.querySelectorAll(`.pair[data-category="${btn.dataset.filter}"]`));
            ScrollTrigger.refresh();
        });
    });

    document.querySelectorAll(".pair").forEach(wirePair);
}

/* tap / keyboard flip for one before/after card; hover is pure CSS.
   Shared with the job dialog, which wires the clone it shows. */
function wirePair(pair) {
    const flip = pair.querySelector(".pair__flip");
    const set = (on) => {
        pair.classList.toggle("is-after", on);
        flip.setAttribute("aria-pressed", String(on));
        flip.textContent = on ? "Show the before" : "Show the after";
    };
    flip.addEventListener("click", () => set(!pair.classList.contains("is-after")));
    pair.querySelector(".pair__media").addEventListener("click", () => set(!pair.classList.contains("is-after")));
}

/* ---------- REVIEWS: "See the job" -> dialog with that pair ----------
   The gallery pair stays the single source of truth: the dialog gets a
   deep clone of its figure, so a photo swap in the gallery is a photo
   swap here too. Native <dialog> handles focus trap, Escape, and
   returning focus to the button that opened it. */
function jobDialog() {
    const dialog = document.getElementById("job-dialog");
    const body   = dialog.querySelector(".job__body");
    const title  = dialog.querySelector(".job__title");

    document.querySelectorAll(".review__job[data-job]").forEach((btn) => {
        const source = document.getElementById(btn.dataset.job);
        if (!source) { btn.hidden = true; return; }     /* no such pair yet: hide the button */
        btn.addEventListener("click", () => {
            body.replaceChildren();
            const clone = document.createElement("div");
            clone.className = "pair";
            clone.appendChild(source.querySelector(".pair__figure").cloneNode(true));
            clone.querySelectorAll("img").forEach((img) => (img.loading = "eager"));
            clone.querySelector(".pair__title").remove();   /* the dialog head carries the title */
            wirePair(clone);
            body.appendChild(clone);
            title.textContent = source.querySelector(".pair__title").textContent;
            document.body.classList.add("has-dialog");
            dialog.showModal();
        });
    });

    dialog.querySelector(".job__close").addEventListener("click", () => dialog.close());
    dialog.querySelector(".job__more").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });   /* backdrop */
    dialog.addEventListener("close", () => document.body.classList.remove("has-dialog"));
}

/* ---------- REVIEWS: pinned scroll carousel ----------
   One scrubbed timeline measured in PIXELS OF SCROLL: the section pins,
   the column travels up by D px over D px of scrolling (so it moves 1:1
   with the wheel), and each card's after photo wipes in bottom-to-top
   across the stretch of scroll where that card's middle crosses the
   window's middle. Padding on the column lets the first and last
   cards reach the middle too. Snap points sit on each card's centre,
   which is what makes it feel like a carousel rather than a list. */
function reviewCarousel() {
    const section = document.querySelector(".section--reviews");
    const win     = section.querySelector(".reviews-window");
    const column  = section.querySelector(".reviews");
    const cards   = gsap.utils.toArray(".review");
    /* per card, everything one wipe drives: the after photo layer, the
       rail fill, and the tag that rides the fill's leading edge. Each
       card owns a progress object (p: 0 before, 1 after) that a single
       tween moves; render() paints all three from it. Null when the
       card has no before photo. */
    const layers  = cards.map((c) => {
        if (!c.classList.contains("has-before")) return null;
        return { card: c, layer: c.querySelector(".review__after-layer"), fill: c.querySelector(".review__rail-fill"), tag: c.querySelector(".review__tag"), p: 0 };
    });
    cards.forEach((c) => gsap.set(c.querySelector(".review__tag"), { rotation: 180 }));   /* sideways, reading bottom to top */
    function render(w) {
        const inset = `inset(${(1 - w.p) * 100}% 0 0 0)`;
        w.layer.style.clipPath = inset;
        w.fill.style.clipPath  = inset;
        const travel = w.card.clientHeight - w.tag.offsetHeight - 24;   /* bottom:12px to top:12px */
        gsap.set(w.tag, { y: -w.p * travel });
        w.tag.classList.toggle("is-after", w.p >= 0.5);
    }
    const texts   = cards.map((c) => c.querySelector(".review__glass"));
    const slot    = section.querySelector(".reviews-current");
    const count   = section.querySelector(".reviews-progress__count");
    const fill    = section.querySelector(".reviews-progress__fill");

    if (reduceMotion) {
        layers.filter(Boolean).forEach((w) => { w.p = 1; render(w); });   /* everything in its finished state */
        return;
    }
    section.classList.add("is-carousel");

    /* From 768px the review text leaves its photo and lives in the left
       column, only the active one shown (moving nodes keeps the
       See-the-job wiring). Phones keep the glass on the photo: the head
       would otherwise grow with each quote and squeeze the window. */
    const wide = window.matchMedia("(min-width: 768px)");
    let active = 0;
    function placeTexts() {
        if (wide.matches) {
            texts.forEach((t, i) => { t.hidden = i !== active; slot.appendChild(t); });
        } else {
            texts.forEach((t, i) => { t.hidden = false; cards[i].appendChild(t); });
        }
    }
    function showText(i) {
        if (i === active) return;
        if (wide.matches) {
            texts[active].hidden = true;
            texts[i].hidden = false;
            gsap.fromTo(texts[i], { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: "power2.out", clearProps: "transform" });
        }
        active = i;
    }

    /* DEPTH: every tick of the scrubbed timeline, size and offset each
       card by how far its middle is from the window's middle. The
       centred card is full size and flush left; cards above and below
       shrink and slide right, so the column reads as a stack receding
       away from the centre line, and the next card grows into place as
       it travels in. Reads from the timeline's onUpdate (not the
       ScrollTrigger's) so it tracks the smoothed scrub, not raw scroll. */
    function depth() {
        const box = win.getBoundingClientRect();
        const mid = box.top + box.height / 2;
        cards.forEach((card) => {
            const r = card.getBoundingClientRect();
            /* 0 when centred, 1 a full window-height away: the neighbours
               sit around 0.6, so they read as a step back rather than
               already at the floor, and the gradient shows during travel */
            const d = Math.min(Math.abs(r.top + r.height / 2 - mid) / box.height, 1);
            gsap.set(card, { scale: 1 - d * 0.22, x: d * 56, transformOrigin: "50% 50%" });
        });
    }

    /* THE WIPE IS NOT SCRUBBED. Scroll only decides WHICH card is the
       centre card; the wipe itself runs on its own clock so it reads
       the same whether you flick or creep. A card entering the centre
       band plays the after wipe (bottom to top); leaving the band
       collapses it again, so scrolling back shows the before and the
       reveal replays. */
    let revealed = -1;
    function reveal(i) {
        const w = layers[i];
        if (w) gsap.to(w, { p: 1, duration: 1.1, ease: "power2.inOut", overwrite: true, onUpdate: () => render(w) });
    }
    function conceal(i) {
        const w = layers[i];
        if (w) gsap.to(w, { p: 0, duration: 0.5, ease: "power2.in", overwrite: true, onUpdate: () => render(w) });
    }
    /* dir is the scroll direction (1 down, -1 up). A card that leaves the
       centre because you scrolled ON stays After: the work is done. Only
       scrolling back UP past it reverts it to Before, so the reveal can
       replay on the next pass down. */
    function setCentred(i, dir) {
        if (i === revealed) return;
        if (revealed >= 0 && dir < 0) conceal(revealed);
        if (i >= 0) reveal(i);
        revealed = i;
    }

    /* TIMELINE, measured in pixels of scroll: the column glides 1:1 with
       the wheel, and pauses for a moment (W px of wheel travel) each
       time a card reaches the middle, so the wipe has a beat to play
       before the column moves on. No snapping. Column padding lets the
       first and last cards reach the middle. */
    let tl, trigger;
    function build() {
        if (trigger) trigger.kill();
        if (tl) tl.kill();
        placeTexts();
        gsap.set(column, { y: 0, paddingTop: 0, paddingBottom: 0 });
        layers.filter(Boolean).forEach((w) => { gsap.killTweensOf(w); w.p = 0; render(w); });
        revealed = -1;

        const H = win.clientHeight;
        const W = Math.round(H * 0.28);                /* the dwell, in px of scrolling */
        const first = cards[0], last = cards[cards.length - 1];
        column.style.paddingTop    = `${Math.max(H / 2 - first.offsetHeight / 2, 0)}px`;
        column.style.paddingBottom = `${Math.max(H / 2 - last.offsetHeight / 2, 0)}px`;

        const centres = cards.map((c) => c.offsetTop + c.offsetHeight / 2 - H / 2);   /* column y = -centre puts card i in the middle */
        tl = gsap.timeline({ defaults: { ease: "none" }, onUpdate: depth });
        const arrive = [];                             /* timeline time at which card i is centred */
        let t = 0;
        cards.forEach((card, i) => {
            if (i > 0) {
                const d = centres[i] - centres[i - 1];
                tl.to(column, { y: -centres[i], duration: d }, t);
                t += d;
            }
            arrive.push(t);
            t += W;                                    /* the dwell: nothing moves for W px */
        });
        const total = t;

        trigger = ScrollTrigger.create({
            trigger: section,
            start: "top top",
            end: () => "+=" + total,
            pin: true,
            scrub: 0.5,
            animation: tl,
            onUpdate(self) {
                const now = self.progress * total;
                let idx = 0, best = Infinity;                 /* the card nearest the midline, in scroll terms */
                arrive.forEach((a, i) => {
                    const gap = now < a ? a - now : now > a + W ? now - (a + W) : 0;   /* 0 during the dwell */
                    if (gap < best) { best = gap; idx = i; }
                });
                showText(idx);
                count.textContent = String(idx + 1).padStart(2, "0");
                fill.style.transform = `scaleX(${self.progress})`;
                /* the centre band: within 30% of a card-height of the midline */
                setCentred(best <= cards[idx].offsetHeight * 0.3 ? idx : -1, self.direction);
            },
            /* the pin engages with card 1 already centred. onEnter fires
               AFTER onUpdate, so only act when we really are at the start
               (a jump straight into the middle must not re-reveal card 1) */
            onEnter: (self) => { if (self.progress < 0.01) setCentred(0, 1); },
            onLeaveBack: () => setCentred(-1, -1)          /* scrolled back above the section: reset so it replays */
        });
        depth();                                       /* resting state before any scroll */
    }
    build();

    /* card heights change with the viewport, so rebuild on resize */
    let timer;
    window.addEventListener("resize", () => {
        clearTimeout(timer);
        timer = setTimeout(() => { build(); ScrollTrigger.refresh(); }, 200);
    });
}

/* ---------- AREAS SERVED: static map (Leaflet + OpenStreetMap) ----------
   Free and keyless: Leaflet is open source and OpenStreetMap serves
   its tiles without a key. The map is STATIC (no drag, no zoom) so the
   page scroll never gets trapped. It is framed tightly on the SERVICE
   AREA, drawn in red from assets/service-area.geojson. That file is
   the single source of truth: the red overlay and the address check
   both read it, so whatever shape it holds is what Phil serves. It
   starts as the six counties (Census shapes) and can be any polygons;
   draw a new one with the hidden editor (?edit-area in the URL).
   The basemap's own town names do the labelling, so the only marker
   is the shield at home. */
const SERVICE_HOME = [39.4809, -84.4577];   /* Trenton, OH */
const SERVICE_AREA_URL = "assets/service-area.geojson";
const EDIT_AREA = new URLSearchParams(location.search).has("edit-area");

function serviceMap() {
    const el = document.getElementById("service-map");
    if (!el || typeof L === "undefined") return;         /* Leaflet did not load: the SVG stays */

    const map = L.map(el, {
        zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
        touchZoom: false, boxZoom: false, keyboard: false, zoomSnap: 0.1,
        attributionControl: true
    }).setView(SERVICE_HOME, 9);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const wide = window.matchMedia("(min-width: 768px)");
    let area = null;
    /* keep the area clear of the docked panel: left/top on desktop, bottom on phones */
    function framePadding() {
        const panel = el.parentElement.querySelector(".check__panel");
        const r = panel ? panel.getBoundingClientRect() : { width: 0, height: 0 };
        return wide.matches
            ? { paddingTopLeft: [r.width + 40, 110], paddingBottomRight: [24, 24] }
            : { paddingTopLeft: [12, 72], paddingBottomRight: [12, r.height + 12] };
    }
    /* The area is the focal point: fit it tightly, then shift the view so
       it sits beside the panel (desktop) or above it (phones). Only when
       a checked address has to be shown does the view widen to keep both
       the area and the pin clear of the panel. */
    function fit(extra) {
        if (!area) return;
        map.invalidateSize();
        if (extra) {
            map.fitBounds(area.getBounds().extend(extra), framePadding());
            return;
        }
        const panel = el.parentElement.querySelector(".check__panel");
        const r = panel ? panel.getBoundingClientRect() : { width: 0, height: 0 };
        const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-h")) || 0;
        if (wide.matches) {
            /* as tall as the room under the header allows, then slid right of the panel */
            map.fitBounds(area.getBounds(), { paddingTopLeft: [16, navH + 12], paddingBottomRight: [16, 16], animate: false });
            map.panBy([-(r.width / 2 + 24), 0], { animate: false });
        } else {
            /* phones: fill the width; the bottom edge may tuck under the panel */
            map.fitBounds(area.getBounds(), { paddingTopLeft: [10, navH + 10], paddingBottomRight: [10, r.height * 0.45], animate: false });
        }
    }

    fetch(SERVICE_AREA_URL)
        .then((r) => r.json())
        .then((gj) => {
            area = L.geoJSON(gj, { style: { color: "#BA1E23", weight: 2, fillColor: "#ED1C24", fillOpacity: 0.07 }, interactive: false }).addTo(map);
            fit();
            el.classList.add("is-live");
            if (EDIT_AREA) areaEditor(map, el, () => area);
        })
        .catch(() => {});                                  /* the SVG fallback stays */

    L.marker(SERVICE_HOME, {
        icon: L.divIcon({ className: "map-home", html: '<img src="assets/logo-shield.svg" alt="" width="34" height="36" title="Integrity Restorations and Remodeling, Trenton">', iconSize: [34, 36], iconAnchor: [17, 18] }),
        title: "Integrity Restorations and Remodeling, Trenton", zIndexOffset: 1000, interactive: false
    }).addTo(map);

    let timer;
    window.addEventListener("resize", () => { clearTimeout(timer); timer = setTimeout(() => fit(), 200); });
    ScrollTrigger.addEventListener("refresh", () => map.invalidateSize());

    addressCheck(map, fit);
}

/* ---------- AREA EDITOR (hidden tool: add ?edit-area to the URL) ----------
   Draw Phil's real coverage on the live map, copy the GeoJSON it
   produces, and save it as assets/service-area.geojson. That is the
   whole workflow: the overlay and the check both read that file.
   Click adds a corner. Enter closes the shape. Backspace removes the
   last corner. U removes the last finished shape. Any number of shapes.
   Not linked from anywhere and changes nothing on the site by itself. */
function areaEditor(map, el, getArea) {
    const section = el.closest(".section--check");
    section.classList.add("is-editing");
    map.dragging.enable(); map.scrollWheelZoom.enable(); map.touchZoom.enable(); map.keyboard.enable();
    L.control.zoom({ position: "topright" }).addTo(map);

    const DRAFT = { color: "#BA1E23", weight: 2, fillColor: "#ED1C24", fillOpacity: 0.2, interactive: false };
    const draft = L.layerGroup().addTo(map);           /* finished shapes */
    const dots  = L.layerGroup().addTo(map);           /* corners of the shape in progress */
    let shapes = [], pts = [], line = null;

    function redraw() {
        if (line) line.remove();
        line = pts.length ? L.polyline(pts, { color: "#231F20", weight: 2, dashArray: "6 6", interactive: false }).addTo(map) : null;
        dots.clearLayers();
        pts.forEach((p) => L.circleMarker(p, { radius: 5, color: "#231F20", weight: 2, fillColor: "#FFFFFF", fillOpacity: 1, interactive: false }).addTo(dots));
    }
    function repaint() { draft.clearLayers(); shapes.forEach((s) => L.polygon(s, DRAFT).addTo(draft)); }
    function closeShape() { if (pts.length < 3) return; shapes.push(pts); pts = []; repaint(); redraw(); status(); }
    function toGeoJSON() {
        return { type: "FeatureCollection", features: shapes.map((s, i) => ({
            type: "Feature", properties: { name: `Service area ${i + 1}` },
            geometry: { type: "Polygon", coordinates: [[...s, s[0]].map(([lat, lng]) => [+lng.toFixed(5), +lat.toFixed(5)])] }
        })) };
    }

    map.on("click", (e) => { pts.push([e.latlng.lat, e.latlng.lng]); redraw(); status(); });
    document.addEventListener("keydown", (e) => {
        if (e.target.closest("input, textarea, button")) return;
        if (e.key === "Enter") closeShape();
        else if (e.key === "Backspace") { pts.pop(); redraw(); status(); }
        else if (e.key.toLowerCase() === "u") { shapes.pop(); repaint(); status(); }
    });

    const bar = document.createElement("div");
    bar.className = "area-editor";
    bar.innerHTML =
        '<strong>Service area editor</strong><span class="area-editor__status"></span>' +
        '<div class="area-editor__row">' +
        '<button type="button" data-act="seed">Start from current area</button>' +
        '<button type="button" data-act="close">Close shape (Enter)</button>' +
        '<button type="button" data-act="undo">Remove last shape (U)</button>' +
        '<button type="button" data-act="clear">Clear</button>' +
        '<button type="button" data-act="export">Copy GeoJSON</button></div>' +
        '<textarea class="area-editor__out" rows="3" readonly aria-label="GeoJSON output"></textarea>' +
        '<p>Click adds a corner, Enter closes the shape, Backspace removes the last corner. Save the copied text as assets/service-area.geojson.</p>';
    section.appendChild(bar);
    const out = bar.querySelector(".area-editor__out"), st = bar.querySelector(".area-editor__status");
    function status() { st.textContent = `${shapes.length} shape${shapes.length === 1 ? "" : "s"}, ${pts.length} corner${pts.length === 1 ? "" : "s"} pending`; }

    bar.addEventListener("click", (e) => {
        const act = e.target.dataset.act; if (!act) return;
        if (act === "seed") {
            const layer = getArea(); if (!layer) return;
            shapes = [];
            layer.eachLayer((l) => {
                const g = l.feature.geometry;
                (g.type === "Polygon" ? [g.coordinates] : g.coordinates).forEach((poly) => shapes.push(poly[0].slice(0, -1).map(([lng, lat]) => [lat, lng])));
            });
            repaint();
        }
        if (act === "close") closeShape();
        if (act === "undo") { shapes.pop(); repaint(); }
        if (act === "clear") { shapes = []; pts = []; repaint(); redraw(); }
        if (act === "export") {
            const txt = JSON.stringify(toGeoJSON());
            out.value = txt; out.select();
            if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(() => {});
            st.textContent = "Copied. Save as assets/service-area.geojson";
            return;
        }
        status();
    });
    status();
}

/* ---------- ADDRESS CHECK ----------
   The check geocodes the structured address with the US Census Bureau
   (free, no key, most accurate for US street addresses because it
   interpolates house numbers from address ranges; JSONP because it
   sends no CORS header), Photon (OpenStreetMap) as a fallback. Either
   way the answer is decided HERE by a point-in-polygon test against
   the service-area shapes (the same file the red overlay is drawn
   from), so the answer always matches what the visitor sees.
   SUGGESTIONS while typing are optional: OpenStreetMap has no house
   number points for most of this area, so a keyless suggester can only
   offer street names, which reads as broken. With a Geoapify key in
   data-suggest-key on the form (free tier, restrict it to the domain),
   the street field becomes a real address autocomplete. */
const STATE_CODES = { ohio: "OH", indiana: "IN", kentucky: "KY", michigan: "MI", "west virginia": "WV", pennsylvania: "PA", illinois: "IL" };

function inRing(ring, lng, lat) {                        /* ray casting */
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}
/* the name of the service-area shape containing the point, or null */
function areaAt(gj, lng, lat) {
    for (const f of gj.features) {
        const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
        for (const poly of polys) {
            if (inRing(poly[0], lng, lat) && !poly.slice(1).some((hole) => inRing(hole, lng, lat))) return (f.properties && f.properties.name) || "the service area";
        }
    }
    return null;
}

function geocodeCensus(parts) {
    return new Promise((resolve, reject) => {
        const cb = "censusCb" + Date.now();
        const s = document.createElement("script");
        const timeout = setTimeout(() => { cleanup(); reject(new Error("timeout")); }, 8000);
        function cleanup() { clearTimeout(timeout); delete window[cb]; s.remove(); }
        window[cb] = (data) => {
            cleanup();
            const m = data && data.result && data.result.addressMatches && data.result.addressMatches[0];
            if (!m) return resolve(null);
            resolve({ label: m.matchedAddress, lat: m.coordinates.y, lng: m.coordinates.x });
        };
        s.onerror = () => { cleanup(); reject(new Error("census")); };
        const q = new URLSearchParams({ street: parts.street, city: parts.city, state: parts.state, zip: parts.zip, benchmark: "Public_AR_Current", format: "jsonp", callback: cb });
        s.src = "https://geocoding.geo.census.gov/geocoder/locations/address?" + q.toString();
        document.head.appendChild(s);
    });
}
function photonToParts(f) {
    const p = f.properties;
    const street = [p.housenumber, p.street || (p.type === "street" ? p.name : "")].filter(Boolean).join(" ");
    const city = p.city || p.town || p.village || p.county || "";
    const state = STATE_CODES[(p.state || "").toLowerCase()] || p.state || "";
    return { street, city, state, zip: p.postcode || "", lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
}
/* a generous box around the six counties, used to keep both geocoders
   from wandering to another state's Main Street */
const AREA_BBOX = { west: -85.3, south: 38.7, east: -83.6, north: 40.3 };
const nearHome = (x) => (x.lat - SERVICE_HOME[0]) ** 2 + (x.lng - SERVICE_HOME[1]) ** 2;
function photon(q, limit) {
    const bbox = `${AREA_BBOX.west},${AREA_BBOX.south},${AREA_BBOX.east},${AREA_BBOX.north}`;
    return fetch(`https://photon.komoot.io/api/?limit=${limit}&lang=en&bbox=${bbox}&lat=${SERVICE_HOME[0]}&lon=${SERVICE_HOME[1]}&zoom=10&location_bias_scale=0.8&q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => (d.features || []).map(photonToParts).filter((x) => x.street).sort((a, b) => nearHome(a) - nearHome(b)));
}
/* Geoapify autocomplete: real house-number addresses. Only used when a key is set. */
function geoapify(q, key) {
    const rect = `rect:${AREA_BBOX.west},${AREA_BBOX.south},${AREA_BBOX.east},${AREA_BBOX.north}`;
    /* limit 10, not 6: a house number on a common street name (South
       Main) exists in six or seven towns here, and the visitor's town
       can sit past the sixth. Typing the town or ZIP narrows it to one. */
    const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(q)}&filter=${rect}&bias=proximity:${SERVICE_HOME[1]},${SERVICE_HOME[0]}&limit=10&lang=en&format=json&apiKey=${encodeURIComponent(key)}`;
    return fetch(url).then((r) => r.json()).then((d) => {
        const seen = new Set();
        return (d.results || [])
            .filter((x) => x.housenumber && x.street)
            .map((x) => ({ street: `${x.housenumber} ${x.street}`, city: x.city || x.town || x.village || "", state: x.state_code || x.state || "", zip: x.postcode || "", lat: x.lat, lng: x.lon }))
            .filter((x) => { const k = `${x.street}|${x.city}|${x.zip}`.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
            .slice(0, 7);
    });
}

function addressCheck(map, fit) {
    const form   = document.getElementById("check-form");
    if (!form) return;
    const street = document.getElementById("check-street");
    const city   = document.getElementById("check-city");
    const state  = document.getElementById("check-state");
    const zip    = document.getElementById("check-zip");
    const list   = document.getElementById("check-suggest");
    const result = document.getElementById("check-result");
    const btn    = form.querySelector(".check__btn");
    let pin = null, geo = null, items = [], active = -1, debounce, lastQuery = "";
    fetch(SERVICE_AREA_URL).then((r) => r.json()).then((gj) => { geo = gj; });

    /* --- suggestions: an ARIA combobox over the street field --- */
    function closeList() { list.hidden = true; list.replaceChildren(); street.setAttribute("aria-expanded", "false"); active = -1; }
    function openList(found) {
        items = found;
        list.replaceChildren(...found.map((it, i) => {
            const li = document.createElement("li");
            li.className = "check__option"; li.setAttribute("role", "option"); li.id = `check-opt-${i}`; li.setAttribute("aria-selected", "false");
            const strong = document.createElement("strong"); strong.textContent = it.street;
            const span = document.createElement("span"); span.textContent = [it.city, it.state, it.zip].filter(Boolean).join(", ");
            li.append(strong, span);
            li.addEventListener("mousedown", (e) => { e.preventDefault(); choose(i); });   /* mousedown: before the input blurs */
            return li;
        }));
        list.hidden = found.length === 0;
        street.setAttribute("aria-expanded", String(found.length > 0));
        active = -1;
    }
    function highlight(i) {
        active = i;
        [...list.children].forEach((li, k) => li.setAttribute("aria-selected", String(k === i)));
        street.setAttribute("aria-activedescendant", i >= 0 ? `check-opt-${i}` : "");
    }
    function choose(i) {
        const it = items[i]; if (!it) return;
        street.value = it.street; city.value = it.city || city.value; state.value = it.state || state.value; zip.value = it.zip || zip.value;
        closeList();
        (it.city ? zip : city).focus();
    }
    const suggestKey = (form.dataset.suggestKey || "").trim();
    if (!suggestKey) {                                   /* no key: a plain text field, no listbox */
        street.removeAttribute("role"); street.removeAttribute("aria-autocomplete");
        street.removeAttribute("aria-expanded"); street.removeAttribute("aria-controls"); street.removeAttribute("aria-haspopup");
    } else {                                             /* free plan terms: credit the suggestion source */
        const note = form.querySelector(".check__note");
        if (note) {
            note.append(" Suggestions ");
            const a = document.createElement("a"); a.href = "https://www.geoapify.com/"; a.rel = "noopener"; a.textContent = "powered by Geoapify"; a.className = "areas__link";
            note.append(a, ".");
        }
    }
    /* budget: at most this many suggestion requests per visitor per
       session, so one runaway tab or a bot cannot drain the daily
       allowance. A normal address entry uses 3 to 6, so 6 covers one
       honest attempt; after that the visitor finishes typing by hand. */
    const SUGGEST_BUDGET = 10;
    let suggestUsed = 0;
    street.addEventListener("input", () => {
        clearTimeout(debounce);
        if (!suggestKey || suggestUsed >= SUGGEST_BUDGET) return;
        const q = street.value.trim();
        if (q.length < 4) { closeList(); return; }
        debounce = setTimeout(async () => {
            suggestUsed += 1;
            const query = q + (city.value ? ", " + city.value : "") + (zip.value ? " " + zip.value : "");
            lastQuery = query;
            try {
                const found = await geoapify(query, suggestKey);
                if (lastQuery === query) openList(found);
            } catch (_) { closeList(); }
        }, 300);
    });
    street.addEventListener("keydown", (e) => {
        if (list.hidden) return;
        if (e.key === "ArrowDown") { e.preventDefault(); highlight(Math.min(active + 1, items.length - 1)); }
        else if (e.key === "ArrowUp") { e.preventDefault(); highlight(Math.max(active - 1, 0)); }
        else if (e.key === "Enter" && active >= 0) { e.preventDefault(); choose(active); }
        else if (e.key === "Escape") { closeList(); }
    });
    street.addEventListener("blur", () => setTimeout(closeList, 120));

    /* --- the check --- */
    function say(cls, html) { result.className = "check__result " + cls; result.innerHTML = html; }
    [city, state, zip].forEach((f) => f.addEventListener("focus", closeList));
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearTimeout(debounce); lastQuery = "";            /* a late suggestion response must not reopen the list */
        closeList();
        const parts = { street: street.value.trim(), city: city.value.trim(), state: state.value.trim(), zip: zip.value.trim() };
        if (!parts.street || !parts.city || !parts.state) {
            say("is-err", "Fill in the street address, city, and state.");
            (!parts.street ? street : !parts.city ? city : state).focus();
            return;
        }
        parts.state = STATE_CODES[parts.state.toLowerCase()] || parts.state.toUpperCase();
        say("", "Checking&hellip;"); btn.disabled = true;
        try {
            let hit = null;
            try { hit = await geocodeCensus(parts); } catch (_) { /* fall through to Photon */ }
            if (!hit) {
                const alt = await photon(`${parts.street}, ${parts.city}, ${parts.state} ${parts.zip}`.trim(), 1);
                if (alt[0]) hit = { label: `${alt[0].street}, ${alt[0].city}, ${alt[0].state} ${alt[0].zip}`.trim(), lat: alt[0].lat, lng: alt[0].lng };
            }
            if (!hit) { say("is-err", "We couldn't find that address. Check the spelling and city, or <a href=\"#contact\">ask Phil</a>."); return; }
            if (!geo) geo = await fetch(SERVICE_AREA_URL).then((r) => r.json());
            const zone = areaAt(geo, hit.lng, hit.lat);

            /* the checked address: a red map pin whose tip sits on the
               point (the pin's tip is at 81% of the artwork's height);
               the shield stays Phil's */
            if (pin) pin.remove();
            pin = L.marker([hit.lat, hit.lng], {
                icon: L.divIcon({ className: "map-pin", html: '<img src="assets/icon-pin.svg" alt="" width="48" height="48">', iconSize: [48, 48], iconAnchor: [24, 39] }),
                interactive: false, zIndexOffset: 2000
            }).addTo(map);
            fit([hit.lat, hit.lng]);

            /* name the county only when the shape IS a county; a hand-drawn
               zone just reads as "Phil's service area" */
            const where = zone && /county$/i.test(zone) ? ` in ${zone}` : "";
            if (zone) say("is-yes", `Yes. ${hit.label} is inside Phil's service area${where}. <a href="#contact">Get a free estimate</a>.`);
            else say("is-no", `${hit.label} is outside Phil's service area. If you're close to the line, <a href="#contact">ask Phil anyway</a>.`);
        } catch (_) {
            say("is-err", "The address lookup didn't respond. Try again in a moment, or <a href=\"#contact\">ask Phil</a>.");
        } finally {
            btn.disabled = false;
        }
    });
}

/* ---------- CONTACT FORM: friendly validation before Netlify gets it ----------
   novalidate turns off the browser's bubbles; this marks the first
   empty required field, focuses it, and says what is missing in a
   live region. Netlify receives the plain POST when everything is in. */
function contactForm() {
    const form = document.querySelector(".form");
    if (!form) return;
    const error = form.querySelector(".form__error");
    form.addEventListener("submit", (e) => {
        const missing = [];
        form.querySelectorAll("[required]").forEach((f) => f.classList.remove("is-invalid"));
        /* one pass in document order, so the first thing named is the
           first thing on the page the visitor skipped */
        form.querySelectorAll(".form__input[required], .form__group").forEach((f) => {
            if (f.classList.contains("form__group")) {
                if (!f.querySelector("input:checked")) missing.push(f.querySelector("input"));
                return;
            }
            const bad = !f.value.trim() || (f.type === "email" && !f.checkValidity());
            if (bad) { f.classList.add("is-invalid"); missing.push(f); }
        });
        if (!missing.length) { error.hidden = true; return; }        /* let the POST go */
        e.preventDefault();
        const first = missing[0];
        const group = first.closest(".form__group");
        const label = group ? group.querySelector(".form__label").textContent : form.querySelector(`label[for="${first.id}"]`).textContent;
        error.textContent = first.type === "email" && first.value.trim() ? "That email address doesn't look right." : `Please fill in: ${label.toLowerCase()}.`;
        error.hidden = false;
        first.focus();
    });
    form.addEventListener("input", (e) => e.target.classList.remove("is-invalid"));
}

/* ---------- SECTION FADE-INS (ScrollTrigger) ----------
   Empty shells for now; batch handles however many we add later. */
function sectionReveals() {
    if (reduceMotion) return;
    /* section heads and the service blocks reveal separately so the
       four blocks can cascade instead of arriving as one slab */
    /* the reviews section is excluded: its cards live inside the pinned,
       transformed column and its head must be visible the moment the
       pin engages */
    const targets = ".section__head:not(.reviews-head), .placeholder .section__inner, .service, .segments, .panel:not([hidden]), .beat__media, .beat__body, .about__facts, .about__cta-row, .areas__body, .check__panel, .badge, .contact__intro, .form";
    gsap.set(targets, { autoAlpha: 0, y: 24 });
    ScrollTrigger.batch(targets, {
        start: "top 85%",
        once: true,
        onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, duration: 0.8, ease: "power2.out", stagger: 0.12 })
    });
}

/* ---------- BOOT ---------- */
document.fonts.ready.then(() => {
    document.querySelectorAll("[data-roll]").forEach(rollingText);
    heroIntro();
    ourWork();
    jobDialog();
    reviewCarousel();
    serviceMap();
    contactForm();
    sectionReveals();
});
