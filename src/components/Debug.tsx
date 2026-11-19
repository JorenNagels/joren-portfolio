'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A console you can read on someone else's phone. Open any page with `?debug=1` and a panel comes down over the
 * top with what the graphics card says it is, what size buffer it actually handed out, and every error and lost
 * context since the page opened — then one tap copies the lot to the clipboard to paste into a message.
 *
 * Nothing here runs for an ordinary visitor: without the query the effect returns on its first line and the panel
 * never renders.
 *
 * It is here because the street draws nothing on some Android phones and there is no way to see their console.
 * The things worth reading, in the order they matter:
 *   · `lost` — the context went. Chrome then paints a small sad face where the street was and the page carries on
 *     around it, which is exactly the white screen that was reported.
 *   · `buffer` against `canvas` — what was asked for against what came back. A browser over its limits quietly
 *     hands back something smaller, and three.js never looks (it works out the size from the pixel ratio instead
 *     of reading drawingBufferWidth), so the street would be drawn at one size into a buffer of another.
 *   · `fbo` — whether a multisampled sRGB target, which is what the street draws into, can be made at all.
 *   · `mem` — how much memory the phone admits to. Under about 4GB, with a browserful of tabs behind you, is
 *     where the context starts going.
 */
export function Debug() {
  const [on, setOn] = useState(false);
  const [open, setOpen] = useState(true);
  const [lines, setLines] = useState<string[]>([]);
  const [caps, setCaps] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (!/[?&]debug=1\b/.test(location.search)) return;
    setOn(true);

    // Errors are kept oldest-first and capped: the first one is nearly always the one that matters, and a loop
    // throwing every frame must not push it off the top.
    // Every line carries the second it happened: without it the log says the context went but not what the page was
    // in the middle of, which is the one thing that names a cause.
    const push = (s: string) => setLines((xs) => (xs.length >= 50 ? xs : [...xs, `${(performance.now() / 1000).toFixed(2)}s ${s}`]));
    // What the street marks its allocations through (mark.ts). Installed only here, so without ?debug=1 the street
    // measures and formats nothing.
    (window as unknown as { __mark?: (s: string) => void }).__mark = push;
    const text = (a: unknown) => {
      if (a instanceof Error) return a.message;
      if (typeof a === 'string') return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    };
    // three.js repeats the same shader error every frame; say it once.
    const once = (s: string) => {
      if (seen.current.has(s)) return;
      seen.current.add(s);
      push(s);
    };

    const err = console.error;
    const warn = console.warn;
    console.error = (...a: unknown[]) => {
      once(`ERR ${a.map(text).join(' ').slice(0, 700)}`);
      err(...a);
    };
    console.warn = (...a: unknown[]) => {
      once(`WARN ${a.map(text).join(' ').slice(0, 400)}`);
      warn(...a);
    };
    const onErr = (e: ErrorEvent) => once(`WINDOW ${e.message} @ ${e.filename?.split('/').pop()}:${e.lineno}`);
    const onRej = (e: PromiseRejectionEvent) => once(`REJECTED ${text(e.reason).slice(0, 400)}`);
    addEventListener('error', onErr);
    addEventListener('unhandledrejection', onRej);

    // What the phone is, before any of the street's own code has run.
    const nav = navigator as Navigator & { deviceMemory?: number };
    const first: string[] = [];
    first.push(`ua ${navigator.userAgent.replace(/^Mozilla\/5\.0 \(/, '').slice(0, 140)}`);
    first.push(`dpr ${devicePixelRatio} · window ${innerWidth}x${innerHeight} · screen ${screen.width}x${screen.height}`);
    first.push(`mem ${nav.deviceMemory ?? '?'}GB · cores ${navigator.hardwareConcurrency ?? '?'} · coarse ${matchMedia('(pointer: coarse)').matches} · reduced ${matchMedia('(prefers-reduced-motion: reduce)').matches}`);

    // A context of our own, to ask what this card can do without disturbing the street's.
    const probe = document.createElement('canvas').getContext('webgl2');
    if (!probe) {
      first.push('webgl2 NONE — the street will not run at all here');
    } else {
      const info = probe.getExtension('WEBGL_debug_renderer_info');
      first.push(`gpu ${info ? String(probe.getParameter(info.UNMASKED_RENDERER_WEBGL)).slice(0, 110) : 'hidden'}`);
      first.push(`maxTex ${probe.getParameter(probe.MAX_TEXTURE_SIZE)} · maxRenderbuf ${probe.getParameter(probe.MAX_RENDERBUFFER_SIZE)} · maxSamples ${probe.getParameter(probe.MAX_SAMPLES)} · maxViewport ${probe.getParameter(probe.MAX_VIEWPORT_DIMS)}`);

      // Exactly the kind of target the street draws into: sRGB, multisampled. A driver that cannot make one says
      // so here rather than by drawing nothing.
      const status = (samples: number, srgb: boolean) => {
        const fb = probe.createFramebuffer();
        const rb = probe.createRenderbuffer();
        probe.bindFramebuffer(probe.FRAMEBUFFER, fb);
        probe.bindRenderbuffer(probe.RENDERBUFFER, rb);
        const fmt = srgb ? probe.SRGB8_ALPHA8 : probe.RGBA8;
        if (samples > 0) probe.renderbufferStorageMultisample(probe.RENDERBUFFER, samples, fmt, 1024, 1024);
        else probe.renderbufferStorage(probe.RENDERBUFFER, fmt, 1024, 1024);
        probe.framebufferRenderbuffer(probe.FRAMEBUFFER, probe.COLOR_ATTACHMENT0, probe.RENDERBUFFER, rb);
        const s = probe.checkFramebufferStatus(probe.FRAMEBUFFER);
        const e = probe.getError();
        probe.bindFramebuffer(probe.FRAMEBUFFER, null);
        probe.deleteFramebuffer(fb);
        probe.deleteRenderbuffer(rb);
        const names: Record<number, string> = {
          [probe.FRAMEBUFFER_COMPLETE]: 'ok',
          [probe.FRAMEBUFFER_INCOMPLETE_ATTACHMENT]: 'BAD-ATTACHMENT',
          [probe.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT]: 'NO-ATTACHMENT',
          [probe.FRAMEBUFFER_UNSUPPORTED]: 'UNSUPPORTED',
          [probe.FRAMEBUFFER_INCOMPLETE_MULTISAMPLE]: 'BAD-MULTISAMPLE',
        };
        return `${names[s] ?? s}${e ? `/err${e}` : ''}`;
      };
      first.push(`fbo srgb x0 ${status(0, true)} · x2 ${status(2, true)} · x4 ${status(4, true)} · rgba x2 ${status(2, false)}`);
      probe.getExtension('WEBGL_lose_context')?.loseContext(); // give it straight back; the street needs the memory
    }
    setCaps(first);

    // The canary: a second context, one pixel across, kept alive for the life of the page and never asked to do
    // anything. When the street's context goes, whether this one went with it is the whole question.
    //   · dead too — the GPU process itself came down (a driver reset, a crash, the phone reclaiming it). Nothing
    //     about the street's own footprint caused that, and cutting it would not have helped.
    //   · still alive — Chrome dropped the street's context and left its neighbour standing, which is what it does
    //     when one context asks for more than it is allowed. Then the sizes in the log above are what to cut.
    // Two causes that look identical on screen and want opposite fixes; this is the line that tells them apart.
    const canary = document.createElement('canvas').getContext('webgl2');

    // The street's own canvas, once it has made one: the size it asked for against the size it was given, and
    // whether the context is still there. getContext hands back the one three.js is already using.
    const watched = new WeakSet<HTMLCanvasElement>();
    const look = () => {
      const c = document.querySelector('canvas');
      if (!c) return;
      if (!watched.has(c)) {
        watched.add(c);
        c.addEventListener('webglcontextlost', (e) => {
          // And can a context be had at all, right now? three.js asks for this one back and waits for
          // webglcontextrestored, which on the phone this panel was written for never comes. Asking straight out
          // settles whether building a fresh canvas would get anywhere, before any code is written to try it.
          const fresh = document.createElement('canvas').getContext('webgl2');
          const status = (e as WebGLContextEvent).statusMessage;
          push(
            `LOST the context at ${c.width}x${c.height}` +
              ` · canary ${canary ? (canary.isContextLost() ? 'ALSO DEAD → the whole GPU process went down' : 'alive → this context alone was dropped') : 'none'}` +
              ` · a new context is ${fresh ? 'GRANTED → a rebuilt canvas could work' : 'REFUSED → a rebuilt canvas could not'}` +
              (status ? ` · ${status}` : ''),
          );
          fresh?.getExtension('WEBGL_lose_context')?.loseContext();
        });
        c.addEventListener('webglcontextrestored', () => push('RESTORED'));
        c.addEventListener('webglcontextcreationerror', (e) => push(`NO CONTEXT: ${(e as WebGLContextEvent).statusMessage}`));
      }
      const gl = c.getContext('webgl2') as WebGL2RenderingContext | null;
      const live = [
        `canvas ${c.width}x${c.height} css ${c.clientWidth}x${c.clientHeight} ratio ${(c.width / Math.max(1, c.clientWidth)).toFixed(2)} · ${(c.width * c.height / 1e6).toFixed(2)}Mpx`,
        // A lost context reports no buffer at all, which is not the browser cutting the size down: say which it is.
        gl
          ? `buffer ${gl.drawingBufferWidth}x${gl.drawingBufferHeight} · lost ${gl.isContextLost()}${
              gl.isContextLost() ? ' ← GONE, this is the blank canvas' : gl.drawingBufferWidth !== c.width || gl.drawingBufferHeight !== c.height ? ' ← CLAMPED, smaller than the canvas asked for' : ''
            }`
          : 'buffer (no webgl2 on the canvas)',
      ];
      setCaps((x) => [...x.filter((l) => !l.startsWith('canvas ') && !l.startsWith('buffer ')), ...live]);
    };
    const id = setInterval(look, 1500);

    return () => {
      console.error = err;
      console.warn = warn;
      removeEventListener('error', onErr);
      removeEventListener('unhandledrejection', onRej);
      clearInterval(id);
      delete (window as unknown as { __mark?: (s: string) => void }).__mark;
      canary?.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, []);

  const copy = useCallback(() => {
    navigator.clipboard?.writeText([...caps, '', ...lines].join('\n')).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  }, [caps, lines]);

  if (!on) return null;
  const box: React.CSSProperties = {
    position: 'fixed',
    insetInline: 0,
    top: 0,
    zIndex: 9999,
    background: 'rgba(0,0,0,.9)',
    color: '#9effa0',
    font: '11px/1.5 ui-monospace,monospace',
    padding: '8px 10px',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  };
  return (
    <div style={{ ...box, maxHeight: open ? '62vh' : 'auto', overflow: 'auto' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: open ? 6 : 0 }}>
        <button type="button" onClick={() => setOpen((x) => !x)} style={btn}>{open ? 'hide' : `debug (${lines.length})`}</button>
        {open && <button type="button" onClick={copy} style={btn}>{copied ? 'copied' : 'copy all'}</button>}
      </div>
      {open && (
        <>
          {caps.map((l) => <div key={l.slice(0, 24)} style={{ color: '#ffd479' }}>{l}</div>)}
          <div style={{ color: '#7fb3ff', margin: '6px 0 2px' }}>— errors ({lines.length}) —</div>
          {lines.length === 0 ? <div style={{ color: '#8a8a8a' }}>(none)</div> : lines.map((l, i) => <div key={i} style={{ color: l.startsWith('WARN') ? '#c9c9c9' : '#ff9090' }}>{l}</div>)}
        </>
      )}
    </div>
  );
}

const btn: React.CSSProperties = {
  border: '1px solid #4a4a4a',
  borderRadius: 4,
  padding: '3px 9px',
  color: '#e6e6e6',
  background: '#1c1c1c',
  font: 'inherit',
};
