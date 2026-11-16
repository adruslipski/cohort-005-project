import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "~/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { bookmarks, courses, lessons, modules } from "~/db/schema";

// ─── Bookmarks ───
// A Bookmark is a Student's flag on a Lesson, private to them. One per Student
// per Lesson, enforced by a unique index on (user_id, lesson_id). See
// GLOSSARY.md for the language.
//
// Every function takes the database first, so tests can hand in an in-memory
// one. Uses positional parameters (project convention).

export type Db = BetterSQLite3Database<typeof schema>;

/** A Bookmark joined to its Lesson and the Course the Lesson belongs to. */
export type SavedBookmark = {
  id: number;
  lessonId: number;
  lessonTitle: string;
  moduleTitle: string;
  courseTitle: string;
  courseSlug: string;
  createdAt: string;
};

/** Whether the Student has a Bookmark on this Lesson. */
export function isBookmarked(
  db: Db,
  studentId: number,
  lessonId: number
): boolean {
  return !!db
    .select({ id: bookmarks.id })
    .from(bookmarks)
    .where(
      and(eq(bookmarks.userId, studentId), eq(bookmarks.lessonId, lessonId))
    )
    .get();
}

/**
 * Adds the Student's Bookmark on a Lesson if it is absent, removes it if it is
 * present. Returns whether the Lesson is bookmarked afterwards.
 */
export function toggleBookmark(
  db: Db,
  studentId: number,
  lessonId: number,
  now: Date
): boolean {
  const existing = db
    .select()
    .from(bookmarks)
    .where(
      and(eq(bookmarks.userId, studentId), eq(bookmarks.lessonId, lessonId))
    )
    .get();

  if (existing) {
    db.delete(bookmarks).where(eq(bookmarks.id, existing.id)).run();
    return false;
  }

  db.insert(bookmarks)
    .values({ userId: studentId, lessonId, createdAt: now.toISOString() })
    .run();
  return true;
}

/** The Student's Bookmarks, newest first, each joined to its Lesson and Course. */
export function listBookmarks(db: Db, studentId: number): SavedBookmark[] {
  return db
    .select({
      id: bookmarks.id,
      lessonId: bookmarks.lessonId,
      lessonTitle: lessons.title,
      moduleTitle: modules.title,
      courseTitle: courses.title,
      courseSlug: courses.slug,
      createdAt: bookmarks.createdAt,
    })
    .from(bookmarks)
    .innerJoin(lessons, eq(lessons.id, bookmarks.lessonId))
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .innerJoin(courses, eq(courses.id, modules.courseId))
    .where(eq(bookmarks.userId, studentId))
    .orderBy(desc(bookmarks.createdAt))
    .all();
}
