import { EditorView } from '@codemirror/view'

export const editorBaseTheme = EditorView.baseTheme({
  '&': { height: '100%', backgroundColor: '#ffffff' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'inherit' },
  '.cm-content': { caretColor: '#2563eb' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#2563eb', borderLeftWidth: '1.8px' }
})

/**
 * 查找匹配高亮：普通匹配浅黄底，当前匹配橙色描边。
 * 使用 baseTheme 保证可被默认样式覆盖顺序正确。
 */
export const searchHighlightTheme = EditorView.baseTheme({
  '.cm-searchMatch': {
    backgroundColor: 'rgba(250, 204, 21, 0.35)',
    outline: '1px solid rgba(250, 204, 21, 0.6)',
    borderRadius: '2px'
  },
  '.cm-searchMatch-selected': {
    backgroundColor: 'rgba(249, 115, 22, 0.35)',
    outline: '1px solid rgba(234, 88, 12, 0.8)'
  }
})
