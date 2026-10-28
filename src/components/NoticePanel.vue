<script setup lang="ts">
/**
 * 通知面板（顶栏铃铛 / 门户铃铛共用的内容区）
 * ---------------------------------------------------------------------------
 * 读的是真实消息仓库：未读数、逐条已读、全部已读都会落到数据里，
 * 消息中心列表页随之变化。
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import AppIcon from '@/components/AppIcon.vue'
import { useDataStore } from '@/stores/data'

const data = useDataStore()
const router = useRouter()

const all = computed(() => data.rows('message'))
const list = computed(() => all.value.slice(0, 8))
const unread = computed(() => all.value.filter((m: any) => m.read === '未读'))

function tone(p: string) {
  if (p === '紧急') return 'error'
  if (p === '重要') return 'warning'
  return 'default'
}

/** 单条已读并跳到消息中心 */
function open(m: any) {
  if (m.read === '未读') data.updateRow('message', m.id, { read: '已读' })
  router.push('/platform/message')
}

/** 全部已读 */
function markAll() {
  const ids = unread.value.map((m: any) => m.id)
  if (!ids.length) {
    message.info('没有未读消息')
    return
  }
  data.patchRows('message', ids, { read: '已读' })
  message.success(`已标记 ${ids.length} 条消息为已读`)
}
</script>

<template>
  <div class="np">
    <div class="np-head">
      <span class="np-title">通知</span>
      <a class="np-act" @click="markAll">全部已读</a>
    </div>

    <a-empty v-if="!list.length" description="暂无消息" style="padding: 18px 0" />

    <div v-else class="np-list">
      <div
        v-for="m in list"
        :key="m.id"
        class="np-item"
        :class="{ unread: m.read === '未读' }"
        @click="open(m)"
      >
        <span class="np-dot" />
        <div class="np-main">
          <div class="np-t ellipsis">{{ m.title }}</div>
          <div class="np-s">
            {{ m.from }} · {{ m.type }} · {{ m.sendAt }}
          </div>
        </div>
        <a-tag v-if="m.priority !== '普通'" :color="tone(m.priority)" :bordered="false">
          {{ m.priority }}
        </a-tag>
      </div>
    </div>

    <div class="np-foot">
      <a class="np-more" @click="router.push('/platform/message')">
        查看全部消息
        <AppIcon name="RightOutlined" :size="11" />
      </a>
    </div>
  </div>
</template>

<style scoped>
.np {
  width: 330px;
}
.np-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 4px 8px;
}
.np-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}
.np-act {
  font-size: 12px;
  color: var(--brand-600);
  cursor: pointer;
}
.np-act:hover {
  color: var(--brand-700);
}
.np-list {
  max-height: 320px;
  overflow: auto;
}
.np-item {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 9px 4px;
  border-top: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: background-color var(--dur-base) var(--ease);
}
.np-item:hover {
  background: var(--surface-hover);
}
.np-dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: transparent;
  margin-top: 7px;
}
.np-item.unread .np-dot {
  background: var(--danger);
  box-shadow: 0 0 0 3px var(--danger-bg);
}
.np-main {
  flex: 1;
  min-width: 0;
}
.np-t {
  font-size: 12.5px;
  color: var(--text-2);
  line-height: 1.45;
}
.np-item.unread .np-t {
  color: var(--text-1);
  font-weight: 500;
}
.np-s {
  font-size: 11px;
  color: var(--text-4);
  margin-top: 3px;
}
.np-foot {
  border-top: 1px solid var(--border-subtle);
  padding-top: 9px;
  margin-top: 2px;
}
.np-more {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-3);
  cursor: pointer;
}
.np-more:hover {
  color: var(--brand-600);
}
</style>
