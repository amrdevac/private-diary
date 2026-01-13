"use client";

import { useDiarySession } from "@/components/providers/DiarySessionProvider";
import { DiaryEntry, MentionReference } from "@/types/diary";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDeleteConfirmStore } from "@/store/deleteConfirmStore";

interface DiaryFeedProps {
  entries: DiaryEntry[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  onRetry: () => void;
  searchValue: string;
  onSearchChange: (next: string) => void;
  activeEntryId: number | null;
  selectedEntryIds: number[];
  onSelectEntry: (id: number | null, options?: { extend?: boolean }) => void;
  deleteError: string | null;
  onMentionEntry: (entry: DiaryEntry) => void;
  hasMore: boolean;
  onLoadMore: () => void;
  onJumpToMention?: (query: string) => void;
}

export default function DiaryFeed({
  entries,
  loading,
  loadingMore,
  error,
  onRetry,
  searchValue,
  onSearchChange,
  activeEntryId,
  selectedEntryIds,
  onSelectEntry,
  deleteError,
  onMentionEntry,
  hasMore,
  onLoadMore,
  onJumpToMention,
}: DiaryFeedProps) {
  const { blurSettings } = useDiarySession();
  const searchRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLElement>(null);
  const entryRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const revealSetRef = useRef<Set<number>>(new Set());
  const [, forceRevealUpdate] = useState(0);
  const [timelineFocused, setTimelineFocused] = useState(false);
  const hasSearchedRef = useRef(false);
  const openConfirm = useDeleteConfirmStore((state) => state.openConfirm);
  const confirmOpen = useDeleteConfirmStore((state) => state.open);

  const registerEntryRef = useCallback(
    (id: number) => (node: HTMLDivElement | null) => {
      if (node) {
        entryRefs.current.set(id, node);
      } else {
        entryRefs.current.delete(id);
      }
    },
    []
  );

  const handleSelectEntry = useCallback(
    (id: number | null, options?: { extend?: boolean }) => {
      setTimelineFocused(true);
      onSelectEntry(id, options);
    },
    [onSelectEntry]
  );

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === "/") {
        event.preventDefault();
        searchContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        requestAnimationFrame(() => {
          searchRef.current?.focus();
          searchRef.current?.select();
        });
        return;
      }
      if (event.key === "Escape" && document.activeElement === searchRef.current) {
        event.preventDefault();
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    const handleArrowNav = (event: KeyboardEvent) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      if (confirmOpen) return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName.toLowerCase();
        if (tagName === "input" || tagName === "textarea" || target.isContentEditable) {
          return;
        }
      }
      if (!entries.length) return;
      event.preventDefault();
      const currentIndex = activeEntryId ? entries.findIndex((entry) => entry.id === activeEntryId) : -1;
      if (event.key === "ArrowDown") {
        const next = entries[Math.min(currentIndex + 1, entries.length - 1)];
        const targetId = next?.id ?? entries[entries.length - 1].id;
        handleSelectEntry(targetId, { extend: event.shiftKey });
      } else {
        const prevIndex = currentIndex === -1 ? entries.length - 1 : Math.max(currentIndex - 1, 0);
        const targetId = entries[prevIndex].id;
        handleSelectEntry(targetId, { extend: event.shiftKey });
      }
    };
    window.addEventListener("keydown", handleArrowNav);
    return () => window.removeEventListener("keydown", handleArrowNav);
  }, [confirmOpen, entries, handleSelectEntry, activeEntryId]);

  useEffect(() => {
    const handleDeleteKey = (event: KeyboardEvent) => {
      if (event.key !== "Delete") return;
      if (confirmOpen) return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea" || target.isContentEditable) {
          return;
        }
      }
      if (!selectedEntryIds.length) return;
      event.preventDefault();
      openConfirm(
        selectedEntryIds,
        selectedEntryIds.length > 1
          ? `${selectedEntryIds.length} catatan akan hilang permanen dari timeline.`
          : "Catatan akan hilang permanen dari timeline."
      );
    };
    window.addEventListener("keydown", handleDeleteKey);
    return () => window.removeEventListener("keydown", handleDeleteKey);
  }, [confirmOpen, selectedEntryIds, openConfirm]);

  useEffect(() => {
    const handleEscapeClear = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (!timelineFocused) return;
      event.preventDefault();
      onSelectEntry(null);
      setTimelineFocused(false);
      if (revealSetRef.current.size) {
        revealSetRef.current.clear();
        forceRevealUpdate((prev) => prev + 1);
      }
    };
    window.addEventListener("keydown", handleEscapeClear);
    return () => window.removeEventListener("keydown", handleEscapeClear);
  }, [timelineFocused, onSelectEntry]);

  useEffect(() => {
    if (revealSetRef.current.size) {
      revealSetRef.current.clear();
      forceRevealUpdate((prev) => prev + 1);
    }
  }, [activeEntryId]);

  useEffect(() => {
    const handleHoldReveal = (event: KeyboardEvent) => {
      if (!timelineFocused) return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName.toLowerCase();
        if (tagName === "input" || tagName === "textarea" || target.isContentEditable) {
          return;
        }
      }
      if (event.ctrlKey && event.altKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (activeEntryId != null && !revealSetRef.current.has(activeEntryId)) {
          revealSetRef.current.add(activeEntryId);
          forceRevealUpdate((prev) => prev + 1);
        }
      }
    };
    const handleReleaseReveal = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "s" && revealSetRef.current.size) {
        revealSetRef.current.clear();
        forceRevealUpdate((prev) => prev + 1);
      }
    };
    window.addEventListener("keydown", handleHoldReveal);
    window.addEventListener("keyup", handleReleaseReveal);
    return () => {
      window.removeEventListener("keydown", handleHoldReveal);
      window.removeEventListener("keyup", handleReleaseReveal);
    };
  }, [activeEntryId, timelineFocused]);

  const handleJumpToMention = useCallback(
    (mention: MentionReference) => {
      const { preview } = mention;
      onSearchChange(preview);
      onJumpToMention?.(preview);
      setTimelineFocused(false);
      requestAnimationFrame(() => searchRef.current?.focus());
    },
    [onSearchChange, onJumpToMention]
  );

  useEffect(() => {
    const handleMentionShortcut = (event: KeyboardEvent) => {
      if (!timelineFocused) return;
      const entry = entries.find((item) => item.id === activeEntryId);
      if (!entry) return;
      if (event.ctrlKey && event.altKey && event.key.toLowerCase() === "m") {
        event.preventDefault();
        onMentionEntry(entry);
        const composeSection = document.querySelector("[data-section='compose']");
        const textarea = document.querySelector("[data-id='diary-composer-textarea']") as HTMLTextAreaElement | null;
        if (composeSection) {
          composeSection.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        requestAnimationFrame(() => textarea?.focus());
      }
      if (event.ctrlKey && event.altKey && event.key.toLowerCase() === "g") {
        if (!entry.mentions?.length) return;
        event.preventDefault();
        handleJumpToMention(entry.mentions[0]);
      }
    };
    window.addEventListener("keydown", handleMentionShortcut);
    return () => window.removeEventListener("keydown", handleMentionShortcut);
  }, [timelineFocused, entries, activeEntryId, onMentionEntry, handleJumpToMention]);

  useEffect(() => {
    const handleFocusChange = (event: FocusEvent) => {
      if (!feedRef.current) return;
      const inside = feedRef.current.contains(event.target as Node);
      setTimelineFocused(inside);
      if (!inside && revealSetRef.current.size) {
        revealSetRef.current.clear();
        forceRevealUpdate((prev) => prev + 1);
      }
    };
    window.addEventListener("focusin", handleFocusChange, true);
    return () => window.removeEventListener("focusin", handleFocusChange, true);
  }, []);


  useEffect(() => {
    if (searchValue.trim().length > 0) {
      hasSearchedRef.current = true;
    }
  }, [searchValue]);

  useEffect(() => {
    if (!hasSearchedRef.current) return;
    if (loading && timelineRef.current) {
      timelineRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [loading]);

  useEffect(() => {
    if (activeEntryId == null) return;
    const node = entryRefs.current.get(activeEntryId);
    if (node) {
      node.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeEntryId]);

  const showEmpty = !loading && !error && entries.length === 0;

  useEffect(() => {
    if (!hasMore) return;
    const target = loadMoreRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entriesObs) => {
        const entry = entriesObs[0];
        if (entry.isIntersecting && !loading && !loadingMore) {
          onLoadMore();
        }
      },
      { root: timelineRef.current, threshold: 0.2 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, onLoadMore]);

  return (
    <section ref={feedRef} className="diary-surface rounded-3xl border p-6 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="diary-label">Timeline</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2" ref={searchContainerRef}>
          <div className="relative">
            <Input
              ref={searchRef}
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              onFocus={() => setTimelineFocused(false)}
              placeholder="Cari catatan (Ctrl + /)"
              className="diary-search-input  w-48 rounded-xl  focus:border-0 focus:ring-1 pr-10 text-sm sm:w-64"
              aria-label="Cari catatan di timeline"
            />
            {!loading ? (
              <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 diary-search-icon" />
            ) : (
              <Loader2 className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin diary-loader" />
            )}
          </div>
        </div>
      </div>
      {deleteError && (
        <p className="diary-error-text mt-2 text-sm">{deleteError}</p>
      )}

      <div ref={timelineRef} className="mt-6 flex flex-col space-y-4" id="timeline-scroll">
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`skeleton-${index}`}
                className="diary-skeleton h-24 rounded-2xl animate-pulse"
              />
            ))}
          </div>
        )}

        {error && (
          <div className="diary-error-panel rounded-2xl border p-4 text-sm">
            <p>{error}</p>
            <Button variant="ghost" size="sm" className="mt-2 px-2" onClick={onRetry}>
              Coba lagi
            </Button>
          </div>
        )}

        {showEmpty && (
          <div className="flex flex-1 items-center justify-center">
            <div className="diary-empty-panel rounded-2xl border border-dashed p-6 text-center">
              <p className="diary-empty-text">Belum ada apa-apa di sini. Tulis sesuatu dulu.</p>
            </div>
          </div>
        )}

        {!error && !loading &&
          entries.map((entry, index) => (
            <DiaryCard
              key={entry.content.replaceAll(" ","") + index + "_baru"}
              entry={entry}
              blurEnabled={blurSettings.feedBlurEnabled}
              selected={selectedEntryIds.includes(entry.id)}
              active={timelineFocused && entry.id === activeEntryId}
              showBlur={!revealSetRef.current.has(entry.id)}
              onSelect={(extend) => handleSelectEntry(entry.id, { extend })}
              onMention={() => onMentionEntry(entry)}
              onJumpToMention={handleJumpToMention}
              innerRef={registerEntryRef(entry.id)}
            />
          ))}
        <div ref={loadMoreRef} className="flex justify-center py-4">
          {loadingMore && <Loader2 className="diary-loader size-5 animate-spin" />}
          {!loading && !loadingMore && hasMore && (
            <button
              type="button"
              onClick={onLoadMore}
              className="diary-link text-xs"
            >
              Muat lagi
            </button>
          )}
          {!hasMore && !loading && entries.length > 0 && (
            <span className="diary-text-muted text-xs">Sudah sampai akhir</span>
          )}
        </div>
      </div>
    </section>
  );
}

