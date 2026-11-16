import { describe, it, expect, beforeEach } from "vitest";
import { and, eq } from "drizzle-orm";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { isBookmarked, listBookmarks, toggleBookmark } from "./bookmarks.server";

type TestDb = ReturnType<typeof createTestDb>;

const NOW = new Date(2026, 9, 6, 12, 0, 0);

function laterBy(minutes: number) {
  return new Date(NOW.getTime() + minutes * 60_000);
}

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let moduleId: number;
let lessonIds: number[];

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);

  moduleId = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get().id;

  lessonIds = [1, 2, 3].map(
    (position) =>
      db
        .insert(schema.lessons)
        .values({ moduleId, title: `Lesson ${position}`, position })
        .returning()
        .get().id
  );
});

describe("toggling a bookmark", () => {
  it("creates a bookmark on a lesson with none, then removes it", () => {
    expect(toggleBookmark(db, base.user.id, lessonIds[0], NOW)).toBe(true);
    expect(isBookmarked(db, base.user.id, lessonIds[0])).toBe(true);

    expect(toggleBookmark(db, base.user.id, lessonIds[0], NOW)).toBe(false);
    expect(isBookmarked(db, base.user.id, lessonIds[0])).toBe(false);
  });

  it("never leaves a student with two bookmarks on the same lesson", () => {
    toggleBookmark(db, base.user.id, lessonIds[0], NOW);
    toggleBookmark(db, base.user.id, lessonIds[0], NOW); // remove
    toggleBookmark(db, base.user.id, lessonIds[0], NOW); // add again

    const rows = db
      .select()
      .from(schema.bookmarks)
      .where(
        and(
          eq(schema.bookmarks.userId, base.user.id),
          eq(schema.bookmarks.lessonId, lessonIds[0])
        )
      )
      .all();
    expect(rows).toHaveLength(1);
  });
});

describe("listing a student's bookmarks", () => {
  it("returns only that student's rows, newest first, with lesson and course", () => {
    const other = addStudent("Ben");

    toggleBookmark(db, base.user.id, lessonIds[0], NOW);
    toggleBookmark(db, base.user.id, lessonIds[1], laterBy(5));
    toggleBookmark(db, other.id, lessonIds[2], laterBy(10));

    const mine = listBookmarks(db, base.user.id);

    expect(mine).toHaveLength(2);
    expect(mine.map((b) => b.lessonId)).toEqual([lessonIds[1], lessonIds[0]]);
    expect(mine[0]).toMatchObject({
      lessonId: lessonIds[1],
      lessonTitle: "Lesson 2",
      moduleTitle: "Basics",
      courseTitle: "Test Course",
      courseSlug: "test-course",
    });
  });
});

function addStudent(name: string) {
  return db
    .insert(schema.users)
    .values({
      name,
      email: `${name.toLowerCase()}@example.com`,
      role: schema.UserRole.Student,
    })
    .returning()
    .get();
}
