/**
 * ⚠️ PROTOTYPE — THROWAWAY. Not production code.
 *
 * Answers wayfinder ticket "What does the Notification Feed look like in Cadence?"
 * (#14). Three radically different takes on the Notification Feed, switchable via
 * `?variant=` + a floating bottom bar, mounted in the real sidebar user row so the
 * surface overlays a real page for honest density:
 *
 *   A — Sidebar popover   : DevUI-style dropdown opening upward from the bell.
 *   B — Right slide-over  : full-height drawer sliding in over <main>.
 *   C — Full inbox page    : bell navigates to a dedicated page (simulated as a
 *                            full-area overlay here), All / Unread tabs.
 *
 * Data is hardcoded sample Notifications from the catalogue (#10), shaped like a
 * Knock feed item (id / unread / insertedAt / actor / type). NOT wired to live
 * Knock — "roughly against the vendor" per the ticket; real feed-fetching is
 * implementation work. State is in-memory only (no persistence).
 *
 * Gated to dev builds. On resolution this file + its one mount line in sidebar.tsx
 * go to a throwaway branch; the winning variant gets rebuilt properly.
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import {
  Bell,
  BadgeCheck,
  BookOpen,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Inbox,
  MessageSquare,
  Receipt,
  X,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";

type NotifType = "N1" | "N4" | "N5" | "N6" | "N8";

interface SampleNotification {
  id: string;
  type: NotifType;
  title: string;
  course: string;
  when: string; // relative, static for the prototype
  group: "Today" | "Earlier";
  href: string;
  unread: boolean;
}

const ICON: Record<NotifType, typeof Bell> = {
  N1: BadgeCheck,
  N4: BookOpen,
  N5: MessageSquare,
  N6: MessageSquare,
  N8: Receipt,
};

const SAMPLE: SampleNotification[] = [
  {
    id: "n8",
    type: "N8",
    title: "Maria López requested a refund",
    course: "React Fundamentals",
    when: "2m",
    group: "Today",
    href: "/admin/refunds",
    unread: true,
  },
  {
    id: "n6",
    type: "N6",
    title: "Tom Reed asked a question",
    course: "Lesson 4 · Hooks",
    when: "18m",
    group: "Today",
    href: "/instructor/questions",
    unread: true,
  },
  {
    id: "n5",
    type: "N5",
    title: "Alex Kim replied to your comment",
    course: "useEffect deep-dive",
    when: "1h",
    group: "Today",
    href: "/courses/react-fundamentals/lessons/42",
    unread: true,
  },
  {
    id: "n4",
    type: "N4",
    title: "New lesson: Suspense",
    course: "React Fundamentals",
    when: "3h",
    group: "Today",
    href: "/courses/react-fundamentals",
    unread: false,
  },
  {
    id: "n1",
    type: "N1",
    title: "Your refund was approved — $49 on its way back",
    course: "Advanced TypeScript",
    when: "Yesterday",
    group: "Earlier",
    href: "/dashboard",
    unread: false,
  },
];

const VARIANTS = ["A", "B", "C"] as const;
type Variant = (typeof VARIANTS)[number];
const VARIANT_NAME: Record<Variant, string> = {
  A: "Sidebar popover",
  B: "Right slide-over",
  C: "Full inbox page",
};

export function NotificationFeedPrototype() {
  if (!import.meta.env.DEV) return null;
  return <Inner />;
}

function Inner() {
  const [searchParams, setSearchParams] = useSearchParams();
  const variant = (
    VARIANTS.includes(searchParams.get("variant") as Variant)
      ? searchParams.get("variant")
      : "A"
  ) as Variant;

  const [items, setItems] = useState(SAMPLE);
  const [open, setOpen] = useState(false);
  const unreadCount = items.filter((i) => i.unread).length;

  function setVariant(v: Variant) {
    setOpen(false);
    setSearchParams(
      (prev) => {
        prev.set("variant", v);
        return prev;
      },
      { replace: true },
    );
  }

  function cycle(dir: 1 | -1) {
    const idx = VARIANTS.indexOf(variant);
    setVariant(VARIANTS[(idx + dir + VARIANTS.length) % VARIANTS.length]);
  }

  // Keyboard ←/→ cycles variants, unless typing in a field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el as HTMLElement | null)?.isContentEditable
      )
        return;
      if (e.key === "ArrowLeft") cycle(-1);
      if (e.key === "ArrowRight") cycle(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function markRead(id: string) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, unread: false } : i)),
    );
  }
  function markAllRead() {
    setItems((prev) => prev.map((i) => ({ ...i, unread: false })));
  }
  function openItem(n: SampleNotification) {
    markRead(n.id);
    setOpen(false);
    toast(`Would open: ${n.href}`);
  }

  return (
    <>
      {/* The bell — lives in the sidebar user row in every variant */}
      <div className="relative">
        <button
          type="button"
          title="Notifications"
          onClick={() => setOpen((o) => !o)}
          className="relative rounded-md p-1 text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold leading-none text-primary-foreground">
              {unreadCount}
            </span>
          )}
        </button>

        {variant === "A" && open && (
          <VariantPopover
            items={items}
            onOpen={openItem}
            onMarkAll={markAllRead}
            onClose={() => setOpen(false)}
          />
        )}
      </div>

      {variant === "B" && open && (
        <VariantDrawer
          items={items}
          unread={unreadCount}
          onOpen={openItem}
          onMarkAll={markAllRead}
          onClose={() => setOpen(false)}
        />
      )}

      {variant === "C" && open && (
        <VariantPage
          items={items}
          onOpen={openItem}
          onMarkAll={markAllRead}
          onMarkRead={markRead}
          onClose={() => setOpen(false)}
        />
      )}

      <Switcher variant={variant} onPrev={() => cycle(-1)} onNext={() => cycle(1)} />
    </>
  );
}

