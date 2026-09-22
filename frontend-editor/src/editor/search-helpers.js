import { SearchQuery, setSearchQuery, getSearchQuery } from '@codemirror/search'

/**
 * Read the query currently held in the editor state.
 * The query survives panel close/reopen, so it doubles as the
 * persistence layer for "resume from the current match".
 */
export function readQuery(view) {
  return getSearchQuery(view.state)
}

/**
 * Push UI field values into the editor's search state.
 * This is a pure state effect — it never touches the document,
 * so toggling options (e.g. case sensitivity) cannot lose content.
 */
export function applyQuery(view, { search, replace, caseSensitive, wholeWord }) {
  view.dispatch({
    effects: setSearchQuery.of(new SearchQuery({
      search: search ?? '',
      replace: replace ?? '',
      caseSensitive: !!caseSensitive,
      wholeWord: !!wholeWord
    }))
  })
}

/**
 * Count matches against the *current* document state.
 *
 * Positions are never cached: this is recomputed from `view.state` after
 * every edit / replace, so replacements that shift text (position drift)
 * or bursts of rapid operations always see a consistent snapshot.
 *
 * Returns { total, current } where `current` is the 1-based index of the
 * match exactly covered by the main selection (0 when not on a match).
 */
export function countMatches(view) {
  const query = getSearchQuery(view.state)
  // `valid` is false for an empty search string — nothing to count,
  // and getCursor is never called on an invalid query.
  if (!query.valid) return { total: 0, current: 0 }

  const { from, to } = view.state.selection.main
  let total = 0
  let current = 0
  const cursor = query.getCursor(view.state)
  for (let step = cursor.next(); !step.done; step = cursor.next()) {
    total++
    if (!current && step.value.from === from && step.value.to === to) {
      current = total
    }
  }
  return { total, current }
}
