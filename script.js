/* =====================================================================
   INTEGRITY RESTORATIONS & REMODELING
   Vanilla JS + GSAP (ScrollTrigger, SplitText). No build step.
   Order: plugins -> helpers -> nav -> hero intro -> rolling text -> scroll
   ===================================================================== */

gsap.registerPlugin(ScrollTrigger, SplitText, Flip);

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
/* a click outside the header (the page behind the drawer) closes it */
document.addEventListener("click", (e) => {
    if (toggle.getAttribute("aria-expanded") === "true" && !e.target.closest(".site-header")) setMenu(false);
});

/* ---------- HERO PARALLAX ----------
   The photo is 30% taller than its frame and starts centred in it, so
   the crop at rest is the same as before. As the hero scrolls out the
   photo drifts down relative to the frame (scrubbed, so it tracks the
   scroll exactly), which on screen reads as the photo moving up more
   slowly than the page: the section passes over it. The extra height
   is set here, not in CSS, so reduced motion keeps a plain photo. */
if (!reduceMotion) {
    const photo = document.querySelectorAll(".hero__photo");   /* the before and the after move as one */
    gsap.set(photo, { height: "130%", yPercent: -11.5 });
    gsap.to(photo, { yPercent: 0, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
    /* the divider bands' photos drift the same way, harder: each is
       230% of its band's height and travels the spare 130% across its
       whole trip through the viewport, so it moves at well under half
       the page's speed. Each band also REVEALS once: the photo wipes in sideways
       with a vertical front that follows the two slanted cuts, left to
       right for the first band, right to left for the mirrored one.
       Timed, not scrubbed, so it never runs back. GSAP would snap a
       polygon string, so a number drives it. */
    document.querySelectorAll(".divider").forEach((div) => {
        const photo = div.querySelector(".divider__photo");
        const media = div.querySelector(".divider__media");
        const mirror = div.classList.contains("divider--mirror");
        /* data-grow overrides the 230% for a band whose photo is too wide
           to survive a long vertical trip (the subject would leave the frame) */
        const grow = Math.min(parseFloat(div.dataset.grow) || 230, window.innerWidth < 768 ? 150 : 1e3);   /* phones: a landscape photo in a tall narrow band is already zoomed hard, so less spare */
        /* data-rest: the share of the spare height still hidden above the band
           when the trip ends (0 by default: the photo's top arrives). A band
           whose subject stands LOW in the photo keeps some, so the window
           stays over the lower part of the picture the whole way */
        const spare = -((grow - 100) / grow) * 100, rest = parseFloat(div.dataset.rest) || 0;
        gsap.set(photo, { height: grow + "%", yPercent: spare });
        gsap.to(photo, { yPercent: spare * rest, ease: "none", force3D: true, scrollTrigger: { trigger: div, start: "top bottom", end: "bottom top", scrub: 0.6 } });   /* scrub 0.6: the photo eases after the wheel instead of stepping with each scroll event, which read as jitter */

        const wipe = { p: 0 };
        const draw = () => {
            const P = wipe.p.toFixed(4), Q = (1 - wipe.p).toFixed(4);
            if (mirror) {
                const X = ((1 - wipe.p) * 100).toFixed(3) + "%";      /* the front, coming from the right */
                media.style.clipPath = `polygon(${X} calc(var(--slant) * ${P}), 100% 0, 100% calc(100% - var(--slant)), ${X} calc(100% - var(--slant) * ${Q}))`;
            } else {
                const X = (wipe.p * 100).toFixed(3) + "%";            /* the front, coming from the left */
                media.style.clipPath = `polygon(0 0, ${X} calc(var(--slant) * ${P}), ${X} calc(100% - var(--slant) * ${Q}), 0 calc(100% - var(--slant)))`;
            }
        };
        draw();
        gsap.to(wipe, {
            p: 1, duration: 1.3, ease: "power3.inOut", onUpdate: draw,
            onComplete: () => { media.style.clipPath = ""; },   /* back to the stylesheet's polygon */
            scrollTrigger: { trigger: div, start: "top 78%", once: true }
        });
    });
}

/* ---------- HEADER: the hero crossing ----------
   Over the hero the header is the full centred nav; past the hero it is
   the 64px bar. The crossing is when the hero's bottom passes 30% of the
   viewport, so the bar is in place while the nav is still over the
   photo, never over the white section below. The two are different
   layouts (.is-scrolled), so instead of snapping between them: as the
   hero's bottom passes 60% the logo shrinks to its bar size; at the crossing the links
   fade, the shield and wordmark glide left into their bar positions
   (GSAP Flip across the class change), the grey bar wipes in left to
   right, then the hamburger fades in. Scrolling back up runs it in
   reverse. Reduced motion: the plain class toggle. */
const headerBg = header.querySelector(".site-header__bg");
const shield   = header.querySelector(".nav__shield");
const wordmark = header.querySelector(".nav__wordmark");
const lists    = header.querySelectorAll(".nav__list");
const desktopNav = () => window.matchMedia("(min-width: 1024px)").matches;   /* only there do the layouts differ */
let crossing = null, flipping = null, shrink = null, shrinkAt = null;

function setScrolled(on) {
    /* the sheet must not play its slide transition while the layout switches */
    menu.classList.add("nav__menu--snap");
    header.classList.toggle("is-scrolled", on);
    requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.remove("nav__menu--snap")));
}

function cross(on) {
    if (crossing) crossing.progress(1).kill();
    if (flipping) flipping.progress(1).kill();
    const swapToggle = desktopNav();
    const tl = crossing = gsap.timeline({ onComplete() { crossing = null; } });
    /* the Flip glides position only, so the logo must already be at its
       bar size when the layout switches (it is, unless the page jumped) */
    const settleShrink = () => { if (shrink) shrink.progress(1).pause(); };
    if (on) {
        tl.to(lists, { autoAlpha: 0, duration: 0.2, ease: "power1.in" })
          .add(() => {
              settleShrink();
              /* the shield leads and the wordmark follows, so their paths
                 (left along the top; left and up from underneath) never overlap */
              const state = Flip.getState([shield, wordmark]);
              if (swapToggle) gsap.set(toggle, { autoAlpha: 0 });
              setScrolled(true);
              gsap.set(lists, { clearProps: "opacity,visibility" });   /* they live in the drawer now */
              flipping = Flip.from(state, { duration: 0.65, ease: "power3.inOut", scale: true, stagger: 0.12, onComplete() { flipping = null; } });
          })
          .to(headerBg, { scaleX: 1, duration: 0.55, ease: "power2.inOut" }, "+=0.25");
        if (swapToggle) tl.to(toggle, { autoAlpha: 1, duration: 0.3, ease: "power2.out" }, "-=0.1");
    } else {
        if (swapToggle) tl.to(toggle, { autoAlpha: 0, duration: 0.2, ease: "power1.in" });
        tl.to(headerBg, { scaleX: 0, duration: 0.45, ease: "power2.inOut" }, "<")
          .add(() => {
              settleShrink();
              const state = Flip.getState([wordmark, shield]);   /* wordmark leads on the way back */
              setScrolled(false);
              if (swapToggle) gsap.set(toggle, { clearProps: "opacity,visibility" });
              gsap.set(lists, { autoAlpha: 0 });
              flipping = Flip.from(state, { duration: 0.6, ease: "power3.inOut", scale: true, stagger: 0.12, onComplete() {
                  flipping = null;
                  /* back at the centre: regrow now if the page is already above the shrink line */
                  if (shrink && shrinkAt && !shrinkAt.isActive) shrink.reverse();
              } });
          })
          .to(lists, { autoAlpha: 1, duration: 0.35, ease: "power2.out" }, "+=0.4");
    }
}

