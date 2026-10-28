<script setup lang="ts">
/**
 * 偏好设置
 * ---------------------------------------------------------------------------
 * 三项偏好都真实生效：
 * - 表格密度：写到 <html data-density>，由 CSS 接管行高；
 * - 通知自动已读：打开通知面板时未读消息自动标记为已读；
 * - 登录落地页：登录后进「应用门户」还是回到上次所在的应用域。
 */
import { watch } from 'vue'
import { useChromeStore } from '@/stores/chrome'

const chrome = useChromeStore()

watch(
  () => chrome.prefsOpen,
  (v) => {
    if (v) chrome.applyDensity()
  },
)
</script>

<template>
  <a-modal
    :open="chrome.prefsOpen"
    title="偏好设置"
    :width="520"
    :footer="null"
    @cancel="chrome.closePrefs()"
  >
    <div class="pf-row">
      <div class="pf-label">
        表格密度
        <span class="pf-hint">列表页每行的高度</span>
      </div>
      <a-radio-group
        :value="chrome.prefs.density"
        button-style="solid"
        size="small"
        @change="(e: any) => chrome.setDensity(e.target.value)"
      >
        <a-radio-button value="compact">紧凑</a-radio-button>
        <a-radio-button value="default">默认</a-radio-button>
        <a-radio-button value="relaxed">宽松</a-radio-button>
      </a-radio-group>
    </div>

    <div class="pf-row">
      <div class="pf-label">
        通知自动已读
        <span class="pf-hint">打开通知面板时把未读消息标记为已读</span>
      </div>
      <a-switch
        :checked="chrome.prefs.autoRead"
        @change="(v: any) => chrome.setAutoRead(!!v)"
      />
    </div>

    <div class="pf-row">
      <div class="pf-label">
        登录落地页
        <span class="pf-hint">下次登录后先进哪个页面</span>
      </div>
      <a-radio-group
        :value="chrome.prefs.landing"
        size="small"
        @change="(e: any) => chrome.setLanding(e.target.value)"
      >
        <a-radio value="portal">应用门户</a-radio>
        <a-radio value="last">上次所在应用</a-radio>
      </a-radio-group>
    </div>

    <div class="pf-foot">
      <a-button type="primary" @click="chrome.closePrefs()">完成</a-button>
    </div>
  </a-modal>
</template>

<style scoped>
.pf-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 14px 0;
  border-bottom: 1px solid var(--border-subtle);
}
.pf-row:last-of-type {
  border-bottom: none;
}
.pf-label {
  font-size: 13.5px;
  color: var(--text-1);
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.pf-hint {
  font-size: 11.5px;
  color: var(--text-3);
}
.pf-foot {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
