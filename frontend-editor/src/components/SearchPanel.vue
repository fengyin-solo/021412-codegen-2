<template>
  <div class="search-panel" @keydown.stop>
    <div class="search-panel__row">
      <div class="search-panel__field">
        <input
          ref="searchInput"
          v-model="searchText"
          class="search-panel__input"
          :class="{ 'search-panel__input--empty': searchText && matches.count === 0 }"
          type="text"
          placeholder="查找"
          spellcheck="false"
          @input="onSearchInput"
          @keydown.enter.prevent="onEnterKey"
          @keydown.esc.prevent="close"
        />
        <button
          class="search-panel__toggle"
          :class="{ 'search-panel__toggle--on': caseSensitive }"
          title="区分大小写"
          @click="toggleCase"
        >Aa</button>
      </div>

      <span class="search-panel__count" :class="{ 'search-panel__count--none': searchText && matches.count === 0 }">
        {{ countLabel }}
      </span>

      <button class="search-panel__btn" title="上一个 (Shift+Enter)" :disabled="!hasMatches" @click="prev">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
      </button>
      <button class="search-panel__btn" title="下一个 (Enter)" :disabled="!hasMatches" @click="next">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <button class="search-panel__btn" title="关闭 (Esc)" @click="close">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="search-panel__row">
      <div class="search-panel__field">
        <input
          v-model="replaceText"
          class="search-panel__input"
          type="text"
          placeholder="替换为"
          spellcheck="false"
          @keydown.enter.prevent="onReplaceEnter"
          @keydown.esc.prevent="close"
        />
      </div>
      <button class="search-panel__action" :disabled="!hasMatches" @click="replaceCurrent">替换</button>
      <button class="search-panel__action" :disabled="!hasMatches" @click="replaceAll">全部替换</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import {
  applySearchQuery,
  readSearchQuery,
  collectMatches,
  goToNextMatch,
  goToPrevMatch,
  replaceCurrentMatch,
  replaceAllMatches
} from '@/editor/search-controller'

const props = defineProps({
  view: { type: Object, required: true },
  // 文档/选区变化的信号，由父组件在每次编辑器更新时递增
  tick: { type: Number, default: 0 }
})
const emit = defineEmits(['close', 'toast'])

const searchInput = ref(null)
const searchText = ref('')
const replaceText = ref('')
const caseSensitive = ref(false)
const matches = ref({ count: 0, index: 0, capped: false })

let debounceTimer = null

const hasMatches = computed(() => matches.value.count > 0)

const countLabel = computed(() => {
  if (!searchText.value) return ''
  if (matches.value.count === 0) return '无结果'
  const total = matches.value.capped ? `${matches.value.count}+` : `${matches.value.count}`
  return matches.value.index > 0 ? `${matches.value.index} / ${total}` : `共 ${total} 处`
})

function refresh() {
  matches.value = collectMatches(props.view)
}

/** 输入防抖：快速连续输入时只应用最后一次查询，避免频繁全量扫描 */
function onSearchInput() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    applySearchQuery(props.view, {
      search: searchText.value,
      replace: replaceText.value,
      caseSensitive: caseSensitive.value
    })
    refresh()
  }, 120)
}

/** 立即应用查询（切换大小写、执行替换前等需要同步生效的场景） */
function applyNow() {
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
  applySearchQuery(props.view, {
    search: searchText.value,
    replace: replaceText.value,
    caseSensitive: caseSensitive.value
  })
  refresh()
}

function toggleCase() {
  caseSensitive.value = !caseSensitive.value
  applyNow()
  searchInput.value?.focus()
}

function onEnterKey(e) {
  if (e.isComposing) return
  e.shiftKey ? prev() : next()
}

function onReplaceEnter(e) {
  if (e.isComposing) return
  replaceCurrent()
}

function next() {
  if (!hasMatches.value) return
  applyNow()
  goToNextMatch(props.view)
  refresh()
}

function prev() {
  if (!hasMatches.value) return
  applyNow()
  goToPrevMatch(props.view)
  refresh()
}

