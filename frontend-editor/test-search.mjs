// State-level verification of the find & replace workflow.
// Uses a minimal view-like object so it runs without a DOM.
import { EditorState } from '@codemirror/state'
import { search, findNext, findPrevious, replaceNext, replaceAll } from '@codemirror/search'
import { history, undo } from '@codemirror/commands'
import { readQuery, applyQuery, countMatches } from './src/editor/search-helpers.js'

let failures = 0
function check(name, cond, extra = '') {
  if (cond) console.log(`  ok  ${name}`)
  else { failures++; console.log(`FAIL  ${name} ${extra}`) }
}

function makeView(doc) {
  let state = EditorState.create({ doc, extensions: [search(), history()] })
  return {
    get state() { return state },
    dispatch(...args) { state = state.update(...args).state },
    // commands may request these; harmless no-ops outside the DOM
    requestMeasure() {},
    plugin() { return null },
  }
}

const DOC = 'foo bar Foo\nfoo foo FOO\nnothing here\nfoo'

// --- 1. empty search: no matches, no crash ---
{
  const view = makeView(DOC)
  applyQuery(view, { search: '', replace: 'x', caseSensitive: false, wholeWord: false })
  const { total, current } = countMatches(view)
  check('empty search -> 0 matches', total === 0 && current === 0)
  check('empty search -> query invalid, doc untouched', view.state.doc.toString() === DOC)
}

// --- 2. plain search counts all matches ---
{
  const view = makeView(DOC)
  applyQuery(view, { search: 'foo', replace: '', caseSensitive: false, wholeWord: false })
  check('case-insensitive foo -> 6', countMatches(view).total === 6, `got ${countMatches(view).total}`)
}

// --- 3. case sensitivity toggle changes match set, doc untouched ---
{
  const view = makeView(DOC)
  applyQuery(view, { search: 'foo', replace: '', caseSensitive: false, wholeWord: false })
  const before = countMatches(view).total
  applyQuery(view, { search: 'foo', replace: '', caseSensitive: true, wholeWord: false })
  const after = countMatches(view).total
  check('case toggle 6 -> 4', before === 6 && after === 4, `got ${before}->${after}`)
  check('case toggle leaves doc intact', view.state.doc.toString() === DOC)
}

// --- 4. whole word ---
{
  const view = makeView('foo food foo')
  applyQuery(view, { search: 'foo', replace: '', caseSensitive: false, wholeWord: true })
  check('whole word skips "food"', countMatches(view).total === 2)
}

// --- 5. findNext / findPrevious walk and wrap ---
{
  const view = makeView(DOC)
  applyQuery(view, { search: 'foo', replace: '', caseSensitive: true, wholeWord: false })
  findNext(view)
  let m = countMatches(view)
  check('findNext selects match 1', m.current === 1, `got current=${m.current}`)
  check('selected range is a real match', view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to) === 'foo')
  findNext(view); findNext(view)
  m = countMatches(view)
  check('findNext x3 -> match 3', m.current === 3, `got ${m.current}`)
  findPrevious(view)
  m = countMatches(view)
  check('findPrevious -> back to 2', m.current === 2, `got ${m.current}`)
  // wrap around: 4 matches total, go forward past the end
  findNext(view); findNext(view); findNext(view)
  m = countMatches(view)
  check('findNext wraps to 1', m.current === 1, `got ${m.current}`)
}

// --- 6. replaceNext with length-changing replacement (position drift) ---
{
  const view = makeView('aa bb aa bb aa')
  applyQuery(view, { search: 'aa', replace: 'bbb', caseSensitive: false, wholeWord: false })
  findNext(view) // select first
  replaceNext(view) // replace it, auto-advance
  replaceNext(view)
  check('replaceNext x2 -> first two replaced', view.state.doc.toString() === 'bbb bb bbb bb aa', `got "${view.state.doc}"`)
  const m = countMatches(view)
  check('positions recomputed after drift', m.total === 1 && m.current === 1, `got total=${m.total} current=${m.current}`)
}

// --- 6b. overlapping matches inside replacement text are seen on recompute ---
{
  const view = makeView('aa bb aa bb aa')
  applyQuery(view, { search: 'aa', replace: 'aaaa', caseSensitive: false, wholeWord: false })
  findNext(view)
  replaceNext(view)
  replaceNext(view)
  check('replaceNext aaaa drift', view.state.doc.toString() === 'aaaa bb aaaa bb aa', `got "${view.state.doc}"`)
  const m = countMatches(view)
  // 'aaaa' holds two non-overlapping 'aa' matches; selection tracked the last one
  check('recompute sees matches inside replacements', m.total === 5 && m.current === 5, `got total=${m.total} current=${m.current}`)
}

// --- 7. replaceNext where replacement contains the search text (no infinite loop) ---
{
  const view = makeView('a a a')
  applyQuery(view, { search: 'a', replace: 'aa', caseSensitive: false, wholeWord: false })
  findNext(view)
  replaceNext(view)
  check('replace a->aa advances past replacement', view.state.doc.toString() === 'aa a a', `got "${view.state.doc}"`)
}

// --- 8. replaceAll in one transaction, then undo restores original ---
{
  const view = makeView(DOC)
  applyQuery(view, { search: 'foo', replace: 'baz', caseSensitive: false, wholeWord: false })
  const n = countMatches(view).total
  replaceAll(view)
  check('replaceAll replaces all 6', view.state.doc.toString() === 'baz bar baz\nbaz baz baz\nnothing here\nbaz', `got "${view.state.doc}"`)
  check('replaceAll leaves 0 matches', countMatches(view).total === 0)
  // rapid repeat: nothing left to replace, must be a safe no-op
  replaceAll(view)
  replaceAll(view)
  check('rapid repeat replaceAll is a no-op', view.state.doc.toString().startsWith('baz bar baz'))
  undo(view)
  check('undo restores original doc', view.state.doc.toString() === DOC, `got "${view.state.doc}"`)
  check('undo restores matches', countMatches(view).total === n)
}

// --- 9. no results: navigation and replace are safe no-ops ---
{
  const view = makeView(DOC)
  applyQuery(view, { search: 'zzz-not-there', replace: 'x', caseSensitive: false, wholeWord: false })
  const ok = findNext(view)
  replaceNext(view)
  replaceAll(view)
  check('no results -> findNext returns false', ok === false)
  check('no results -> doc untouched', view.state.doc.toString() === DOC)
  check('no results -> count 0', countMatches(view).total === 0)
}

// --- 10. query persists in state (resume-from-current-match after "reopen") ---
{
  const view = makeView(DOC)
  applyQuery(view, { search: 'foo', replace: 'baz', caseSensitive: true, wholeWord: false })
  findNext(view); findNext(view)
  const persisted = readQuery(view)
  check('query persisted in state', persisted.search === 'foo' && persisted.replace === 'baz' && persisted.caseSensitive === true)
  // simulate reopen: a fresh panel reads the same query and current position
  const m = countMatches(view)
  check('resume at match 2 of 4', m.current === 2 && m.total === 4, `got ${m.current}/${m.total}`)
  // typing elsewhere (doc change) then continuing still works
  view.dispatch({ changes: { from: view.state.doc.length, insert: '\nfoo tail' } })
  findNext(view)
  const m2 = countMatches(view)
  check('after edit, findNext continues from current', m2.current === 3 && m2.total === 5, `got ${m2.current}/${m2.total}`)
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED`)
process.exit(failures === 0 ? 0 : 1)
