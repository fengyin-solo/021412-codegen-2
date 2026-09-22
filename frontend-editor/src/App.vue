<template>
  <div class="app">
    <Toolbar @action="handleToolbarAction" />
    <div class="editor-area">
      <EditorPane ref="editorPane" @ready="onEditorReady" @update="onEditorUpdate" />
      <SearchPanel
        v-if="searchOpen && editorView"
        ref="searchPanel"
        :view="editorView"
        @close="closeSearch"
        @notify="showToast"
      />
    </div>
    <StatusBar />
    <Transition name="toast">
      <div v-if="toast.visible" :class="['toast', `toast--${toast.type}`]">
        {{ toast.message }}
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'
import Toolbar from '@/components/Toolbar.vue'
import EditorPane from '@/components/EditorPane.vue'
import SearchPanel from '@/components/SearchPanel.vue'
import StatusBar from '@/components/StatusBar.vue'

const editorPane = ref(null)
const searchPanel = ref(null)
const searchOpen = ref(false)
let editorView = null

const toast = reactive({ visible: false, message: '', type: 'info' })
let toastTimer = null

function showToast(msg, type = 'info') {
  toast.message = msg; toast.type = type; toast.visible = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.visible = false }, 2000)
}

function onEditorReady(view) { editorView = view }

// Keep the panel's match counter in sync with every editor transaction
// (typing, undo, replacements) — positions are re-read from live state.
function onEditorUpdate() { searchPanel.value?.refresh() }

function openSearch() {
  if (searchOpen.value) {
    // Already open — just re-focus and re-select the query.
    searchPanel.value?.focusSearch()
  } else {
    searchOpen.value = true // the panel focuses itself on mount
  }
}

function closeSearch() {
  if (!searchOpen.value) return
  searchOpen.value = false
  // Hand focus back to the editor; the selection stays on the current
  // match and the query persists, so F3 / reopening resumes from here.
  editorView?.focus()
}

// App-level shortcuts, registered on window so they work no matter
// whether focus is in the editor or inside the search panel.
function onGlobalKeydown(e) {
  if ((e.metaKey || e.ctrlKey) && (e.key === 'f' || e.key === 'F')) {
    e.preventDefault()
    openSearch()
  } else if (e.key === 'Escape' && searchOpen.value) {
    closeSearch()
  }
}

onMounted(() => window.addEventListener('keydown', onGlobalKeydown, true))
onBeforeUnmount(() => window.removeEventListener('keydown', onGlobalKeydown, true))

function insertText(before, after = '') {
  if (!editorView) return
  const { from, to } = editorView.state.selection.main
  const sel = editorView.state.sliceDoc(from, to)
  const text = `${before}${sel || 'text'}${after}`
  editorView.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + before.length, head: from + before.length + (sel || 'text').length }
  })
  editorView.focus()
}

function insertLine(prefix) {
  if (!editorView) return
  const line = editorView.state.doc.lineAt(editorView.state.selection.main.head)
  editorView.dispatch({ changes: { from: line.from, to: line.from, insert: prefix } })
  editorView.focus()
}

function handleToolbarAction(action) {
  const map = {
    bold: () => insertText('**', '**'),
    italic: () => insertText('*', '*'),
    strikethrough: () => insertText('~~', '~~'),
    code: () => insertText('`', '`'),
    link: () => insertText('[', '](url)'),
    image: () => insertText('![alt](', ')'),
    blockquote: () => insertLine('> '),
    'bullet-list': () => insertLine('- '),
    'ordered-list': () => insertLine('1. '),
    hr: () => {
      const pos = editorView.state.selection.main.head
      const line = editorView.state.doc.lineAt(pos)
      editorView.dispatch({ changes: { from: line.to, to: line.to, insert: '\n\n---\n\n' } })
      editorView.focus()
    },
    search: () => openSearch(),
  }
  const fn = map[action]
  fn ? fn() : showToast(`未知操作: ${action}`, 'warning')
}
</script>

<style lang="scss" scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: $bg;
}

.editor-area {
  position: relative;
  flex: 1;
  display: flex;
  min-height: 0;
}

.toast {
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  padding: $sp-2 $sp-5;
  border-radius: $r-full;
  font-size: $fs-sm;
  color: #fff;
  z-index: $z-toast;
  box-shadow: $shadow-lg;
  pointer-events: none;
  font-family: $font-ui;

  &--info { background: $accent; }
  &--success { background: $success; }
  &--warning { background: $warning; }
  &--error { background: $error; }
}

.toast-enter-active,
.toast-leave-active {
  transition: all $t-slow $ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
</style>
