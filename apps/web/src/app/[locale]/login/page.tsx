import { redirect } from "next/navigation";

// The Phase-0 one-time-code sign-in never shipped: accounts sign in on /account, with the booking
// app's own passwords. The address stays so an old link lands somewhere useful.
export default function Login() {
  redirect("/account");
}
