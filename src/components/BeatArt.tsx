/** Illustration for beatcut (it has no website): an audio waveform with cut points on the beat. */
export function BeatArt() {
  const n = 120;
  const bars = Array.from({ length: n }, (_, i) => {
    const env = 0.35 + 0.65 * Math.abs(Math.sin(i / 9)) * (0.6 + 0.4 * Math.sin(i / 23));
    const jitter = 0.55 + 0.45 * Math.abs(Math.sin(i * 12.9898) * 43758.5453 % 1);
    return Math.max(0.06, env * jitter);
  });
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#0d0d0d] p-8">
      <svg viewBox={`0 0 ${n * 5} 200`} className="w-full" aria-hidden>
        {bars.map((h, i) => (
          <rect key={i} x={i * 5} y={100 - h * 90} width={3} height={h * 180} fill={i % 16 === 0 ? '#ff7a45' : '#f2f2ee'} opacity={i % 16 === 0 ? 1 : 0.85} />
        ))}
        {bars.map((_, i) =>
          i % 16 === 0 ? <line key={`c${i}`} x1={i * 5 + 1.5} x2={i * 5 + 1.5} y1={0} y2={200} stroke="#ff7a45" strokeWidth={1} strokeDasharray="3 4" /> : null,
        )}
      </svg>
    </div>
  );
}
