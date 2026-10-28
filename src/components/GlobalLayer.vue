<script setup lang="ts">
/**
 * 全局浮层总装
 * ---------------------------------------------------------------------------
 * 挂在 App.vue 下（而不是布局层），这样门户页、登录页之外的所有页面
 * —— 包括脱离控制台外壳的承接页 —— 都能打开同一套浮层。
 */
import { onMounted } from 'vue'
import RecordDrawer from '@/components/RecordDrawer.vue'
import DetailDrawer from '@/components/DetailDrawer.vue'
import PreviewDrawer from '@/components/PreviewDrawer.vue'
import AssignModal from '@/components/AssignModal.vue'
import ProfileModal from '@/components/ProfileModal.vue'
import TenantModal from '@/components/TenantModal.vue'
import PrefsModal from '@/components/PrefsModal.vue'
import DocModal from '@/components/DocModal.vue'
import { useChromeStore } from '@/stores/chrome'

const chrome = useChromeStore()

onMounted(() => {
  // 恢复上次的表格密度
  chrome.applyDensity()
})
</script>

<template>
  <!-- 记录类：新增 / 编辑 / 详情 / 预览 / 分配 -->
  <RecordDrawer />
  <DetailDrawer />
  <PreviewDrawer />
  <AssignModal />
  <!-- 外壳类：个人中心 / 切换租户 / 偏好设置 / 文档 -->
  <ProfileModal />
  <TenantModal />
  <PrefsModal />
  <DocModal />
</template>
