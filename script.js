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

/* ---------- SECTION FADE-INS (ScrollTrigger) ----------
   Empty shells for now; batch handles however many we add later. */
function sectionReveals() {
    if (reduceMotion) return;
    /* section heads and the service blocks reveal separately so the
       four blocks can cascade instead of arriving as one slab */
    const targets = ".section__head, .placeholder .section__inner, .service, .segments, .panel:not([hidden]), .review";
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
    sectionReveals();
});
