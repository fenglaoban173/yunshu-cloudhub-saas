/**
 * 应用域（App Domain）元数据
 *
 * 一套 CloudHub 平台由若干「应用域」组成：CRM / OA / 财务 / 平台配置。
 * 用户按角色被授权进入其中的若干个，登录后的承接页（应用门户）按这里的元数据渲染卡片。
 *
 * 这里只放「与用户无关」的静态元数据；与用户相关的（哪些域可见、卡片上的统计数字）
 * 分别放在 @/stores/user 与 @/mock/portal。
 */

export type AppCode = 'crm' | 'oa' | 'finance' | 'platform'

export interface AppMeta {
  code: AppCode
  /** 全称，如「CRM 客户关系」 */
  name: string
  /** 短名，用于窄空间 */
  short: string
  /** 一句话说明 */
  desc: string
  /** 图标名（AppIcon 组件的图标 key） */
  icon: string
  /** 主题色 */
  color: string
  /** 进入该应用后的落地路由 —— 统一指向该应用域的工作台 */
  entry: string
  /** 该应用包含的功能项数 */
  modules: number
}

export const appList: AppMeta[] = [
  {
    code: 'crm',
    name: 'CRM 客户关系',
    short: 'CRM',
    desc: '从线索到回款的全周期客户经营',
    icon: 'TeamOutlined',
    color: '#165DFF',
    entry: '/crm/dashboard',
    modules: 15,
  },
  {
    code: 'oa',
    name: 'OA 协同办公',
    short: 'OA',
    desc: '审批流、组织与人事一体化协同',
    icon: 'CoffeeOutlined',
    color: '#00B42A',
    entry: '/oa/dashboard',
    modules: 17,
  },
  {
    code: 'finance',
    name: '财务中心',
    short: '财务',
    desc: '多账套核算、报表与资金管理',
    icon: 'BankOutlined',
    color: '#FF7D00',
    entry: '/finance/dashboard',
    modules: 17,
  },
  {
    code: 'platform',
    name: '平台配置',
    short: '平台',
    desc: '租户、用户、角色与系统参数',
    icon: 'SettingOutlined',
    color: '#722ED1',
    entry: '/platform/dashboard',
    modules: 12,
  },
]

/** 按编码取应用元数据 */
export function getApp(code: AppCode | string): AppMeta | undefined {
  return appList.find((a) => a.code === code)
}
