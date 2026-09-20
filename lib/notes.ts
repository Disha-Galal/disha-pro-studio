/**
 * Non-fatal warnings collected while reading a document (e.g. "skipped 2 blank PDF pages").
 * Kept separate from processor.ts so readers (lib/readers/*) can push notes without importing
 * the orchestrator and creating a cycle.
 */
let notes: string[] = [];

export function pushNote(note: string): void {
  notes.push(note);
}

/** Returns and clears the notes collected since the last call. */
export function takeNotes(): string[] {
  const taken = notes;
  notes = [];
  return taken;
}
