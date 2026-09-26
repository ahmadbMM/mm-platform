// Where a catalogue page sits: Bikes › Road › Carbon › the model. The last item is the page
// itself and is not a link. The separator is drawn by catalog.css, pointing the reading way.
export default function Crumbs({ items, current, label }: { items: { href: string; label: string }[]; current: string; label: string }) {
  return (
    <nav className="ct-crumbs" aria-label={label}>
      <ol>
        {items.map((i) => <li key={i.href}><a href={i.href}>{i.label}</a></li>)}
        <li aria-current="page">{current}</li>
      </ol>
    </nav>
  );
}
