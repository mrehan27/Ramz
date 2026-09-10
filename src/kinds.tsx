/**
 * The UI half of the kind registry: which page renders each kind.
 *
 * Everything that is not React lives in `shared/kinds.ts`, which the server
 * imports too. Adding a kind means adding it there, then a row here.
 */
import type { ReactNode } from "react";
import { KINDS, type KindId } from "../shared/kinds.ts";
import type { Entry, EntryInput, TagColor } from "../shared/schema.ts";
import { ListPage } from "./pages/ListPage.tsx";
import { NotesPage } from "./pages/NotesPage.tsx";
import { PromptsPage } from "./pages/PromptsPage.tsx";
import { RunbooksPage } from "./pages/RunbooksPage.tsx";

/** Every page gets the same props; a page uses what it needs. */
export type PageProps = {
  entries: Entry[];
  tagColors: Record<string, TagColor>;
  onSave: (input: EntryInput, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleExport: (entry: Entry) => Promise<void>;
  onTogglePin: (entry: Entry) => Promise<void>;
  onToggleArchive: (entry: Entry) => Promise<void>;
  onUsed: (id: string) => void;
  onTagColor: (tag: string, color: TagColor | null) => void;
  /** Kind-specific buttons in the page header, e.g. Import and Sync to shell. */
  actions?: ReactNode;
};

const PAGES: Record<KindId, (props: PageProps) => ReactNode> = {
  alias: (p) => <ListPage kind="alias" {...p} />,
  snippet: (p) => <ListPage kind="snippet" {...p} />,
  prompt: (p) => <PromptsPage {...p} />,
  runbook: (p) => <RunbooksPage {...p} />,
  note: (p) => <NotesPage {...p} />,
};

export function page(id: KindId, props: PageProps) {
  return PAGES[id](props);
}

export { KINDS, type KindId };
