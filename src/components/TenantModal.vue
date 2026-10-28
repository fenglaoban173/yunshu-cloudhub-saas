<script setup lang="ts">
/**
 * 切换租户
 * ---------------------------------------------------------------------------
 * 租户列表读的是平台配置的真实租户数据；切换后顶栏 / 门户的租户身份立即变化，
 * 并在刷新后保留。
 */
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import AppIcon from '@/components/AppIcon.vue'
import { useDataStore } from '@/stores/data'
import { useUserStore } from '@/stores/user'
import { useChromeStore } from '@/stores/chrome'

const data = useDataStore()
const user = useUserStore()
const chrome = useChromeStore()

const picked = ref('')

const tenants = computed(() => data.rows('tenant'))

watch(
  () => chrome.tenantOpen,
  (v) => {
    if (v) picked.value = user.user.tenant
  },
)

function statusTone(s: string) {
  return s === '正常' ? 'success' : s === '即将到期' ? 'warning' : 'error'
}

function confirm() {
  const t = tenants.value.find((x: any) => x.name === picked.value)
  if (!t) {
    message.warning('请先选择一个租户')
    return
  }
  user.switchTenant(t.name, t.plan)
  chrome.closeTenant()
  message.success(`已切换到「${t.name}」`)
}
</script>

<template>
  <a-modal
    :open="chrome.tenantOpen"
    title="切换租户"
    :width="600"
    ok-text="确认切换"
    cancel-text="取消"
    @ok="confirm"
    @cancel="chrome.closeTenant()"
  >
    <a-radio-group v-model:value="picked" class="tn-list">
      <label
        v-for="t in tenants"
        :key="t.id"
        class="tn-item"
        :class="{ active: picked === t.name }"
      >
        <a-radio :value="t.name" />
        <div class="tn-main">
          <div class="tn-name">
            {{ t.name }}
            <a-tag :color="statusTone(t.status)" :bordered="false">{{ t.status }}</a-tag>
          </div>
          <div class="tn-meta">
            {{ t.plan }} · {{ t.users }} / {{ t.maxUsers }} 用户 · {{ t.storage }}
          </div>
          <div class="tn-meta">到期 {{ t.expireAt }} · 应用域 {{ t.domains }} 个</div>
        </div>
      </label>
    </a-radio-group>
    <div v-if="!tenants.length" class="tn-empty">
      <AppIcon name="InfoCircleOutlined" :size="14" />
      暂无可切换的租户
    </div>
  </a-modal>
</template>

<style scoped>
.tn-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}
.tn-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 11px 13px;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  cursor: pointer;
  transition: all var(--dur-base) var(--ease);
}
.tn-item:hover {
  border-color: var(--brand-300, #94bfff);
  background: var(--surface-hover);
}
.tn-item.active {
  border-color: var(--brand-500);
  background: var(--brand-050);
}
.tn-main {
  min-width: 0;
  flex: 1;
}
.tn-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text-1);
}
.tn-meta {
  font-size: 11.5px;
  color: var(--text-3);
  margin-top: 3px;
}
.tn-empty {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: var(--text-3);
  padding: 14px 0;
}
</style>
