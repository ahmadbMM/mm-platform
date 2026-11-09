/** An amount as the booking app writes it (_sar): the new riyal sign (U+20C1) left of the number with a
 *  space (SAMA's guidance), the whole isolated left-to-right so it reads right in Arabic too. Two decimals
 *  only when there are halalas. */
export const sar = (n: number) => {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return `⁦⃁ ${Number.isInteger(v) ? v : v.toFixed(2)}⁩`;
};
