import { EditorView } from '@codemirror/view'

export const editorBaseTheme = EditorView.baseTheme({
  '&': { height: '100%', backgroundColor: '#ffffff' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'inherit' },
  '.cm-content': { caretColor: '#2563eb' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#2563eb', borderLeftWidth: '1.8px' },

  // Find & replace match highlighting
  '.cm-searchMatch': {
    backgroundColor: 'rgba(217, 119, 6, 0.16)',
    outline: '1px solid rgba(217, 119, 6, 0.35)',
    borderRadius: '2px'
  },
  '.cm-searchMatch-selected': {
    backgroundColor: 'rgba(217, 119, 6, 0.42)'
  },
  // Other occurrences of the currently selected text
  '.cm-selectionMatch': {
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    borderRadius: '2px'
  }
})
