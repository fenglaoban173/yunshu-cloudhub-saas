<script setup lang="ts">
/**
 * OA 协同办公 · 组织架构
 * ---------------------------------------------------------------------------
 * 部门树与成员列表均读全局仓库（dept / staff），在别处新建或编辑部门后这里立刻同步：
 *  - 新增 / 编辑 / 新增下级走共享动作（全局表单抽屉），保存后树里立刻出现；
 *  - 搜索为真实过滤：只展示命中部门及其父级路径，并高亮命中项；
 *  - 导出为真实 CSV 下载。
 */
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import AppIcon from '@/components/AppIcon.vue'
import { useAction } from '@/composables/useAction'
import { useDataStore } from '@/stores/data'
import { exportCsv, stamp } from '@/utils/export'

const data = useDataStore()
const { run } = useAction()

const selected = ref('D003')
const keyword = ref('')
const searchInput = ref<any>(null)

/** 部门列表（来自全局仓库） */
const deptRows = computed<any[]>(() => data.rows('dept'))

/** 空部门占位，避免仓库为空时模板报错 */
const EMPTY_DEPT: Record<string, any> = {
  id: '', name: '—', code: '—', parent: '—', manager: '—',
  people: 0, level: 0, costCenter: '—', status: '停用', createAt: '—',
}

/** 搜索命中的部门 id 集合 */
const matchedIds = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  const set = new Set<string>()
  if (!kw) return set
  for (const d of deptRows.value) {
    const name = String(d.name ?? '').toLowerCase()
    const code = String(d.code ?? '').toLowerCase()
    if (name.includes(kw) || code.includes(kw)) set.add(d.id)
  }
  return set
})

/** 需要展示的节点：命中节点 + 其父级路径（null 表示不做过滤） */
const visibleIds = computed(() => {
  if (!keyword.value.trim()) return null
  const set = new Set<string>(matchedIds.value)
  for (const id of matchedIds.value) {
    let cur = deptRows.value.find((d) => d.id === id)
    let guard = 0
    while (cur && guard++ < 20) {
      const parentName = String(cur.parent ?? '').trim()
      const parent = deptRows.value.find((d) => d.name === parentName)
      if (!parent) break
      set.add(parent.id)
      cur = parent
    }
  }
  return set
})

/** 构造树节点 */
function toNode(d: any): any {
  const kids = deptRows.value
    .filter((c: any) => String(c.parent ?? '').trim() === d.name)
    .filter((c: any) => !visibleIds.value || visibleIds.value.has(c.id))
    .map((c: any) => toNode(c))
  return {
    key: d.id,
    title: d.name,
    children: kids.length ? kids : undefined,
    people: d.people,
    hit: matchedIds.value.has(d.id),
  }
}

/** 根部门：上级为空、「—」或上级已不存在 */
const rootDepts = computed<any[]>(() =>
  deptRows.value.filter((d) => {
    const p = String(d.parent ?? '').trim()
    const isRoot = !p || p === '—' || !deptRows.value.some((x) => x.name === p)
    return isRoot && (!visibleIds.value || visibleIds.value.has(d.id))
  }),
)

/** 部门树 */
const treeData = computed<any[]>(() => rootDepts.value.map((d) => toNode(d)))

/** 当前选中部门 */
const current = computed<any>(
  () => deptRows.value.find((d) => d.id === selected.value) ?? deptRows.value[0] ?? EMPTY_DEPT,
)

/** 当前部门成员（来自员工档案） */
const members = computed<any[]>(() =>
  data.rows('staff').filter((s: any) => s.dept === current.value.name),
)

/** 当前部门的下级部门 */
const children = computed<any[]>(() =>
  deptRows.value.filter((d: any) => String(d.parent ?? '').trim() === current.value.name),
)

const selectedKeys = computed<string[]>({
  get: () => [selected.value],
  set: (v) => {
    if (v?.length) selected.value = v[0]
  },
})

/** 搜索命中后，把右侧详情同步到第一个命中部门 */
watch(keyword, (kw) => {
  if (!kw.trim()) return
  const ids = Array.from(matchedIds.value)
  if (!ids.length) return
  if (!visibleIds.value?.has(selected.value)) selected.value = ids[0]
})

/** 搜索按钮：有关键词时清空并恢复完整树，否则聚焦搜索框 */
function toggleSearch() {
  if (keyword.value) {
    keyword.value = ''
    message.info('已清空搜索条件')
    return
  }
  searchInput.value?.focus?.()
}