interface DiaryCardProps {
  entry: DiaryEntry;
  blurEnabled: boolean;
  selected: boolean;
  active: boolean;
  showBlur: boolean;
  onSelect: (extend: boolean) => void;
  onMention: () => void;
  onJumpToMention: (mention: MentionReference) => void;
  innerRef?: (node: HTMLDivElement | null) => void;
}

function DiaryCard({
  entry,
  blurEnabled,
  selected,
  active,
  showBlur,
  onSelect,
  onMention,
  onJumpToMention,
  innerRef,
}: DiaryCardProps) {
  const timestamp = useMemo(() => formatTimeAgo(entry.createdAt), [entry.createdAt]);
  const shouldBlur = blurEnabled && showBlur;

  return (
    <article
      ref={innerRef}
      onClick={(event) => onSelect(event.shiftKey)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(event.shiftKey);
        }
      }}
      className={cn(
        "group relative rounded-2xl border diary-card p-5 shadow-sm transition hover:shadow-md focus:outline-none",
        selected && "ring-2 diary-card-selected",
        active && "ring-2 diary-card-active"
      )}
      aria-pressed={selected}
    >
      <div className="diary-card-label mb-3 flex items-center justify-between text-xs uppercase tracking-widest">
        <span>{timestamp}</span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onMention();
            }}
            className="h-auto rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.3em]"
          >
            Mention
          </Button>
        </div>
      </div>
      {entry.mentions?.length ? (
        <div
          className={cn(
            "diary-mention-block mb-3 space-y-2 rounded-2xl border p-3 transition",
            shouldBlur && "blur-sm group-hover:blur-none"
          )}
        >
          {entry.mentions.map((mention) => (
            <div key={`${entry.id}-mention-${mention.id}`}>
              <p className="diary-mention-label text-[11px] uppercase tracking-[0.3em]">
                Menyambung {formatTimeAgo(mention.createdAt)}
              </p>
              <p className="diary-mention-text">{mention.preview}</p>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onJumpToMention(mention);
                }}
                className="diary-mention-link mt-2 text-xs font-medium"
              >
                Lihat di timeline
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <div className="relative">
        <p
          className={cn(
            "diary-entry-text whitespace-pre-wrap break-all leading-relaxed transition",
            shouldBlur && "blur-md hover:blur-none group-hover:blur-none"
          )}
        >
          {entry.content}
        </p>
      </div>
    </article>
  );
}

function formatTimeAgo(dateString: string) {
  const parsed = new Date(`${dateString}Z`);
  const now = new Date();
  const diff = parsed.getTime() - now.getTime();
  const minutes = Math.round(diff / 60000);

  if (Math.abs(minutes) < 1) return "baru saja";
  if (Math.abs(minutes) < 60) {
    return `${Math.abs(minutes)} menit lalu`;
  }

  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) {
    return `${Math.abs(hours)} jam lalu`;
  }
  const days = Math.round(hours / 24);
  return `${Math.abs(days)} hari lalu`;
}
