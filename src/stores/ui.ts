import { defineStore } from 'pinia'

/**
 * 全局交互状态
 * ---------------------------------------------------------------------------
 * 新增/编辑抽屉、详情抽屉、预览抽屉都是**全局单例**，挂在布局层。
 * 这样任何一个页面（列表页、看板、待办、凭证录入…）都能用同一套入口打开表单，
 * 不必各自维护 drawer 状态；跨页面触发的动作（比如在商机行上点「新建合同」）
 * 也能正常打开表单。
 */
export const useUiStore = defineStore('ui', {
  state: () => ({
    /** 新增 / 编辑抽屉 */
    formOpen: false,
    formMode: 'create' as 'create' | 'edit',
    formPageKey: '',
    formRecord: null as any,
    /** 表单预填值（转化场景：客户名、来源等自动带入） */
    formPreset: {} as Record<string, any>,

    /** 详情抽屉（只读） */
    detailOpen: false,
    detailPageKey: '',
    detailRecord: null as any,

    /** 预览抽屉（简报 / 流程设计 / 权限树 / 调试响应） */
    previewOpen: false,
    previewTitle: '',
    previewBody: '' as any,

    /** 分配弹窗（分配责任人 / 角色 / 部门） */
    assignOpen: false,
    assignPageKey: '',
    assignIds: [] as any[],
    assignField: 'owner',
    assignTitle: '分配',
  }),
  actions: {
    openCreate(pageKey: string, preset: Record<string, any> = {}) {
      this.formMode = 'create'
      this.formPageKey = pageKey
      this.formRecord = null
      this.formPreset = { ...preset }
      this.formOpen = true
    },
    openEdit(pageKey: string, record: any) {
      this.formMode = 'edit'
      this.formPageKey = pageKey
      this.formRecord = record ? { ...record } : null
      this.formPreset = {}
      this.formOpen = true
    },
    openDetail(pageKey: string, record: any) {
      this.detailPageKey = pageKey
      this.detailRecord = record ? { ...record } : null
      this.detailOpen = true
    },
    openPreview(title: string, body: any) {
      this.previewTitle = title
      this.previewBody = body
      this.previewOpen = true
    },
    openAssign(pageKey: string, ids: any[], field: string, title: string) {
      this.assignPageKey = pageKey
      this.assignIds = [...ids]
      this.assignField = field
      this.assignTitle = title
      this.assignOpen = true
    },
    closeForm() {
      this.formOpen = false
    },
    closeDetail() {
      this.detailOpen = false
    },
    closePreview() {
      this.previewOpen = false
    },
    closeAssign() {
      this.assignOpen = false
    },
  },
})
