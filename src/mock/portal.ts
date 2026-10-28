import type { AppCode } from '@/config/apps'

/**
 * 承接页（应用门户）静态配置
 *
 * 跨应用聚合的待办与统计不再放在这里 —— 它们改由 `composables/usePortal.ts`
 * 从全局数据仓库实时聚合，保证门户上的数字与各模块列表页永远一致。
 * 这里只保留与数据无关的「最近访问」快捷入口。
 */

/** 最近访问（门户底部快捷入口） */
export const portalRecent: { app: AppCode; label: string; path: string }[] = [
  { app: 'oa', label: '审批中心', path: '/oa/approval' },
  { app: 'finance', label: '财务工作台', path: '/finance/dashboard' },
  { app: 'oa', label: '考勤管理', path: '/oa/attendance' },
  { app: 'finance', label: '应收管理', path: '/finance/ar' },
  { app: 'platform', label: '平台工作台', path: '/platform/dashboard' },
  { app: 'oa', label: '通知公告', path: '/oa/notice' },
]
