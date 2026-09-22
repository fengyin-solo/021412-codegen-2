<template>
  <div class="search-panel" @keydown.esc.stop="onClose">
    <div class="search-panel__row">
      <div class="search-panel__field" :class="{ 'search-panel__field--empty': showEmpty }">
        <input
          ref="searchInput"
          v-model="searchText"
          type="text"
          class="search-panel__input"
          placeholder="查找"
          spellcheck="false"
          aria-label="查找"
          @input="syncQuery"
          @keydown.enter.prevent="onSearchEnter"
        />
        <button
          class="search-panel__toggle"
          :class="{ 'search-panel__toggle--on': caseSensitive }"
          title="区分大小写"
          @mousedown.prevent
          @click="toggleCase"
        >Aa</button>
        <button
          class="search-panel__toggle"
          :class="{ 'search-panel__toggle--on': wholeWord }"
          title="全词匹配"
          @mousedown.prevent
          @click="toggleWholeWord"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V5h16v2"/><path d="M9 20h6"/><path d="M12 5v15"/></svg>
        </button>
      </div>

      <span class="search-panel__count" :class="{ 'search-panel__count--empty': showEmpty }">
        {{ countLabel }}
      </span>

      <button class="search-panel__btn" title="上一个 (Shift+Enter)" :disabled="!hasMatches"
        @mousedown.prevent @click="goPrev">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
      </button>
      <button class="search-panel__btn" title="下一个 (Enter)" :disabled="!hasMatches"
        @mousedown.prevent @click="goNext">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <button class="search-panel__btn" title="关闭 (Esc)" @mousedown.prevent @click="onClose">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="search-panel__row">
      <div class="search-panel__field">
        <input
          v-model="replaceText"
          type="text"
          class="search-panel__input"
          placeholder="替换为"
          spellcheck="false"
          aria-label="替换为"
          @input="syncQuery"
          @keydown.enter.prevent="replaceCurrent"
        />
      </div>
      <button class="search-panel__action" :disabled="!hasMatches"
        @mousedown.prevent @click="replaceCurrent">替换</button>
      <button class="search-panel__action" :disabled="!hasMatches"
        @mousedown.prevent @click="replaceAllMatches">全部替换</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { findNext, findPrevious, replaceNext, replaceAll } from '@codemirror/search'
import { readQuery, applyQuery, countMatches } from '@/editor/search-helpers'

const props = defineProps({
  view: { type: Object, required: true }
})
const emit = defineEmits(['close', 'notify'])

const searchText = ref('')
const replaceText = ref('')
const caseSensitive = ref(false)
const wholeWord = ref(false)
const matchTotal = ref(0)
const matchCurrent = ref(0)
const searchInput = ref(null)

const hasMatches = computed(() => matchTotal.value > 0)
const showEmpty = computed(() => searchText.value.length > 0 && matchTotal.value === 0)
const countLabel = computed(() => {
  if (!searchText.value) return ''
  if (matchTotal.value === 0) return '无结果'
  return matchCurrent.value > 0
    ? `${matchCurrent.value} / ${matchTotal.value}`
    : `共 ${matchTotal.value} 处`
})

/** Push the UI fields into the editor's search state, then re-count. */
function syncQuery() {
  applyQuery(props.view, {
    search: searchText.value,
    replace: replaceText.value,
    caseSensitive: caseSensitive.value,
    wholeWord: wholeWord.value
  })
  refresh()
}

/**
 * Recompute match counters from the live editor state.
 * Called after every panel action and (via App) after every editor
 * transaction, so positions shifted by replacements never go stale.
 */
function refresh() {
  const { total, current } = countMatches(props.view)
  matchTotal.value = total
  matchCurrent.value = current
}

function goNext() { findNext(props.view); refresh() }
function goPrev() { findPrevious(props.view); refresh() }

function onSearchEnter(event) {
  if (!hasMatches.value) return
  event.shiftKey ? goPrev() : goNext()
}

function toggleCase() {
  caseSensitive.value = !caseSensitive.value
  syncQuery()
  focusSearch(false)
}

