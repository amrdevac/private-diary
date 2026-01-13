"use client";

import DiaryComposer from "./DiaryComposer";
import DiaryFeed from "./DiaryFeed";
import DiaryControlPanel from "./DiaryControlPanel";
import { useDiaryEntries } from "@/hooks/useDiaryEntries";
import { useCallback, useEffect, useState } from "react";
import ConfirmModal from "@/components/shared/ConfirmModal";
import { useDeleteConfirmStore } from "@/store/deleteConfirmStore";
import { useToast } from "@/ui/use-toast";
import { DiaryEntry, MentionReference } from "@/types/diary";

export default function DiaryDashboard() {
  const [search, setSearch] = useState("");
  const [activeEntryId, setActiveEntryId] = useState<number | null>(null);
  const [selectionAnchorId, setSelectionAnchorId] = useState<number | null>(null);
  const [selectedEntryIds, setSelectedEntryIds] = useState<number[]>([]);
  const [mentionDrafts, setMentionDrafts] = useState<MentionReference[]>([]);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { entries, loading, error, refresh, loadMore, hasMore, loadingMore } = useDiaryEntries(search);
  const { open, entryIds, message, pending, closeConfirm, setPending } = useDeleteConfirmStore();
  const { toast } = useToast();

  useEffect(() => {
    if (!entries.length) {
      setActiveEntryId(null);
      setSelectionAnchorId(null);
      setSelectedEntryIds([]);
      return;
    }
    if (activeEntryId !== null && !entries.some((entry) => entry.id === activeEntryId)) {
      const nextId = entries[0]?.id ?? null;
      setActiveEntryId(nextId);
      setSelectionAnchorId(nextId);
      setSelectedEntryIds(nextId ? [nextId] : []);
      return;
    }
    setSelectedEntryIds((prev) => {
      const filtered = prev.filter((id) => entries.some((entry) => entry.id === id));
      if (!filtered.length && activeEntryId !== null) {
        return [activeEntryId];
      }
      return filtered;
    });
    if (selectionAnchorId !== null && !entries.some((entry) => entry.id === selectionAnchorId)) {
      setSelectionAnchorId(activeEntryId);
    }
  }, [entries, activeEntryId, selectionAnchorId]);

  const getRangeIds = useCallback(
    (fromId: number, toId: number) => {
      const startIndex = entries.findIndex((entry) => entry.id === fromId);
      const endIndex = entries.findIndex((entry) => entry.id === toId);
      if (startIndex === -1 || endIndex === -1) return [toId];
      const [start, end] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
      return entries.slice(start, end + 1).map((entry) => entry.id);
    },
    [entries]
  );

  const handleSelectEntry = useCallback(
    (id: number | null, options?: { extend?: boolean }) => {
      if (id === null) {
        setActiveEntryId(null);
        setSelectionAnchorId(null);
        setSelectedEntryIds([]);
        return;
      }
      if (options?.extend) {
        const anchor = selectionAnchorId ?? activeEntryId ?? id;
        const range = getRangeIds(anchor, id);
        setSelectedEntryIds(range);
        setActiveEntryId(id);
        if (!selectionAnchorId) {
          setSelectionAnchorId(anchor);
        }
        return;
      }
      setActiveEntryId(id);
      setSelectionAnchorId(id);
      setSelectedEntryIds([id]);
    },
    [activeEntryId, selectionAnchorId, getRangeIds]
  );

  const handleAddMention = useCallback(
    (entry: DiaryEntry) => {
      setMentionDrafts((prev) =>
        prev.some((mention) => mention.id === entry.id)
          ? prev
          : [
              ...prev,
              {
                id: entry.id,
                preview: entry.content.slice(0, 200),
                createdAt: entry.createdAt,
              },
            ]
      );
    },
    []
  );

  const handleRemoveMention = useCallback((id: number) => {
    setMentionDrafts((prev) => prev.filter((mention) => mention.id !== id));
  }, []);

  const clearMentions = useCallback(() => setMentionDrafts([]), []);

  const handleDeleteEntries = useCallback(
    async (ids: number[]) => {
      if (!ids.length) return;
      setDeleteError(null);
      try {
        await Promise.all(
          ids.map(async (id) => {
            const res = await fetch("/api/diary", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success) {
              throw new Error(data?.error || "Gagal menghapus catatan.");
            }
          })
        );
        await refresh();
        toast({
          title: ids.length > 1 ? "Catatan terhapus" : "Catatan terhapus",
          description:
            ids.length > 1 ? `${ids.length} catatan berhasil dihapus.` : "Entri berhasil dihapus dari timeline.",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Gagal menghapus catatan.";
        setDeleteError(message);
        toast({
          title: "Gagal menghapus",
          description: message,
          variant: "destructive",
        });
        throw err;
      }
    },
    [refresh, toast]
  );

  const confirmDelete = useCallback(async () => {
    if (!entryIds.length) return;
    setPending(true);
    try {
      await handleDeleteEntries(entryIds);
      closeConfirm();
    } catch {
      // error surfaced via deleteError state
    } finally {
      setPending(false);
    }
  }, [entryIds, handleDeleteEntries, closeConfirm, setPending]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 lg:flex-row">
        <div className="flex-1 space-y-6">
          <Hero />
          <DiaryComposer
            onPosted={() => {
              refresh();
              clearMentions();
            }}
            mentions={mentionDrafts}
            onRemoveMention={handleRemoveMention}
          />
          <DiaryFeed
            entries={entries}
            loading={loading}
            loadingMore={loadingMore}
            error={error}
            onRetry={refresh}
            searchValue={search}
            onSearchChange={setSearch}
            activeEntryId={activeEntryId}
            selectedEntryIds={selectedEntryIds}
            onSelectEntry={handleSelectEntry}
            deleteError={deleteError}
            onMentionEntry={handleAddMention}
            hasMore={hasMore}
            onLoadMore={loadMore}
            onJumpToMention={setSearch}
          />
        </div>
        <div className="w-full lg:w-[320px]">
          <DiaryControlPanel />
        </div>
      </div>
      <ConfirmModal
        isOpen={open}
        onCancel={() => {
          if (!pending) closeConfirm();
        }}
        onConfirm={confirmDelete}
        title="Hapus catatan ini?"
        message={message}
        confirmText="Konfirmasi hapus"
        cancelText="Batal"
        autoFocusConfirm
        variant="overlay"
      />
    </div>
  );
}

function Hero() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
      <p className="text-sm uppercase tracking-[0.4em] text-slate-400">
        Private diary
      </p>
    </section>
  );
}
