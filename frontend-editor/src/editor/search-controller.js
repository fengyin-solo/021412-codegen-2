import {
  SearchQuery,
  getSearchQuery,
  setSearchQuery,
  findNext,
  findPrevious,
  replaceNext,
  replaceAll
} from '@codemirror/search'

/**
 * 单次统计的匹配数量上限。
 * 超过上限后停止扫描，避免超大文档/高频输入时阻塞编辑器。
 */
export const MATCH_LIMIT = 2000

/**
 * 将当前查找/替换参数写入编辑器状态（触发高亮刷新）。
 * 搜索词为空时 query 自动失效，高亮随之清除。
 */
export function applySearchQuery(view, { search, replace, caseSensitive }) {
  if (!view) return
  const query = new SearchQuery({
    search: search || '',
    replace: replace ?? '',
    caseSensitive: !!caseSensitive
  })
  view.dispatch({ effects: setSearchQuery.of(query) })
}

/**
 * 读取编辑器中当前生效的查询（面板重新打开时恢复现场）。
 */
export function readSearchQuery(view) {
  if (!view) return { search: '', replace: '', caseSensitive: false }
  const q = getSearchQuery(view.state)
  return { search: q.search, replace: q.replace, caseSensitive: q.caseSensitive }
}

/**
 * 统计当前文档中的匹配，并定位“当前匹配”（与主选区重合的那一项）。
 * 所有数据都从最新 state 重新计算，因此替换/编辑导致的位置漂移不会累积误差。
 *
 * @returns {{ count: number, index: number, capped: boolean }}
 *   count 匹配总数（封顶 MATCH_LIMIT），index 为 1 起始的当前匹配序号（无则为 0）
 */
export function collectMatches(view) {
  const empty = { count: 0, index: 0, capped: false }
  if (!view) return empty
  const { state } = view
  const query = getSearchQuery(state)
  if (!query.valid) return empty

  const sel = state.selection.main
  let count = 0
  let index = 0
  let capped = false

  const cursor = query.getCursor(state)
  let next = cursor.next()
  while (!next.done) {
    if (count >= MATCH_LIMIT) { capped = true; break }
    count++
    const { from, to } = next.value
    if (from === sel.from && to === sel.to) index = count
    next = cursor.next()
  }
  return { count, index, capped }
}

/** 跳到下一个匹配（自动回绕）。返回是否成功。 */
export function goToNextMatch(view) {
  if (!view) return false
  return findNext(view)
}

/** 跳到上一个匹配（自动回绕）。 */
export function goToPrevMatch(view) {
  if (!view) return false
  return findPrevious(view)
}

/**
 * 替换当前匹配并自动跳到下一个。
 * 当前选区不是匹配时等价于“查找下一个”，不会误改文档。
 */
export function replaceCurrentMatch(view) {
  if (!view) return false
  return replaceNext(view)
}

/**
 * 全部替换。整个操作是单个事务：可一步撤销，
 * 且替换前后不会暴露中间态，避免重复点击造成文档损坏。
 * @returns {number} 实际替换的处数
 */
export function replaceAllMatches(view) {
  if (!view) return 0
  const { count } = collectMatches(view)
  if (count === 0) return 0
  replaceAll(view)
  return count
}
