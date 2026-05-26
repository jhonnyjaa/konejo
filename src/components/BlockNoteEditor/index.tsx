import { useEffect, useMemo, useRef, memo } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import type { Block } from "@blocknote/core";

interface BlockNoteEditorProps {
  content: string;     // Markdown string
  onChange?: (markdown: string) => void;
  editable?: boolean;
  className?: string;
}

// Renderizador de markdown simple para el thread de chat (sin editor completo)
export function MarkdownRenderer({ content, className = "" }: { content: string; className?: string }) {
  const html = useMemo(() => markdownToHtml(content), [content]);
  return (
    <div
      className={`prose-konejo selectable ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// Editor BlockNote completo para documentos editables
export const BlockNoteEditor = memo(function BlockNoteEditor({
  content,
  onChange,
  editable = true,
  className = "",
}: BlockNoteEditorProps) {
  const editor = useCreateBlockNote();
  const initializedRef = useRef(false);

  // Parsear markdown inicial una sola vez
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    editor.tryParseMarkdownToBlocks(content).then((blocks) => {
      editor.replaceBlocks(editor.document, blocks);
    });
  }, []);

  return (
    <div className={`bn-konejo ${className}`}>
      <BlockNoteView
        editor={editor}
        editable={editable}
        onChange={() => {
          if (onChange) {
            editor.blocksToMarkdownLossy(editor.document).then(onChange);
          }
        }}
        theme="light"
      />
    </div>
  );
});

// ── Conversión Markdown → HTML (lightweight, sin deps extra) ──────────────────

function markdownToHtml(md: string): string {
  let html = md
    // Escape
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Bloques de código
  html = html.replace(/```[\s\S]*?```/g, (match) => {
    const code = match.slice(3, -3).replace(/^\w+\n/, "");
    return `<pre><code>${code}</code></pre>`;
  });

  // Código inline
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Headings
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h2>$1</h2>");

  // Bold/Italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Blockquote
  html = html.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");

  // Tablas (básico)
  html = html.replace(/\|(.+)\|/g, (match) => {
    if (match.includes("---")) return "";
    const cells = match.split("|").filter(Boolean).map((c) => c.trim());
    const isHeader = html.indexOf(match) < html.indexOf("---") + 50;
    const tag = isHeader ? "th" : "td";
    return `<tr>${cells.map((c) => `<${tag}>${c}</${tag}>`).join("")}</tr>`;
  });

  // Listas
  html = html.replace(/^- \[ \] (.+)$/gm, "<li><input type='checkbox' disabled> $1</li>");
  html = html.replace(/^- \[x\] (.+)$/gm, "<li><input type='checkbox' checked disabled> $1</li>");
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/^(\d+)\. (.+)$/gm, "<li>$2</li>");

  // Wrap listas consecutivas
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Línea horizontal
  html = html.replace(/^---$/gm, "<hr>");

  // Párrafos (líneas no marcadas)
  html = html.replace(/^(?!<[a-z]|$)(.+)$/gm, "<p>$1</p>");

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Emojis de tabla de acciones ⚠️ riesgo
  return html;
}
