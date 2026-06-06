import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2, Copy, X, Brain, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { askAI } from "@/lib/ai.functions";
import { getMyMemory, saveMyMemory } from "@/lib/memory.functions";

type Mode = "summarize" | "improve" | "translate_ar" | "translate_en" | "explain" | "freeform";

export function AIPanel({ getText, projectId, onClose, onInsert }: {
  getText: () => string;
  projectId: string;
  onClose: () => void;
  onInsert: (text: string) => void;
}) {
  const ask = useServerFn(askAI);
  const loadMem = useServerFn(getMyMemory);
  const saveMem = useServerFn(saveMyMemory);
  const [mode, setMode] = useState<Mode>("summarize");
  const [customPrompt, setCustomPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [memOpen, setMemOpen] = useState(false);
  const [memContent, setMemContent] = useState("");
  const [memLoaded, setMemLoaded] = useState(false);
  const [memBusy, setMemBusy] = useState(false);

  useEffect(() => {
    if (!memOpen || memLoaded) return;
    (async () => {
      const r = await loadMem();
      if (r.ok) setMemContent(r.content);
      setMemLoaded(true);
    })();
  }, [memOpen, memLoaded, loadMem]);

  const persistMemory = async () => {
    setMemBusy(true);
    const r = await saveMem({ data: { content: memContent } });
    setMemBusy(false);
    if (r.ok) toast.success("Memory saved — the AI will use it on every project");
    else toast.error(r.error);
  };

  const run = async () => {
    const docText = getText();
    const text = mode === "freeform" ? customPrompt : docText;
    if (!text.trim()) { toast.error("Nothing to send"); return; }
    setBusy(true); setResult("");
    try {
      // For custom prompts, always give the AI access to the full document
      // so the user can ask questions like "what does my doc say about X?".
      const res = await ask({
        data: {
          mode,
          text: text.slice(0, 60000),
          projectId,
          documentText: mode === "freeform" ? docText.slice(0, 60000) : undefined,
        },
      });
      if (!res.ok) toast.error(res.error);
      else setResult(res.text);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI request failed");
    }
    setBusy(false);
  };

  return (
    <aside className="fixed right-0 top-0 z-30 h-screen w-full max-w-md border-l border-border bg-card shadow-2xl flex flex-col">
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-2 font-semibold"><Sparkles className="size-4 text-accent" /> AI Assistant</div>
        <div className="flex items-center gap-1">
          <Button variant={memOpen ? "default" : "ghost"} size="icon" onClick={() => setMemOpen((v) => !v)} title="My AI memory">
            <Brain className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="size-4" /></Button>
        </div>
      </div>

      {memOpen && (
        <div className="p-4 space-y-2 border-b border-border bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold">My memory (applies to every project)</div>
            <Button size="sm" onClick={persistMemory} disabled={memBusy}>
              {memBusy ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              Save
            </Button>
          </div>
          <Textarea rows={6} placeholder="e.g. Always reply in formal Arabic. My name is Mohamed. Prefer bullet points. Never use emojis…"
            value={memContent} onChange={(e) => setMemContent(e.target.value)} />
          <p className="text-[10px] text-muted-foreground">
            The AI reads this before every request and applies it to all your documents.
          </p>
        </div>
      )}

      <div className="p-4 space-y-3 border-b border-border">
        <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="summarize">Summarize document</SelectItem>
            <SelectItem value="improve">Improve writing</SelectItem>
            <SelectItem value="explain">Explain</SelectItem>
            <SelectItem value="translate_ar">Translate → Arabic</SelectItem>
            <SelectItem value="translate_en">Translate → English</SelectItem>
            <SelectItem value="freeform">Custom prompt (AI sees your full document)</SelectItem>
          </SelectContent>
        </Select>

        {mode === "freeform" && (
          <Textarea rows={4} placeholder="Ask anything about your document, or any custom request…"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)} />
        )}

        <Button onClick={run} disabled={busy} className="w-full">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {busy ? "Thinking…" : "Run"}
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {result ? (
          <div className="space-y-3">
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{result}</div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(result); toast.success("Copied"); }}>
                <Copy className="size-3" /> Copy
              </Button>
              <Button size="sm" onClick={() => onInsert(result)}>Insert into document</Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Choose a mode and press Run. Results appear here.</p>
        )}
      </div>
    </aside>
  );
}
