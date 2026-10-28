<script setup lang="ts">
/**
 * 全局预览抽屉
 * ---------------------------------------------------------------------------
 * 承载「纪要 / 设计流程 / 分配权限 / 价格策略 / 票据 / 未达项」等结构化预览内容。
 * 分区类型：kv 键值表 · table 数据表 · text 正文 · code 代码块 · checklist 检查清单
 */
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import type { PreviewDoc } from '@/utils/preview'

const ui = useUiStore()
const doc = computed<PreviewDoc | null>(() => (ui.previewOpen ? (ui.previewBody as PreviewDoc) : null))

function cell(v: any) {
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
}

/**
 * 预览表格的行键。
 * 预览数据是任意结构（没有统一主键），Ant Design Vue 4.2 起不再保证 rowKey 函数的
 * index 参数可用，所以这里只按行内容推导一个稳定的键，不依赖下标。
 */
function previewRowKey(r: any): string {
  if (r && typeof r === 'object') {
    const cand = r.id ?? r.key ?? r.code ?? r.name ?? r.title
    if (cand !== undefined && cand !== null && cand !== '') return String(cand)
    const first = Object.values(r).find((v) => v !== null && v !== undefined && typeof v !== 'object')
    if (first !== undefined) return String(first)
  }
  return String(r)
}
</script>

<template>
  <a-drawer
    :open="ui.previewOpen"
    :title="doc?.title ?? '预览'"
    :width="720"
    @close="ui.closePreview()"
  >
    <p v-if="doc?.subtitle" class="pv-sub">{{ doc.subtitle }}</p>

    <div v-for="(s, si) in doc?.sections ?? []" :key="si" class="pv-sec">
      <h4 class="pv-h">{{ s.title }}</h4>

      <a-descriptions v-if="s.type === 'kv'" bordered size="small" :column="1">
        <a-descriptions-item v-for="(r, ri) in s.rows ?? []" :key="ri" :label="r.label">
          {{ r.value }}
        </a-descriptions-item>
      </a-descriptions>

      <a-table
        v-else-if="s.type === 'table'"
        :data-source="s.data ?? []"
        :columns="(s.columns ?? []).map((c) => ({ key: c.key, dataIndex: c.key, title: c.title }))"
        :pagination="false"
        size="small"
        :row-key="previewRowKey"
      >
        <template #bodyCell="{ column, record }">
          {{ cell(record[column.dataIndex]) }}
        </template>
      </a-table>

      <div v-else-if="s.type === 'text'" class="pv-text">{{ s.text }}</div>

      <pre v-else-if="s.type === 'code'" class="pv-code">{{ s.code }}</pre>

      <ul v-else-if="s.type === 'checklist'" class="pv-check">
        <li v-for="(r, ri) in s.data ?? []" :key="ri">
          <span class="ck-box" :class="{ done: String(r['状态'] ?? r['结果'] ?? '').includes('完成') || String(r['状态'] ?? r['结果'] ?? '').includes('通过') || String(r['状态'] ?? '').includes('开通') || String(r['状态'] ?? '').includes('开启') }" />
          <span class="ck-main">
            <span class="ck-t">{{ cell(r['事项'] ?? r['单据'] ?? r['议题']) }}</span>
            <span class="ck-s">{{ cell(r['范围'] ?? r['责任人'] ?? r['主讲'] ?? r['结论'] ?? r['结果']) }}</span>
          </span>
          <a-tag
            :color="String(r['状态'] ?? r['结果'] ?? '').includes('风险') || String(r['状态'] ?? '').includes('未') ? 'warning' : 'success'"
            :bordered="false"
          >
            {{ cell(r['状态'] ?? r['结果']) }}
          </a-tag>
        </li>
      </ul>
    </div>

    <template #footer>
      <div class="pv-foot">
        <a-button @click="ui.closePreview()">关闭</a-button>
      </div>
    </template>
  </a-drawer>
</template>

<script lang="ts">
export default { name: 'PreviewDrawer' }
</script>

<style scoped>
.pv-sub {
  margin: 0 0 14px;
  font-size: 12.5px;
  color: var(--text-3);
}
.pv-sec {
  margin-bottom: 20px;
}
.pv-h {
  margin: 0 0 10px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-1);
}
.pv-text {
  font-size: 13px;
  line-height: 1.9;
  color: var(--text-2);
  white-space: pre-wrap;
  background: var(--surface-hover);
  border-radius: var(--r-md);
  padding: 12px 14px;
}
.pv-code {
  margin: 0;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 12.5px;
  line-height: 1.8;
  color: var(--text-1);
  background: #f7f8fa;
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-md);
  padding: 12px 14px;
  white-space: pre-wrap;
}
.pv-check {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-md);
  overflow: hidden;
}
.pv-check li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-subtle);
}
.pv-check li:last-child {
  border-bottom: none;
}
.ck-box {
  width: 15px;
  height: 15px;
  border-radius: 4px;
  border: 1px solid var(--border-strong);
  flex: none;
  position: relative;
}
.ck-box.done {
  background: var(--success);
  border-color: var(--success);
}
.ck-box.done::after {
  content: '';
  position: absolute;
  left: 4.5px;
  top: 1.5px;
  width: 4px;
  height: 8px;
  border: solid #fff;
  border-width: 0 1.6px 1.6px 0;
  transform: rotate(43deg);
}
.ck-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ck-t {
  font-size: 13px;
  color: var(--text-1);
}
.ck-s {
  font-size: 11.5px;
  color: var(--text-3);
}
.pv-foot {
  display: flex;
  justify-content: flex-end;
}
</style>
