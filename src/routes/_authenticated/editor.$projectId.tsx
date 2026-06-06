import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  ArrowLeft, Save, Languages, Check, Mic, MicOff, Volume2, VolumeX,
  Sparkles, Download, Search, BookmarkPlus, Bookmark as BookmarkIcon, Trash2,
  SpellCheck2, ChevronUp, ChevronDown, Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { supabase } from "@/integrations/supabase/client";
import { RichEditor } from "@/components/editor/rich-editor";
import { AIPanel } from "@/components/editor/ai-panel";
import { useDictation } from "@/hooks/use-dictation";
import { useTTS } from "@/hooks/use-tts";
import { exportDocx, exportPdf, exportTxt } from "@/lib/export";
import { useServerFn } from "@tanstack/react-start";
import { grammarCheck } from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/editor/$projectId")({
  head: () => ({ meta: [{ title: "Editor — ASTRA STUDIO" }] }),
  component: EditorPage,
});

type Project = {
  id: string;
  title: string;
  content_json: unknown;
  language: string;
};

type Bookmark = { id: string; label: string; position: number; created_at: string };
type Match = { from: number; to: number };
type GrammarIssue = { original: string; suggestion: string; reason: string; from: number; to: number };
type DictMode = "ar" | "en" | "mixed";

function EditorPage() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,title,content_json,language")
        .eq("id", projectId).single();
      if (error) throw error;
      return data as Project;
    },
  });

  const { data: bookmarks = [] } = useQuery({
    queryKey: ["bookmarks", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookmarks").select("id,label,position,created_at")
        .eq("project_id", projectId).order("position", { ascending: true });
      if (error) throw error;
      return data as Bookmark[];
    },
  });

  const [title, setTitle] = useState("");
  const [lang, setLang] = useState<"ar" | "en" | "mixed">("mixed");
  const [dictMode, setDictMode] = useState<DictMode>("mixed");
  const [dictLang, setDictLang] = useState<"ar-EG" | "en-US">("ar-EG");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findQ, setFindQ] = useState("");
  const [replaceQ, setReplaceQ] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeMatch, setActiveMatch] = useState(0);
  const [selectedMatches, setSelectedMatches] = useState<Set<number>>(new Set());
  const [grammarOpen, setGrammarOpen] = useState(false);
  const [grammarIssues, setGrammarIssues] = useState<GrammarIssue[]>([]);
  const [grammarLoading, setGrammarLoading] = useState(false);
  const [bookmarkTops, setBookmarkTops] = useState<Record<string, number>>({});

  const callGrammar = useServerFn(grammarCheck);

  const stateRef = useRef<{ json: unknown; text: string; wc: number }>({ json: null, text: "", wc: 0 });
  const dirtyRef = useRef(false);
  const interimRef = useRef<{ from: number; to: number } | null>(null);

  useEffect(() => {
    if (project) {
      setTitle(project.title);
      setLang((project.language as "ar" | "en" | "mixed") ?? "mixed");
      stateRef.current = { json: project.content_json, text: "", wc: 0 };
    }
  }, [project]);

  const dir: "ltr" | "rtl" = lang === "ar" ? "rtl" : "ltr";

  // When the user switches dictation MODE, sync the recognizer language.
  // (Mixed defaults to AR-EG and the user can flip with the EN/ع pill — the
  // hook restarts cleanly on lang change so there's no lag or dropped audio.)
  useEffect(() => {
    if (dictMode === "ar") setDictLang("ar-EG");
    else if (dictMode === "en") setDictLang("en-US");
  }, [dictMode]);

  const doSave = async () => {
    if (!project) return;
    setSaving(true);
    const { error } = await supabase.from("projects").update({
      title: title.trim() || "Untitled",
      content_json: stateRef.current.json ?? {},
      content_text: stateRef.current.text,
      word_count: stateRef.current.wc,
      language: lang,
    }).eq("id", project.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    setSavedAt(new Date());
    dirtyRef.current = false;
  };

  useEffect(() => {
    const t = setInterval(() => { if (dirtyRef.current && !saving) doSave(); }, 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, title, lang]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  // Dictation
  const dictation = useDictation({
    lang: dictLang,
    onFinal: (text) => {
      if (!editor) return;
      const finalText = text + " ";
      const range = interimRef.current;
      if (range) {
        editor.chain().focus()
          .insertContentAt({ from: range.from, to: range.to }, finalText)
          .run();
        interimRef.current = null;
      } else {
        editor.chain().focus().insertContent(finalText).run();
      }
      dirtyRef.current = true;
    },
    onInterim: (text) => {
      if (!editor || !text) return;
      const range = interimRef.current;
      if (range) {
        editor.chain()
          .insertContentAt({ from: range.from, to: range.to }, text)
          .setTextSelection(range.from + text.length)
          .run();
        interimRef.current = { from: range.from, to: range.from + text.length };
      } else {
        const from = editor.state.selection.from;
        editor.chain()
          .insertContentAt(from, text)
          .setTextSelection(from + text.length)
          .run();
        interimRef.current = { from, to: from + text.length };
      }
      dirtyRef.current = true;
    },
  });

  // TTS
  const tts = useTTS();
  // Read user's selection if any, else the full document. In "mixed" lang
  // the hook segments by script so AR + EN are queued in order with their
  // own voices and never overlap.
  const speakDocOrSelection = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const text = from !== to
      ? editor.state.doc.textBetween(from, to, "\n")
      : editor.getText();
    if (!text.trim()) return toast.error("Nothing to read");
    tts.speak(text, lang);
  };

  // Find / Replace — scans the whole doc, lists every match in order, and
  // lets the user pick exactly which occurrences to replace and with what
  // (any subset, "all", or just the active one).
  const scanMatches = (): Match[] => {
    if (!editor || !findQ) return [];
    const needle = caseSensitive ? findQ : findQ.toLowerCase();
    const found: Match[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return;
      const hay = caseSensitive ? node.text : node.text.toLowerCase();
      let i = 0;
      while (true) {
        const idx = hay.indexOf(needle, i);
        if (idx < 0) break;
        found.push({ from: pos + idx, to: pos + idx + needle.length });
        i = idx + Math.max(needle.length, 1);
      }
    });
    return found;
  };
  const jumpToMatch = (i: number, list: Match[] = matches) => {
    if (!editor || !list[i]) return;
    setActiveMatch(i);
    editor.commands.setTextSelection({ from: list[i].from, to: list[i].to });
    editor.commands.focus();
    editor.commands.scrollIntoView();
  };
  const runFind = () => {
    const m = scanMatches();
    setMatches(m);
    setSelectedMatches(new Set(m.map((_, i) => i)));
    setActiveMatch(0);
    if (m.length === 0) toast.error("Not found");
    else jumpToMatch(0, m);
  };
  const stepMatch = (delta: number) => {
    if (matches.length === 0) return;
    jumpToMatch((activeMatch + delta + matches.length) % matches.length);
  };
  const toggleMatchSel = (i: number) => {
    setSelectedMatches((prev) => {
      const n = new Set(prev);
      if (n.has(i)) n.delete(i); else n.add(i);
      return n;
    });
  };
  const doReplaceSelected = (which: "selected" | "active" | "all") => {
    if (!editor || matches.length === 0) return;
    const targets = which === "all"
      ? matches.map((_, i) => i)
      : which === "active" ? [activeMatch] : [...selectedMatches];
    if (targets.length === 0) return toast.error("Select at least one match");
    // Replace in descending order so earlier positions stay valid.
    const ordered = [...targets].sort((a, b) => b - a);
    const chain = editor.chain();
    for (const i of ordered) {
      const m = matches[i];
      chain.insertContentAt({ from: m.from, to: m.to }, replaceQ);
    }
    chain.run();
    dirtyRef.current = true;
    toast.success(`Replaced ${ordered.length}`);
    setTimeout(() => {
      const fresh = scanMatches();
      setMatches(fresh);
      setSelectedMatches(new Set(fresh.map((_, i) => i)));
      setActiveMatch(0);
    }, 0);
  };

  // Bookmarks
  const addBookmark = async () => {
    if (!editor) return;
    const pos = editor.state.selection.from;
    const label = prompt("Bookmark label?") || `Bookmark @ ${pos}`;
    const { error } = await supabase.from("bookmarks").insert({
      project_id: projectId,
      user_id: (await supabase.auth.getUser()).data.user!.id,
      label, position: pos,
    });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["bookmarks", projectId] });
    toast.success("Bookmark added");
  };
  const goToBookmark = (b: Bookmark) => {
    if (!editor) return;
    const max = editor.state.doc.content.size;
    const pos = Math.min(Math.max(1, b.position), max - 1);
    editor.commands.setTextSelection(pos);
    editor.commands.focus();
    editor.commands.scrollIntoView();
  };
  const deleteBookmark = async (id: string) => {
    await supabase.from("bookmarks").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["bookmarks", projectId] });
  };

  // Pixel Y for each bookmark so we can render gutter markers on the left.
  useEffect(() => {
    if (!editor) return;
    const compute = () => {
      const tops: Record<string, number> = {};
      const shell = (editor.view.dom as HTMLElement).closest(".editor-shell") as HTMLElement | null;
      const baseTop = shell?.getBoundingClientRect().top ?? 0;
      for (const b of bookmarks) {
        try {
          const max = editor.state.doc.content.size;
          const pos = Math.min(Math.max(1, b.position), max - 1);
          const c = editor.view.coordsAtPos(pos);
          tops[b.id] = c.top - baseTop;
        } catch { /* out-of-range */ }
      }
      setBookmarkTops(tops);
    };
    compute();
    editor.on("update", compute);
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    return () => {
      editor.off("update", compute);
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [editor, bookmarks]);

  // Grammar check — runs the bilingual proofreader server fn, translates
  // plain-text offsets to ProseMirror positions, and exposes navigation +
  // per-issue / all-at-once application of suggested fixes.
  const runGrammar = async (autoFix = false) => {
    if (!editor) return;
    const text = editor.getText();
    if (!text.trim()) return toast.error("Document is empty");
    setGrammarLoading(true);
    setGrammarOpen(true);
    try {
      const res = await callGrammar({ data: { text, autoFix } });
      if (!res.ok) { toast.error(res.error); setGrammarIssues([]); return; }
      const issues = [...res.issues].sort((a, b) => a.from - b.from);
      const located: GrammarIssue[] = [];
      let plainCursor = 0;
      let issueI = 0;
      editor.state.doc.descendants((node, pos) => {
        if (issueI >= issues.length) return false;
        if (!node.isText || !node.text) {
          if (node.isBlock && node.content.size === 0) plainCursor += 1;
          return;
        }
        const start = plainCursor;
        const end = start + node.text.length;
        while (issueI < issues.length && issues[issueI].from >= start && issues[issueI].from < end) {
          const iss = issues[issueI];
          const offset = iss.from - start;
          located.push({ ...iss, from: pos + offset, to: pos + offset + (iss.to - iss.from) });
          issueI++;
        }
        plainCursor = end + 1;
      });
      setGrammarIssues(located);
      if (located.length === 0) toast.success("No issues found");
      if (autoFix && located.length) applyAllGrammarFixes(located);
    } catch (e: any) {
      toast.error(e?.message ?? "Grammar check failed");
    } finally {
      setGrammarLoading(false);
    }
  };
  const jumpToIssue = (i: number) => {
    const iss = grammarIssues[i];
    if (!editor || !iss) return;
    editor.commands.setTextSelection({ from: iss.from, to: iss.to });
    editor.commands.focus();
    editor.commands.scrollIntoView();
  };
  const applyOneFix = (i: number) => {
    const iss = grammarIssues[i];
    if (!editor || !iss) return;
    const delta = iss.suggestion.length - (iss.to - iss.from);
    editor.chain().focus()
      .insertContentAt({ from: iss.from, to: iss.to }, iss.suggestion).run();
    dirtyRef.current = true;
    setGrammarIssues((prev) => prev.flatMap((p, idx) => {
      if (idx === i) return [];
      if (p.from >= iss.to) return [{ ...p, from: p.from + delta, to: p.to + delta }];
      return [p];
    }));
  };
  const applyAllGrammarFixes = (list: GrammarIssue[] = grammarIssues) => {
    if (!editor || list.length === 0) return;
    const ordered = [...list].sort((a, b) => b.from - a.from);
    const chain = editor.chain();
    for (const iss of ordered) {
      chain.insertContentAt({ from: iss.from, to: iss.to }, iss.suggestion);
    }
    chain.run();
    dirtyRef.current = true;
    setGrammarIssues([]);
    toast.success(`Applied ${ordered.length} fixes`);
  };

  // Export
  const doExport = async (fmt: "docx" | "pdf" | "txt") => {
    await doSave();
    const t = title.trim() || "Untitled";
    const plain = stateRef.current.text || editor?.getText() || "";
    if (fmt === "docx") await exportDocx(t, stateRef.current.json);
    if (fmt === "pdf") await exportPdf(t, editor?.getHTML() || plain, lang === "ar");
    if (fmt === "txt") exportTxt(t, plain);
    toast.success(`Exported as ${fmt.toUpperCase()}`);
  };

  if (isLoading || !project) {
    return <div className="p-10 text-muted-foreground">Loading project…</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 z-10 bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/dashboard" })}>
              <ArrowLeft className="size-4" />
            </Button>
            <Input value={title}
              onChange={(e) => { setTitle(e.target.value); dirtyRef.current = true; }}
              className="font-semibold text-base border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-2"
              placeholder="Untitled" />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Select value={lang} onValueChange={(v) => { setLang(v as any); dirtyRef.current = true; }}>
              <SelectTrigger className="w-[120px]"><Languages className="size-4 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mixed">Mixed</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ar">العربية</SelectItem>
              </SelectContent>
            </Select>

            {/* Dictation MODE: ar / en / mixed. Mode controls which scripts
                the typer accepts. In "mixed" the user can flip the active
                recognizer with the ع/EN pill at any time. */}
            <Select value={dictMode} onValueChange={(v) => setDictMode(v as DictMode)}>
              <SelectTrigger className="w-[120px]" title="Dictation mode">
                <Mic className="size-4 mr-1" /><SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mixed">Mixed (ع + EN)</SelectItem>
                <SelectItem value="ar">العربية فقط</SelectItem>
                <SelectItem value="en">English only</SelectItem>
              </SelectContent>
            </Select>
            {dictMode === "mixed" && (
              <Button variant="outline" size="sm"
                onClick={() => setDictLang(dictLang === "ar-EG" ? "en-US" : "ar-EG")}
                title="Switch active dictation language">
                <span className="text-xs font-semibold">{dictLang === "ar-EG" ? "ع" : "EN"}</span>
              </Button>
            )}
            <Button variant={dictation.listening ? "default" : "outline"} size="sm"
              onClick={() => dictation.listening ? dictation.stop() : dictation.start()}
              disabled={!dictation.supported}
              title={dictation.supported ? `Voice dictation (${dictLang})` : "Not supported in this browser"}>
              {dictation.listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            </Button>
            {/* Clear live indicator of which language the typer is hearing. */}
            {dictation.listening && (
              <Badge variant="secondary" className="text-xs">
                {dictLang === "ar-EG" ? "يستمع: عربي" : "Listening: EN"}
              </Badge>
            )}

            <Button variant={tts.speaking ? "default" : "outline"} size="sm"
              onClick={() => tts.speaking ? tts.stop() : speakDocOrSelection()}
              title="Read aloud (selection if any, else full document)">
              {tts.speaking ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </Button>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm"><BookmarkIcon className="size-4" /></Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">Bookmarks</span>
                  <Button size="sm" variant="ghost" onClick={addBookmark}><BookmarkPlus className="size-4" /></Button>
                </div>
                <div className="max-h-64 overflow-auto space-y-1">
                  {bookmarks.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No bookmarks yet.</p>
                  ) : bookmarks.map((b) => (
                    <div key={b.id} className="flex items-center justify-between gap-1 rounded px-2 py-1 hover:bg-muted">
                      <button onClick={() => goToBookmark(b)} className="text-sm truncate flex-1 text-left">{b.label}</button>
                      <button onClick={() => deleteBookmark(b.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Button variant="outline" size="sm" onClick={() => setFindOpen(true)}><Search className="size-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => runGrammar(false)}
              title="Grammar & spelling check (AR + EN)">
              <SpellCheck2 className="size-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAiOpen(true)}><Sparkles className="size-4" /></Button>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm"><Download className="size-4" /></Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-40 p-1">
                <Button variant="ghost" className="w-full justify-start" onClick={() => doExport("docx")}>DOCX</Button>
                <Button variant="ghost" className="w-full justify-start" onClick={() => doExport("pdf")}>PDF</Button>
                <Button variant="ghost" className="w-full justify-start" onClick={() => doExport("txt")}>TXT</Button>
              </PopoverContent>
            </Popover>

            <Button variant="outline" size="sm" onClick={doSave} disabled={saving}>
              <Save className="size-4" />{saving ? "Saving…" : "Save"}
            </Button>
            {savedAt && !saving && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Check className="size-3 text-accent" /> {savedAt.toLocaleTimeString()}
              </span>
            )}
            <LanguageToggle /><ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="editor-shell relative">
          {/* Bookmark gutter — visible markers in the margin that don't touch the text. */}
          <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-6">
            {bookmarks.map((b) => {
              const top = bookmarkTops[b.id];
              if (top == null) return null;
              return (
                <button key={b.id}
                  onClick={() => goToBookmark(b)}
                  title={b.label}
                  className="pointer-events-auto absolute -left-1 flex items-center gap-1 rounded-r-md bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground shadow hover:bg-accent/80"
                  style={{ top: `${top}px` }}>
                  <BookmarkIcon className="size-3" />
                  <span className="max-w-[90px] truncate">{b.label}</span>
                </button>
              );
            })}
          </div>
          <RichEditor
            dir={dir}
            initialContent={project.content_json}
            onReady={setEditor}
            onChange={(json, text, wc) => {
              stateRef.current = { json, text, wc };
              dirtyRef.current = true;
            }}
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground text-center">
          {stateRef.current.wc.toLocaleString()} words · auto-saves every 2 seconds
        </p>
      </main>

      {aiOpen && editor && (
        <AIPanel
          projectId={projectId}
          getText={() => editor.getText()}
          onClose={() => setAiOpen(false)}
          onInsert={(t) => { editor.chain().focus().insertContent(t).run(); dirtyRef.current = true; }}
        />
      )}

      {/* Find & Replace — lists every match in order so the user can navigate
          quickly and pick exactly which occurrences to replace. */}
      <Dialog open={findOpen} onOpenChange={setFindOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Find & Replace</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="Find…" value={findQ}
                onChange={(e) => setFindQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") runFind(); }} />
              <Button onClick={runFind}>Find</Button>
            </div>
            <Input placeholder="Replace with…" value={replaceQ}
              onChange={(e) => setReplaceQ(e.target.value)} />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox checked={caseSensitive}
                onCheckedChange={(v) => setCaseSensitive(Boolean(v))} />
              Case sensitive
            </label>
            {matches.length > 0 && (
              <>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{matches.length} matches · #{activeMatch + 1} active · {selectedMatches.size} selected</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => stepMatch(-1)}>
                      <ChevronUp className="size-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => stepMatch(1)}>
                      <ChevronDown className="size-3" />
                    </Button>
                  </div>
                </div>
                <div className="max-h-64 overflow-auto rounded border border-border divide-y">
                  {matches.map((m, i) => {
                    const ctx = editor?.state.doc.textBetween(
                      Math.max(0, m.from - 20), Math.min(editor.state.doc.content.size, m.to + 20), " ",
                    ) ?? "";
                    return (
                      <div key={i}
                        className={`flex items-center gap-2 px-2 py-1.5 text-xs ${i === activeMatch ? "bg-accent/30" : ""}`}>
                        <Checkbox checked={selectedMatches.has(i)}
                          onCheckedChange={() => toggleMatchSel(i)} />
                        <span className="font-mono text-muted-foreground w-6">#{i + 1}</span>
                        <button onClick={() => jumpToMatch(i)}
                          className="flex-1 text-left truncate hover:underline">…{ctx}…</button>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Button size="sm" variant="ghost"
                    onClick={() => setSelectedMatches(new Set(matches.map((_, i) => i)))}>
                    Select all
                  </Button>
                  <Button size="sm" variant="ghost"
                    onClick={() => setSelectedMatches(new Set())}>
                    Clear
                  </Button>
                </div>
              </>
            )}
          </div>
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => doReplaceSelected("active")}
              disabled={matches.length === 0}>Replace active</Button>
            <Button variant="outline" onClick={() => doReplaceSelected("selected")}
              disabled={selectedMatches.size === 0}>
              Replace selected ({selectedMatches.size})
            </Button>
            <Button onClick={() => doReplaceSelected("all")}
              disabled={matches.length === 0}>Replace all</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grammar / spelling — bilingual (AR + EN). Lists issues with reasons,
          jumps to them, and lets the user accept fixes one-by-one or all at once. */}
      <Dialog open={grammarOpen} onOpenChange={setGrammarOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Grammar & Spelling</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {grammarLoading ? (
              <p className="text-sm text-muted-foreground">Checking your document…</p>
            ) : grammarIssues.length === 0 ? (
              <p className="text-sm text-muted-foreground">No issues to show. Run a fresh check from the toolbar.</p>
            ) : (
              <div className="max-h-80 overflow-auto rounded border border-border divide-y">
                {grammarIssues.map((iss, i) => (
                  <div key={i} className="p-2 text-sm space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <button onClick={() => jumpToIssue(i)} className="text-left flex-1">
                        <span className="line-through text-destructive">{iss.original}</span>
                        <span className="mx-2">→</span>
                        <span className="font-semibold text-accent-foreground">{iss.suggestion}</span>
                      </button>
                      <Button size="sm" variant="outline" onClick={() => applyOneFix(i)}>Fix</Button>
                    </div>
                    {iss.reason && <p className="text-xs text-muted-foreground">{iss.reason}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => runGrammar(false)} disabled={grammarLoading}>
              <SpellCheck2 className="size-4 mr-1" /> Re-check
            </Button>
            <Button onClick={() => applyAllGrammarFixes()} disabled={grammarIssues.length === 0}>
              <Wand2 className="size-4 mr-1" /> Apply all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
