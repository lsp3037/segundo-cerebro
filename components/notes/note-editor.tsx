"use client";

import type { Block } from "@blocknote/core";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import { pt } from "@blocknote/core/locales";
import { type DefaultReactSuggestionItem, SuggestionMenuController, useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { FileTextIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef } from "react";

import { uploadAttachment } from "@/lib/attachments";

export type NoteContent = { json: Block[]; markdown: string; text: string };

// Editor no estilo Notion: "/" abre os tipos de bloco e "@" cria link para outra nota.
// Avisa as mudanças com um pequeno atraso, para não salvar a cada tecla.
export default function NoteEditor({
  noteId,
  initialJson,
  initialMarkdown,
  otherNotes,
  onChange,
}: {
  noteId: string;
  initialJson: unknown;
  initialMarkdown: string | null;
  otherNotes: { id: string; title: string }[];
  onChange: (content: NoteContent) => void;
}) {
  const { resolvedTheme } = useTheme();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useCreateBlockNote(
    {
      dictionary: pt,
      initialContent: Array.isArray(initialJson) && initialJson.length > 0 ? (initialJson as Block[]) : undefined,
      uploadFile: (file) => uploadAttachment(file, { type: "notes", id: noteId }),
    },
    [noteId],
  );

  // Notas criadas pela Caixa de Entrada ou por modelo chegam só em Markdown.
  const importedMarkdown = useRef(false);
  useEffect(() => {
    if (importedMarkdown.current || (Array.isArray(initialJson) && initialJson.length > 0) || !initialMarkdown) return;
    importedMarkdown.current = true;
    editor.replaceBlocks(editor.document, editor.tryParseMarkdownToBlocks(initialMarkdown));
  }, [editor, initialJson, initialMarkdown]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function handleChange() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const markdown = editor.blocksToMarkdownLossy(editor.document);
      const text = markdown
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/[#>*_`~-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      onChange({ json: editor.document, markdown, text });
    }, 800);
  }

  const linkItems = useMemo(
    () => (query: string) =>
      filterSuggestionItems(
        otherNotes.slice(0, 500).map(
          (n): DefaultReactSuggestionItem => ({
            title: n.title || "Sem título",
            icon: <FileTextIcon className="size-4" />,
            group: "Notas",
            onItemClick: () =>
              editor.insertInlineContent([
                { type: "link", href: `/conhecimento/${n.id}`, content: n.title || "Sem título" },
                " ",
              ]),
          }),
        ),
        query,
      ).slice(0, 12),
    [editor, otherNotes],
  );

  return (
    <BlockNoteView
      editor={editor}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      onChange={handleChange}
      className="note-editor"
    >
      <SuggestionMenuController triggerCharacter="@" getItems={async (query) => linkItems(query)} />
    </BlockNoteView>
  );
}
