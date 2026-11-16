import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "~/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { courses, lessons, modules, notes } from "~/db/schema";

// ─── Notes ───
// A Note is a Student's own writing about a Lesson, private to the Student who
// wrote it — nobody else, not the Course's Instructor, not a Platform Admin.
// One per Student per Lesson, enforced by a unique index on
// (user_id, lesson_id). A Note is plain text, never rendered as Markdown. See
// GLOSSARY.md for the language.
//
// Every function takes the database first, so tests can hand in an in-memory
// one. Uses positional parameters (project convention).

export type Db = BetterSQLite3Database<typeof schema>;

type Note = typeof notes.$inferSelect;

/** A Note body is trimmed and capped at this many characters on write. */
export const MAX_NOTE_LENGTH = 2000;

/** The message shown when a Note is refused for being too long. */
export const NOTE_TOO_LONG_MESSAGE = `A note cannot be longer than 2,000 characters.`;

export type NoteFailure = { ok: false; error: string };

/** `note` is null when an empty body cleared the Student's Note. */
export type SaveNoteResult = { ok: true; note: Note | null } | NoteFailure;

/** The Student's Note on a Lesson, if they have one. */
export function getNote(db: Db, studentId: number, lessonId: number) {
  return db
    .select()
    .from(notes)
    .where(and(eq(notes.userId, studentId), eq(notes.lessonId, lessonId)))
    .get();
}

/**
 * Saves the Student's Note on a Lesson. A new Note is created; an existing one
 * has its body replaced and its `updatedAt` moved on, while `createdAt` stays.
 * An empty (or whitespace-only) body removes the Note. A body longer than
 * {@link MAX_NOTE_LENGTH} characters is refused rather than truncated.
 */
export function saveNote(
  db: Db,
  studentId: number,
  lessonId: number,
  body: string,
  now: Date
): SaveNoteResult {
  const trimmed = body.trim();
  if (trimmed.length > MAX_NOTE_LENGTH) {
    return { ok: false, error: NOTE_TOO_LONG_MESSAGE };
  }

  const existing = getNote(db, studentId, lessonId);

  if (trimmed.length === 0) {
    if (existing) {
      db.delete(notes).where(eq(notes.id, existing.id)).run();
    }
    return { ok: true, note: null };
  }

  if (existing) {
    const note = db
      .update(notes)
      .set({ body: trimmed, updatedAt: now.toISOString() })
      .where(eq(notes.id, existing.id))
      .returning()
      .get();
    return { ok: true, note };
  }

  const note = db
    .insert(notes)
    .values({
      userId: studentId,
      lessonId,
      body: trimmed,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    })
    .returning()
    .get();
  return { ok: true, note };
}

/** A Note joined to its Lesson and the Course the Lesson belongs to. */
export type SavedNote = {
  id: number;
  lessonId: number;
  lessonTitle: string;
  moduleTitle: string;
  courseTitle: string;
  courseSlug: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

/** The Student's Notes, newest edit first, each joined to its Lesson and Course. */
export function listNotes(db: Db, studentId: number): SavedNote[] {
  return db
    .select({
      id: notes.id,
      lessonId: notes.lessonId,
      lessonTitle: lessons.title,
      moduleTitle: modules.title,
      courseTitle: courses.title,
      courseSlug: courses.slug,
      body: notes.body,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
    })
    .from(notes)
    .innerJoin(lessons, eq(lessons.id, notes.lessonId))
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .innerJoin(courses, eq(courses.id, modules.courseId))
    .where(eq(notes.userId, studentId))
    .orderBy(desc(notes.updatedAt))
    .all();
}
