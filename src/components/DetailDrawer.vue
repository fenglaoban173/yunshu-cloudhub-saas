<script setup lang="ts">
/**
 * 全局详情抽屉（只读）
 * ---------------------------------------------------------------------------
 * 承接「详情 / 查看 / 档案 / 台账 / 卡片 / 流水」等查看类动作，
 * 字段同样由 PageDef.columns 自动生成；底部提供编辑入口。
 */
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { pages } from '@/mock/pages'
import type { ColumnDef } from '@/config/types'

const ui = useUiStore()

const def = computed(() => (ui.detailPageKey ? pages[ui.detailPageKey] : undefined))

function fmtMoney(v: any) {
  if (v === null || v === undefined || v === '') return '—'
  return Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtNumber(v: any) {
  if (v === null || v === undefined || v === '') return '—'
  return Number(v).toLocaleString('zh-CN')
}
function tagColor(col: ColumnDef, v: any) {
  return col.statusMap?.[String(v)]?.color ?? 'default'
}
function tagText(col: ColumnDef, v: any) {
  return col.statusMap?.[String(v)]?.text ?? v
}
</script>

<template>
  <a-drawer :open="ui.detailOpen" :title="`${def?.title ?? ''} · 详情`" :width="660" @close="ui.closeDetail()">
    <a-descriptions v-if="ui.detailRecord && def" bordered :column="2" size="small">
      <a-descriptions-item v-for="c in def.columns" :key="c.key" :label="c.title">
        <template v-if="c.type === 'tag'">
          <a-tag :color="tagColor(c, ui.detailRecord[c.key])" :bordered="false">
            {{ tagText(c, ui.detailRecord[c.key]) }}
          </a-tag>
        </template>
        <template v-else-if="c.type === 'money'">¥ {{ fmtMoney(ui.detailRecord[c.key]) }}</template>
        <template v-else-if="c.type === 'number'">{{ fmtNumber(ui.detailRecord[c.key]) }}{{ c.suffix ?? '' }}</template>
        <template v-else>{{ ui.detailRecord[c.key] ?? '—' }}</template>
      </a-descriptions-item>
    </a-descriptions>

    <template #footer>
      <div class="df-foot">
        <a-button @click="ui.closeDetail()">关闭</a-button>
        <a-button type="primary" @click="ui.openEdit(ui.detailPageKey, ui.detailRecord); ui.closeDetail()">
          编辑
        </a-button>
      </div>
    </template>
  </a-drawer>
</template>

<script lang="ts">
export default { name: 'DetailDrawer' }
</script>

<style scoped>
.df-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
