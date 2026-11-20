// The marks this builder needs that the shared set (components/market/MkIcon.tsx) does not hold, drawn the same way:
// a 24 grid, stroke 1.75, round caps and joins, the text's own colour, for the eye alone.
const P = {
  minus: "M5 12h14",
} as const;
export type W1IconName = keyof typeof P;

export default function W1Icon({ name, size = 20, className = "" }: { name: W1IconName; size?: number; className?: string }) {
  return (
    <svg className={`mk-ic${className ? ` ${className}` : ""}`} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={P[name]} />
    </svg>
  );
}
