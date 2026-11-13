// One requestAnimationFrame loop for the whole page, so everything moves in the same frame and in a fixed order:
// 0 smooth scroll, 1 hero progress, 2 the 3D city, 3 the WebGL images. Separate loops drift a frame apart,
// which shows up as jitter between the canvas and the DOM.

type Fn = (time: number, dt: number) => void;
const subs: { fn: Fn; order: number }[] = [];
let raf = 0;
let last = 0;

function loop(time: number) {
  raf = requestAnimationFrame(loop);
  const dt = last ? Math.min((time - last) / 1000, 0.1) : 1 / 60;
  last = time;
  for (const s of subs) s.fn(time, dt);
}

export function onFrame(fn: Fn, order: number): () => void {
  subs.push({ fn, order });
  subs.sort((a, b) => a.order - b.order);
  if (!raf) raf = requestAnimationFrame(loop);
  return () => {
    const i = subs.findIndex((s) => s.fn === fn);
    if (i >= 0) subs.splice(i, 1);
    if (!subs.length) {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    }
  };
}
