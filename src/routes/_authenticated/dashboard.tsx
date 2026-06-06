import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, FileText, Trash2, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — ASTRA STUDIO" }] }),
  component: DashboardPage,
});

type Project = {
  id: string;
  title: string;
  word_count: number;
  language: string;
  updated_at: string;
};

function DashboardPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useLang();
  const { user } = Route.useRouteContext();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,title,word_count,language,updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Project[];
    },
  });

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const createProject = async () => {
    if (projects.length >= 5) {
      toast.error(t("Project limit reached (5)"));
      return;
    }
    setCreating(true);
    const { data, error } = await supabase
      .from("projects")
      .insert({ user_id: user.id, title: title.trim() || "Untitled" })
      .select("id")
      .single();
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setOpen(false);
    setTitle("");
    qc.invalidateQueries({ queryKey: ["projects"] });
    navigate({ to: "/editor/$projectId", params: { projectId: data.id } });
  };

  const deleteProject = async (id: string) => {
    if (!confirm(t("Delete this project? This cannot be undone."))) return;
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("Project deleted"));
    qc.invalidateQueries({ queryKey: ["projects"] });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground font-bold">A</div>
            <div className="leading-tight">
              <div className="font-bold tracking-tight">ASTRA STUDIO</div>
              <div className="text-xs text-muted-foreground">{user.email}</div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/owner">
              <Button variant="ghost" size="sm" title={t("Owner console")}>
                <ShieldCheck className="size-4" /> {t("Owner")}
              </Button>
            </Link>
            <LanguageToggle /><ThemeToggle />
            <Button variant="ghost" onClick={signOut}>
              <LogOut className="size-4" /> {t("Sign out")}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("Your projects")}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {projects.length}/5 {t("projects")}
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={projects.length >= 5}>
                <Plus className="size-4" /> {t("New project")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("New project")}</DialogTitle>
                <DialogDescription>{t("Give your document a title. You can change it later.")}</DialogDescription>
              </DialogHeader>
              <Input
                placeholder={t("e.g. Court memo — March")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>{t("Cancel")}</Button>
                <Button onClick={createProject} disabled={creating}>
                  {creating ? t("Creating…") : t("Create")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground">{t("Loading…")}</div>
        ) : projects.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto size-10 text-muted-foreground" />
              <h2 className="mt-3 font-semibold">{t("No projects yet")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("Create your first project to start dictating and writing.")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Card key={p.id} className="group hover:border-accent transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-start justify-between gap-2">
                    <Link
                      to="/editor/$projectId"
                      params={{ projectId: p.id }}
                      className="hover:underline truncate"
                    >
                      {p.title}
                    </Link>
                    <button
                      onClick={() => deleteProject(p.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"
                      aria-label="Delete"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {p.word_count.toLocaleString()} words · {new Date(p.updated_at).toLocaleString()}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