/* timed off the hero's CONTENT (the first screen), not the whole hero: the
   photo may run on below the fold (the tall hero) and the bar should not wait for that */
if (reduceMotion) {
    ScrollTrigger.create({
        trigger: ".hero__content", start: "bottom 30%",
        onEnter: () => setScrolled(true), onLeaveBack: () => setScrolled(false)
    });
} else {
    ScrollTrigger.create({
        trigger: ".hero__content", start: "bottom 30%",
        onEnter: () => cross(true), onLeaveBack: () => cross(false)
    });
    /* the shrink: as the hero's bottom passes 45% of the viewport the
       logo eases down to the bar's sizes (48px shield, 132px wordmark:
       the same numbers the bar's CSS uses), and grows back when that
       line is crossed upward. Desktop only: elsewhere the layouts match. */
    gsap.matchMedia().add("(min-width: 1024px)", () => {
        shrink = gsap.timeline({ paused: true, defaults: { duration: 0.5, ease: "power2.inOut" } })
            .to(shield,   { width: 48 },  0)
            .to(wordmark, { width: 132 }, 0);
        shrinkAt = ScrollTrigger.create({
            trigger: ".hero__content", start: "bottom 60%",
            onEnter: () => shrink.play(), onLeaveBack: () => { if (!flipping) shrink.reverse(); }
        });
        return () => { shrinkAt.kill(); shrink.kill(); shrink = shrinkAt = null; gsap.set([shield, wordmark], { clearProps: "width" }); };
    });
}

/* ---------- MENU LINKS: sections fade in, no scroll jump ----------
   A menu link doesn't scroll the page to its section. The page dips to
   the ink ground (a fixed veil), the scroll position changes underneath
   with the veil up, then the veil lifts and the target section's content
   rises out of it. The hash still updates so the URL and back button
   behave. Reduced motion keeps the browser's plain jump. */
function sectionFades() {
    if (reduceMotion) return;
    const veil = document.createElement("div");
    veil.className = "veil";
    veil.setAttribute("aria-hidden", "true");
    document.body.appendChild(veil);
    let busy = false;

    /* href: the hash to record. target: the section whose content rises in.
       land: the element to bring under the bar (defaults to the section
       itself, honouring its scroll-margin-top). */
    function fadeTo(href, target, land) {
        if (busy) return;
        busy = true;
        const inner = target.querySelector(":scope > .section__inner") || target;
        gsap.timeline({
            onComplete() { busy = false; gsap.set(inner, { clearProps: "opacity,visibility,transform" }); }
        })
        .to(veil, { autoAlpha: 1, duration: 0.28, ease: "power2.in" })
        .add(() => {
            let top;
            if (land) {                                              /* a spot inside the section: just under the bar */
                const bar = header.getBoundingClientRect().height;
                top = land.getBoundingClientRect().top + window.scrollY - bar - 28;
            } else {                                                 /* land where the browser would: the section's top under the bar */
                const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
                top = target.getBoundingClientRect().top + window.scrollY - margin;
            }
            window.scrollTo({ top, behavior: "instant" });
            history.pushState(null, "", href);
            ScrollTrigger.update();
            gsap.set(inner, { autoAlpha: 0, y: 28 });
        })
        .to(veil,  { autoAlpha: 0, duration: 0.55, ease: "power2.out" }, "+=0.05")
        .to(inner, { autoAlpha: 1, y: 0, duration: 0.75, ease: "power3.out" }, "<");
    }

    menu.addEventListener("click", (e) => {
        const link = e.target.closest('a[href^="#"]');
        if (!link) return;
        const target = document.querySelector(link.getAttribute("href"));
        if (!target) return;
        e.preventDefault();
        fadeTo(link.getAttribute("href"), target);
    });

    /* the home control: the same fade, back to the very top */
    const home = document.querySelector(".home-btn");
    if (home) home.addEventListener("click", (e) => {
        e.preventDefault();
        if (busy) return;
        busy = true;
        gsap.timeline({ onComplete() { busy = false; } })
            .to(veil, { autoAlpha: 1, duration: 0.28, ease: "power2.in" })
            .add(() => { window.scrollTo({ top: 0, behavior: "instant" }); history.pushState(null, "", location.pathname + location.search); ScrollTrigger.update(); })
            .to(veil, { autoAlpha: 0, duration: 0.55, ease: "power2.out" }, "+=0.05");
    });

    /* the service blocks: same fade, but landing on the filter row so the
       chosen photos are what you arrive at (ourWork has already picked the filter) */
    document.querySelectorAll("[data-goto-filter]").forEach((link) => {
        link.addEventListener("click", (e) => {
            const target = document.querySelector(link.getAttribute("href"));
            if (!target) return;
            e.preventDefault();
            fadeTo(link.getAttribute("href"), target, target.querySelector(".filters"));
        });
    });
}

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

/* ---------- HOME CONTROL (from the Homicidal Fitness site) ----------
   Appears once the first screen of the hero is scrolled off. Its colour
   comes from a probe of whatever is actually painted under it: take the
   topmost element at its centre (skipping itself), walk up to the first
   opaque background and measure its luminance. Photos sit in dark (ink)
   boxes, so they read as dark. Red over light, white over dark. */
function homeButton() {
    const btn = document.querySelector(".home-btn");
    if (!btn) return;
    function bgIsLight(x, y) {
        let node = document.elementsFromPoint(x, y).find((el) => !el.closest(".home-btn") && !el.closest(".veil"));
        if (node && node.tagName === "IMG") return false;                    /* a photo: treat as dark */
        while (node && node !== document.documentElement) {
            const m = getComputedStyle(node).backgroundColor.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/);
            if (m && (m[4] === undefined || +m[4] > 0.4)) return (0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3]) / 255 > 0.6;
            node = node.parentElement;
        }
        return true;                                                         /* nothing opaque found: the page is white */
    }
    let queued = false;
    function update() {
        queued = false;
        const past = window.scrollY > window.innerHeight * 0.85;
        btn.classList.toggle("visible", past);
        if (!past) return;
        const r = btn.getBoundingClientRect();
        btn.classList.toggle("on-light", bgIsLight(r.left + r.width / 2, r.top + r.height / 2));
    }
    const ask = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
    window.addEventListener("scroll", ask, { passive: true });
    window.addEventListener("resize", ask);
    setInterval(ask, 500);                  /* things change under it without a scroll too (a band's photo wiping in, a card fading) */
    update();
}

/* ---------- HERO ON SCROLL ----------
   1. The headline and note fade out (and lift a little) BEFORE they reach
      the nav: fully gone by the time their top would touch the logo's
      bottom edge. Scrubbed, so scrolling back brings them in again. The
      wrapper is faded, not the words, so the intro's own tweens are left alone.
   2. The buttons ride down the photo as the page scrolls, from the foot of
      the first screen to the foot of the hero (the tall hero's extra 30%),
      at about half the page's speed. */
function heroScroll() {
    if (reduceMotion) return;
    const copy = document.querySelector(".hero__copy"), actions = document.querySelector(".hero__actions");
    const content = document.querySelector(".hero__content"), hero = document.querySelector(".hero"), trust = document.querySelector(".trust");
    /* the lowest thing in the nav at the top of the page: the big logo on desktop, the bar elsewhere */
    const navFoot = () => Math.max(header.querySelector(".nav__brand").getBoundingClientRect().bottom, header.getBoundingClientRect().bottom, 64);
    gsap.fromTo(copy, { autoAlpha: 1, y: 0 }, {
        autoAlpha: 0, y: -24, ease: "none", immediateRender: false,
        scrollTrigger: { trigger: copy, start: () => "clamp(top " + Math.round(navFoot() + 110) + "px)", end: () => "top " + Math.round(navFoot() - 30) + "px", scrub: true, invalidateOnRefresh: true }
    });
    const room = () => Math.max(trust.getBoundingClientRect().top - content.getBoundingClientRect().bottom, 0);   /* the stretch of bare photo under the first screen */
    gsap.fromTo(actions, { "--drop": "0px" }, {
        "--drop": () => room() + "px", ease: "none", immediateRender: false,
        scrollTrigger: { trigger: hero, start: "top top", end: () => "+=" + Math.round(room() * 2), scrub: true, invalidateOnRefresh: true }
    });
}