/** 新增部门：打开全局新增表单 */
function addDept() {
  run('新增部门', { pageKey: 'dept' })
}

/** 编辑当前部门 */
function editDept() {
  run('编辑', { pageKey: 'dept', row: current.value })
}

/** 新增下级：把当前部门作为上级预填 */
function addChild() {
  run('新增下级', {
    pageKey: 'dept',
    row: {
      parent: current.value.name,
      level: Number(current.value.level || 1) + 1,
      status: '启用',
    },
  })
}

/** 导出组织架构 CSV */
function exportOrg() {
  const rows = deptRows.value
  if (!rows.length) {
    message.warning('没有可导出的部门数据')
    return
  }
  exportCsv(
    `组织架构-${stamp()}`,
    [
      { key: 'name', title: '部门名称' },
      { key: 'parent', title: '上级部门' },
      { key: 'manager', title: '负责人' },
      { key: 'people', title: '员工数' },
      { key: 'status', title: '状态' },
    ],
    rows,
  )
  message.success(`已导出 ${rows.length} 个部门`)
}
</script>

<template>
  <div class="page org-page">
    <div class="og-head">
      <div>
        <h1>组织架构</h1>
        <p>多法人主体、多层级部门树与成本中心</p>
      </div>
      <a-space>
        <a-button @click="exportOrg">
          <template #icon><AppIcon name="DownloadOutlined" :size="14" /></template>
          导出
        </a-button>
        <a-button type="primary" @click="addDept">
          <template #icon><AppIcon name="PlusOutlined" :size="14" /></template>
          新增部门
        </a-button>
      </a-space>
    </div>

    <div class="og-grid">
      <!-- 左：部门树 -->
      <div class="card og-tree-card">
        <div class="card-hd">
          <h3>部门树</h3>
          <a-space>
            <span v-if="keyword.trim()" class="cnt">找到 {{ matchedIds.size }} 个部门</span>
            <a-button type="text" size="small" @click="toggleSearch">
              <AppIcon :name="keyword.trim() ? 'CloseOutlined' : 'SearchOutlined'" :size="14" />
            </a-button>
          </a-space>
        </div>
        <div class="og-search">
          <a-input ref="searchInput" v-model:value="keyword" placeholder="搜索部门 / 部门编码" allow-clear size="small">
            <template #prefix><AppIcon name="SearchOutlined" :size="12" /></template>
          </a-input>
        </div>
        <div class="og-tree">
          <a-tree
            :tree-data="treeData"
            v-model:selected-keys="selectedKeys"
            :default-expand-all="true"
            block-node
          >
            <!-- 节点标题：部门名 + 人数，搜索命中项高亮 -->
            <template #title="node">
              <div class="tree-node">
                <span :class="['tn-name', node.hit ? 'tn-hit' : '']">{{ node.title }}</span>
                <span class="tn-count">{{ node.people }}</span>
              </div>
            </template>
          </a-tree>
          <a-empty
            v-if="!treeData.length"
            :description="keyword.trim() ? '没有匹配的部门' : '暂无部门数据'"
            :image="undefined"
            style="padding: 30px 0"
          />
        </div>
      </div>

      <!-- 右：部门详情 -->
      <div class="og-detail">
        <div class="card">
          <div class="card-hd">
            <h3>{{ current.name }}</h3>
            <a-space>
              <a-button size="small" @click="editDept">
                <template #icon><AppIcon name="EditOutlined" :size="13" /></template>
                编辑
              </a-button>
              <a-button size="small" type="primary" @click="addChild">
                新增下级
              </a-button>
            </a-space>
          </div>
          <div class="card-bd">
            <a-descriptions :column="3" size="small" bordered :label-style="{ width: '96px' }">
              <a-descriptions-item label="部门编码">{{ current.code }}</a-descriptions-item>
              <a-descriptions-item label="负责人">{{ current.manager }}</a-descriptions-item>
              <a-descriptions-item label="编制人数">{{ current.people }}</a-descriptions-item>
              <a-descriptions-item label="成本中心">{{ current.costCenter }}</a-descriptions-item>
              <a-descriptions-item label="上级部门">{{ current.parent }}</a-descriptions-item>
              <a-descriptions-item label="层级">第 {{ current.level }} 级</a-descriptions-item>
              <a-descriptions-item label="创建日期">{{ current.createAt }}</a-descriptions-item>
              <a-descriptions-item label="状态">
                <a-tag :color="current.status === '启用' ? 'success' : 'default'" :bordered="false">{{ current.status }}</a-tag>
              </a-descriptions-item>
            </a-descriptions>
          </div>
        </div>

        <div class="og-two">
          <div class="card">
            <div class="card-hd"><h3>部门成员</h3><span class="cnt">{{ members.length }} 人</span></div>
            <div class="card-bd" style="padding: 0">
              <a-table :data-source="members" :pagination="false" size="small" row-key="id">
                <a-table-column key="name" title="姓名" data-index="name" width="86">
                  <template #default="{ record }">
                    <div class="mem">
                      <a-avatar :size="22" style="background: #165dff; font-size: 11px">{{ record.name.slice(0, 1) }}</a-avatar>
                      {{ record.name }}
                    </div>
                  </template>
                </a-table-column>
                <a-table-column key="position" title="岗位" data-index="position" />
                <a-table-column key="level" title="职级" data-index="level" width="64" />
                <a-table-column key="status" title="状态" data-index="status" width="80">
                  <template #default="{ record }">
                    <a-tag :color="record.status === '在职' ? 'success' : 'warning'" :bordered="false">{{ record.status }}</a-tag>
                  </template>
                </a-table-column>
              </a-table>
              <a-empty v-if="!members.length" description="该部门暂无成员" :image="undefined" style="padding: 22px 0" />
            </div>
          </div>

          <div class="card">
            <div class="card-hd"><h3>下级部门</h3><span class="cnt">{{ children.length }} 个</span></div>
            <div class="card-bd" style="padding: 8px 0">
              <div v-for="c in children" :key="c.id" class="sub-item" @click="selected = c.id">
                <span class="sub-ico"><AppIcon name="ApartmentOutlined" :size="14" /></span>
                <div class="sub-main">
                  <div class="sub-name">{{ c.name }}</div>
                  <div class="sub-meta">{{ c.manager }} · {{ c.costCenter }}</div>
                </div>
                <span class="sub-people num">{{ c.people }} 人</span>
              </div>
              <a-empty v-if="!children.length" description="无下级部门" :image="undefined" style="padding: 22px 0" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.org-page { display: flex; flex-direction: column; gap: 12px; }
