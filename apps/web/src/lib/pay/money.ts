/** An amount as the booking app writes it (_sar): the new riyal sign (U+20C1) left of the number with a
 *  space (SAMA's guidance), the whole isolated left-to-right so it reads right in Arabic too. Two decimals
 *  only when there are halalas. Grouped (5,823), as the store's prices and Moyasar's own Pay button write it. */
export const sar = (n: number) => {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return `⁦⃁ ${v.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 })}⁩`;
};