function replaceCurrent() {
  if (!hasMatches.value) return
  applyNow()
  replaceCurrentMatch(props.view)
  refresh()
}

function replaceAll() {
  if (!hasMatches.value) return
  applyNow()
  const n = replaceAllMatches(props.view)
  refresh()
  if (n > 0) emit('toast', `已替换 ${n} 处`, 'success')
}

function close() {
  emit('close')
  props.view?.focus()
}

// 面板打开期间，文档或选区变化（编辑、撤销、替换）时重新统计，
// 匹配序号始终基于最新状态计算，位置漂移不会造成错位
watch(() => props.tick, refresh)

onMounted(() => {
  // 恢复上次查询，实现“返回编辑后仍能从当前匹配继续”
  const saved = readSearchQuery(props.view)
  searchText.value = saved.search
  replaceText.value = saved.replace
  caseSensitive.value = saved.caseSensitive

  // 若无历史查询且当前有单行选区，用选区内容预填
  if (!searchText.value) {
    const sel = props.view.state.selection.main
    if (!sel.empty) {
      const text = props.view.state.sliceDoc(sel.from, sel.to)
      if (!text.includes('\n')) searchText.value = text
    }
  }

  applyNow()
  nextTick(() => {
    searchInput.value?.focus()
    searchInput.value?.select()
  })
})

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})
</script>

<style lang="scss" scoped>
.search-panel {
  position: absolute;
  top: $sp-3;
  right: $sp-5;
  z-index: $z-toolbar;
  display: flex;
  flex-direction: column;
  gap: $sp-2;
  padding: $sp-3;
  background: $bg-elevated;
  border: 1px solid $border;
  border-radius: $r-lg;
  box-shadow: $shadow-lg;
  font-family: $font-ui;
  user-select: none;

  &__row {
    display: flex;
    align-items: center;
    gap: $sp-2;
  }

  &__field {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 220px;
  }

  &__input {
    width: 100%;
    height: 28px;
    padding: 0 $sp-2;
    padding-right: 34px;
    font-size: $fs-sm;
    font-family: $font-ui;
    color: $text;
    background: $bg;
    border: 1px solid $border;
    border-radius: $r-md;
    outline: none;
    transition: border-color $t-fast $ease, box-shadow $t-fast $ease;

    &:focus {
      border-color: $accent;
      box-shadow: 0 0 0 2px $accent-soft;
    }

    &--empty,
    &--empty:focus {
      border-color: $error;
      box-shadow: 0 0 0 2px rgba($error, 0.08);
    }
  }

  &__row:nth-child(2) &__input {
    padding-right: $sp-2;
  }

  &__toggle {
    position: absolute;
    right: 3px;
    height: 22px;
    min-width: 26px;
    padding: 0 4px;
    font-size: $fs-xs;
    font-family: $font-ui;
    color: $text-3;
    background: transparent;
    border: none;
    border-radius: $r-sm;
    cursor: pointer;
    transition: all $t-fast $ease;

    &:hover { color: $accent; background: $accent-soft; }

    &--on {
      color: $accent;
      background: $accent-mid;
    }
  }

  &__count {
    min-width: 64px;
    font-size: $fs-xs;
    color: $text-3;
    text-align: center;
    white-space: nowrap;

    &--none { color: $error; }
  }

  &__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    color: $text-2;
    background: transparent;
    border: none;
    border-radius: $r-md;
    cursor: pointer;
    transition: all $t-fast $ease;

    &:hover:not(:disabled) { background: $accent-soft; color: $accent; }
    &:disabled { opacity: 0.35; cursor: default; }
  }

  &__action {
    height: 28px;
    padding: 0 $sp-3;
    font-size: $fs-xs;
    font-family: $font-ui;
    color: $text-2;
    background: $bg;
    border: 1px solid $border;
    border-radius: $r-md;
    cursor: pointer;
    white-space: nowrap;
    transition: all $t-fast $ease;

    &:hover:not(:disabled) {
      color: $accent;
      border-color: $accent;
      background: $accent-soft;
    }
    &:disabled { opacity: 0.4; cursor: default; }
  }
}
</style>
