import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function Home() {
  const t = useTranslations("home");
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "var(--mm-black)", color: "var(--mm-offwhite)" }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ color: "var(--mm-green-neon)" }}>{t("title")}</h1>
        <p>{t("sub")}</p>
        <Link href="/login" style={{ color: "var(--mm-green-neon)" }}>{t("cta")}</Link>
      </div>
    </main>
  );
}
