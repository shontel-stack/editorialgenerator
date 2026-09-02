# Make linked text frames travel with the issue

## Confirmed problem

Threaded ("linked") text frames store both the link map and the overflow copy
in browser localStorage (`textFlow:links:v1`, `textFlow:cache:v1`). Nothing is
written into the saved issue document, so:

- On another computer, another browser, or after clearing site data, the
  continuation frame renders empty and the source frame still visually
  truncates — the story looks like it lost its second half.
- The IDML export writes each block's raw `text`, so the exported file has the
  full article in the source frame and empty/stale copy in the continuation —
  it never matches what is on screen.

## What to change

1. **Persist the thread in the document, not the browser**
   - Keep `linkPrevId` on the continuation block as the single source of truth
     for the link, and add a matching `linkNextId` on the source block so the
     chain is readable from either end without localStorage.
   - Store the computed overflow copy on the continuation block itself
     (`flowText`, written by the source frame after measuring) so it saves with
     the issue and syncs to the cloud like any other block edit.
   - Treat localStorage purely as a same-session render cache: read from the
     document first, fall back to the cache only when the document has no value
     yet.

2. **Cross-page writes**
   - The source frame lives on a different page than its continuation, so the
     editor context needs a document-level `updateBlockById(pageId, blockId, patch)`
     helper (issue-level, not per-page) that the flow effect calls after
     `splitToFit`. Debounce it so measurement churn doesn't spam autosave.

3. **Export correctness**
   - In `idmlExport.ts`, emit `flowText` for continuation frames and the fitted
     head for source frames, so the exported document matches the layout.

4. **Backfill / safety**
   - On first load of an issue that still has localStorage-only threads, copy
     the cached overflow into the document once, then rely on the document.
   - If a continuation's source is missing (page deleted), keep showing the
     stored `flowText` rather than blanking the frame.

## Notes

Text stays plain and unrewritten in the source frame; only the derived overflow
is mirrored onto the continuation block, so copyfit, wrapping and re-measuring
keep working exactly as they do today.
