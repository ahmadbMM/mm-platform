import { serverLocalize } from "@/i18n/dicts";
import { cmText, type SpecGroup } from "@/lib/store-sections";
import { T } from "../w3b.text";

// The specifications as a table (F36): the rider height the sizes cover as its first row, then staff's rows; a bike's
// rows under small group headings (Size and weight, Frame, Drivetrain, Brakes, Wheels and tyres, Motor and battery),
// a weight with the basis it was weighed on ("10.4 kg" and, lighter, "size M"). It sits in the page's Specifications
// section, where the flat list was. A row staff wrote only in English keeps its own direction on an Arabic page (<bdi>).
export default function SpecTable({ groups, locale }: { groups: SpecGroup[]; locale: string }) {
  if (!groups.length) return null;
  const w = serverLocalize(T, locale);
  const headed = groups.length > 1;
  return (
    <table className="st-pd-spec">
      {groups.map((g, gi) => (
        <tbody key={g.id ?? gi}>
          {headed && g.id && (
            <tr className="st-pd-spec-g"><th colSpan={2} scope="colgroup">{w.groups[g.id]}</th></tr>
          )}
          {g.rows.map((r, i) => (
            <tr key={i}>
              {r.kind === "rider" ? (
                <><th scope="row">{w.riderHeight}</th><td>{cmText(r.range, w)}</td></>
              ) : (
                <>
                  <th scope="row"><bdi>{r.label}</bdi></th>
                  <td><bdi>{r.value}</bdi>{r.basis && <span className="st-pd-basis"> (<bdi>{r.basis}</bdi>)</span>}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  );
}
