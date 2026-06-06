import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// Minimal types for the Web Speech API (not in lib.dom by default in some TS setups)
type SR = {
  start: () => void;
  stop: () => void;
  abort: () => void;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      0: { transcript: string };
    };
  };
};

type SpeechRecognitionErrorLike = { error?: string };

declare global {
  interface Window {
    SpeechRecognition?: new () => SR;
    webkitSpeechRecognition?: new () => SR;
  }
}

const AR_COMMANDS: Record<string, string> = {
  نقطة: ".",
  فاصلة: "،",
  "علامة استفهام": "؟",
  "علامة تعجب": "!",
  "سطر جديد": "\n",
  "فقرة جديدة": "\n\n",
  نقطتان: ":",
  "فاصلة منقوطة": "؛",
};
const EN_COMMANDS: Record<string, string> = {
  period: ".",
  "full stop": ".",
  comma: ",",
  "question mark": "?",
  "exclamation mark": "!",
  "new line": "\n",
  "new paragraph": "\n\n",
  colon: ":",
  semicolon: ";",
};

function applyCommands(raw: string, lang: string): string {
  let text = raw;
  const dict = lang.startsWith("ar") ? AR_COMMANDS : EN_COMMANDS;
  for (const [k, v] of Object.entries(dict)) {
    const re = new RegExp(`\\b${k}\\b`, "gi");
    text = text.replace(re, v);
  }
  return text.replace(/\s+([.,،؛;:!?؟])/g, "$1");
}

export function useDictation(opts: {
  lang: "ar-EG" | "en-US";
  onFinal: (text: string) => void;
  onInterim?: (text: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<SR | null>(null);
  const wantOnRef = useRef(false);
  const permissionGrantedRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbacksRef = useRef({ onFinal: opts.onFinal, onInterim: opts.onInterim });
  const langRef = useRef(opts.lang);
  langRef.current = opts.lang;
  callbacksRef.current = { onFinal: opts.onFinal, onInterim: opts.onInterim };

  // Some mobile browsers (notably iOS Safari) ship a SpeechRecognition
  // constructor that does nothing useful. We still try, but if recognition
  // never produces any event we surface a clear toast.
  const isMobile =
    typeof navigator !== "undefined" &&
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  useEffect(() => {
    const Ctor =
      typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!Ctor) {
      setSupported(false);
    }
  }, []);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const startInternalRef = useRef<() => void>(() => {});

  const scheduleRestart = useCallback(
    (delay: number) => {
      clearRestartTimer();
      restartTimerRef.current = setTimeout(() => {
        restartTimerRef.current = null;
        startInternalRef.current();
      }, delay);
    },
    [clearRestartTimer],
  );

  const startInternal = useCallback(() => {
    clearRestartTimer();
    if (!wantOnRef.current) return;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      setSupported(false);
      return;
    }
    const rec = new Ctor();
    rec.lang = langRef.current;
    // iOS Safari ignores `continuous` and ends after the first utterance,
    // so we always rely on the auto-restart loop in `onend`.
    rec.continuous = !isMobile;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = "";
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (finalText) {
        callbacksRef.current.onFinal(applyCommands(finalText, langRef.current));
      }
      if (interim) callbacksRef.current.onInterim?.(interim);
    };
    rec.onerror = (e) => {
      const err = e?.error;
      // routine, recoverable errors — just let onend restart
      if (err === "no-speech" || err === "aborted" || err === "audio-capture") return;
      if (err === "not-allowed" || err === "service-not-allowed") {
        wantOnRef.current = false;
        setListening(false);
        toast.error("Microphone blocked. Allow mic access in your browser settings and try again.");
        return;
      }
      if (err === "network") {
        toast.error("Speech recognition needs an internet connection.");
        return;
      }
      if (err === "language-not-supported") {
        wantOnRef.current = false;
        setListening(false);
        toast.error(`Your browser does not support dictation in ${langRef.current}.`);
        return;
      }
      // unknown — keep going if the user still wants it
      if (!wantOnRef.current) setListening(false);
    };
    rec.onend = () => {
      if (wantOnRef.current && recRef.current === rec) {
        // Browser stopped it on its own — restart cleanly. On mobile this
        // fires after every utterance, which is exactly how we get
        // continuous transcription on iOS / Android.
        scheduleRestart(120);
      } else {
        setListening(false);
      }
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      /* already running */
    }
  }, [clearRestartTimer, isMobile, scheduleRestart]);
  startInternalRef.current = startInternal;

  const start = useCallback(async () => {
    const Ctor =
      typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!Ctor) {
      setSupported(false);
      toast.error(
        "This browser does not support voice dictation. Use Chrome, Edge, or Safari 14.5+.",
      );
      return;
    }
    // Explicitly request mic permission via getUserMedia first. On iOS /
    // Android Chrome the SpeechRecognition API silently no-ops if the
    // permission prompt was never triggered from a user gesture.
    if (!permissionGrantedRef.current && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        permissionGrantedRef.current = true;
      } catch {
        toast.error("Microphone permission was denied. Enable it in your browser settings.");
        return;
      }
    }
    wantOnRef.current = true;
    startInternal();
  }, [startInternal]);

  const stop = useCallback(() => {
    wantOnRef.current = false;
    clearRestartTimer();
    recRef.current?.stop();
    setListening(false);
  }, [clearRestartTimer]);

  // When the caller changes the dictation language, restart the recognizer
  // with the new lang immediately so the next word is heard in the right
  // script — no lag, no dropped audio.
  useEffect(() => {
    if (wantOnRef.current && recRef.current) {
      try {
        recRef.current.abort();
      } catch {
        /* recognizer may already be stopped */
      }
      scheduleRestart(80);
    }
  }, [opts.lang, scheduleRestart]);

  useEffect(
    () => () => {
      wantOnRef.current = false;
      clearRestartTimer();
      recRef.current?.abort();
    },
    [clearRestartTimer],
  );

  return { listening, supported, start, stop };
}
