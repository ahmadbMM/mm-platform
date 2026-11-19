import { Link } from "@/i18n/navigation";
import type { RowValue } from "@/lib/account-menu";
import AccIcon, { type AccIconName } from "./AccIcon";
import { AccLogOut } from "./AccPages";

// My Account's menu (the booking app's .acc-menu, 2026-11-10): the Wallet and Invite friends tiles, then the rows in their
// groups, each with its value on the right (what is missing in amber, "Add profile photo") and a chevron, then Log out
// and, last, Delete my account in red. Every row is a link to its page's own address; the open page's row is the current
// page (aria-current), which the highlight is drawn from. A row that leaves the account (Help, Tech support, a
// testimonial) is a plain link; Tech support opens WhatsApp in a new tab.
export type MenuRow = { id: string; label: string; icon: AccIconName; href: string; value?: (RowValue & { node?: React.ReactNode }) | null; out?: boolean; red?: boolean };
export type MenuGroup = { id: string; title?: string; rows: MenuRow[] };
export type MenuTile = { id: string; label: string; icon: AccIconName; href: string; value: string; ltr?: boolean; node?: React.ReactNode };

function Row({ r, current }: { r: MenuRow; current: string | null }) {
  const on = current === r.id;
  const body = (
    <>
      <span className="acm-row-ic"><AccIcon name={r.icon} /></span>
      <span className="acm-row-t">{r.label}</span>
      {r.value && (r.value.text || r.value.node) ? (
        <span className={`acm-row-v${r.value.add ? " is-add" : ""}`}>{r.value.node ?? (r.value.ltr ? <bdi dir="ltr">{r.value.text}</bdi> : <bdi>{r.value.text}</bdi>)}</span>
      ) : null}
      <AccIcon name="go" size={16} className="acm-row-go" />
    </>
  );
  const cls = `acm-row${r.red ? " acm-row-red" : ""}`;
  if (r.out) {
    const ext = /^https?:/.test(r.href);
    return <a className={cls} href={r.href} {...(ext ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{body}</a>;
  }
  return <Link className={cls} href={r.href} aria-current={on ? "page" : undefined} data-row={r.id}>{body}</Link>;
}

export default function AccMenu({ label, tiles, groups, current, logOut, del }: {
  label: string; tiles: MenuTile[]; groups: MenuGroup[]; current: string | null; logOut: string; del: MenuRow | null;
}) {
  return (
    <nav className="acm-menu" aria-label={label}>
      {tiles.length > 0 && (
        <div className="acm-tiles">
          {tiles.map((t) => (
            <Link key={t.id} href={t.href} className="acm-tile" aria-current={current === t.id ? "page" : undefined} data-row={t.id}>
              <span className="acm-tile-k"><AccIcon name={t.icon} size={18} /><span>{t.label}</span></span>
              <span className="acm-tile-v">{t.node ?? (t.ltr ? <bdi dir="ltr">{t.value}</bdi> : <bdi>{t.value}</bdi>)}</span>
            </Link>
          ))}
        </div>
      )}
      {groups.filter((g) => g.rows.length > 0).map((g) => (
        <div key={g.id} className="acm-grp">
          {g.title && <h2 className="acm-grp-h" id={`acm-g-${g.id}`}>{g.title}</h2>}
          <ul className="acm-list" aria-labelledby={g.title ? `acm-g-${g.id}` : undefined}>
            {g.rows.map((r) => <li key={r.id}><Row r={r} current={current} /></li>)}
          </ul>
        </div>
      ))}
      <div className="acm-grp">
        <ul className="acm-list">
          <li><AccLogOut label={logOut} /></li>
          {del && <li><Row r={del} current={current} /></li>}
        </ul>
      </div>
    </nav>
  );
}
