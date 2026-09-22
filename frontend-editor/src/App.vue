<template>
  <div class="app">
    <Toolbar @action="handleToolbarAction" />
    <div class="editor-area">
      <EditorPane ref="editorPane" @ready="onEditorReady" @update="onEditorUpdate" @open-search="openSearch" />
      <Transition name="search">
        <SearchPanel
          v-if="searchVisible && editorView"
          :view="editorView"
          :tick="editorTick"
          @close="searchVisible = false"
          @toast="showToast"
        />
      </Transition>
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
import { ref, shallowRef, reactive } from 'vue'
import Toolbar from '@/components/Toolbar.vue'
import EditorPane from '@/components/EditorPane.vue'
import SearchPanel from '@/components/SearchPanel.vue'
import StatusBar from '@/components/StatusBar.vue'

const editorPane = ref(null)
const editorView = shallowRef(null)

const searchVisible = ref(false)
// 每次编辑器更新都递增，驱动搜索面板重新统计匹配
const editorTick = ref(0)

const toast = reactive({ visible: false, message: '', type: 'info' })
let toastTimer = null

function showToast(msg, type = 'info') {
  toast.message = msg; toast.type = type; toast.visible = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.visible = false }, 2000)
}

function onEditorReady(view) { editorView.value = view }

function onEditorUpdate() { editorTick.value++ }

function openSearch() {
  if (!editorView.value) return
  searchVisible.value = true
}

function insertText(before, after = '') {
  const view = editorView.value
  if (!view) return
  const { from, to } = view.state.selection.main
  const sel = view.state.sliceDoc(from, to)
  const text = `${before}${sel || 'text'}${after}`
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + before.length, head: from + before.length + (sel || 'text').length }
  })
  view.focus()
}

function insertLine(prefix) {
  const view = editorView.value
  if (!view) return
  const line = view.state.doc.lineAt(view.state.selection.main.head)
  view.dispatch({ changes: { from: line.from, to: line.from, insert: prefix } })
  view.focus()
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
    search: () => openSearch(),
    hr: () => {
      const view = editorView.value
      if (!view) return
      const pos = view.state.selection.main.head
      const line = view.state.doc.lineAt(pos)
      view.dispatch({ changes: { from: line.to, to: line.to, insert: '\n\n---\n\n' } })
      view.focus()
    },
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
  flex-direction: column;
  overflow: hidden;
}

.search-enter-active,
.search-leave-active {
  transition: all $t-normal $ease;
}
.search-enter-from,
.search-leave-to {
  opacity: 0;
  transform: translateY(-6px);
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
