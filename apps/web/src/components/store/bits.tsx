import { SOCIAL_ICONS } from "@/components/site/social-icons";

// The store's small shared pieces: an amount (the riyal sign's own font, isolated), the drawn marks the
// pages use (one monoline stroke, the booking app's set; never a text glyph or an emoji), and the frame a
// product with no photo keeps.

export const Amt = ({ children, className = "" }: { children: string; className?: string }) => <bdi className={`tk-amt ${className}`.trim()}>{children}</bdi>;

const PATHS = {
  bag: <><path d="M5.5 8.5h13L17.4 20a1.5 1.5 0 0 1-1.5 1.3H8.1A1.5 1.5 0 0 1 6.6 20L5.5 8.5z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></>,
  truck: <><path d="M2.8 6.4h10.6v9.8H2.8zM13.4 9.6h4.1l3.7 3.8v2.8h-7.8" /><circle cx="7" cy="17.4" r="1.9" /><circle cx="17.2" cy="17.4" r="1.9" /></>,
  shop: <><path d="M4 9.4V20h16V9.4M3 9.4l1.6-5h14.8l1.6 5z" /><path d="M9.5 20v-5.6h5V20" /></>,
  back: <><path d="M9 7.5L4.6 12 9 16.5" /><path d="M4.8 12h9.7a5 5 0 0 1 0 10H12" /></>,
  minus: <path d="M6.5 12h11" />,
  plus: <path d="M12 6.5v11M6.5 12h11" />,
  tick: <path d="M5 12.6l4.3 4.3L19 7.4" />,
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  copy: <><rect x="8.6" y="8.6" width="11" height="11" rx="2" /><path d="M15.4 8.6V6.4a2 2 0 0 0-2-2H6.4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2.2" /></>,
  print: <><path d="M7 9V3.8h10V9" /><rect x="3.6" y="9" width="16.8" height="7.6" rx="2" /><path d="M7 14.2h10v6H7z" /></>,
  photo: <><rect x="3.4" y="5" width="17.2" height="14" rx="2.2" /><circle cx="9" cy="10" r="1.7" /><path d="M20.6 15.6l-4.8-4.6-8.4 8" /></>,
  lock: <><rect x="4.4" y="10.6" width="15.2" height="10" rx="2.2" /><path d="M8 10.6V7.6a4 4 0 0 1 8 0v3" /></>,
  wallet: <><path d="M4 7.2h14.4a1.6 1.6 0 0 1 1.6 1.6v9.6a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 18.4z" /><path d="M4 7.2l11-3.4v3.4M16.2 13.8h.1" /></>,
  user: <><circle cx="12" cy="8" r="3.6" /><path d="M5 20c1.4-3.6 4.4-5.4 7-5.4s5.6 1.8 7 5.4" /></>,
};
export type StoreIcon = keyof typeof PATHS;

export function Ic({ name, size = 18, className = "" }: { name: StoreIcon; size?: number; className?: string }) {
  return (
    <svg className={`st-ic ${className}`.trim()} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{PATHS[name]}</svg>
  );
}

/** The WhatsApp mark (the footer's own). */
export function WhatsAppMark({ size = 18 }: { size?: number }) {
  return <svg className="st-ic" viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" focusable="false"><path d={SOCIAL_ICONS.whatsapp} /></svg>;
}

/** The frame of a product with no photo yet: a drawn picture mark in the same box. */
export const NoPhoto = () => <span className="st-nophoto"><Ic name="photo" size={34} /></span>;
