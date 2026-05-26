import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Typography from "@tiptap/extension-typography";
import { cn } from "@/lib/utils";

interface EditorProps {
  content: string;
  onChange?: (html: string) => void;
  readonly?: boolean;
  placeholder?: string;
  className?: string;
}

const EXTENSIONS = [
  StarterKit,
  TaskList,
  TaskItem.configure({ nested: true }),
  Table.configure({ resizable: false }),
  TableRow,
  TableCell,
  TableHeader,
  Highlight.configure({ multicolor: true }),
  Link.configure({ openOnClick: false }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Underline,
  TextStyle,
  Typography,
];

export function KonejoEditor({ content, onChange, readonly = false, placeholder, className }: EditorProps) {
  const editor = useEditor({
    extensions: [
      ...EXTENSIONS,
      ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
    ],
    content,
    editable: !readonly,
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
  });

  if (!editor) return null;

  return (
    <div className={cn("tiptap-wrapper", className)}>
      {/* Simple floating toolbar via CSS - appears on text selection */}
      <EditorContent editor={editor} className="tiptap-editor selectable" />
    </div>
  );
}

// ── Markdown / HTML renderer (read-only Tiptap instance) ──────────────────────

export function MarkdownRenderer({ content }: { content: string }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow, TableCell, TableHeader,
      Highlight, Link, TextAlign.configure({ types: ["heading", "paragraph"] }),
      Underline, TextStyle,
    ],
    content: mdToHtml(content),
    editable: false,
  });

  if (!editor) {
    return (
      <div
        className="prose-konejo selectable"
        dangerouslySetInnerHTML={{ __html: mdToHtml(content) }}
      />
    );
  }

  return <EditorContent editor={editor} className="tiptap-editor selectable" />;
}

// ── Basic markdown → HTML helper ───────────────────────────────────────────────
// Only used as a fallback; Tiptap parses HTML natively.
// If content is already HTML (starts with <), pass through.

function mdToHtml(md: string): string {
  if (!md) return "";
  // If content looks like HTML, pass through
  if (md.trim().startsWith("<")) return md;

  const lines = md.split("\n");
  const html: string[] = [];
  let inList = false;

  for (const raw of lines) {
    const line = raw;
    if (line.match(/^###\s/))       { if (inList) { html.push("</ul>"); inList = false; } html.push(`<h3>${fmt(line.slice(4))}</h3>`); continue; }
    if (line.match(/^##\s/))        { if (inList) { html.push("</ul>"); inList = false; } html.push(`<h2>${fmt(line.slice(3))}</h2>`); continue; }
    if (line.match(/^#\s/))         { if (inList) { html.push("</ul>"); inList = false; } html.push(`<h1>${fmt(line.slice(2))}</h1>`); continue; }
    if (line.match(/^[-*]\s/))      { if (!inList) { html.push("<ul>"); inList = true; } html.push(`<li>${fmt(line.slice(2))}</li>`); continue; }
    if (line.match(/^\d+\.\s/))     { if (!inList) { html.push("<ol>"); inList = true; } html.push(`<li>${fmt(line.replace(/^\d+\.\s/, ""))}</li>`); continue; }
    if (line.match(/^>\s/))         { if (inList) { html.push("</ul>"); inList = false; } html.push(`<blockquote><p>${fmt(line.slice(2))}</p></blockquote>`); continue; }
    if (line.match(/^---+$/))       { if (inList) { html.push("</ul>"); inList = false; } html.push("<hr>"); continue; }
    if (inList && line.trim() === "") { html.push("</ul>"); inList = false; }
    if (line.trim() === "")         { html.push(""); continue; }
    html.push(`<p>${fmt(line)}</p>`);
  }

  if (inList) html.push("</ul>");
  return html.join("\n");
}

function fmt(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,     "<em>$1</em>")
    .replace(/_(.+?)_/g,       "<em>$1</em>")
    .replace(/`(.+?)`/g,       "<code>$1</code>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
}
