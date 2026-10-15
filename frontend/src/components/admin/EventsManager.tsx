"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { EventIcon } from "@/components/revenue-trend/EventIcon";
import { ApiError, apiFetch, loginUrlForCurrentPage } from "@/lib/api";
import { formatDayDate } from "@/lib/format";
import type { DaySummary, EventImpact, ImpactEvent } from "@/lib/types";
import { Alert, Button, inputClass } from "./ui";

interface Draft {
  date: string;
  impact: EventImpact;
  title: string;
  description: string;
}

interface EventsManagerProps {
  weekStart: string;
  days: DaySummary[];
  events: ImpactEvent[];
}

export function EventsManager({ weekStart, days, events }: EventsManagerProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setEditing(null);
      setConfirmingDelete(null);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push(loginUrlForCurrentPage());
        return;
      }
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const save = (draft: Draft, id?: number) =>
    run(() =>
      apiFetch(id ? `/api/admin/events/${id}` : "/api/admin/events", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(draft),
      }),
    );

  const remove = (id: number) => run(() => apiFetch(`/api/admin/events/${id}`, { method: "DELETE" }));

  return (
    <section className="rounded-[20px] border border-line bg-surface p-5 sm:p-6" aria-labelledby="events-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="events-title" className="font-medium">
            Events
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            Things that moved the numbers. They appear as markers above the bars of their day.
          </p>
        </div>
        {editing === null && (
          <Button
            onClick={() => {
              setEditing("new");
              setError(null);
            }}
          >
            <Plus size={15} aria-hidden />
            Add event
          </Button>
        )}
      </div>

      {error && (
        <div className="mt-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {editing === "new" && (
        <EventForm
          key={`new-${weekStart}`}
          days={days}
          initial={{ date: days[0].date, impact: "positive", title: "", description: "" }}
          busy={busy}
          submitLabel="Add event"
          onCancel={() => setEditing(null)}
          onSubmit={(draft) => save(draft)}
        />
      )}

      {events.length === 0 && editing !== "new" ? (
        <p className="mt-5 rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          No events this week.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-line border-t border-line">
          {events.map((event) =>
            editing === event.id ? (
              <li key={event.id}>
                <EventForm
                  days={days}
                  initial={{
                    date: event.date,
                    impact: event.impact,
                    title: event.title,
                    description: event.description ?? "",
                  }}
                  busy={busy}
                  submitLabel="Save changes"
                  onCancel={() => setEditing(null)}
                  onSubmit={(draft) => save(draft, event.id)}
                />
              </li>
            ) : (
              <li key={event.id} className="flex items-start gap-3 py-3.5">
                <span
                  className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border ${
                    event.impact === "positive" ? "border-[#bfeccb] bg-[#ecfcef]" : "border-[#f6c9cd] bg-[#fdeeef]"
                  }`}
                  title={event.impact === "positive" ? "Positive impact" : "Negative impact"}
                >
                  <EventIcon impact={event.impact} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{event.title}</span>
                    <span className="ml-2 whitespace-nowrap text-muted">{formatDayDate(event.date)}</span>
                  </p>
                  {event.description && <p className="mt-0.5 text-sm text-muted">{event.description}</p>}
                </div>
                {confirmingDelete === event.id ? (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className="text-sm text-muted">Delete this event?</span>
                    <Button variant="ghost" onClick={() => setConfirmingDelete(null)} disabled={busy}>
                      Cancel
                    </Button>
                    <Button variant="danger" onClick={() => remove(event.id)} loading={busy}>
                      Delete
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditing(event.id);
                        setError(null);
                      }}
                      disabled={editing !== null}
                      aria-label={`Edit ${event.title}`}
                    >
                      <Pencil size={14} aria-hidden />
                      <span className="hidden sm:inline">Edit</span>
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => setConfirmingDelete(event.id)}
                      disabled={editing !== null}
                      aria-label={`Delete ${event.title}`}
                    >
                      <Trash2 size={14} aria-hidden />
                    </Button>
                  </div>
                )}
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}

interface EventFormProps {
  days: DaySummary[];
  initial: Draft;
  busy: boolean;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (draft: Draft) => void;
}

function EventForm({ days, initial, busy, submitLabel, onCancel, onSubmit }: EventFormProps) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [titleError, setTitleError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.title.trim()) {
      setTitleError("Title is required");
      return;
    }
    onSubmit({ ...draft, title: draft.title.trim(), description: draft.description.trim() });
  }

  return (
    <form onSubmit={submit} noValidate className="my-4 grid gap-4 rounded-xl bg-subtle p-4 sm:grid-cols-[180px_1fr]">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Day</span>
        <select value={draft.date} onChange={(e) => set("date", e.target.value)} className={inputClass}>
          {days.map((day) => (
            <option key={day.date} value={day.date}>
              {formatDayDate(day.date)}
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend className="mb-1.5 block text-sm font-medium">Impact</legend>
        <div className="inline-flex rounded-[10px] border border-line bg-white p-0.5">
          {(["positive", "negative"] as const).map((impact) => (
            <label
              key={impact}
              className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-medium has-focus-visible:ring-2 has-focus-visible:ring-ink/20 ${
                draft.impact === impact ? "bg-ink text-white" : "text-ink/75 hover:text-ink"
              }`}
            >
              <input
                type="radio"
                name="impact"
                value={impact}
                checked={draft.impact === impact}
                onChange={() => set("impact", impact)}
                className="sr-only"
              />
              <EventIcon impact={impact} color={draft.impact === impact ? "#ffffff" : undefined} />
              {impact === "positive" ? "Positive" : "Negative"}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block sm:col-span-2">
        <span className="mb-1.5 block text-sm font-medium">Title</span>
        <input
          value={draft.title}
          onChange={(e) => {
            set("title", e.target.value);
            setTitleError(null);
          }}
          maxLength={120}
          placeholder="e.g. Street food festival"
          aria-invalid={Boolean(titleError)}
          className={inputClass}
          autoFocus
        />
        {titleError && <span className="mt-1 block text-xs text-down">{titleError}</span>}
      </label>

      <label className="block sm:col-span-2">
        <span className="mb-1.5 block text-sm font-medium">
          Description <span className="font-normal text-muted">(optional)</span>
        </span>
        <textarea
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          maxLength={500}
          rows={2}
          className={`${inputClass} h-auto py-2`}
        />
      </label>

      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
