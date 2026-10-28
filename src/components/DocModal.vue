<script setup lang="ts">
/**
 * 文档弹窗（帮助文档 / 服务协议 / 隐私政策 / 安全白皮书）
 * 内容来自 src/utils/docs.ts
 */
import { useChromeStore } from '@/stores/chrome'

const chrome = useChromeStore()
</script>

<template>
  <a-modal
    :open="chrome.docOpen"
    :title="chrome.doc?.title"
    :width="680"
    :footer="null"
    @cancel="chrome.closeDoc()"
  >
    <div v-if="chrome.doc" class="doc">
      <p class="doc-sub">{{ chrome.doc.subtitle }}</p>
      <section v-for="s in chrome.doc.sections" :key="s.title" class="doc-sec">
        <h4>{{ s.title }}</h4>
        <p>{{ s.body }}</p>
      </section>
    </div>
    <div class="doc-foot">
      <a-button type="primary" @click="chrome.closeDoc()">我知道了</a-button>
    </div>
  </a-modal>
</template>

<style scoped>
.doc {
  max-height: 58vh;
  overflow: auto;
  padding-right: 4px;
}
.doc-sub {
  margin: 0 0 16px;
  font-size: 12.5px;
  color: var(--text-3);
}
.doc-sec {
  margin-bottom: 18px;
}
.doc-sec h4 {
  margin: 0 0 7px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-1);
  padding-left: 9px;
  border-left: 3px solid var(--brand-500);
  line-height: 1.3;
}
.doc-sec p {
  margin: 0;
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.75;
  white-space: pre-wrap;
}
.doc-foot {
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
  border-top: 1px solid var(--border-subtle);
}
</style>
