import { serverLocalize } from "@/i18n/dicts";
import { cmText, type SpecGroup } from "@/lib/store-sections";
import { T } from "../w3b.text";
import BidiText from "../BidiText";

// The specifications as a table (F36): the rider height the sizes cover as its first row, then staff's rows; a bike's
// rows under small group headings (Size and weight, Frame, Drivetrain, Brakes, Wheels and tyres, Motor and battery),
// a weight with the basis it was weighed on ("10.4 kg" and, lighter, "size M"). It sits in the page's Specifications
// section, where the flat list was. A row staff wrote only in English keeps its own direction on an Arabic page (<bdi>);
// a row with Arabic in it reads right to left with each Latin run in its own <bdi> ("كربون HELUX DD5" no longer runs left
// to right because it starts with a model name: P22, the user's "do all" 2026-11-18).
const Cell = ({ text, locale }: { text: string; locale: string }) => (/[\u0600-\u06ff]/.test(text) ? <BidiText text={text} locale={locale} /> : <bdi>{text}</bdi>);
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
                  <th scope="row"><Cell text={r.label} locale={locale} /></th>
                  <td><Cell text={r.value} locale={locale} />{r.basis && <span className="st-pd-basis"> (<bdi>{r.basis}</bdi>)</span>}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  );
}
