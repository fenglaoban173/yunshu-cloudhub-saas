<script setup lang="ts">
/**
 * 工作台「常用功能」快捷入口条
 * 四个应用域的工作台顶部共用同一套交互：图标 + 名称 + 右箭头，点击直达功能页。
 * color 传应用域主题色（CRM 蓝 / OA 绿 / 财务橙 / 平台紫）。
 */
import { useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'

export interface QuickLinkItem {
  label: string
  icon: string
  path: string
}

const props = withDefaults(defineProps<{ items: QuickLinkItem[]; color?: string }>(), {
  color: '#165DFF',
})
const router = useRouter()
</script>

<template>
  <div class="quick-links">
    <button
      v-for="q in props.items"
      :key="q.path"
      type="button"
      class="ql"
      @click="router.push(q.path)"
    >
      <span class="ql-ico" :style="{ background: props.color + '14', color: props.color }">
        <AppIcon :name="q.icon" :size="14" />
      </span>
      <span class="ql-label">{{ q.label }}</span>
      <AppIcon name="RightOutlined" :size="11" class="ql-arrow" />
    </button>
  </div>
</template>

<style scoped>
.quick-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.ql {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px 7px 8px;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  background: var(--surface);
  cursor: pointer;
  font: inherit;
  transition: border-color var(--dur-base) var(--ease), background-color var(--dur-base) var(--ease);
}
.ql:hover {
  background: var(--surface-hover);
  border-color: var(--border-strong);
}
.ql-ico {
  width: 24px;
  height: 24px;
  border-radius: var(--r-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}
.ql-label {
  font-size: 12.5px;
  color: var(--text-1);
}
.ql-arrow {
  color: var(--text-4);
}
.ql:hover .ql-arrow {
  color: var(--text-2);
}
</style>
