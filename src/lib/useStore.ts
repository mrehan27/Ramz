import { useCallback, useEffect, useState } from "react";
import type { Entry, EntryInput } from "../../shared/schema.ts";
import type { TagColor } from "../../shared/schema.ts";
import { api, type Config, type TagColors } from "./api.ts";

export function useStore() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [tagColors, setTagColors] = useState<TagColors>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [list, cfg, tags] = await Promise.all([api.list(), api.config(), api.tags()]);
      setEntries(list);
      setConfig(cfg);
      setTagColors(tags);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not reach the RAMZ api");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const save = useCallback(async (input: EntryInput, id?: string) => {
    if (id) await api.update(id, input);
    else await api.create(input);
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    await api.remove(id);
    await refresh();
  }, [refresh]);

  const patch = useCallback(async (entry: Entry, changes: Partial<EntryInput>) => {
    const { id, createdAt, updatedAt, ...rest } = entry;
    void createdAt; void updatedAt;
    await api.update(id, { ...rest, ...changes });
    await refresh();
  }, [refresh]);

  const toggleExport = useCallback((entry: Entry) => patch(entry, { exported: !entry.exported }), [patch]);
  const togglePin = useCallback((entry: Entry) => patch(entry, { pinned: !entry.pinned }), [patch]);
  const toggleArchive = useCallback((entry: Entry) => patch(entry, { archived: !entry.archived }), [patch]);

  /** Fire-and-forget: a failed count must never get in the way of a copy. */
  const markUsed = useCallback((id: string) => {
    setEntries((list) => list.map((e) => (e.id === id ? { ...e, useCount: e.useCount + 1 } : e)));
    void api.markUsed(id).catch(() => {});
  }, []);

  const setTagColor = useCallback(async (tag: string, color: TagColor | null) => {
    setTagColors(await api.setTagColor(tag, color));
  }, []);

  const renameTag = useCallback(async (tag: string, to: string) => {
    setTagColors((await api.renameTag(tag, to)).tagColors);
    await refresh();
  }, [refresh]);

  const deleteTag = useCallback(async (tag: string) => {
    setTagColors((await api.deleteTag(tag)).tagColors);
    await refresh();
  }, [refresh]);

  return {
    entries, config, tagColors, error, loading, refresh,
    save, remove, toggleExport, togglePin, toggleArchive, markUsed, setTagColor, renameTag, deleteTag,
  };
}