/* ---------- HERO INTRO ----------
   The slogan fades in word by word over the BEFORE photo; then "a
   success" and the finished kitchen reveal together, left to right.
   Runs after fonts load so SplitText measures the real glyphs. */
function heroIntro() {
    const hero  = document.querySelector(".hero");
    const after = hero.querySelector(".hero__after .hero__photo");
    hero.style.animation = "none";                       /* script is here: the CSS fallback is not needed */
    hero.style.setProperty("--rv", reduceMotion ? "1" : "0");
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
            const others = rest.filter((s) => s !== ".nav__brand");

            /* 1. the line fades in, word by word, no rising
               2. the shield (the nav brand) appears
               3. "a success" and the after photo reveal left to right, in step
               4. everything else follows */
            hero.style.setProperty("--rv", "0");        /* a re-split replays the intro: start the reveal over */
            const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
            tl.from(words, { autoAlpha: 0, duration: 0.9, stagger: 0.05, force3D: false })   /* 2D: the gradient clip holds */
              .to(".nav__brand", { autoAlpha: 1, y: 0, duration: 0.6 }, "-=0.2")
              /* THE REVEAL: "a success" arrives left to right, and the
                 finished kitchen arrives over the before photo at exactly
                 the same pace, because one number (--rv on the hero)
                 drives both masks. It waits for the after photo if the
                 network has not delivered it yet. */
              .add(() => {
                    if (after.complete && after.naturalWidth) return;
                    tl.pause();
                    const go = () => tl.resume();
                    after.addEventListener("load", go, { once: true });
                    after.addEventListener("error", go, { once: true });
                }, "+=0.1")
              .to(hero, { "--rv": 1, duration: 1.6, ease: "power2.inOut" })
              .to(others, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.08 }, "-=0.5");
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
        /* the commercial list: each row slides in from the right, top first */
        const rows = panels[index].querySelectorAll(".commercial__item");
        if (rows.length && !reduceMotion) gsap.fromTo(rows, { x: 72, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.6, ease: "power3.out", stagger: 0.09, delay: 0.1, clearProps: "transform" });
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

    /* THE SERVICE LINKS above: each names a filter. Picking it happens here,
       at once, while the gallery is still off screen; getting there is
       sectionFades' job (or the plain anchor jump, with reduced motion). */
    document.querySelectorAll("[data-goto-filter]").forEach((link) => {
        link.addEventListener("click", () => {
            selectTab(0);                                                    /* Residential */
            const btn = filters.find((f) => f.dataset.filter === link.dataset.gotoFilter);
            if (btn && btn.getAttribute("aria-pressed") !== "true") btn.click();
        });
    });
}

/* tap / keyboard flip for one before/after card; hover is pure CSS.
   Shared with the job dialog, which wires the clone it shows. */
function wirePair(pair) {
    const after  = pair.querySelector(".pair__after");
    const fill   = pair.querySelector(".pair__rail-fill");
    const before = pair.querySelector(".pair__opt--before");
    const toggle = pair.querySelector(".pair__opt--after");
    /* one number drives the photo's wipe and the rail's fill together;
       a dialog clone starts wherever its source was */
    const w = { p: pair.classList.contains("is-after") ? 1 : 0 };
    const render = () => {
        const cut = `inset(0 ${((1 - w.p) * 100).toFixed(3)}% 0 0)`;
        after.style.clipPath = cut;
        fill.style.clipPath = cut;
    };
    const mark = (on) => {
        pair.classList.toggle("is-after", on);
        before.classList.toggle("is-on", !on); before.setAttribute("aria-pressed", String(!on));
        toggle.classList.toggle("is-on", on);  toggle.setAttribute("aria-pressed", String(on));
    };
    const set = (on) => {
        mark(on);
        gsap.to(w, { p: on ? 1 : 0, duration: reduceMotion ? 0 : 0.8, ease: "power2.inOut", overwrite: true, onUpdate: render });
    };
    render();
    before.addEventListener("click", (e) => { e.stopPropagation(); set(false); });
    toggle.addEventListener("click", (e) => { e.stopPropagation(); set(true); });
    pair.querySelector(".pair__media").addEventListener("click", () => set(!pair.classList.contains("is-after")));
}

/* ---------- THE TAP HINT ----------
   Nobody assumes a word on a photo is a button, so a finger sits by the
   AFTER button of the first photo showing, its outline drawing itself
   in the brand gradient, fading, and drawing again. The first tap on
   any BEFORE, AFTER, or photo ends it for that visit. It is not
   remembered across visits: it was, and the site's owner never saw it. */
