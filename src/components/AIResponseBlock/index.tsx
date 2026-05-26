import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { Copy, Download, Maximize2, Edit3, Check, FileDown, X, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Extensions ─────────────────────────────────────────────────────────────────

const RESP_EXT = [
  StarterKit,
  TaskList,
  TaskItem.configure({ nested: true }),
  Highlight,
  Link.configure({ openOnClick: true }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Underline,
  TextStyle,
];

// ── md → HTML ──────────────────────────────────────────────────────────────────

function mdToHtml(md: string): string {
  if (!md) return "<p></p>";
  if (md.trim().startsWith("<")) return md;

  const lines = md.split("\n");
  const html: string[] = [];
  let inUl = false;
  let inOl = false;

  function closeList() {
    if (inUl) { html.push("</ul>"); inUl = false; }
    if (inOl) { html.push("</ol>"); inOl = false; }
  }

  for (const line of lines) {
    if (/^###\s/.test(line))   { closeList(); html.push(`<h3>${fmt(line.slice(4))}</h3>`); continue; }
    if (/^##\s/.test(line))    { closeList(); html.push(`<h2>${fmt(line.slice(3))}</h2>`); continue; }
    if (/^#\s/.test(line))     { closeList(); html.push(`<h1>${fmt(line.slice(2))}</h1>`); continue; }
    if (/^[-*]\s/.test(line))  { if (inOl) { html.push("</ol>"); inOl = false; } if (!inUl) { html.push("<ul>"); inUl = true; } html.push(`<li>${fmt(line.slice(2))}</li>`); continue; }
    if (/^\d+\.\s/.test(line)) { if (inUl) { html.push("</ul>"); inUl = false; } if (!inOl) { html.push("<ol>"); inOl = true; } html.push(`<li>${fmt(line.replace(/^\d+\.\s/, ""))}</li>`); continue; }
    if (/^>\s/.test(line))     { closeList(); html.push(`<blockquote><p>${fmt(line.slice(2))}</p></blockquote>`); continue; }
    if (/^---+$/.test(line))   { closeList(); html.push("<hr>"); continue; }
    if (line.trim() === "")    { closeList(); html.push(""); continue; }
    html.push(`<p>${fmt(line)}</p>`);
  }

  closeList();
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

// ── Export helpers ─────────────────────────────────────────────────────────────

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function printHtml(html: string) {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Konejo Export</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:780px;margin:40px auto;color:#1e293b;line-height:1.75;font-size:15px}
  h1{font-size:1.6em;font-weight:700;margin:1.4em 0 .5em;color:#0f172a}
  h2{font-size:1.3em;font-weight:600;margin:1.2em 0 .4em;color:#1e293b}
  h3{font-size:1.1em;font-weight:600;margin:1em 0 .3em;color:#334155}
  p{margin:.5em 0}ul,ol{padding-left:1.5em;margin:.5em 0}li{margin:.2em 0}
  strong{font-weight:600;color:#0f172a}
  code{background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:.875em;font-family:monospace}
  pre{background:#1e293b;color:#e2e8f0;padding:16px;border-radius:8px;overflow:auto;font-size:.875em}
  blockquote{border-left:4px solid #ddd8fe;padding-left:1em;color:#475569;font-style:italic;margin:.5em 0}
  table{width:100%;border-collapse:collapse;margin:.8em 0}
  th{background:#f8fafc;text-align:left;padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;font-size:.9em}
  td{padding:8px 12px;border:1px solid #e2e8f0;font-size:.9em}
  @media print{body{margin:2cm}@page{margin:2cm}}
</style></head><body>${html}</body></html>`);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 150);
}

// ── ToolbarBtn ─────────────────────────────────────────────────────────────────

function ToolbarBtn({ onClick, label, icon, active = false }: {
  onClick: () => void; label: string; icon: React.ReactNode; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors select-none",
        active
          ? "bg-violet-100 text-violet-700"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ── FocusMode overlay ──────────────────────────────────────────────────────────

function FocusMode({ open, onClose, html, messageId }: {
  open: boolean; onClose: () => void; html: string; messageId: string;
}) {
  const [copied, setCopied] = useState(false);
  const editor = useEditor({ extensions: RESP_EXT, content: html, editable: true });
  const slug = messageId.slice(0, 8);

  // Refresh content when modal opens
  useEffect(() => {
    if (editor && open) editor.commands.setContent(html);
  }, [open]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(editor?.getText() ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const handleMd = () =>
    downloadBlob(editor?.getText() ?? "", `konejo-${slug}.md`, "text/markdown");
  const handleDoc = () =>
    downloadBlob(
      `<html><head><meta charset="utf-8"></head><body>${editor?.getHTML() ?? ""}</body></html>`,
      `konejo-${slug}.doc`,
      "application/msword"
    );
  const handlePdf = () => printHtml(editor?.getHTML() ?? "");

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[100] bg-white flex flex-col"
        >
          {/* Top bar */}
          <div className="flex-shrink-0 flex items-center justify-between px-8 py-3.5 border-b border-slate-100 bg-white">
            <div className="flex items-center gap-2.5">
              <div className="w-1 h-5 rounded-full bg-violet-500" />
              <span className="text-sm font-semibold text-slate-800">Focus mode</span>
              <span className="text-xs text-slate-400">— edita y exporta libremente</span>
            </div>

            <div className="flex items-center gap-1">
              {/* Export buttons */}
              <button
                onClick={handleCopy}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all",
                  copied ? "bg-emerald-50 text-emerald-600" : "text-slate-600 hover:bg-slate-100"
                )}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? "Copiado" : "Copiar"}
              </button>
              <button
                onClick={handleMd}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition-all"
              >
                <FileText size={12} /> .md
              </button>
              <button
                onClick={handleDoc}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition-all"
              >
                <FileDown size={12} /> .doc
              </button>
              <button
                onClick={handlePdf}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition-all"
              >
                <Download size={12} /> PDF
              </button>
              <div className="w-px h-5 bg-slate-200 mx-2" />
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Editor area */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-8 py-10">
              <EditorContent editor={editor} className="tiptap-editor tiptap-focus selectable" />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Streaming bubble (no Tiptap during stream) ─────────────────────────────────

function StreamingBubble({ content, thinkingSlot }: { content: string; thinkingSlot?: React.ReactNode }) {
  return (
    <div className={cn(
      "bg-white rounded-2xl rounded-tl-sm border border-slate-100 px-5 py-4",
      !content && "streaming-cursor"
    )}>
      {content ? (
        <div
          className="tiptap-editor selectable"
          dangerouslySetInnerHTML={{ __html: mdToHtml(content) }}
        />
      ) : (
        thinkingSlot
      )}
    </div>
  );
}

// ── FinishedResponseEditor — the full Tiptap editable block ────────────────────

function FinishedResponseEditor({ messageId, content }: { messageId: string; content: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);
  const slug = messageId.slice(0, 8);

  const editor = useEditor({
    extensions: RESP_EXT,
    content: mdToHtml(content),
    editable: false,
    onUpdate: () => {},
  });

  // Sync editable mode
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(isEditing);
    if (isEditing) setTimeout(() => editor.commands.focus("end"), 40);
  }, [isEditing, editor]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(editor?.getText() ?? content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const handleMd = () =>
    downloadBlob(content, `konejo-${slug}.md`, "text/markdown");
  const handleDoc = () =>
    downloadBlob(
      `<html><head><meta charset="utf-8"></head><body>${editor?.getHTML() ?? ""}</body></html>`,
      `konejo-${slug}.doc`,
      "application/msword"
    );
  const handlePdf = () => printHtml(editor?.getHTML() ?? "");

  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { if (!isEditing) setHovered(false); }}
        className={cn(
          "relative rounded-2xl rounded-tl-sm border transition-all duration-200",
          isEditing
            ? "border-violet-200 bg-white shadow-medium ring-2 ring-violet-50"
            : "border-slate-100 bg-white hover:border-slate-200 hover:shadow-soft"
        )}
      >
        {/* Floating action toolbar */}
        <AnimatePresence>
          {(hovered || isEditing) && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.95 }}
              transition={{ duration: 0.12 }}
              className="absolute -top-[38px] right-0 z-20 flex items-center gap-0.5
                         bg-white/95 backdrop-blur-sm border border-slate-200/80
                         rounded-xl shadow-medium px-1.5 py-1"
            >
              <ToolbarBtn
                onClick={() => setIsEditing((v) => !v)}
                label={isEditing ? "Vista" : "Editar"}
                icon={<Edit3 size={11} />}
                active={isEditing}
              />
              <div className="w-px h-3.5 bg-slate-200 mx-0.5" />
              <ToolbarBtn
                onClick={handleCopy}
                label={copied ? "✓" : "Copiar"}
                icon={<Copy size={11} />}
              />
              <ToolbarBtn onClick={handleMd}  label=".md"  icon={<FileText size={11} />} />
              <ToolbarBtn onClick={handleDoc} label=".doc" icon={<FileDown size={11} />} />
              <ToolbarBtn onClick={handlePdf} label="PDF"  icon={<Download size={11} />} />
              <div className="w-px h-3.5 bg-slate-200 mx-0.5" />
              <ToolbarBtn
                onClick={() => setIsFocused(true)}
                label="Focus"
                icon={<Maximize2 size={11} />}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        <div className={cn("px-5", isEditing ? "pt-4 pb-2" : "py-4")}>
          <EditorContent editor={editor} className="tiptap-editor selectable" />
        </div>

        {/* Edit mode footer */}
        {isEditing && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-violet-100 bg-violet-50/60 rounded-b-2xl">
            <span className="text-[11px] text-violet-500 font-medium flex items-center gap-1.5">
              <Edit3 size={10} /> Editando
            </span>
            <button
              onClick={() => setIsEditing(false)}
              className="text-[11px] font-semibold text-violet-600 hover:text-violet-800 transition-colors px-2 py-0.5 rounded hover:bg-violet-100"
            >
              Listo ✓
            </button>
          </div>
        )}
      </div>

      {/* Focus mode overlay */}
      <FocusMode
        open={isFocused}
        onClose={() => setIsFocused(false)}
        html={editor?.getHTML() ?? mdToHtml(content)}
        messageId={messageId}
      />
    </>
  );
}

// ── AIResponseBlock — public API ───────────────────────────────────────────────

interface AIResponseBlockProps {
  messageId: string;
  content: string;
  isStreaming?: boolean;
  thinkingSlot?: React.ReactNode;
}

export function AIResponseBlock({ messageId, content, isStreaming = false, thinkingSlot }: AIResponseBlockProps) {
  if (isStreaming) {
    return <StreamingBubble content={content} thinkingSlot={thinkingSlot} />;
  }
  return <FinishedResponseEditor messageId={messageId} content={content} />;
}
