// Boots the film: builds one layer per scene, one master timeline with a
// label per scene, and binds it to native scroll via ScrollTrigger (scrub).
import { SCENES, MOBILE_QUERY, REDUCED_QUERY, SCRUB } from './config.js';
import { buildShared } from './shared.js';
import { fitAll } from './lib/fit.js';
import { initDebug } from './debug.js';
import { reveal } from './lib/reveal.js';

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
    isDesktop: `not all and ${MOBILE_QUERY}`,
    isMobile: MOBILE_QUERY,
    reduced: REDUCED_QUERY,
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

    // Teardown for things the matchMedia context can't revert itself
    // (ticker callbacks); scenes register them with ctx.onCleanup(fn).
    const cleanups = [];
    const onCleanup = (fn) => cleanups.push(fn);

    const ctxs = SCENES.map((scene, i) => {
      const layer = document.createElement('section');
      layer.className = `layer layer--${scene.id}`;
      layer.dataset.scene = scene.id;
      layer.dataset.kind = scene.kind;
      layer.setAttribute('aria-label', scene.title);
      stage.append(layer);
      const ctx = {
        scene,
        layer,
        stage,
        isMobile,
        reduced,
        duration: unitsOf(scene),
        start: master.labels[scene.id],
        onCleanup,
      };
      modules[i].build(master, ctx);
      return ctx;
    });
    buildShared(stage, master, { isMobile, reduced });
    // Optional second pass, once every layer exists: transitions that drive
    // elements of their neighbouring scenes export link(tl, ctx).
    modules.forEach((m, i) => m.link?.(master, ctxs[i]));
    fitAll(document);
    // Images are decoding="async"; decode them off the critical path (idle)
    // so hidden layers still paint instantly when they are cut to (they start
    // visibility:hidden, which would otherwise defer decoding to first paint).
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
    stage.querySelectorAll('img').forEach((img) => {
      img.decoding = 'async';
      idle(() => img.decode?.().catch(() => {}));
    });

    // Pad the timeline so its length always equals the scroll length.
    master.set({}, {}, at);
    app.master = master;

    // will-change only around the playhead (T15): the active layer and its
    // neighbours get .is-live (css/scenes.css lists what it promotes).
    if (!reduced) {
      const layers = SCENES.map((s) => stage.querySelector(`:scope > .layer--${s.id}`));
      const starts = SCENES.map((s) => master.labels[s.id]);
      let live = -2;
      const markLive = () => {
        const t = master.time();
        const i = starts.findLastIndex((s) => s <= t + 1e-6);
        if (i === live) return;
        live = i;
        layers.forEach((l, j) => l.classList.toggle('is-live', Math.abs(j - i) <= 1));
      };
      master.eventCallback('onUpdate', markLive);
      markLive();
    }

    // Reduced motion: no scroll binding; each stacked scene fades in once.
    const unreveal = reduced ? reveal(stage) : null;
    if (!reduced) {
      app.trigger = ScrollTrigger.create({
        trigger: track,
        start: 'top top',
        end: 'bottom bottom',
        scrub: SCRUB,
        animation: master,
      });
      // Warm-up (T15): GSAP initialises each tween on its first render (reads
      // computed styles, parses paths), which cost 5–37ms frames the first
      // time a scene was scrolled into. Render the whole film once, at an idle
      // moment, then return to where the reader is (same task, so no paint).
      idle(() => {
        if (app.master !== master) return;
        const t = master.time();
        master.progress(1);
        master.time(t);
      }, { timeout: 2000 });
    }

    return () => {
      cleanups.forEach((fn) => fn());
      unreveal?.();
      app.trigger = null;
      app.master = null;
    };
  }
);

initDebug(app);
