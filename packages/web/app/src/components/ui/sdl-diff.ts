import { useEffect, useState } from 'react';
import { createTwoFilesPatch, type CreatePatchOptionsAbortable } from 'diff';
import { sortSdl } from '@/lib/sort-sdl';
import { processFile, type FileDiffMetadata } from '@pierre/diffs';

export type SdlDiffResult =
  | { kind: 'diff'; fileDiff: FileDiffMetadata }
  | { kind: 'unchanged' }
  | { kind: 'order-only' }
  | { kind: 'too-large' };

const FILE_NAME = 'schema.graphql';

// The line diff runs on the main thread and its cost grows faster than the number of changed lines
// (10k changed lines in a 210k-line schema take 11s), so it gives up past this budget.
const DIFF_TIMEOUT_MS = 3000;

type CacheEntry = { before: string; after: string; sorted: boolean; result: SdlDiffResult };

// One result per diff tab of a check (service, public schema, supergraph), so moving between
// them never recomputes. A large FileDiffMetadata holds both sides' lines, so it goes no further.
const cache: CacheEntry[] = [];
const CACHE_SIZE = 3;

export function getCachedSdlDiff(before: string, after: string, sorted: boolean) {
  return cache.find(
    entry => entry.before === before && entry.after === after && entry.sorted === sorted,
  )?.result;
}

export function computeSdlDiff(
  before: string,
  after: string,
  options: { sorted: boolean; diffOptions?: CreatePatchOptionsAbortable },
): SdlDiffResult {
  const cached = getCachedSdlDiff(before, after, options.sorted);
  if (cached) {
    return cached;
  }

  const result = diffSdl(before, after, options);
  cache.unshift({ before, after, sorted: options.sorted, result });
  cache.length = Math.min(cache.length, CACHE_SIZE);
  return result;
}

/**
 * The diff of two SDLs, or null while it is computed. A cache miss is computed after the next
 * paint, so whatever mounted the view (a tab switch) shows before the main thread is busy.
 */
export function useSdlDiff(before: string, after: string, sorted: boolean): SdlDiffResult | null {
  const [computed, setComputed] = useState<CacheEntry | null>(null);
  const result =
    getCachedSdlDiff(before, after, sorted) ??
    (computed?.before === before && computed.after === after && computed.sorted === sorted
      ? computed.result
      : null);
  const missing = result === null;

  useEffect(() => {
    if (!missing) {
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    // requestAnimationFrame runs before the paint, the timeout it schedules after it.
    const frame = requestAnimationFrame(() => {
      timer = setTimeout(() => {
        setComputed({ before, after, sorted, result: computeSdlDiff(before, after, { sorted }) });
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [before, after, sorted, missing]);

  return result;
}

function diffSdl(
  before: string,
  after: string,
  options: { sorted: boolean; diffOptions?: CreatePatchOptionsAbortable },
): SdlDiffResult {
  if (before === after) {
    return { kind: 'unchanged' };
  }

  const oldContents = options.sorted ? sortSdl(before) : before;
  const newContents = options.sorted ? sortSdl(after) : after;
  if (oldContents === newContents) {
    return { kind: 'order-only' };
  }

  const patch = createTwoFilesPatch(
    FILE_NAME,
    FILE_NAME,
    oldContents,
    newContents,
    undefined,
    undefined,
    options.diffOptions ?? { timeout: DIFF_TIMEOUT_MS },
  );
  if (patch === undefined) {
    return { kind: 'too-large' };
  }

  // What @pierre/diffs' parseDiffFromFile does after creating the patch.
  const fileDiff = processFile(patch, {
    oldFile: { name: FILE_NAME, contents: oldContents },
    newFile: { name: FILE_NAME, contents: newContents },
  });
  if (!fileDiff) {
    throw new Error('Could not parse the SDL diff.');
  }
  return { kind: 'diff', fileDiff };
}