function pairHint() {
    const gallery = document.querySelector(".gallery");
    if (!gallery || reduceMotion) return;

    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "pair__hint"); svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true");
    /* the arrow, then the five rays as their own paths, each drawn from
       the end nearest the arrow outward (their d runs inner to outer) */
    const mk = (d) => { const el = document.createElementNS(NS, "path"); el.setAttribute("d", d); svg.appendChild(el); return el; };
    const path = mk("M17.1603 16.9887L21.0519 15.4659C21.4758 15.3001 21.4756 14.7003 21.0517 14.5346L11.6992 10.8799C11.2933 10.7213 10.8929 11.1217 11.0515 11.5276L14.7062 20.8801C14.8719 21.304 15.4717 21.3042 15.6375 20.8803L17.1603 16.9887Z");
    const rays = ["M7 7L5.5 5.5", "M11 5L11 3", "M15 7L16.5 5.5", "M5 11L3 11", "M7 15L5.5 16.5"].map(mk);

    /* the outline draws along its own length: dash the stroke to that
       length and slide the dash into view */
    const place = () => { const first = [...gallery.querySelectorAll(".pair")].find((p) => p.offsetParent !== null); if (first) first.appendChild(svg); };
    place();
    const L = path.getTotalLength();
    const R = rays.map((r) => r.getTotalLength());
    gsap.set(path, { strokeDasharray: L, strokeDashoffset: L });
    rays.forEach((r, k) => gsap.set(r, { strokeDasharray: R[k], strokeDashoffset: R[k] + 2 }));   /* +2: the round cap would show as a dot */
    const loop = gsap.timeline({ repeat: -1, repeatDelay: 0.6, defaults: { ease: "power2.inOut" } })
        .set(svg, { opacity: 1 })
        .fromTo(path, { strokeDashoffset: L }, { strokeDashoffset: 0, duration: 1.0 })
        /* the rays shoot outward from the arrow, one after another: the click */
        .fromTo(rays, { strokeDashoffset: (k) => R[k] + 2 }, { strokeDashoffset: 0, duration: 0.28, ease: "power2.out", stagger: 0.07 }, "-=0.1")
        .fromTo(svg, { scale: 1, transformOrigin: "60% 60%" }, { scale: 0.86, duration: 0.18, yoyo: true, repeat: 1 }, "-=0.15")   /* the tap */
        .to(svg, { opacity: 0, duration: 0.5 }, "+=0.5");

    /* follow the first photo showing when the filters change */
    document.querySelectorAll(".filter, .segment").forEach((b) => b.addEventListener("click", () => setTimeout(place, 50)));

    const done = () => {
        loop.kill(); gsap.to(svg, { opacity: 0, duration: 0.3, onComplete: () => svg.remove() });
        gallery.removeEventListener("click", onTap, true);
    };
    const onTap = (e) => { if (e.target.closest(".pair__opt, .pair__media")) done(); };
    gallery.addEventListener("click", onTap, true);
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
    const vcount  = section.querySelector(".reviews-vprogress__count");   /* phones: the vertical bar beside the window */
    const vfill   = section.querySelector(".reviews-vprogress__fill");

    if (reduceMotion) {
        layers.filter(Boolean).forEach((w) => { w.p = 1; render(w); });   /* everything in its finished state */
        return;
    }
    section.classList.add("is-carousel");

    /* a red rule between every pair of cards (decorative, carousel only). They
       are plain flow items in the column, so they travel with the cards but are
       not scaled by the depth effect, and the card centres below still come
       from offsetTop, rules included. */
    cards.slice(1).forEach((card) => {
        const rule = document.createElement("li");
        rule.className = "reviews__rule"; rule.setAttribute("aria-hidden", "true"); rule.setAttribute("role", "presentation");
        card.before(rule);
    });

    /* The review text leaves its photo and lives in the head (.reviews-
       current), only the active one shown (moving nodes keeps the
       See-the-job wiring): beside the window from 768px, above it on
       phones. On phones the slot is sized to the LONGEST review, so the
       head never grows or shrinks and the window below never jumps. */
    const wide = window.matchMedia("(min-width: 768px)");
    let active = 0;
    function placeTexts() {
        texts.forEach((t, i) => { t.hidden = i !== active; slot.appendChild(t); });
        if (wide.matches) { slot.style.minHeight = ""; return; }
        let tallest = 0;
        texts.forEach((t) => { const was = t.hidden; t.hidden = false; tallest = Math.max(tallest, t.offsetHeight); t.hidden = was; });
        slot.style.minHeight = tallest + "px";
    }
    function showText(i) {
        if (i === active) return;
        texts[active].hidden = true;
        texts[i].hidden = false;
        gsap.fromTo(texts[i], { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: "power2.out", clearProps: "transform" });
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
            gsap.set(card, { scale: 1 - d * 0.22, x: d * (wide.matches ? 56 : 22), transformOrigin: "50% 50%" });
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
        cards.forEach((c, k) => c.classList.toggle("is-focus", k === i));      /* the red frame follows the card in the middle */
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
        cards.forEach((c) => c.classList.remove("is-focus"));          /* a rebuild (resize) starts with nothing in focus */

        const H = win.clientHeight;
        /* phones: each photo fills most of the window (the window's height
           is whatever the head leaves, so it is only known here) */
        cards.forEach((c) => { c.style.minHeight = wide.matches ? "" : Math.round(H * 0.84) + "px"; });
        const W = Math.round(H * 0.28);                /* the dwell, in px of scrolling */
        const first = cards[0], last = cards[cards.length - 1];
        column.style.paddingTop    = `${Math.max(H / 2 - first.offsetHeight / 2, 0)}px`;
        column.style.paddingBottom = `${Math.max(H / 2 - last.offsetHeight / 2, 0)}px`;

        /* the window's top fade (photos and rails together) stops short of the centred card */
        const tallest = Math.max(...cards.map((c) => c.offsetHeight));
        win.style.setProperty("--fade", Math.round(Math.min(Math.max((H - tallest) / 2 - 14, 10), 80)) + "px");

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
                count.textContent = vcount.textContent = String(idx + 1).padStart(2, "0");
                fill.style.transform = `scaleX(${self.progress})`;
                vfill.style.transform = `scaleY(${self.progress})`;
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
   both read it, so whatever shape it holds is what Phil serves. It is
   now the outline Phil drew (a rounded box: Indiana line to western
   Greene County, just north of I-70 down to Loveland; see
   tools/service-area.py); redraw with the hidden editor (?edit-area).
   The basemap's own town names do the labelling, so the only marker
   is the shield at home. */
const SERVICE_HOME = [39.4809, -84.4577];   /* Trenton, OH */
const SERVICE_AREA_URL = "assets/service-area.geojson";
const EDIT_AREA = new URLSearchParams(location.search).has("edit-area");

function serviceMap() {
    const el = document.getElementById("service-map");
    if (!el || typeof L === "undefined") return;         /* Leaflet did not load: the SVG stays */
    const check = el.parentElement;                      /* .check: the map plus the checker panel */

    const map = L.map(el, {
        zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
        touchZoom: false, boxZoom: false, keyboard: false, zoomSnap: 0.1,
        attributionControl: true
    }).setView(SERVICE_HOME, 9);
    map.attributionControl.setPrefix(false);             /* the OSM credit stays (licence); Leaflet's own badge goes */

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
            /* phones: fill the width. Sheet closed: clear the button at the
               foot. Sheet open: the bottom edge may tuck under the panel */
            const closed = check.classList.contains("is-sheet") && !check.classList.contains("is-open");
            map.fitBounds(area.getBounds(), { paddingTopLeft: [10, navH + 10], paddingBottomRight: [10, closed ? 116 : r.height * 0.45], animate: false });
        }
    }

    /* PHONES: the checker is a bottom sheet. The button at the map's foot
       slides the form up to where it always sat; the form's close button
       (or Escape) slides it away. CSS does the motion off two classes. */
    const openBtn  = check.querySelector(".check__open");
    const closeBtn = check.querySelector(".check__close");
    const sheetMq  = window.matchMedia("(max-width: 767px)");
    function setSheet(open) {
        check.classList.toggle("is-open", open);
        openBtn.setAttribute("aria-expanded", String(open));
        fit();
        if (open) setTimeout(() => check.querySelector("#check-street").focus({ preventScroll: true }), 460);   /* after the slide */
        else if (sheetMq.matches) openBtn.focus({ preventScroll: true });
    }
    function applySheet() {
        check.classList.toggle("is-sheet", sheetMq.matches);
        if (!sheetMq.matches) { check.classList.remove("is-open"); openBtn.setAttribute("aria-expanded", "false"); }
        fit();
    }
    if (openBtn && closeBtn) {
        openBtn.addEventListener("click", () => setSheet(true));
        closeBtn.addEventListener("click", () => setSheet(false));
        check.addEventListener("keydown", (e) => { if (e.key === "Escape" && check.classList.contains("is-open") && sheetMq.matches) setSheet(false); });
        sheetMq.addEventListener("change", applySheet);
        applySheet();
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
            if (!hit) { say("is-err", "We couldn't find that address. Check the spelling and city, or <a href=\"#contact\">ask us</a>."); return; }
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
               zone just reads as "our service area" */
            const where = zone && /county$/i.test(zone) ? ` in ${zone}` : "";
            if (zone) say("is-yes", `Yes. ${hit.label} is inside our service area${where}. <a href="#contact">Get a free estimate</a>.`);
            else say("is-no", `${hit.label} is outside our service area. If you're close to the line, <a href="#contact">ask us anyway</a>.`);
        } catch (_) {
            say("is-err", "The address lookup didn't respond. Try again in a moment, or <a href=\"#contact\">ask us</a>.");
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

/* ---------- CONTACT: the shield splits open ----------
   At rest the two halves sit together at the centre as one small
   shield in its true proportions, the panel closed to a line behind
   them. On arrival the halves slide to the card's edges while they
   grow to the card's height, the panel opens between them, and the
   content fades in. Plays once. Reduced motion: the finished card. */
/* BELOW 1024px there is no split: the card is several screens tall
   there, and scaling something that size was glitchy on phones. The
   shield and wordmark build on the grey section, the section turns
   white, and the form's blocks fade in top to bottom. Only opacity,
   small transforms and one background colour move. Plays once.
   Without this (no JS, reduced motion) the section is simply white
   with the form in place. */
function contactIntroSmall() {
    const section = document.querySelector(".section--contact");
    const intro   = section && section.querySelector(".contact-intro");
    if (!intro || reduceMotion) return;
    const shield = intro.querySelector(".contact-intro__shield");
    const items = [...section.querySelectorAll(
        ".contact-card__main > :not(form), .form > :not(input):not(.form__hp), .contact-card__side > *"
    )];
    section.classList.add("is-intro");
    gsap.set(items, { autoAlpha: 0, y: 10 });
    gsap.set(shield, { autoAlpha: 0, scale: 0.85, transformOrigin: "50% 50%" });
    const name = SplitText.create(intro.querySelector(".lockup__name"), { type: "chars", mask: "chars", charsClass: "char" });
    const tag  = SplitText.create(intro.querySelector(".lockup__tag"),  { type: "chars", charsClass: "char" });
    gsap.set(name.chars, { yPercent: -110 });
    gsap.set(tag.chars,  { scale: 0, transformOrigin: "50% 50%" });

    gsap.timeline({ scrollTrigger: { trigger: section, start: "top 30%", once: true } })
        .to(shield, { autoAlpha: 1, scale: 1, duration: 0.5, ease: "back.out(1.4)" })
        .to(name.chars, { yPercent: 0, duration: 0.4, ease: "power2.out", stagger: 0.035 }, "-=0.2")
        .to(tag.chars, { scale: 1, duration: 0.25, ease: "back.out(1.7)", stagger: 0.012 }, "-=0.25")
        .to(intro, { autoAlpha: 0, duration: 0.35, ease: "power2.in" }, "+=0.6")
        .to(section, { backgroundColor: "#FFFFFF", duration: 0.5, ease: "power2.inOut" }, "<")
        .add(() => {
            section.classList.remove("is-intro");                 /* the stylesheet's white takes over */
            gsap.set(section, { clearProps: "backgroundColor" });
            name.revert(); tag.revert();
        })
        .to(items, { autoAlpha: 1, y: 0, duration: 0.35, ease: "power2.out", stagger: 0.04, clearProps: "transform" });
}

function shieldCard() {
    if (!window.matchMedia("(min-width: 1024px)").matches) { contactIntroSmall(); return; }
    const card = document.querySelector(".shield-card");
    if (!card || reduceMotion) return;
    const left    = card.querySelector(".shield-card__cap--left");
    const right   = card.querySelector(".shield-card__cap--right");
    const panel   = card.querySelector(".shield-card__panel");
    const content = card.querySelector(".shield-card__content");
    const lockup  = card.querySelector(".shield-card__lockup");

    const H = card.offsetHeight;
    const cap = left.offsetWidth;
    const SHIELD_H = Math.min(240, H * 0.3);            /* the whole shield's size at rest */
    const halfW = SHIELD_H * (110 / 231);               /* a half's true width at that height */
    const shift = card.offsetWidth / 2 - cap;           /* from the card's edge to the centre line */
    /* the shield's FULL size: as tall as the card, in true proportions,
       unless that would be wider than the card (phones), in which case
       as wide as the card */
    const fullScale = Math.min(1, card.offsetWidth / (2 * H * (110 / 231)));
    const fullSY = fullScale;
    const fullSX = fullScale * (H * (110 / 231)) / cap;

    /* rest: the two halves touch at the centre line as one shield in
       its true proportions, vertically centred in the card's area, with
       the wordmark just under it. Origins sit on the inner edges so
       scaling keeps the halves touching. */
    /* where the shield rests: the card's centre on desktop, but on a phone
       the card is several screens tall, so it rests about 45vh below the
       card's top instead. Every transform origin uses this same point, and
       scaling back to 1 restores the full element whatever the origin. */
    const restY = Math.min(0.5, (window.innerHeight * 0.45) / H);
    const oy = (restY * 100).toFixed(2) + "%";
    gsap.set(left,  { transformOrigin: "100% " + oy, x:  shift, scaleX: halfW / cap, scaleY: SHIELD_H / H });
    gsap.set(right, { transformOrigin: "0% " + oy,   x: -shift, scaleX: halfW / cap, scaleY: SHIELD_H / H });
    gsap.set(panel, { transformOrigin: "50% " + oy, scaleX: 0, scaleY: SHIELD_H / H });
    /* the wordmark hangs 18px under the shield as rendered (measured,
       not computed: the rest point and the scaled cap do not always
       agree to the pixel on tall phone cards) */
    const capBox = left.getBoundingClientRect(), cardBox = card.getBoundingClientRect();
    gsap.set(lockup, { y: capBox.bottom - cardBox.top + 18 - H / 2, autoAlpha: 1 });

    /* THE CONTENT arrives only after the panel is fully open (so it is
       never seen stretched with the panel's scale): every block of the
       form and the side column, in top-to-bottom order across both
       columns, fades in with a short stagger. */
    const items = [...content.querySelectorAll(
        ".contact-card__main > :not(form), .form > :not(input):not(.form__hp), .contact-card__side > *"
    )].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    gsap.set(items, { autoAlpha: 0, y: 10 });

    /* THE WORDMARK. INTEGRITY: each letter sits in a mask exactly its
       own height and drops into it from above, so it appears out of
       nothing along its own top edge, left to right. The tagline: each
       letter scales into place, left to right. Reverted after the
       sequence so nothing odd is left in the DOM. */
    const name = SplitText.create(lockup.querySelector(".lockup__name"), { type: "chars", mask: "chars", charsClass: "char" });
    const tag  = SplitText.create(lockup.querySelector(".lockup__tag"),  { type: "chars", charsClass: "char" });
    gsap.set(name.chars, { yPercent: -110 });
    gsap.set(tag.chars,  { scale: 0, transformOrigin: "50% 50%" });

    gsap.timeline({
        scrollTrigger: { trigger: card, start: `top+=${Math.round(restY * H)} 60%`, once: true },   /* the rest point reaches 60% of the screen */
        defaults: { ease: "power3.inOut" },
        onComplete() { name.revert(); tag.revert(); }
    })
    /* 1. INTEGRITY drops in, letter by letter */
    .to(name.chars, { yPercent: 0, duration: 0.4, ease: "power2.out", stagger: 0.035 }, 0)
    /* 2. the tagline scales in, letter by letter */
    .to(tag.chars, { scale: 1, duration: 0.25, ease: "back.out(1.7)", stagger: 0.012 }, 0.3)
    /* 3. a beat with the whole lockup on screen, then the text fades */
    .to(lockup, { autoAlpha: 0, duration: 0.3, ease: "power2.in" }, "+=0.5")
    /* 4. one even swell to the shield's full size, still whole */
    .to([left, right], { scaleX: fullSX, scaleY: fullSY, duration: 0.9, ease: "power2.inOut" }, "<+=0.05")
    .to(panel, { scaleY: fullSY, duration: 0.9, ease: "power2.inOut" }, "<")
    /* 5. it sits a moment, then opens sideways: the halves glide to the
          edges (finishing any height still owed on phones) and the
          white panel opens between them, empty */
    .to([left, right], { x: 0, scaleX: 1, scaleY: 1, duration: 0.85, ease: "power2.inOut" }, "+=0.2")
    .to(panel, { scaleX: 1, scaleY: 1, duration: 0.85, ease: "power2.inOut" }, "<")
    /* 6. the fields fill the white space, top to bottom */
    .to(items, { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out", stagger: 0.045, clearProps: "transform" }, "+=0.05");
}

/* ---------- MEET PHIL: the two-column story ----------
   Each beat arrives once: the photo wipes in from its outer edge while
   it settles from a slight zoom, and the copy slides in from the other
   side, line by line. From tablet up the two columns also drift past
   each other with the scroll (the photo down-to-up, the copy the other
   way), so the pair reads as two planes. Reduced motion: static. */
/* where the three stacked prints rest, bottom to top (mirrored in the CSS
   nth-child transforms for the static page) */
const STACK_REST = [{ x: -20, y: 14, rotation: -5 }, { x: 16, y: -12, rotation: 3.5 }, { x: 0, y: 0, rotation: 0 }];

/* ---------- MEET PHIL: cycling the stack ----------
   A round button in the stack's bottom right. Each press slides the top
   print out to the right, tucks it under the pile, and moves the other
   two up a place, so the next photo is on top. Works with reduced
   motion too (the moves are instant). */
function stackCycle() {
    const stack = document.querySelector("[data-stack]");
    if (!stack) return;
    const photos = [...stack.querySelectorAll(".stack__photo")];
    if (photos.length < 2) return;
    const order = photos.map((_, k) => k);                          /* bottom to top */
    order.forEach((idx, pos) => gsap.set(photos[idx], { zIndex: pos + 1 }));

    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "stack__next";
    btn.setAttribute("aria-label", "Flip through the photos of the crew at work");
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true"); svg.setAttribute("focusable", "false");
    const path = document.createElementNS(NS, "path");               /* two layers and an arrow: next in the pile */
    path.setAttribute("d", "M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5M3 17.5l9 5 9-5");
    path.setAttribute("fill", "none"); path.setAttribute("stroke", "currentColor"); path.setAttribute("stroke-width", "1.8");
    path.setAttribute("stroke-linecap", "round"); path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path); btn.appendChild(svg);
    const label = document.createElement("span");                   /* "Tap" where there is no mouse */
    label.textContent = window.matchMedia("(hover: none)").matches ? "Tap to flip through" : "Click to flip through";
    btn.appendChild(label); stack.appendChild(btn);

    let busy = false;
    btn.addEventListener("click", () => {
        if (busy) return;
        busy = true;
        const d = reduceMotion ? 0 : 0.95;
        const top = order.pop(); order.unshift(top);                /* the top print goes to the back */
        const tl = gsap.timeline({ onComplete() { busy = false; } });
        tl.to(photos[top], { x: stack.offsetWidth * 0.62, y: -18, rotation: 10, duration: d * 0.42, ease: "power2.in" })
          .add(() => order.forEach((idx, pos) => gsap.set(photos[idx], { zIndex: pos + 1 })))
          .to(photos[top], { ...STACK_REST[0], duration: d * 0.58, ease: "power2.out" });
        order.slice(1).forEach((idx, k) => tl.to(photos[idx], { ...STACK_REST[k + 1], duration: d * 0.7, ease: "power2.inOut" }, 0));
    });
}

function philStory() {
    const beats = [...document.querySelectorAll(".beat")];
    if (!beats.length || reduceMotion) return;
    beats.forEach((beat, i) => {
        const step  = beat.querySelector(".beat__step");
        const title = beat.querySelector(".beat__title");
        const paras = beat.querySelectorAll(".beat__body > p:not(.beat__step)");
        const stack = beat.querySelector("[data-stack]");

        if (stack) {
            /* THE WORK: the three photos fly in from beyond the left edge,
               one after another, each landing on the pile; the last lands
               on top, square to the frame. Only then does the text type
               itself out, like the first beat. Its last word, "integrity",
               is typed, backspaced under a cursor, and retyped bold in the
               wordmark's red. Once, no loop. Resting transforms match CSS. */
            const photos = [...stack.querySelectorAll(".stack__photo")];
            const caption = beat.querySelector(".beat__caption");
            const next = stack.querySelector(".stack__next");          /* the cycle button arrives with the caption */
            photos.forEach((ph) => { ph.loading = "eager"; });
            const away = () => -(stack.getBoundingClientRect().left + stack.offsetWidth + 80);   /* fully off the left of the screen */
            photos.forEach((ph, k) => gsap.set(ph, { x: away(), y: STACK_REST[k].y + 30, rotation: STACK_REST[k].rotation - 14, autoAlpha: 0 }));
            gsap.set(caption, { autoAlpha: 0, y: 14 });
            if (next) gsap.set(next, { autoAlpha: 0, scale: 0.6 });

            /* the copy, split for typing (same as the first beat) */
            const titleSplit = SplitText.create(title, { type: "chars", charsClass: "tchar" });
            const paraSplits = [...paras].map((p) => SplitText.create(p, { type: "words", wordsClass: "tword" }));
            gsap.set(step, { autoAlpha: 0 });
            gsap.set(titleSplit.chars, { autoAlpha: 0 });
            paraSplits.forEach((s) => gsap.set(s.words, { autoAlpha: 0 }));
            /* the word to retype: typed by hand below, so it leaves the word-by-word run,
               and so does whatever follows it (the full stop) */
            const retype = beat.querySelector("[data-retype]");
            const rWord  = retype && retype.querySelector(".tword");
            const rText  = rWord ? rWord.textContent : "";
            const runs = paraSplits.map((s) => [...s.words]);     /* what the word-by-word run types, per paragraph */
            let tail = [];
            if (rWord) {
                const last = runs[runs.length - 1];
                const at = last.indexOf(rWord);
                tail = last.slice(at + 1);
                runs[runs.length - 1] = last.slice(0, at);
            }

            const tl = gsap.timeline({
                scrollTrigger: { trigger: beat, start: "top 92%", once: true },   /* as soon as it enters: nothing should sit empty on screen */
                onComplete() {
                    titleSplit.revert(); paraSplits.forEach((s) => s.revert());   /* back to plain markup: the word rests bold and red via CSS */
                }
            });
            photos.forEach((ph, k) => {
                tl.set(ph, { autoAlpha: 1 }, k * 0.42)
                  .to(ph, { ...STACK_REST[k], duration: 1.05, ease: "power3.out" }, k * 0.42);
            });
            tl.to(caption, { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out" }, "-=0.35");
            if (next) tl.to(next, { autoAlpha: 1, scale: 1, duration: 0.45, ease: "back.out(2)", clearProps: "transform" }, "<");
            tl.to(step, { autoAlpha: 1, duration: 0.3 }, "-=0.2")
              .to(titleSplit.chars, { autoAlpha: 1, duration: 0.01, stagger: 0.035 }, "<0.15");
            runs.forEach((words) => tl.to(words, { autoAlpha: 1, duration: 0.01, stagger: 0.022 }, "+=0.15"));

            if (rWord) {
                const cursor = document.createElement("span");
                cursor.className = "type-cursor"; cursor.setAttribute("aria-hidden", "true"); cursor.textContent = "|";
                const show = (n) => () => { rWord.textContent = rText.slice(0, n); };
                tl.call(() => {                                    /* plain first, empty, cursor on */
                    retype.classList.add("is-plain"); rWord.textContent = ""; gsap.set(rWord, { autoAlpha: 1 }); retype.after(cursor);
                }, null, "+=0.05");
                for (let n = 1; n <= rText.length; n++) tl.call(show(n), null, "+=0.1125");            /* type it (2/3 of the first speed, user asked) */
                tl.call(() => {}, null, "+=1.0");                                                      /* look at it */
                for (let n = rText.length - 1; n >= 0; n--) tl.call(show(n), null, "+=0.075");         /* backspace */
                tl.call(() => retype.classList.remove("is-plain"), null, "+=0.35");                    /* now bold, in the wordmark's red */
                for (let n = 1; n <= rText.length; n++) tl.call(show(n), null, "+=0.165");             /* retype, a touch slower */
                tl.to(tail, { autoAlpha: 1, duration: 0.01 }, "+=0.25")                                /* the full stop */
                  .call(() => cursor.remove(), null, "+=1.6");                                         /* a few blinks, then the cursor goes */
            }
            return;
        }

        const media  = beat.querySelector(".beat__media");
        const photos = beat.querySelectorAll(".beat__photo");        /* both photos in the morph frame */
        const photoRight = i % 2 === 1;                      /* even beats: photo left; odd: photo right */
        const wipe = { p: 0 };
        const draw = () => { const hid = ((1 - wipe.p) * 100).toFixed(3) + "%"; media.style.clipPath = photoRight ? `inset(0 0 0 ${hid})` : `inset(0 ${hid} 0 0)`; };
        draw();
        gsap.set(photos, { scale: 1.12, transformOrigin: "50% 50%" });

        /* THE COPY TYPES ITSELF OUT: the title letter by letter, then each
           paragraph word by word in reading order. No motion, just each
           piece switching on, so it reads as typing. Reverted after. */
        const titleSplit = SplitText.create(title, { type: "chars", charsClass: "tchar" });
        const paraSplits = [...paras].map((p) => SplitText.create(p, { type: "words", wordsClass: "tword" }));
        gsap.set(step, { autoAlpha: 0 });
        gsap.set(titleSplit.chars, { autoAlpha: 0 });
        paraSplits.forEach((s) => gsap.set(s.words, { autoAlpha: 0 }));

        const tl = gsap.timeline({
            scrollTrigger: { trigger: beat, start: "top 72%", once: true },
            onComplete() { titleSplit.revert(); paraSplits.forEach((s) => s.revert()); }
        });
        tl.to(wipe, { p: 1, duration: 1.0, ease: "power3.inOut", onUpdate: draw, onComplete: () => { media.style.clipPath = ""; } })
          .to(photos, { scale: 1, duration: 1.4, ease: "power2.out", clearProps: "transform" }, 0)
          .to(step, { autoAlpha: 1, duration: 0.3 }, 0.3)
          .to(titleSplit.chars, { autoAlpha: 1, duration: 0.01, stagger: 0.035 }, 0.45);
        paraSplits.forEach((s) => tl.to(s.words, { autoAlpha: 1, duration: 0.01, stagger: 0.022 }, "+=0.15"));
    });
    /* THE COLUMNS SETTLE INTO PLACE (from 768px, where they sit side by side).
       As a beat rises into view its text starts high and its photo low; they
       slide to their resting places as you scroll and are home by the time
       the beat's top reaches 40% of the screen, then hold still. The text
       rides up inside the spare height of its own row (it is centred beside
       a taller photo), so it fills the quiet stretch between the beats
       without touching the beat above. Holding still afterwards matters:
       the marker arrow is anchored to the settled text. */
    gsap.matchMedia().add("(min-width: 768px)", () => {
        /* CLOSING THE GAP, measured. The work beat is pulled up under the first
           beat, and its text also rides up while it glides in; both spend the
           same free space, so both come from one measurement: the smaller of
           (work text top - the first beat's photo caption) and (the stack's
           top - the first beat's text), taken now, while the tall portrait is
           showing (the worst case), less a 40px margin. 60% of it is the
           pull-up, the rest is the most the text may lift. On a short window
           that room is small and both shrink with it; fixed numbers clashed. */
        const work  = beats.find((bt) => bt.classList.contains("beat--work"));
        const first = work && work.previousElementSibling;
        let workLift = 0;
        if (work && first) {
            work.style.marginTop = "";
            const capB = first.querySelector(".beat__caption").getBoundingClientRect().bottom;
            const txtB = first.querySelector(".beat__body").getBoundingClientRect().bottom;
            const wTxt = work.querySelector(".beat__body").getBoundingClientRect().top;
            const wPic = work.querySelector(".beat__media").getBoundingClientRect().top;
            const room = Math.max(0, Math.min(wTxt - capB, wPic - txtB) - 40);
            const tuck = Math.min(180, room * 0.6);
            work.style.marginTop = (-tuck).toFixed(0) + "px";
            workLift = Math.min(100, room - tuck);
        }
        beats.forEach((beat) => {
            const media = beat.querySelector(".beat__media"), body = beat.querySelector(".beat__body");
            const spare = Math.max(0, (beat.offsetHeight - body.offsetHeight) / 2);        /* room above the centred text, inside its own row */
            /* the first beat's text is top-aligned (nothing above it but the section head), so it only lifts a little */
            const lift = beat.querySelector("[data-morph]") ? 50 : Math.max(0, Math.min(workLift, spare * 0.9));
            const st = { trigger: beat, start: "top bottom", end: "top 40%", scrub: 0.4 };
            gsap.fromTo(body,  { y: -lift }, { y: 0, ease: "power1.out", scrollTrigger: st });
            gsap.fromTo(media, { y: 70 },    { y: 0, ease: "power1.out", scrollTrigger: st });
        });
        return () => { if (work) work.style.marginTop = ""; };
    });
}

/* ---------- MEET PHIL: the frame that reshapes ----------
   TIMED, not tied to scrolling. When the stage comes into view the
   frame is portrait-shaped (66% of the stage wide, 3:4) showing Phil
   whole. It holds on him for a few seconds, then on its own widens to
   the full stage and flattens to 3:2 while Phil crossfades to the
   family photo. Once; it stays on the family. The stage's own size
   never changes, so the page below holds still. One number drives the
   width, the shape, both opacities and the caption. */
function philMorph() {
    const stage = document.querySelector("[data-morph]");
    if (!stage || reduceMotion) return;
    const frame   = stage.querySelector(".morph__frame");
    const self    = stage.querySelector(".morph__img--self");
    const family  = stage.querySelector(".morph__img--family");
    const caption = stage.querySelector(".beat__caption");
    [self, family].forEach((im) => { im.loading = "eager"; });
    stage.classList.add("is-live");
    const m = { p: 0 };
    const fade = gsap.utils.clamp(0, 1);
    function render() {
        const p = m.p;
        frame.style.width = (66 + 34 * p).toFixed(3) + "%";
        frame.style.aspectRatio = (0.75 + 0.75 * p).toFixed(4);              /* 3:4 (0.75) to 3:2 (1.5) */
        const x = fade((p - 0.3) / 0.45);                                   /* the crossfade sits in the middle of the reshape */
        self.style.opacity = (1 - x).toFixed(3);
        family.style.opacity = x.toFixed(3);
        const cap = x < 0.5 ? caption.dataset.capSelf : caption.dataset.capFamily;
        if (caption.textContent !== cap) caption.textContent = cap;
    }
    render();
    gsap.to(m, { p: 1, duration: 1.9, ease: "power3.inOut", delay: 3.2, onUpdate: render,   /* the hold on Phil, then the warp */
        scrollTrigger: { trigger: stage, start: "top 72%", once: true } });
}

/* ---------- MEET PHIL: the arrow to the estimate button ----------
   A thin black line from under the work text: a small rise, a smooth S
   down to the right, then a level run into a symmetrical head aimed at
   the button. It is built from where the text and the button ACTUALLY
   sit, in the pixel space of the section's inner box, and rebuilt on
   resize. The text's resting place is used (its parallax offset is
   subtracted), so the arrow never anchors to a paragraph that is still
   gliding into position. Tied to SCROLL POSITION: it draws itself (the
   line, then the head) when the button reaches the middle of the
   screen. Hidden where there is no room (phones). Reduced motion: shown
   at once, no animation. */
function ctaArrow() {
    const box = document.querySelector("#meet-phil .section__inner");
    const btn = document.querySelector(".about__cta");
    if (!box || !btn) return;
    const NS = "http://www.w3.org/2000/svg";
    const el = (name, attrs) => { const n = document.createElementNS(NS, name); Object.entries(attrs || {}).forEach(([k, v]) => n.setAttribute(k, v)); return n; };
    const svg = el("svg", { class: "cta-arrow", "aria-hidden": "true", focusable: "false" });
    const shaft = el("path", { class: "cta-arrow__shaft" });
    const head  = el("path", { class: "cta-arrow__head" });
    svg.appendChild(shaft); svg.appendChild(head); box.appendChild(svg);
    const strokes = [shaft, head];
    let drawn = false;

    function build() {
        const word = document.querySelector("[data-retype]");
        const body = word.closest(".beat__body");
        const drift = Number(gsap.getProperty(body, "y")) || 0;                       /* the text's current parallax offset */
        const c = box.getBoundingClientRect(), w = word.getBoundingClientRect(), b = btn.getBoundingClientRect();
        const para = word.closest("p").getBoundingClientRect();
        const tx = b.left - c.left - 22, ty = b.top + b.height / 2 - c.top;          /* the point, a short gap before the button */
        const left = para.left - c.left;                                             /* the text column's left edge */
        /* start a little in from the word when it begins a line (or sits near
           the left); otherwise from the left end of that same last line. The
           word may still be mid-typing (empty), so the paragraph's own bottom
           gives the height */
        const wordAt = w.width > 0 ? w.left - c.left : left;
        const sx = (wordAt - left < 200 ? wordAt : left) + 24;
        const sy = para.bottom - drift - c.top + 30;                                 /* under the last line, at the text's RESTING position */
        const dx = tx - sx, dy = ty - sy;
        const fits = dx >= 220 && dy > 50 && window.innerWidth >= 768;
        svg.style.display = fits ? "" : "none";
        if (!fits) return false;

        const P = (fx, fy, base) => `${(sx + fx * dx).toFixed(1)} ${((base === "t" ? ty : sy) + fy * dy).toFixed(1)}`;
        shaft.setAttribute("d",
            `M ${P(0, 0)} C ${P(0.14, -0.10)} ${P(0.28, 0.05)} ${P(0.36, 0.55)} ` +
            `C ${P(0.42, 0.95)} ${P(0.52, 0.08, "t")} ${P(0.66, 0.06, "t")} ` +
            `C ${P(0.78, 0.045, "t")} ${P(0.88, 0, "t")} ${tx.toFixed(1)} ${ty.toFixed(1)}`);      /* the last control point is level with the tip: it arrives dead horizontal */
        /* the head: one chevron, mirror-symmetrical about the level shaft */
        const LEN = 15, RISE = 10;
        head.setAttribute("d", `M ${(tx - LEN).toFixed(1)} ${(ty - RISE).toFixed(1)} L ${tx.toFixed(1)} ${ty.toFixed(1)} L ${(tx - LEN).toFixed(1)} ${(ty + RISE).toFixed(1)}`);

        strokes.forEach((pth) => {
            const L = pth.getTotalLength() + 4;                                      /* +4: keeps the round cap hidden until its stroke starts */
            pth.style.strokeDasharray = L;
            pth.style.strokeDashoffset = drawn ? 0 : L;
            pth.style.visibility = drawn ? "visible" : "hidden";
        });
        return true;
    }

    function draw() {
        if (drawn) return;
        if (!build()) return;
        drawn = true;
        shaft.style.visibility = "visible";
        if (reduceMotion) { head.style.visibility = "visible"; strokes.forEach((pth) => { pth.style.strokeDashoffset = 0; }); return; }
        gsap.timeline()
            .to(shaft, { strokeDashoffset: 0, duration: 1.7, ease: "power2.inOut" })
            .set(head, { visibility: "visible" })
            .to(head, { strokeDashoffset: 0, duration: 0.45, ease: "power2.out" });
    }

    build();
    if (reduceMotion) { draw(); }
    else ScrollTrigger.create({ trigger: btn, start: "center center", once: true, onEnter: draw });   /* the button reaches mid-screen */
    let timer;
    window.addEventListener("resize", () => { clearTimeout(timer); timer = setTimeout(build, 200); });
}

/* ---------- QUALIFICATIONS: the badges converge, then the words ----------
   Each badge column starts out of line, the first and third high, the
   second and fourth low, each by its own amount, and slides into line as
   the section scrolls to the centre of the screen (scrubbed, so it
   tracks the scroll exactly). The moment they line up, the head
   arrives once: the eyebrow, the title's words rising out of their
   masks, then the paragraph. Reduced motion: everything just shows. */
function qualsIntro() {
    const section = document.querySelector(".section--quals");
    if (!section || reduceMotion) return;
    /* first and third start high (the first highest), second and fourth
       start low (the fourth lowest): each pair a little different */
    const wide = window.matchMedia("(min-width: 1024px)").matches;
    const offsets = wide ? [-280, 230, -210] : [-120, 100, -90];   /* narrow: shorter columns, shorter sweep */
    const row = section.querySelector(".badges");                    /* the triggers follow the badge row: the claims card below makes the section taller than a screen */
    const badges = [...section.querySelectorAll(".badges .badge")];
    const slides = badges.map((badge, i) => gsap.fromTo(badge, { y: offsets[i % offsets.length] }, {
        y: 0, ease: "none",
        scrollTrigger: { trigger: row, start: "top 110%", end: "center 62%", scrub: 0.6 }
    }));
    /* once they meet, they lock: the scroll no longer moves them, so
       scrolling back up cannot fan them out over the revealed head */
    const lock = () => {
        slides.forEach((t) => { t.scrollTrigger.kill(); t.kill(); });
        gsap.set(badges, { y: 0 });
    };

    const eyebrow = section.querySelector(".section__eyebrow");
    const title   = section.querySelector(".section__title");
    const lede    = section.querySelector(".section__lede");
    gsap.set([eyebrow, lede], { autoAlpha: 0, y: 14 });
    const words = SplitText.create(title, { type: "words", mask: "words", wordsClass: "qword" });
    gsap.set(words.words, { yPercent: 110 });
    gsap.timeline({
        scrollTrigger: { trigger: row, start: "center 64%", once: true },
        onStart: lock,
        onComplete() { words.revert(); }
    })
    .to(eyebrow, { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out" })
    .to(words.words, { yPercent: 0, duration: 0.6, ease: "power3.out", stagger: 0.14 }, "<0.1")
    .to(lede, { autoAlpha: 1, y: 0, duration: 0.6, ease: "power2.out" }, "-=0.2");

    /* the insurance row rises in: the badge, then the two photos, then the words */
    const claim = section.querySelector(".claim");
    if (claim) {
        const parts = [claim.querySelector(".claim__badge"), ...claim.querySelectorAll(".claim__photo"), claim.querySelector(".claim__body")];
        gsap.set(parts, { autoAlpha: 0, y: 36 });
        ScrollTrigger.create({ trigger: claim, start: "top 82%", once: true,
            onEnter: () => gsap.to(parts, { autoAlpha: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.14, clearProps: "transform" }) });
    }
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
    const targets = ".section__head:not(.reviews-head):not(.quals-head), .placeholder .section__inner, .service, .segments, .panel:not([hidden]), .about__cta-row, .areas__body" + (window.matchMedia("(min-width: 768px)").matches ? ", .check__panel" : "");   /* phones: the panel is a CSS-driven sheet */   /* qualifications run their own entrance (qualsIntro) */   /* the contact card is excluded: the pour is its entrance, and a translated card would throw the tint projection off */
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
    pairHint();
    jobDialog();
    reviewCarousel();
    serviceMap();
    contactForm();
    shieldCard();
    homeButton(); heroScroll(); philMorph();
    stackCycle();
    philStory();
    ctaArrow();
    qualsIntro();
    sectionReveals();
    sectionFades();
});
