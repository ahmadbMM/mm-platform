// What the Learn to ride sign-up shows while staff are not taking sign-ups (Experiences > Learn to
// ride, "Taking sign-ups" off): the closed title and text in place of the form - drawn by the page,
// and by the form itself when the database answers that sign-ups closed while it was open.
export default function LearnClosed({ title, text }: { title: string; text: string }) {
  return (
    <div className="ln-card ln-done ln-closed" role="status">
      <span className="ln-closed-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M9.5 8v8M14.5 8v8" /></svg>
      </span>
      {title && <h2>{title}</h2>}
      {text && <p>{text}</p>}
    </div>
  );
}
