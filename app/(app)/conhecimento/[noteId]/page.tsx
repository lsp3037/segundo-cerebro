import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { NoteView } from "@/components/notes/note-view";
import { getNote } from "@/lib/data/notes";

async function load(noteId: string) {
  if (!z.uuid().safeParse(noteId).success) return null;
  return getNote(noteId);
}

export async function generateMetadata(props: PageProps<"/conhecimento/[noteId]">): Promise<Metadata> {
  const data = await load((await props.params).noteId);
  return { title: data?.note.title ?? "Nota" };
}

export default async function NotePage(props: PageProps<"/conhecimento/[noteId]">) {
  const data = await load((await props.params).noteId);
  if (!data) notFound();

  return <NoteView key={data.note.id} note={data.note} otherNotes={data.otherNotes} backlinks={data.backlinks} />;
}
