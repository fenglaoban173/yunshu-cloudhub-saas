<script setup lang="ts">
/**
 * 全局分配弹窗
 * ---------------------------------------------------------------------------
 * 承接「领取 / 分配 / 转办 / 分配角色 / 批量授权」等分配类动作，
 * 候选集合按目标字段自动切换：责任人 → 人员，角色 → 角色清单，部门 → 部门清单。
 */
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { useUiStore } from '@/stores/ui'
import { useDataStore } from '@/stores/data'
import { assignOptions } from '@/composables/useAction'

const ui = useUiStore()
const data = useDataStore()

const value = ref<string>('')

const options = computed(() => assignOptions(ui.assignField))
const count = computed(() => ui.assignIds.length)

watch(
  () => ui.assignOpen,
  (open) => {
    if (open) value.value = ''
  },
)

function ok() {
  if (!value.value) {
    message.warning('请选择要分配的对象')
    return
  }
  const n = data.patchRows(ui.assignPageKey, ui.assignIds, { [ui.assignField]: value.value })
  message.success(`已分配给「${value.value}」，共 ${n} 条`)
  ui.closeAssign()
}
</script>

<template>
  <a-modal
    :open="ui.assignOpen"
    :title="ui.assignTitle"
    :width="420"
    ok-text="确认分配"
    cancel-text="取消"
    @ok="ok"
    @cancel="ui.closeAssign()"
  >
    <p class="as-tip">
      将为选中的 <b>{{ count }}</b> 条记录分配
      <b>{{ ui.assignField === 'owner' ? '负责人' : ui.assignField === 'approver' ? '处理人' : ui.assignField === 'role' ? '角色' : ui.assignField === 'dept' ? '部门' : '归属' }}</b>。
    </p>
    <a-select
      v-model:value="value"
      :options="options.map((o) => ({ label: o, value: o }))"
      show-search
      placeholder="请选择"
      style="width: 100%"
      :filter-option="(input: string, opt: any) => String(opt.label).toLowerCase().includes(input.toLowerCase())"
    />
  </a-modal>
</template>

<script lang="ts">
export default { name: 'AssignModal' }
</script>

<style scoped>
.as-tip {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--text-2);
}
.as-tip b {
  color: var(--brand-600);
}
</style>
