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

/* ---------- SECTION FADE-INS (ScrollTrigger) ----------
   Empty shells for now; batch handles however many we add later. */
function sectionReveals() {
    if (reduceMotion) return;
    gsap.set(".section__inner", { autoAlpha: 0, y: 24 });
    ScrollTrigger.batch(".section__inner", {
        start: "top 80%",
        once: true,
        onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, duration: 0.8, ease: "power2.out", stagger: 0.1 })
    });
}

/* ---------- BOOT ---------- */
document.fonts.ready.then(() => {
    document.querySelectorAll("[data-roll]").forEach(rollingText);
    heroIntro();
    sectionReveals();
});
