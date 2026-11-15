// The ZATCA phase 1 QR code of a simplified tax invoice (L06; the order page draws it, w5): five fields in TLV form
// (a tag byte, a length byte, the value's UTF-8 bytes), the whole in base64. 1 the seller's name, 2 its VAT number,
// 3 the invoice's time (ISO 8601), 4 the total with VAT, 5 the VAT. ZATCA's e-invoicing guideline, phase 1 (generation),
// in force for every VAT payer since 4 Dec 2021.

const enc = new TextEncoder();

/** One field: its tag, its length (one byte: a value over 255 bytes is cut at a character's edge) and its bytes. */
function tlv(tag: number, value: string): number[] {
  let bytes = enc.encode(value);
  if (bytes.length > 255) {
    let s = value;
    while (enc.encode(s).length > 255) s = [...s].slice(0, -1).join("");
    bytes = enc.encode(s);
  }
  return [tag, bytes.length, ...bytes];
}

/** An amount as ZATCA's examples write it: two decimals, no grouping ("1150.00"). */
export const zatcaAmount = (n: number) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);

/** The QR's text: base64 of the five fields. `at` is an ISO date-time (the order's paid_at), written in UTC with Z. */
export function zatcaQr(f: { seller: string; vat: string; at: string; total: number; vatAmount: number }): string {
  const t = Date.parse(f.at);
  const when = Number.isFinite(t) ? new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z") : f.at;
  const bytes = [...tlv(1, f.seller), ...tlv(2, f.vat), ...tlv(3, when), ...tlv(4, zatcaAmount(f.total)), ...tlv(5, zatcaAmount(f.vatAmount))];
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** The five fields read back from a QR's text (for tests and checks); null when it is not TLV. */
export function zatcaFields(b64: string): Record<number, string> | null {
  let bin: string;
  try { bin = atob(b64); } catch { return null; }
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const out: Record<number, string> = {};
  for (let i = 0; i < bytes.length; ) {
    const tag = bytes[i], len = bytes[i + 1];
    if (len === undefined || i + 2 + len > bytes.length) return null;
    out[tag] = new TextDecoder().decode(bytes.slice(i + 2, i + 2 + len));
    i += 2 + len;
  }
  return out;
}