function Row({
  n,
  onClick,
  size = "sm",
}: {
  n: SampleNotification;
  onClick: () => void;
  size?: "sm" | "lg";
}) {
  const Icon = ICON[n.type];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 px-3 text-left transition-colors hover:bg-accent",
        size === "sm" ? "py-2.5" : "py-3",
      )}
    >
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              "truncate text-sm",
              n.unread ? "font-semibold" : "font-medium text-foreground/80",
            )}
          >
            {n.title}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">{n.when}</span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {n.course}
        </span>
      </span>
      {n.unread && (
        <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="unread" />
      )}
    </button>
  );
}

/* A — DevUI-style popover, opens upward from the bell */
function VariantPopover({
  items,
  onOpen,
  onMarkAll,
  onClose,
}: {
  items: SampleNotification[];
  onOpen: (n: SampleNotification) => void;
  onMarkAll: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute bottom-full left-0 z-50 mb-2 w-80 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          <button
            onClick={onMarkAll}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <CheckCheck className="size-3" /> Mark all read
          </button>
        </div>
        <div className="max-h-96 divide-y overflow-y-auto">
          {items.map((n) => (
            <Row key={n.id} n={n} onClick={() => onOpen(n)} />
          ))}
        </div>
        <div className="border-t px-3 py-2 text-center">
          <button className="text-xs text-muted-foreground hover:text-foreground">
            View all
          </button>
        </div>
      </div>
    </>
  );
}

/* B — full-height drawer sliding in from the right over <main> */
function VariantDrawer({
  items,
  unread,
  onOpen,
  onMarkAll,
  onClose,
}: {
  items: SampleNotification[];
  unread: number;
  onOpen: (n: SampleNotification) => void;
  onMarkAll: () => void;
  onClose: () => void;
}) {
  const groups = ["Today", "Earlier"] as const;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="absolute right-0 top-0 flex h-full w-96 flex-col border-l bg-background shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="size-4" />
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                {unread}
              </span>
            )}
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex items-center justify-end border-b px-4 py-1.5">
          <button
            onClick={onMarkAll}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <CheckCheck className="size-3" /> Mark all read
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {groups.map((g) => {
            const rows = items.filter((i) => i.group === g);
            if (!rows.length) return null;
            return (
              <div key={g}>
                <div className="bg-muted/50 px-4 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {g}
                </div>
                <div className="divide-y">
                  {rows.map((n) => (
                    <Row key={n.id} n={n} onClick={() => onOpen(n)} size="lg" />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* C — dedicated inbox page (simulated as a full-area overlay), All / Unread tabs */
function VariantPage({
  items,
  onOpen,
  onMarkAll,
  onMarkRead,
  onClose,
}: {
  items: SampleNotification[];
  onOpen: (n: SampleNotification) => void;
  onMarkAll: () => void;
  onMarkRead: (id: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"all" | "unread">("all");
  const shown = tab === "all" ? items : items.filter((i) => i.unread);
  return (
    <div className="fixed inset-y-0 right-0 left-0 z-50 overflow-y-auto bg-background md:left-64">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Inbox className="size-5" />
            <h1 className="text-xl font-semibold">Notifications</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onMarkAll}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="size-4" /> Mark all read
            </button>
            <button onClick={onClose} className="rounded-md p-1 hover:bg-accent" title="Close (prototype)">
              <X className="size-4" />
            </button>
          </div>
        </div>
        <div className="mb-4 flex gap-1 border-b">
          {(["all", "unread"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm capitalize",
                tab === t
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="overflow-hidden rounded-md border divide-y">
          {shown.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Nothing here.
            </div>
          )}
          {shown.map((n) => (
            <div key={n.id} className="group flex items-center">
              <div className="flex-1">
                <Row n={n} onClick={() => onOpen(n)} size="lg" />
              </div>
              {n.unread && (
                <button
                  onClick={() => onMarkRead(n.id)}
                  title="Mark read"
                  className="mr-3 rounded-md p-1.5 text-muted-foreground opacity-0 transition hover:bg-accent group-hover:opacity-100"
                >
                  <Check className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Prototype-only variant switcher. Hidden in production (whole component is dev-gated). */
function Switcher({
  variant,
  onPrev,
  onNext,
}: {
  variant: Variant;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-1 rounded-full border bg-background/95 px-1.5 py-1 shadow-lg backdrop-blur">
      <Button size="icon-sm" variant="ghost" onClick={onPrev} title="Previous variant (←)">
        <ChevronLeft className="size-4" />
      </Button>
      <span className="px-2 text-xs font-medium tabular-nums">
        Feed {variant} · {VARIANT_NAME[variant]}
      </span>
      <Button size="icon-sm" variant="ghost" onClick={onNext} title="Next variant (→)">
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
