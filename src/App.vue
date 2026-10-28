<script setup lang="ts">
import { ConfigProvider } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import GlobalLayer from '@/components/GlobalLayer.vue'
import { themeConfig } from './theme'
</script>

<template>
  <ConfigProvider :locale="zhCN" :theme="themeConfig">
    <RouterView />
    <!-- 全局浮层：挂在这里而不是布局层，承接页等无外壳页面同样可用 -->
    <GlobalLayer />
  </ConfigProvider>
</template>
