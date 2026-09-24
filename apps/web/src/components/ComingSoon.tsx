import "@/app/[locale]/coming-soon.css";

// The Coming Soon screen from the Claude Design launch package (ComingSoon.dc.html, "site"
// mode), and nothing else, as the owner asked (2026-09-24): the neon mark, "Coming soon." and
// one line. Its words come from the staff page (Website > Coming Soon screen).
export default function ComingSoon({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <main className="cs">
      <span className="cs-mark" role="img" aria-label="Micromobility" />
      <div className="cs-shade" aria-hidden="true" />
      <div className="cs-body">
        <span className="cs-eyebrow">
          <span className="cs-dot" aria-hidden="true" />
          {eyebrow}
        </span>
        <h1 className="cs-title">{title}</h1>
        <p className="cs-sub">{sub}</p>
      </div>
    </main>
  );
}
