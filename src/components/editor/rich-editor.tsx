import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Extension } from "@tiptap/core";
import { useEffect, useRef, useState } from "react";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered, Quote,
  Heading1, Heading2, Heading3, AlignLeft, AlignCenter, AlignRight, Undo, Redo, Highlighter,
  Palette, Type as TypeIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Minimal FontSize extension — adds a `style="font-size: ..."` to text-style marks.
const FontSize = Extension.create({
  name: "fontSize",
  addOptions() { return { types: ["textStyle"] as string[] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (el: HTMLElement) => el.style.fontSize || null,
          renderHTML: (attrs: any) => attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
        },
      },
    }];
  },
  addCommands() {
    return {
      setFontSize: (size: string) => ({ chain }: any) =>
        chain().setMark("textStyle", { fontSize: size }).run(),
      unsetFontSize: () => ({ chain }: any) =>
        chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    } as any;
  },
});

// Highlight mark extension that supports user-chosen highlight colors via
// the Highlight extension's multicolor option. We also expose a custom mark
// for grammar issues so we can decorate / navigate them from the route.
const GrammarMark = Extension.create({
  name: "grammarMark",
}).extend({
  // placeholder; the real Mark lives below
});

const PALETTE = [
  "#0F172A", "#1E40AF", "#0E7490", "#15803D", "#CA8A04",
  "#B91C1C", "#9D174D", "#7C3AED", "#000000", "#6B7280",
  "#F59E0B", "#FDE68A", "#A7F3D0", "#BFDBFE", "#FBCFE8",
];
const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "30px", "36px", "48px"];

type Props = {
  initialContent: unknown;
  dir: "ltr" | "rtl";
  onChange: (json: unknown, text: string, wordCount: number) => void;
  onReady?: (editor: ReturnType<typeof useEditor>) => void;
};

export function RichEditor({ initialContent, dir, onChange, onReady }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      FontSize,
      Link.configure({ openOnClick: true, HTMLAttributes: { rel: "noopener noreferrer" } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({
        placeholder: dir === "rtl" ? "ابدأ الكتابة أو املي صوتك..." : "Start writing or dictate...",
      }),
    ],
    content: (initialContent as object) ?? "",
    editorProps: {
      attributes: {
        dir,
        class: dir === "rtl" ? "rtl" : "ltr",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      const wc = text.trim().length ? text.trim().split(/\s+/).length : 0;
      onChange(editor.getJSON(), text, wc);
    },
  });

  useEffect(() => {
    if (editor && onReady) onReady(editor);
  }, [editor, onReady]);

  useEffect(() => {
    if (editor) {
      editor.setOptions({
        editorProps: {
          attributes: {
            dir,
            class: dir === "rtl" ? "rtl" : "ltr",
            spellcheck: "true",
          },
        },
      });
    }
  }, [dir, editor]);

  if (!mounted || !editor) {
    return <div className="min-h-[60vh] animate-pulse rounded-md bg-muted/40" />;
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <Toolbar editor={editor} />
      <div className="border-t border-border">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: NonNullable<ReturnType<typeof useEditor>> }) {
  return (
    <div className="flex flex-wrap items-center gap-1 p-2">
      <Button variant="ghost" size="icon" onClick={() => editor.chain().focus().undo().run()}>
        <Undo className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => editor.chain().focus().redo().run()}>
        <Redo className="size-4" />
      </Button>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <Toggle pressed={editor.isActive("heading", { level: 1 })}
        onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 className="size-4" />
      </Toggle>
      <Toggle pressed={editor.isActive("heading", { level: 2 })}
        onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="size-4" />
      </Toggle>
      <Toggle pressed={editor.isActive("heading", { level: 3 })}
        onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 className="size-4" />
      </Toggle>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <Toggle pressed={editor.isActive("bold")} onPressedChange={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="size-4" />
      </Toggle>
      <Toggle pressed={editor.isActive("italic")} onPressedChange={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="size-4" />
      </Toggle>
      <Toggle pressed={editor.isActive("underline")} onPressedChange={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="size-4" />
      </Toggle>
      <Toggle pressed={editor.isActive("strike")} onPressedChange={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="size-4" />
      </Toggle>
      <Toggle pressed={editor.isActive("highlight")} onPressedChange={() => editor.chain().focus().toggleHighlight().run()}>
        <Highlighter className="size-4" />
      </Toggle>
      {/* Text color */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" title="Text color"><Palette className="size-4" /></Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2">
          <p className="text-xs font-semibold mb-2">Text color</p>
          <div className="grid grid-cols-5 gap-1.5">
            {PALETTE.map((c) => (
              <button key={`t-${c}`} onClick={() => editor.chain().focus().setColor(c).run()}
                className="h-6 w-6 rounded border" style={{ background: c }} title={c} />
            ))}
          </div>
          <p className="text-xs font-semibold mt-3 mb-2">Highlight</p>
          <div className="grid grid-cols-5 gap-1.5">
            {PALETTE.map((c) => (
              <button key={`h-${c}`} onClick={() => editor.chain().focus().toggleHighlight({ color: c }).run()}
                className="h-6 w-6 rounded border" style={{ background: c }} title={c} />
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="outline" className="flex-1"
              onClick={() => editor.chain().focus().unsetColor().run()}>Reset color</Button>
            <Button size="sm" variant="outline" className="flex-1"
              onClick={() => editor.chain().focus().unsetHighlight().run()}>Reset HL</Button>
          </div>
        </PopoverContent>
      </Popover>
      {/* Font size */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" title="Font size"><TypeIcon className="size-4" /></Button>
        </PopoverTrigger>
        <PopoverContent className="w-40 p-1">
          {FONT_SIZES.map((s) => (
            <Button key={s} variant="ghost" size="sm" className="w-full justify-start"
              onClick={() => (editor.chain().focus() as any).setFontSize(s).run()}>{s}</Button>
          ))}
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground"
            onClick={() => (editor.chain().focus() as any).unsetFontSize().run()}>Reset</Button>
        </PopoverContent>
      </Popover>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <Toggle pressed={editor.isActive("bulletList")} onPressedChange={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="size-4" />
      </Toggle>
      <Toggle pressed={editor.isActive("orderedList")} onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="size-4" />
      </Toggle>
      <Toggle pressed={editor.isActive("blockquote")} onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="size-4" />
      </Toggle>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <Toggle pressed={editor.isActive({ textAlign: "left" })}
        onPressedChange={() => editor.chain().focus().setTextAlign("left").run()}>
        <AlignLeft className="size-4" />
      </Toggle>
      <Toggle pressed={editor.isActive({ textAlign: "center" })}
        onPressedChange={() => editor.chain().focus().setTextAlign("center").run()}>
        <AlignCenter className="size-4" />
      </Toggle>
      <Toggle pressed={editor.isActive({ textAlign: "right" })}
        onPressedChange={() => editor.chain().focus().setTextAlign("right").run()}>
        <AlignRight className="size-4" />
      </Toggle>
    </div>
  );
}