.og-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
.og-head h1 { margin: 0 0 5px; font-size: 20px; font-weight: 600; }
.og-head p { margin: 0; font-size: 13px; color: var(--text-3); }

.og-grid { display: grid; grid-template-columns: 288px minmax(0, 1fr); gap: 12px; align-items: start; }
.og-tree-card { display: flex; flex-direction: column; }
.og-search { padding: 10px 14px; border-bottom: 1px solid var(--border-subtle); }
.og-tree { padding: 8px 6px 14px; max-height: 640px; overflow: auto; }
.og-tree :deep(.ant-tree-treenode) { width: 100%; }
.og-tree :deep(.ant-tree-node-content-wrapper) { flex: 1; min-width: 0; border-radius: var(--r-sm); }
.og-tree :deep(.ant-tree-node-selected) { background: var(--brand-050) !important; }
:deep(.tree-node) { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-right: 6px; }
:deep(.tn-name) { font-size: 13px; color: var(--text-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
:deep(.tn-name.tn-hit) { color: var(--brand-700); font-weight: 600; background: var(--brand-050); padding: 0 4px; border-radius: var(--r-sm); }
:deep(.tn-count) { font-size: 11px; color: var(--text-4); flex: none; }

.og-detail { display: flex; flex-direction: column; gap: 12px; }
.og-two { display: grid; grid-template-columns: 1.25fr 1fr; gap: 12px; align-items: start; }
.cnt { font-size: 12px; color: var(--text-3); }
.mem { display: flex; align-items: center; gap: 7px; }
.sub-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 18px; cursor: pointer;
  transition: background-color var(--dur-base) var(--ease);
}
.sub-item:hover { background: var(--surface-hover); }
.sub-ico {
  width: 28px; height: 28px; border-radius: var(--r-sm);
  background: var(--brand-050); color: var(--brand-600);
  display: flex; align-items: center; justify-content: center; flex: none;
}
.sub-main { flex: 1; min-width: 0; }
.sub-name { font-size: 13px; color: var(--text-1); }
.sub-meta { font-size: 11.5px; color: var(--text-3); margin-top: 1px; }
.sub-people { font-size: 12.5px; color: var(--text-2); }

@media (max-width: 1180px) {
  .og-grid { grid-template-columns: 1fr; }
  .og-two { grid-template-columns: 1fr; }
}
</style>
