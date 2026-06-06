import { useCallback, useEffect, useRef, useState } from "react";

// Split a string into Arabic vs non-Arabic runs so each segment can be
// spoken with a voice that actually pronounces that script. Without this
// the browser tries to read Arabic letters with an English voice (or vice
// versa) and produces gibberish or silence on mixed documents.
function segmentByScript(text: string): { lang: "ar" | "en"; text: string }[] {
  if (!text) return [];
  const AR = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  const out: { lang: "ar" | "en"; text: string }[] = [];
  let buf = "";
  let cur: "ar" | "en" | null = null;
  for (const ch of text) {
    const isLetter = /\p{L}/u.test(ch);
    if (!isLetter) { buf += ch; continue; }
    const next: "ar" | "en" = AR.test(ch) ? "ar" : "en";
    if (cur === null) cur = next;
    if (next !== cur) {
      if (buf.trim()) out.push({ lang: cur, text: buf });
      buf = "";
      cur = next;
    }
    buf += ch;
  }
  if (buf.trim() && cur) out.push({ lang: cur, text: buf });
  return out;
}

export function useTTS() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const queueRef = useRef<{ lang: "ar" | "en"; text: string }[]>([]);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
  }, []);

  const pickVoice = useCallback((lang: "ar" | "en") => {
    const prefix = lang === "ar" ? "ar" : "en";
    return voices.find((v) => v.lang.toLowerCase().startsWith(prefix));
  }, [voices]);

  const playNext = useCallback((rate: number) => {
    if (cancelledRef.current) { setSpeaking(false); return; }
    const seg = queueRef.current.shift();
    if (!seg) { setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(seg.text);
    u.lang = seg.lang === "ar" ? "ar-EG" : "en-US";
    u.rate = rate;
    const v = pickVoice(seg.lang);
    if (v) u.voice = v;
    u.onend = () => playNext(rate);
    u.onerror = () => playNext(rate);
    window.speechSynthesis.speak(u);
  }, [pickVoice]);

  // `lang` is a hint for pure-language docs; when "mixed" we segment and
  // queue each run with its own voice so AR and EN never overlap.
  const speak = useCallback((text: string, lang: "ar" | "en" | "mixed" = "en", rate = 1) => {
    if (!("speechSynthesis" in window) || !text.trim()) return;
    window.speechSynthesis.cancel();
    cancelledRef.current = false;
    const segs = lang === "mixed"
      ? segmentByScript(text)
      : [{ lang: lang as "ar" | "en", text }];
    queueRef.current = segs.length ? segs : [{ lang: "en", text }];
    setSpeaking(true);
    playNext(rate);
  }, [playNext]);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    queueRef.current = [];
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const pause = useCallback(() => window.speechSynthesis.pause(), []);
  const resume = useCallback(() => window.speechSynthesis.resume(), []);

  return { voices, speaking, speak, stop, pause, resume };
}
