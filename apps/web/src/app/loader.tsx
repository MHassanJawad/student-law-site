// Scales-of-justice loading indicator: a light runs along the outline while the beam gently rocks.

const STAND = ["M32 10V54", "M20 55H44", "M28 55Q32 50 36 55"];
const BEAM = ["M10 17H54", "M10 17L4 35", "M10 17L16 35", "M3 35Q10 44 17 35Z", "M54 17L48 35", "M54 17L60 35", "M47 35Q54 44 61 35Z"];

function Outline({ parts }: { parts: string[] }) {
  return <>{parts.map((d) => <g key={d}><path className="loader-track" d={d} /><path className="loader-trace" d={d} pathLength={100} /></g>)}</>;
}

/** Announces a loading state; `page` centres it in the viewport for whole-page loads. */
export function Loader({ label, page = false }: { label: string; page?: boolean }) {
  return <div className={page ? "loader loader-page" : "loader"} role="status">
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle className="loader-track" cx="32" cy="10" r="2.5" />
      <Outline parts={STAND} />
      <g className="loader-beam"><Outline parts={BEAM} /></g>
    </svg>
    <span>{label}</span>
  </div>;
}
