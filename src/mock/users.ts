import type { AppCode } from '@/config/apps'

/**
 * 演示身份
 *
 * 真实系统里「用户 → 角色 → 应用域授权」由后端返回，这里用一份静态表模拟。
 * 不同身份被授权的应用域不同，因此左侧菜单与承接页卡片也会不同。
 */
export interface DemoUser {
  account: string
  password: string
  name: string
  /** 岗位角色 */
  role: string
  dept: string
  avatarText: string
  tenant: string
  tenantPlan: string
  /** 该角色被授权的应用域 */
  apps: AppCode[]
}

const PASSWORD = 'cloudhub2025'

export const demoUsers: DemoUser[] = [
  {
    account: 'admin@cloudhub.cn',
    password: PASSWORD,
    name: '苏念',
    role: 'OS 管理员',
    dept: '集团管理中心',
    avatarText: '苏',
    tenant: '云枢科技集团',
    tenantPlan: '旗舰版 Enterprise',
    // 平台管理员：管平台与内部协同，不接触销售业务，所以没有 CRM
    apps: ['oa', 'finance', 'platform'],
  },
  {
    account: 'chenmo@cloudhub.cn',
    password: PASSWORD,
    name: '陈墨',
    role: '集团财务总监',
    dept: '集团管理中心',
    avatarText: '陈',
    tenant: '云枢科技集团',
    tenantPlan: '旗舰版 Enterprise',
    apps: ['finance', 'oa'],
  },
  {
    account: 'sales@cloudhub.cn',
    password: PASSWORD,
    name: '周砚',
    role: '销售总监',
    dept: '客户运营中心',
    avatarText: '周',
    tenant: '云枢科技集团',
    tenantPlan: '旗舰版 Enterprise',
    apps: ['crm', 'oa'],
  },
  {
    account: 'super@cloudhub.cn',
    password: PASSWORD,
    name: '何见山',
    role: '超级管理员',
    dept: '平台运营部',
    avatarText: '何',
    tenant: '云枢科技集团',
    tenantPlan: '旗舰版 Enterprise',
    apps: ['crm', 'oa', 'finance', 'platform'],
  },
]

/** 登录页默认展示的身份 */
export const defaultDemoUser = demoUsers[0]

/** 按账号查演示身份 */
export function findDemoUser(account: string): DemoUser | undefined {
  return demoUsers.find((u) => u.account.toLowerCase() === account.trim().toLowerCase())
}