function toggleWholeWord() {
  wholeWord.value = !wholeWord.value
  syncQuery()
  focusSearch(false)
}

function replaceCurrent() {
  if (!hasMatches.value) return
  replaceNext(props.view)
  refresh()
}

function replaceAllMatches() {
  if (!hasMatches.value) return
  const total = matchTotal.value
  replaceAll(props.view)
  refresh()
  emit('notify', `已替换 ${total} 处匹配`, 'success')
}

function onClose() { emit('close') }

function focusSearch(select = true) {
  nextTick(() => {
    searchInput.value?.focus()
    if (select) searchInput.value?.select()
  })
}

onMounted(() => {
  // Restore the persisted query so a reopened panel resumes where the
  // last session left off; otherwise prefill from the current selection.
  const persisted = readQuery(props.view)
  if (persisted.search) {
    searchText.value = persisted.search
    replaceText.value = persisted.replace
    caseSensitive.value = persisted.caseSensitive
    wholeWord.value = persisted.wholeWord
  } else {
    const { from, to } = props.view.state.selection.main
    const selected = props.view.state.sliceDoc(from, to)
    if (selected && !selected.includes('\n') && selected.length <= 200) {
      searchText.value = selected
    }
  }
  syncQuery()
  focusSearch()
})

defineExpose({ refresh, focusSearch })
</script>

<style lang="scss" scoped>
.search-panel {
  position: absolute;
  top: $sp-2;
  right: $sp-4;
  z-index: $z-toolbar;
  display: flex;
  flex-direction: column;
  gap: $sp-1;
  padding: $sp-2;
  background: $bg-elevated;
  border: 1px solid $border;
  border-radius: $r-lg;
  box-shadow: $shadow-lg;
  font-family: $font-ui;
  user-select: none;

  &__row {
    display: flex;
    align-items: center;
    gap: $sp-1;
  }

  &__field {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: 1;
    min-width: 220px;
    padding: 0 $sp-1 0 $sp-2;
    background: $bg;
    border: 1px solid $border;
    border-radius: $r-md;
    transition: border-color $t-fast $ease;

    &:focus-within {
      border-color: $accent;
    }

    &--empty,
    &--empty:focus-within {
      border-color: $error;
    }
  }

  &__input {
    flex: 1;
    min-width: 0;
    height: 26px;
    border: none;
    outline: none;
    background: transparent;
    font-family: $font-ui;
    font-size: $fs-sm;
    color: $text;

    &::placeholder {
      color: $text-3;
    }
  }

  &__toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 20px;
    padding: 0 3px;
    border: none;
    border-radius: $r-sm;
    background: transparent;
    font-size: $fs-xs;
    font-weight: 600;
    color: $text-3;
    cursor: pointer;
    transition: all $t-fast $ease;

    &:hover {
      background: $accent-soft;
      color: $accent;
    }

    &--on {
      background: $accent-mid;
      color: $accent;
    }
  }

  &__count {
    min-width: 52px;
    text-align: center;
    font-size: $fs-xs;
    color: $text-3;
    font-family: $font-mono;
    white-space: nowrap;

    &--empty {
      color: $error;
    }
  }

  &__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: $r-md;
    background: transparent;
    color: $text-2;
    cursor: pointer;
    transition: all $t-fast $ease;

    &:hover:not(:disabled) {
      background: $accent-soft;
      color: $accent;
    }

    &:disabled {
      opacity: 0.35;
      cursor: default;
    }
  }

  &__action {
    height: 24px;
    padding: 0 $sp-2;
    border: 1px solid $border;
    border-radius: $r-md;
    background: $bg-elevated;
    font-size: $fs-xs;
    color: $text-2;
    cursor: pointer;
    white-space: nowrap;
    transition: all $t-fast $ease;

    &:hover:not(:disabled) {
      border-color: $accent;
      color: $accent;
      background: $accent-soft;
    }

    &:disabled {
      opacity: 0.45;
      cursor: default;
    }
  }
}
</style>
