import { computed } from 'vue'
import type { AppCode } from '@/config/apps'
import { useDataStore } from '@/stores/data'

/**
 * 门户（承接页）的跨应用待办
 * ---------------------------------------------------------------------------
 * 门户只做聚合展示，数据全部来自全局仓库 —— 与各模块列表页同源。
 * 在审批中心通过一条待办，这里立刻少一条；勾销一笔应收，逾期数同步下降。
 */

export interface PortalTask {
  id: string
  app: AppCode
  /** 所属应用（用于着色） */
  appName: string
  title: string
  /** 来源：部门 / 客户 / 租户 */
  from: string
  /** 金额（可选） */
  amount?: string
  /** 时间或截止日期 */
  time: string
  urgency: '普通' | '加急' | '特急'
  /** 点击后跳转的路由 */
  path: string
}

/** 等待时长：审批单上没有这个字段时按单号派生一个稳定的值 */
function waitOf(row: any) {
  if (row?.waitHours !== undefined) return Number(row.waitHours)
  const n = Number(String(row?.id ?? '0').replace(/\D/g, '')) || 0
  return (n * 13) % 96 + 1
}

function yuan(v: any) {
  return `¥ ${Number(v ?? 0).toLocaleString('zh-CN')}`
}

export function usePortal() {
  const data = useDataStore()

  /** 待我审批（OA） */
  const approvals = computed(() =>
    data.rows('approval').filter((a: any) => a.status === '审批中'),
  )

  /** 逾期应收（财务） */
  const overdueAr = computed(() =>
    data.rows('ar').filter((a: any) => a.status === '已逾期'),
  )

  /** 待签合同（CRM） */
  const pendingContracts = computed(() =>
    data.rows('contract').filter((c: any) => c.status === '待签署'),
  )

  /** 异常租户（平台） */
  const abnormalTenants = computed(() =>
    data.rows('tenant').filter((t: any) => t.status !== '正常'),
  )

  const tasks = computed<PortalTask[]>(() => [
    ...approvals.value.slice(0, 5).map((a: any) => ({
      id: a.id,
      app: 'oa' as AppCode,
      appName: 'OA 协同办公',
      title: a.title,
      from: `${a.applicant} · ${a.dept}`,
      amount: a.amount ? yuan(a.amount) : undefined,
      time: `到达 ${waitOf(a)} 小时`,
      urgency: (a.urgency === '特急' || a.urgency === '加急' ? a.urgency : '普通') as PortalTask['urgency'],
      path: '/oa/approval',
    })),
    ...overdueAr.value.slice(0, 3).map((a: any) => ({
      id: a.id,
      app: 'finance' as AppCode,
      appName: '财务中心',
      title: `${a.customer} · 应收账期 ${a.period}`,
      from: a.customer,
      amount: yuan(a.balance),
      time: `逾期 ${a.ageDays} 天`,
      urgency: (a.ageDays > 120 ? '特急' : '加急') as PortalTask['urgency'],
      path: '/finance/ar',
    })),
    ...pendingContracts.value.slice(0, 2).map((c: any) => ({
      id: c.id,
      app: 'crm' as AppCode,
      appName: 'CRM 客户关系',
      title: c.title,
      from: c.customer,
      amount: yuan(c.amount),
      time: `负责人 ${c.owner}`,
      urgency: '加急' as PortalTask['urgency'],
      path: '/crm/contract',
    })),
    ...abnormalTenants.value.slice(0, 2).map((t: any) => ({
      id: t.id,
      app: 'platform' as AppCode,
      appName: '平台配置',
      title: `${t.name} · ${t.plan}`,
      from: t.code,
      time: `到期 ${t.expireAt}`,
      urgency: (t.status === '已过期' ? '特急' : '加急') as PortalTask['urgency'],
      path: '/platform/tenant',
    })),
  ])

  /** 门户顶部的今日概览 */
  const summary = computed(() => [
    { label: '待我审批', value: approvals.value.length, unit: '单', tone: 'brand' },
    { label: '逾期应收', value: overdueAr.value.length, unit: '笔', tone: 'danger' },
    { label: '异常租户', value: abnormalTenants.value.length, unit: '个', tone: 'warning' },
  ])

  /** 每个应用卡片上的关键指标 —— 同样来自实时仓库 */
  const appStats = computed<Record<AppCode, { label: string; value: string }[]>>(() => ({
    crm: [
      { label: '在途商机', value: String(data.rows('opportunity').length) },
      { label: '本月新增线索', value: String(data.rows('lead').length) },
      { label: '待签合同', value: String(pendingContracts.value.length) },
    ],
    oa: [
      { label: '待我审批', value: String(approvals.value.length) },
      { label: '我的待办', value: String(approvals.value.length) },
      { label: '已发布公告', value: String(data.rows('notice').filter((n: any) => n.status === '已发布').length) },
    ],
    finance: [
      { label: '待审单据', value: String(data.rows('voucher').filter((v: any) => v.status === '待审核').length) },
      { label: '逾期应收', value: String(overdueAr.value.length) },
      { label: '本月凭证', value: String(data.rows('voucher').length) },
    ],
    platform: [
      { label: '待处理申请', value: String(abnormalTenants.value.length) },
      { label: '活跃用户', value: String(data.rows('sysUser').length) },
      { label: '今日登录', value: String(data.rows('loginLog').length) },
    ],
  }))

  return { tasks, summary, appStats, approvals, overdueAr, abnormalTenants }
}
