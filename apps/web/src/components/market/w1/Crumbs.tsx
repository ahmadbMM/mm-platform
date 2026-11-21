import { Link } from "@/i18n/navigation";

// Where a Marketplace page sits: Marketplace, the sport, the product type, then the page itself, which is not a
// link. The separator is drawn by w1.css and points the reading way. Names people wrote (a listing's title, a shop's
// name) are shown as written, in their own direction.
//   items     the steps before the page: each a name and its address
//   current   the page's own name
//   label     the trail's name for a screen reader (w1.text.ts `crumbs`)
export default function Crumbs({ items, current, label }: { items: { href: string; label: string }[]; current: string; label: string }) {
  return (
    <nav className="mk-w1-crumbs" aria-label={label}>
      <ol>
        {items.map((i) => <li key={i.href}><Link href={i.href}>{i.label}</Link></li>)}
        <li aria-current="page"><span className="mk-user" dir="auto">{current}</span></li>
      </ol>
    </nav>
  );
}
