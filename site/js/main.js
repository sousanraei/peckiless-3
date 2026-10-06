// Boots the film: builds one layer per scene, one master timeline with a
// label per scene, and binds it to native scroll via ScrollTrigger (scrub).
import { SCENES, BREAKPOINT, SCRUB } from './config.js';
import { buildShared } from './shared.js';
import { fitAll } from './lib/fit.js';
import { initDebug } from './debug.js';

const { gsap, ScrollTrigger, MotionPathPlugin, DrawSVGPlugin } = window;
gsap.registerPlugin(ScrollTrigger, MotionPathPlugin, DrawSVGPlugin);

const stage = document.getElementById('stage');
const track = document.getElementById('track');

// Load scene modules declared in config (null → empty layer for now).
const none = { build() {} };
const modules = await Promise.all(
  SCENES.map((s) => (s.module ? import(`./scenes/${s.module}`) : none))
);

const app = { master: null, trigger: null, scenes: SCENES };
window.__film = app; // handy for console debugging

const mm = gsap.matchMedia();
mm.add(
  {
    isDesktop: `(min-width: ${BREAKPOINT}px)`,
    isMobile: `(max-width: ${BREAKPOINT - 1}px)`,
    reduced: '(prefers-reduced-motion: reduce)',
  },
  (mmCtx) => {
    const { isMobile, reduced } = mmCtx.conditions;
    document.documentElement.classList.toggle('is-reduced', reduced);
    stage.replaceChildren();

    const unitsOf = (s) => (isMobile && s.mobileUnits) || s.units;
    const total = SCENES.reduce((sum, s) => sum + unitsOf(s), 0);
    track.style.setProperty('--track-units', reduced ? 0 : total);

    // Master timeline: 1 second of timeline = 1 viewport of scroll.
    const master = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
    let at = 0;
    SCENES.forEach((scene) => {
      master.addLabel(scene.id, at);
      at += unitsOf(scene);
    });
    master.addLabel('end', at);

    SCENES.forEach((scene, i) => {
      const layer = document.createElement('section');
      layer.className = `layer layer--${scene.id}`;
      layer.dataset.scene = scene.id;
      layer.setAttribute('aria-label', scene.title);
      stage.append(layer);
      modules[i].build(master, {
        scene,
        layer,
        stage,
        isMobile,
        reduced,
        duration: unitsOf(scene),
        start: master.labels[scene.id],
      });
    });
    buildShared(stage, master, { isMobile, reduced });
    fitAll(document);
    // Decode every stage image up front so hidden layers paint instantly when
    // they are cut to (they start visibility:hidden, which defers decoding).
    stage.querySelectorAll('img').forEach((img) => img.decode?.().catch(() => {}));

    // Pad the timeline so its length always equals the scroll length.
    master.set({}, {}, at);
    app.master = master;

    if (!reduced) {
      app.trigger = ScrollTrigger.create({
        trigger: track,
        start: 'top top',
        end: 'bottom bottom',
        scrub: SCRUB,
        animation: master,
      });
    }

    return () => {
      app.trigger = null;
      app.master = null;
    };
  }
);

initDebug(app);
