import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Mic, Headphones, Search, Bookmark, Download, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useLang } from "@/lib/i18n";
import astraLogo from "@/assets/astra-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ASTRA STUDIO — Dictate, Edit & Export Documents (AR/EN)" },
      {
        name: "description",
        content:
          "Professional voice dictation and document editor for lawyers, teachers, researchers, and students. Arabic, English, mixed-language, by GX Team.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Mic, title: "Voice Dictation", desc: "Arabic + English speech-to-text with punctuation commands." },
  { icon: FileText, title: "Large Documents", desc: "Edit long documents with Tiptap — RTL, LTR, and mixed." },
  { icon: Headphones, title: "Read Aloud", desc: "Built-in text-to-speech with adjustable rate and voice." },
  { icon: Search, title: "Search & Replace", desc: "Find anything across your document instantly." },
  { icon: Bookmark, title: "Bookmarks", desc: "Jump back to important sections in one click." },
  { icon: Download, title: "Export", desc: "Download as DOCX, PDF, or plain text." },
  { icon: Sparkles, title: "AI Assistance", desc: "Summarize, rewrite, and translate inside your document." },
  { icon: ShieldCheck, title: "Owner-controlled access", desc: "Activation-code based registration." },
];

function Landing() {
  const { t } = useLang();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <img src={astraLogo} alt="ASTRA STUDIO logo" className="size-10 object-contain drop-shadow-md" />
            <div className="leading-tight">
              <div className="font-bold tracking-tight">ASTRA STUDIO</div>
              <div className="text-xs text-muted-foreground">{t("Made by Team GX")}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle /><ThemeToggle />
            <Button asChild variant="ghost">
              <Link to="/auth">{t("Sign in")}</Link>
            </Button>
            <Button asChild>
              <Link to="/auth" search={{ mode: "register" } as never}>{t("Get started")}</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-20 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-accent" />
          {t("Professional document platform")}
        </span>
        <h1 className="mt-6 text-balance text-5xl font-bold tracking-tight md:text-6xl">
          {t("Dictate, edit, and read large documents — in Arabic & English.")}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-lg text-muted-foreground">
          {t("ASTRA STUDIO is a serious workspace for lawyers, teachers, researchers, writers, and students. Speak it. Write it. Read it. Export it.")}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth" search={{ mode: "register" } as never}>{t("Create account")}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth">{t("I have an account")}</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-lg border border-border bg-card p-5">
              <Icon className="size-6 text-accent" />
              <h3 className="mt-3 font-semibold">{t(title)}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t(desc)}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-muted-foreground flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={astraLogo} alt="ASTRA STUDIO" className="size-8 object-contain" />
            <div className="leading-tight">
              <div className="font-semibold text-foreground">ASTRA STUDIO</div>
              <div className="text-xs">{t("Made by Team GX")} · © {new Date().getFullYear()}</div>
            </div>
          </div>
          <a href="tel:01095777037" className="font-medium text-foreground hover:text-accent transition-colors">
            {t("Contact")}: 01095777037
          </a>
        </div>
      </footer>
    </div>
  );
}
