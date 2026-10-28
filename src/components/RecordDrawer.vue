<script setup lang="ts">
/**
 * 全局新增 / 编辑抽屉
 * ---------------------------------------------------------------------------
 * 表单字段由 `PageDef.columns` 自动生成：
 *   money/number → 数字输入框 · tag → 状态字典下拉 · 日期列 → 日期选择器 · 其余 → 文本框
 * 48 个列表页共用这一个抽屉，不需要逐页写表单。
 */
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { useUiStore } from '@/stores/ui'
import { useDataStore } from '@/stores/data'
import { pages } from '@/mock/pages'
import type { ColumnDef } from '@/config/types'

const ui = useUiStore()
const data = useDataStore()

const model = ref<Record<string, any>>({})
const submitting = ref(false)
const expanded = ref(false)

const def = computed(() => (ui.formPageKey ? pages[ui.formPageKey] : undefined))
const title = computed(() => {
  const d = def.value
  if (!d) return '表单'
  return ui.formMode === 'create' ? `新建${d.title}` : `编辑${d.title}`
})

/** 是否日期类字段 */
function dateFormatOf(col: ColumnDef): string | null {
  const hay = `${col.key} ${col.title}`
  if (!/(date|time|日期|时间|截止|期限|At$|Day)/i.test(hay)) return null
  return /时间|datetime|time/i.test(hay) ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD'
}

/** 表单字段（去掉自增编号与进度条这类不可编辑列） */
const fields = computed(() => {
  const d = def.value
  if (!d) return []
  return d.columns.filter((c) => c.key !== 'id' && c.type !== 'progress')
})
const visibleFields = computed(() => (expanded.value ? fields.value : fields.value.slice(0, 8)))
const restCount = computed(() => Math.max(0, fields.value.length - 8))

/** 状态字典下拉的选项 */
function optionsOf(col: ColumnDef) {
  return Object.keys(col.statusMap ?? {}).map((k) => ({ label: col.statusMap![k].text, value: k }))
}

watch(
  () => ui.formOpen,
  (open) => {
    if (!open) return
    expanded.value = false
    const base = data.blankRow(ui.formPageKey)
    if (ui.formMode === 'edit' && ui.formRecord) {
      model.value = { ...base, ...ui.formRecord }
    } else {
      model.value = { ...base, ...ui.formPreset }
      // 新增时给日期列填今天，避免留空
      const today = new Date().toISOString().slice(0, 10)
      for (const c of fields.value) {
        const fmt = dateFormatOf(c)
        if (fmt && !model.value[c.key]) model.value[c.key] = fmt.includes('HH') ? `${today} 09:00` : today
      }
    }
  },
)

/** 必填：第一个字段（标题类） */
const requiredKey = computed(() => fields.value[0]?.key ?? '')
const missing = ref('')

async function submit() {
  if (!def.value || !ui.formPageKey) return
  const key = requiredKey.value
  if (key && !String(model.value[key] ?? '').trim()) {
    missing.value = key
    message.warning(`请填写「${def.value.columns.find((c) => c.key === key)?.title}」`)
    return
  }
  missing.value = ''
  submitting.value = true
  // 轻微延时模拟提交过程（按钮 loading 状态可见）
  setTimeout(() => {
    if (ui.formMode === 'create') {
      data.addRow(ui.formPageKey, { ...model.value })
      message.success(`${def.value!.title}已创建`)
    } else if (ui.formRecord) {
      data.updateRow(ui.formPageKey, ui.formRecord.id, { ...model.value })
      message.success(`${def.value!.title}已保存`)
    }
    submitting.value = false
    ui.closeForm()
  }, 260)
}
</script>

<template>
  <a-drawer
    :open="ui.formOpen"
    :title="title"
    :width="640"
    :destroy-on-close="true"
    @close="ui.closeForm()"
  >
    <a-form layout="vertical" class="rf">
      <div class="rf-grid">
        <a-form-item
          v-for="(c, i) in visibleFields"
          :key="c.key"
          :label="c.title"
          :class="{ 'rf-full': i === 0 }"
          :validate-status="missing === c.key ? 'error' : ''"
          :help="missing === c.key ? '此项为必填' : undefined"
        >
          <a-input-number
            v-if="c.type === 'money' || c.type === 'number'"
            v-model:value="model[c.key]"
            :min="0"
            :precision="c.type === 'money' ? 2 : 0"
            :step="c.type === 'money' ? 100 : 1"
            style="width: 100%"
          />
          <a-select
            v-else-if="c.type === 'tag'"
            v-model:value="model[c.key]"
            :options="optionsOf(c)"
            allow-clear
            style="width: 100%"
          />
          <a-date-picker
            v-else-if="dateFormatOf(c)"
            v-model:value="model[c.key]"
            :value-format="dateFormatOf(c)!"
            :show-time="dateFormatOf(c)!.includes('HH')"
            style="width: 100%"
          />
          <a-input
            v-else
            v-model:value="model[c.key]"
            :placeholder="`请输入${c.title}`"
            allow-clear
          />
        </a-form-item>
      </div>

      <a-button v-if="restCount > 0" type="link" size="small" @click="expanded = !expanded">
        {{ expanded ? '收起' : `展开更多 ${restCount} 项` }}
      </a-button>
    </a-form>

    <template #footer>
      <div class="rf-foot">
        <a-button @click="ui.closeForm()">取消</a-button>
        <a-button type="primary" :loading="submitting" @click="submit">
          {{ ui.formMode === 'create' ? '创建' : '保存' }}
        </a-button>
      </div>
    </template>
  </a-drawer>
</template>

<script lang="ts">
export default { name: 'RecordDrawer' }
</script>

<style scoped>
.rf-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 16px;
}
.rf-full {
  grid-column: 1 / -1;
}
.rf-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
