import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { getNote, listNotes, saveNote, MAX_NOTE_LENGTH } from "./notes.server";
import {
  approveRefundRequest,
  raiseRefundRequest,
} from "./refunds.server";
import { fakeNotifications } from "./notifications.fake.server";
import { toggleBookmark } from "./bookmarks.server";

type TestDb = ReturnType<typeof createTestDb>;

const NOW = new Date(2026, 9, 6, 12, 0, 0);
const LATER = new Date(2026, 9, 7, 12, 0, 0);

function daysBefore(days: number) {
  const when = new Date(NOW);
  when.setDate(when.getDate() - days);
  return when.toISOString();
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

describe("saving a note", () => {
  it("creates a note on a lesson with none, with the body trimmed", () => {
    const result = saveNote(db, base.user.id, lessonIds[0], "  hello  ", NOW);

    expect(result).toMatchObject({
      ok: true,
      note: {
        userId: base.user.id,
        lessonId: lessonIds[0],
        body: "hello",
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      },
    });
  });

  it("replaces the body and moves updatedAt on, keeping createdAt", () => {
    saveNote(db, base.user.id, lessonIds[0], "first", NOW);
    const result = saveNote(db, base.user.id, lessonIds[0], "second", LATER);

    expect(result).toMatchObject({
      ok: true,
      note: {
        body: "second",
        createdAt: NOW.toISOString(),
        updatedAt: LATER.toISOString(),
      },
    });
  });

  it("never leaves a student with two notes on the same lesson", () => {
    saveNote(db, base.user.id, lessonIds[0], "first", NOW);
    saveNote(db, base.user.id, lessonIds[0], "second", LATER);

    const rows = db
      .select()
      .from(schema.notes)
      .all()
      .filter((n) => n.userId === base.user.id && n.lessonId === lessonIds[0]);
    expect(rows).toHaveLength(1);
  });

  it("accepts a note at exactly the length cap", () => {
    const body = "a".repeat(MAX_NOTE_LENGTH);
    const result = saveNote(db, base.user.id, lessonIds[0], body, NOW);
    expect(result).toMatchObject({ ok: true, note: { body } });
  });

  it("refuses a note one character over the cap", () => {
    const result = saveNote(
      db,
      base.user.id,
      lessonIds[0],
      "a".repeat(MAX_NOTE_LENGTH + 1),
      NOW
    );

    expect(result).toEqual({
      ok: false,
      error: "A note cannot be longer than 2,000 characters.",
    });
    expect(getNote(db, base.user.id, lessonIds[0])).toBeUndefined();
  });

  it("removes the note when the body is emptied", () => {
    saveNote(db, base.user.id, lessonIds[0], "something", NOW);

    const result = saveNote(db, base.user.id, lessonIds[0], "   ", LATER);

    expect(result).toEqual({ ok: true, note: null });
    expect(getNote(db, base.user.id, lessonIds[0])).toBeUndefined();
  });
});

describe("listing a student's notes", () => {
  it("returns only that student's rows, newest edit first, with lesson and course", () => {
    const other = addStudent("Ben");

    saveNote(db, base.user.id, lessonIds[0], "older", NOW);
    saveNote(db, base.user.id, lessonIds[1], "newer", LATER);
    saveNote(db, other.id, lessonIds[2], "not mine", LATER);

    const mine = listNotes(db, base.user.id);

    expect(mine).toHaveLength(2);
    expect(mine.map((n) => n.body)).toEqual(["newer", "older"]);
    expect(mine[0]).toMatchObject({
      lessonId: lessonIds[1],
      lessonTitle: "Lesson 2",
      moduleTitle: "Basics",
      courseTitle: "Test Course",
      courseSlug: "test-course",
    });
  });
});

describe("an approved refund", () => {
  it("leaves the student's bookmarks and notes in place", async () => {
    const notifications = fakeNotifications();

    const purchase = db
      .insert(schema.purchases)
      .values({
        userId: base.user.id,
        courseId: base.course.id,
        amountPaid: 7900,
        createdAt: daysBefore(3),
      })
      .returning()
      .get();
    db.insert(schema.enrollments)
      .values({ userId: base.user.id, courseId: base.course.id })
      .run();

    saveNote(db, base.user.id, lessonIds[0], "my private note", NOW);
    toggleBookmark(db, base.user.id, lessonIds[0], NOW);

    const raised = await raiseRefundRequest(
      db,
      purchase.id,
      base.user.id,
      "Not for me.",
      NOW,
      notifications
    );
    if (!raised.ok) throw new Error(raised.error);

    const platformAdmin = db
      .insert(schema.users)
      .values({
        name: "Pat Admin",
        email: "pat@example.com",
        role: schema.UserRole.Admin,
      })
      .returning()
      .get();

    const decision = await approveRefundRequest(
      db,
      raised.refundRequestId,
      platformAdmin.id,
      null,
      LATER,
      notifications
    );
    expect(decision.ok).toBe(true);

    expect(getNote(db, base.user.id, lessonIds[0])).toMatchObject({
      body: "my private note",
    });
    expect(
      db
        .select()
        .from(schema.bookmarks)
        .all()
        .filter((b) => b.userId === base.user.id)
    ).toHaveLength(1);
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
