import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang, setLang } from "@/lib/i18n";

export function LanguageToggle() {
  const { lang } = useLang();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLang(lang === "en" ? "ar" : "en")}
      title={lang === "en" ? "التبديل إلى العربية" : "Switch to English"}
      className="gap-2"
    >
      <Languages className="size-4" />
      <span className="text-xs font-semibold">{lang === "en" ? "العربية" : "EN"}</span>
    </Button>
  );
}
