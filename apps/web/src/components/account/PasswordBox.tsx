"use client";

import { useState } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { T } from "./PasswordBox.text";
import "./password-box.css";

// A box for a new password, typed once, with show/hide at its end (2026-11-11, as the booking app's _pwEyeBtn): the
// second box to type it again is gone from the Learn to ride sign-up and the choose-your-own-password card. The
// input takes every attribute it is given (its class, value, onChange, aria-invalid...); the type is the button's.
type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { inputRef?: React.Ref<HTMLInputElement> };

export default function PasswordBox({ inputRef, ...input }: Props) {
  const t = useLocalize(T);
  const [show, setShow] = useState(false);
  return (
    <span className="pw-box">
      <input ref={inputRef} {...input} type={show ? "text" : "password"} />
      <button type="button" className="pw-eye" aria-pressed={show} aria-label={show ? t.hide : t.show} title={show ? t.hide : t.show} onClick={() => setShow((s) => !s)}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          {show
            ? <path d="M9.9 6a9.6 9.6 0 0 1 2.1-.4c6 0 9.4 6.4 9.4 6.4a16 16 0 0 1-2.7 3.4M6.6 7.5C4 9.2 2.6 12 2.6 12S6 18.4 12 18.4a8.8 8.8 0 0 0 4.4-1.2M9.9 10a2.9 2.9 0 0 0 4.1 4.1M3.6 3.6l16.8 16.8" />
            : <><path d="M2.6 12S6 5.6 12 5.6 21.4 12 21.4 12 18 18.4 12 18.4 2.6 12 2.6 12z" /><circle cx="12" cy="12" r="2.9" /></>}
        </svg>
      </button>
    </span>
  );
}
