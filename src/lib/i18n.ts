import { useEffect, useState } from "react";

export type Lang = "en" | "ar";
const KEY = "astra-lang";
const EVT = "astra-lang-change";

export const dict: Record<string, string> = {
  // common
  "Sign in": "تسجيل الدخول",
  "Sign out": "تسجيل الخروج",
  "Get started": "ابدأ الآن",
  "Create account": "إنشاء حساب",
  "I have an account": "لدي حساب بالفعل",
  "Register": "تسجيل جديد",
  "Cancel": "إلغاء",
  "Create": "إنشاء",
  "Creating…": "جارٍ الإنشاء…",
  "Signing in…": "جارٍ تسجيل الدخول…",
  "Creating account…": "جارٍ إنشاء الحساب…",
  "Welcome": "أهلاً بك",
  "Welcome back": "أهلاً بعودتك",
  "Email": "البريد الإلكتروني",
  "Password": "كلمة المرور",
  "Password (min 8)": "كلمة المرور (8 أحرف على الأقل)",
  "Display name (optional)": "الاسم الظاهر (اختياري)",
  "Activation code": "كود التفعيل",
  "Owner-controlled access. New accounts require an activation code.":
    "الوصول يخضع لإدارة المالك. الحسابات الجديدة تتطلب كود تفعيل.",
  "Forgot your password? Contact the owner to reset it.":
    "نسيت كلمة المرور؟ تواصل مع المالك لإعادة التعيين.",
  "Owner": "المالك",
  "Owner console": "لوحة المالك",
  "by GX Team": "من فريق GX",
  "Professional document platform": "منصة مستندات احترافية",
  "Account created": "تم إنشاء الحساب",
  "Account created. Please sign in.": "تم إنشاء الحساب. الرجاء تسجيل الدخول.",
  "Registration failed": "فشل التسجيل",

  // landing
  "Dictate, edit, and read large documents — in Arabic & English.":
    "أملِ، حرِّر، واقرأ المستندات الكبيرة — بالعربية والإنجليزية.",
  "ASTRA STUDIO is a serious workspace for lawyers, teachers, researchers, writers, and students. Speak it. Write it. Read it. Export it.":
    "أسترا ستوديو مساحة عمل احترافية للمحامين والمعلمين والباحثين والكُتّاب والطلاب. تحدث، اكتب، اقرأ، وصدِّر.",
  "Voice Dictation": "إملاء صوتي",
  "Arabic + English speech-to-text with punctuation commands.":
    "تحويل الكلام إلى نص بالعربية والإنجليزية مع أوامر الترقيم.",
  "Large Documents": "مستندات كبيرة",
  "Edit long documents with Tiptap — RTL, LTR, and mixed.":
    "حرر مستندات طويلة — يمين-يسار، يسار-يمين، ومختلطة.",
  "Read Aloud": "قراءة صوتية",
  "Built-in text-to-speech with adjustable rate and voice.":
    "قراءة نصية مدمجة بسرعة وصوت قابلين للضبط.",
  "Search & Replace": "بحث واستبدال",
  "Find anything across your document instantly.": "ابحث عن أي شيء في مستندك فوراً.",
  "Bookmarks": "الإشارات المرجعية",
  "Jump back to important sections in one click.": "عُد إلى الأقسام المهمة بنقرة واحدة.",
  "Export": "تصدير",
  "Download as DOCX, PDF, or plain text.": "نزّل بصيغة DOCX أو PDF أو نص عادي.",
  "AI Assistance": "مساعد ذكي",
  "Summarize, rewrite, and translate inside your document.":
    "تلخيص وإعادة صياغة وترجمة داخل مستندك.",
  "Owner-controlled access": "وصول خاضع لإدارة المالك",
  "Activation-code based registration.": "تسجيل عبر كود تفعيل.",
  "Contact": "تواصل",

  // dashboard
  "Your projects": "مشاريعك",
  "projects": "مشاريع",
  "New project": "مشروع جديد",
  "Give your document a title. You can change it later.":
    "أعطِ مستندك عنواناً — يمكنك تغييره لاحقاً.",
  "No projects yet": "لا توجد مشاريع بعد",
  "Create your first project to start dictating and writing.":
    "أنشئ مشروعك الأول لتبدأ الإملاء والكتابة.",
  "Loading…": "جارٍ التحميل…",
  "words": "كلمة",
  "Delete this project? This cannot be undone.": "حذف هذا المشروع؟ لا يمكن التراجع.",
  "Project deleted": "تم حذف المشروع",
  "Project limit reached (5)": "تم بلوغ حد المشاريع (5)",
  "Delete": "حذف",
  "e.g. Court memo — March": "مثال: مذكرة محكمة — مارس",
  "Untitled": "بدون عنوان",

  // editor
  "Back": "رجوع",
  "Save": "حفظ",
  "Saved": "تم الحفظ",
  "Saving…": "جارٍ الحفظ…",
  "Dictate": "إملاء",
  "Stop": "إيقاف",
  "Read": "قراءة",
  "AI": "مساعد",
  "Find": "بحث",
  "Replace": "استبدال",
  "Find and replace": "بحث واستبدال",
  "Search…": "ابحث…",
  "Replace with…": "استبدل بـ…",
  "Replace all": "استبدال الكل",
  "Add bookmark": "إضافة إشارة",
  "Bookmark label": "اسم الإشارة",
  "Language": "اللغة",
  "Arabic": "العربية",
  "English": "الإنجليزية",
  "Mixed": "مختلط",
  "Title": "العنوان",
  "Document": "المستند",

  // AI panel
  "AI Assistant": "المساعد الذكي",
  "Summarize document": "تلخيص المستند",
  "Improve writing": "تحسين الصياغة",
  "Explain": "اشرح",
  "Translate → Arabic": "ترجم إلى العربية",
  "Translate → English": "ترجم إلى الإنجليزية",
  "Custom prompt": "طلب مخصص",
  "Type your prompt…": "اكتب طلبك…",
  "Run": "تنفيذ",
  "Thinking…": "جارٍ التفكير…",
  "Copy": "نسخ",
  "Copied": "تم النسخ",
  "Insert into document": "إدراج في المستند",
  "Choose a mode and press Run. Results appear here.":
    "اختر وضعاً ثم اضغط تنفيذ. ستظهر النتائج هنا.",
  "Nothing to send": "لا يوجد نص لإرساله",

  // owner
  "Owner Console": "لوحة المالك",
  "Activation codes": "أكواد التفعيل",
  "Generate codes": "توليد أكواد",
  "Audit log": "سجل التدقيق",
  "Users": "المستخدمون",
  "Status": "الحالة",
  "Used by": "استخدمه",
  "Notes": "ملاحظات",
  "Revoke": "إلغاء",
  "Generate": "توليد",
};

export function applyLanguage(lang: Lang) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
}

export function getLang(): Lang {
  if (typeof window === "undefined") return "en";
  return (localStorage.getItem(KEY) as Lang | null) ?? "en";
}

export function setLang(lang: Lang) {
  localStorage.setItem(KEY, lang);
  applyLanguage(lang);
  window.dispatchEvent(new CustomEvent(EVT, { detail: lang }));
}

export function useLang() {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    const cur = getLang();
    setLangState(cur);
    applyLanguage(cur);
    const h = (e: Event) => setLangState((e as CustomEvent).detail as Lang);
    window.addEventListener(EVT, h);
    return () => window.removeEventListener(EVT, h);
  }, []);
  const t = (s: string) => (lang === "ar" ? dict[s] ?? s : s);
  return { lang, t, setLang };
}
