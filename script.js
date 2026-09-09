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

/* ---------- AREAS SERVED: county cutout map (Leaflet + OpenStreetMap) ----------
   Free and keyless: Leaflet is open source and OpenStreetMap serves
   its tiles without a key. The map is STATIC (no drag, no zoom) and the
   tile layer is clipped to the union of the six county shapes, so the
   basemap only exists inside the service area; outside is blank. The
   clip is an SVG clipPath built in Leaflet's layer-pixel space from the
   same Census boundaries the outlines use (assets/service-counties.geojson).
   The inline SVG in the HTML is the fallback until this runs. */
const SERVICE_HOME  = [39.4809, -84.4577];   /* Trenton, OH */
const SERVICE_MILES = 50;
const SERVICE_CITIES = [
    ["Hamilton", 39.3995, -84.5613, true], ["Fairfield", 39.3454, -84.5603], ["Monroe", 39.4403, -84.3622],
    ["Middletown", 39.5151, -84.3983, true], ["Oxford", 39.5070, -84.7452, true],
    ["Mason", 39.3600, -84.3099, true], ["Lebanon", 39.4354, -84.2030, true], ["Springboro", 39.5523, -84.2333],
    ["Franklin", 39.5589, -84.3041], ["Kettering", 39.6895, -84.1688], ["Centerville", 39.6284, -84.1594],
    ["Miamisburg", 39.6428, -84.2866], ["West Carrollton", 39.6723, -84.2522], ["Dayton", 39.7589, -84.1916, true],
    ["Trotwood", 39.7973, -84.3113], ["Blue Ash", 39.2320, -84.3783], ["Sharonville", 39.2681, -84.4133],
    ["Reading", 39.2237, -84.4422], ["Norwood", 39.1556, -84.4597, true], ["St. Bernard", 39.1670, -84.4986],
    ["Forest Park", 39.2903, -84.5041], ["Loveland", 39.2689, -84.2638], ["Milford", 39.1753, -84.2944, true],
    ["Eaton", 39.7439, -84.6366, true]
];

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

    L.circle(SERVICE_HOME, {
        radius: SERVICE_MILES * 1609.344,
        color: "#ED1C24", weight: 1.5, dashArray: "8 8", fillOpacity: 0, interactive: false
    }).addTo(map);

    /* the clip: one SVG clipPath, userSpaceOnUse, in layer-pixel coordinates */
    const svgNS = "http://www.w3.org/2000/svg";
    const clipSvg = document.createElementNS(svgNS, "svg");
    clipSvg.setAttribute("class", "map-clip");
    clipSvg.setAttribute("aria-hidden", "true");
    const clip = document.createElementNS(svgNS, "clipPath");
    clip.setAttribute("id", "county-cut");
    clip.setAttribute("clipPathUnits", "userSpaceOnUse");
    clipSvg.appendChild(clip);
    el.appendChild(clipSvg);

    let counties = null;
    function rebuildClip() {
        if (!counties) return;
        clip.replaceChildren();
        counties.eachLayer((layer) => {
            const rings = layer.feature.geometry.type === "Polygon"
                ? layer.feature.geometry.coordinates
                : layer.feature.geometry.coordinates.map((p) => p[0]);
            rings.forEach((ring) => {
                const d = "M" + ring.map(([lng, lat]) => {
                    const p = map.latLngToLayerPoint([lat, lng]);
                    return `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
                }).join(" L") + "Z";
                const path = document.createElementNS(svgNS, "path");
                path.setAttribute("d", d);
                clip.appendChild(path);
            });
        });
        el.querySelector(".leaflet-tile-pane").style.clipPath = "url(#county-cut)";
    }
    function fit() {
        if (!counties) return;
        map.invalidateSize();
        map.fitBounds(counties.getBounds(), { padding: [14, 14] });
        rebuildClip();
    }

    fetch("assets/service-counties.geojson")
        .then((r) => r.json())
        .then((gj) => {
            counties = L.geoJSON(gj, {
                style: { color: "#BA1E23", weight: 2, fillOpacity: 0 },
                onEachFeature: (f, layer) => layer.bindTooltip(`${f.properties.name} County`, { sticky: true, className: "map-tip" })
            }).addTo(map);
            fit();
            map.on("zoomend moveend", rebuildClip);          /* layer points change with the view */
            el.classList.add("is-live");
        })
        .catch(() => {});                                  /* the SVG fallback stays */

    SERVICE_CITIES.forEach(([name, lat, lng, label]) => L.circleMarker([lat, lng], {
        radius: 4.5, color: "#FFFFFF", weight: 1.5, fillColor: "#231F20", fillOpacity: 1
    }).bindTooltip(name, { permanent: !!label, direction: "right", offset: [6, 0], className: "map-tip" + (label ? " map-tip--pin" : "") }).addTo(map));

    L.marker(SERVICE_HOME, {
        icon: L.divIcon({ className: "map-home", html: '<img src="assets/logo-shield.svg" alt="" width="30" height="32">', iconSize: [30, 32], iconAnchor: [15, 16] }),
        title: "Integrity Restorations and Remodeling, Trenton", zIndexOffset: 1000, interactive: false
    }).bindTooltip("Home base", { permanent: true, direction: "top", offset: [0, -16], className: "map-tip map-tip--home" }).addTo(map);

    let timer;
    window.addEventListener("resize", () => { clearTimeout(timer); timer = setTimeout(fit, 200); });
    ScrollTrigger.addEventListener("refresh", () => map.invalidateSize());
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
    const targets = ".section__head:not(.reviews-head), .placeholder .section__inner, .service, .segments, .panel:not([hidden]), .beat__media, .beat__body, .about__facts, .about__cta-row, .areas__map, .areas__body";
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
    sectionReveals();
});
