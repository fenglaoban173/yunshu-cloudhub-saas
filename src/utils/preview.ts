/**
 * 预览内容构造器
 * ---------------------------------------------------------------------------
 * 「预览」类动作（会议纪要、流程设计、权限分配、价格策略、票据、对账未达项……）
 * 需要展示一块结构化内容。这里按动作名生成对应的分区内容，交给全局预览抽屉渲染。
 */
import { pages } from '@/mock/pages'
import type { PageDef } from '@/config/types'

export interface PreviewSection {
  title: string
  type: 'kv' | 'table' | 'text' | 'code' | 'checklist'
  rows?: { label: string; value: string }[]
  columns?: { key: string; title: string }[]
  data?: Record<string, any>[]
  text?: string
  code?: string
}

export interface PreviewDoc {
  title: string
  subtitle?: string
  sections: PreviewSection[]
}

const defOf = (key: string): PageDef | undefined => pages[key]

/** 把一条记录转成键值对分区 */
function kvOf(def: PageDef | undefined, row: any): PreviewSection {
  const rows = (def?.columns ?? [])
    .filter((c) => row && row[c.key] !== undefined && row[c.key] !== '')
    .map((c) => ({ label: c.title, value: String(row[c.key]) }))
  return { title: '基本信息', type: 'kv', rows }
}

const t = (s: string) => ({ key: s, title: s })

/** 按动作名构造预览文档 */
export function buildPreview(name: string, pageKey: string, row: any): PreviewDoc {
  const def = defOf(pageKey)
  const title = row?.name ?? row?.title ?? row?.subject ?? row?.objective ?? row?.id ?? name
  const doc: PreviewDoc = { title, sections: [] }

  switch (name) {
    /* ---------------- OA ---------------- */
    case '纪要': {
      doc.subtitle = '会议纪要（自动生成，可编辑后归档）'
      doc.sections = [
        kvOf(def, row),
        {
          title: '讨论议程',
          type: 'table',
          columns: [t('议题'), t('主讲'), t('结论'), t('时长')],
          data: [
            { 议题: '上期目标完成情况回顾', 主讲: row?.organizer ?? '主持人', 结论: '达成预期', 时长: '15 分钟' },
            { 议题: '本期重点事项拆解', 主讲: '业务负责人', 结论: '待确认', 时长: '25 分钟' },
            { 议题: '风险与资源协调', 主讲: '支持部门', 结论: '需跨部门协同', 时长: '20 分钟' },
          ],
        },
        {
          title: '待办事项',
          type: 'checklist',
          data: [
            { 事项: '输出会议结论纪要并归档', 责任人: row?.organizer ?? '主持人', 截止: '今日', 状态: '进行中' },
            { 事项: '跟进跨部门协同事项', 责任人: '待指派', 截止: '本周', 状态: '未开始' },
            { 事项: '确认下期会议时间', 责任人: '行政', 截止: '本周', 状态: '已完成' },
          ],
        },
      ]
      return doc
    }
    case '设计流程':
    case '版本': {
      doc.subtitle = name === '版本' ? '版本历史' : '流程节点设计'
      doc.sections = [
        kvOf(def, row),
        {
          title: name === '版本' ? '版本记录' : '审批节点',
          type: 'table',
          columns: [t('节点'), t('处理角色'), t('审批方式'), t('时限')],
          data: [
            { 节点: '发起申请', 处理角色: '申请人', 审批方式: '发起', 时限: '—' },
            { 节点: '部门主管审批', 处理角色: '部门主管', 审批方式: '单人', 时限: '24 小时' },
            { 节点: '财务复核', 处理角色: '财务经理', 审批方式: '单人', 时限: '24 小时' },
            { 节点: '分管领导审批', 处理角色: '分管领导', 审批方式: '单人', 时限: '48 小时' },
            { 节点: '归档', 处理角色: '系统', 审批方式: '自动', 时限: '—' },
          ],
        },
      ]
      return doc
    }
    case '分配权限':
    case '数据权限': {
      doc.subtitle = name === '数据权限' ? '数据范围（行级权限）' : '功能权限（菜单 / 按钮）'
      doc.sections = [
        kvOf(def, row),
        {
          title: name === '数据权限' ? '可见数据范围' : '可访问菜单',
          type: 'checklist',
          data:
            name === '数据权限'
              ? [
                  { 事项: '本人及下级数据', 范围: '销售中心 / 交付服务中心', 状态: '已开启' },
                  { 事项: '本部门数据', 范围: '研发中心', 状态: '已开启' },
                  { 事项: '全部数据', 范围: '全公司', 状态: '未开启' },
                ]
              : [
                  { 事项: 'CRM 客户关系', 范围: '全部菜单 + 导出按钮', 状态: '已授权' },
                  { 事项: 'OA 协同办公', 范围: '审批 / 考勤 / 公告', 状态: '已授权' },
                  { 事项: '财务中心', 范围: '仅报表查看', 状态: '未授权' },
                  { 事项: '平台配置', 范围: '用户与角色维护', 状态: '未授权' },
                ],
        },
      ]
      return doc
    }
    case '拆解 KR':
    case '拆解': {
      doc.subtitle = '关键结果拆解'
      doc.sections = [
        kvOf(def, row),
        {
          title: 'KR 列表',
          type: 'table',
          columns: [t('KR'), t('权重'), t('当前值'), t('目标值'), t('状态')],
          data: [
            { KR: '新增签约客户 12 家', 权重: '40%', 当前值: '7', 目标值: '12', 状态: '进行中' },
            { KR: '续约率提升到 92%', 权重: '35%', 当前值: '88%', 目标值: '92%', 状态: '有风险' },
            { KR: '客户满意度 ≥ 4.6', 权重: '25%', 当前值: '4.5', 目标值: '4.6', 状态: '进行中' },
          ],
        },
      ]
      return doc
    }
    case '复盘': {
      doc.subtitle = '目标复盘'
      doc.sections = [
        kvOf(def, row),
        {
          title: '复盘记录',
          type: 'kv',
          rows: [
            { label: '完成度', value: `${row?.progress ?? 0}%` },
            { label: '自评分', value: `${row?.score ?? 0} / 5` },
            { label: '做得好的', value: '关键动作执行到位，跨部门协同顺畅' },
            { label: '可以改进', value: '前期需求确认偏慢，影响交付节奏' },
            { label: '下期改进项', value: '需求评审前移，锁定关键里程碑' },
          ],
        },
      ]
      return doc
    }
    case '查看票据': {
      doc.subtitle = '关联票据清单'
      doc.sections = [
        kvOf(def, row),
        {
          title: '发票 / 票据',
          type: 'table',
          columns: [t('票据号'), t('类型'), t('金额'), t('开票日期'), t('认证状态')],
          data: [
            { 票据号: '04412886', 类型: '增值税专用发票', 金额: '¥ 1,860.00', 开票日期: '2025-09-12', 认证状态: '已认证' },
            { 票据号: '04412887', 类型: '增值税普通发票', 金额: '¥ 420.00', 开票日期: '2025-09-12', 认证状态: '待认证' },
            { 票据号: '04412903', 类型: '行程单', 金额: '¥ 268.50', 开票日期: '2025-09-14', 认证状态: '已认证' },
          ],
        },
      ]
      return doc
    }
    case '预览': {
      doc.subtitle = '文档正文预览'
      doc.sections = [
        kvOf(def, row),
        {
          title: '正文',
          type: 'text',
          text:
            '一、适用范围\n本规范适用于集团及下属各业务单元的新员工入职引导，包括入职准备、办公环境、账号权限与试用期评估四个环节。\n\n二、关键节点\n入职前 3 个工作日完成账号开通与设备发放；入职当日完成部门介绍与制度宣导；试用期结束前 5 个工作日完成转正评估。\n\n三、责任人\n人力资源中心负责整体流程，各部门负责人负责岗位技能交接。',
        },
      ]
      return doc
    }
    case '台账': {
      doc.subtitle = '印章使用台账'
      doc.sections = [
        kvOf(def, row),
        {
          title: '使用记录',
          type: 'table',
          columns: [t('使用时间'), t('申请人'), t('事由'), t('经办人'), t('状态')],
          data: [
            { 使用时间: '2025-10-18 10:22', 申请人: '周砚', 事由: '客户合同签署', 经办人: '综合管理部', 状态: '已完成' },
            { 使用时间: '2025-10-16 15:40', 申请人: '陈墨', 事由: '银行开户资料', 经办人: '财务中心', 状态: '已完成' },
            { 使用时间: '2025-10-12 09:05', 申请人: '苏念', 事由: '人事证明文件', 经办人: '人力资源中心', 状态: '已归档' },
          ],
        },
      ]
      return doc
    }

    /* ---------------- 财务 ---------------- */
    case '三单匹配': {
      doc.subtitle = '采购三单匹配（合同 / 订单 / 发票）'
      doc.sections = [
        kvOf(def, row),
        {
          title: '匹配结果',
          type: 'table',
          columns: [t('单据'), t('单号'), t('金额'), t('匹配'), t('差异')],
          data: [
            { 单据: '采购合同', 单号: row?.contract ?? 'HT-2025-0092', 金额: '¥ 86,000.00', 匹配: '是', 差异: '—' },
            { 单据: '入库单', 单号: 'RK-2025-0318', 金额: '¥ 85,640.00', 匹配: '是', 差异: '¥ 360.00' },
            { 单据: '增值税发票', 单号: '04412886', 金额: '¥ 85,640.00', 匹配: '是', 差异: '¥ 0.00' },
          ],
        },
        { title: '结论', type: 'text', text: '三单金额一致，容差范围内（≤ 1%），允许付款。' },
      ]
      return doc
    }
    case '检查清单': {
      doc.subtitle = '期末结账检查清单'
      doc.sections = [
        kvOf(def, row),
        {
          title: '检查项',
          type: 'checklist',
          data: [
            { 事项: '所有凭证均已审核', 结果: '通过', 状态: '已完成' },
            { 事项: '银行与现金日记账已对平', 结果: '通过', 状态: '已完成' },
            { 事项: '往来科目已生成对账函', 结果: '2 家未回', 状态: '有风险' },
            { 事项: '固定资产折旧已计提', 结果: '通过', 状态: '已完成' },
            { 事项: '收入成本结转已完成', 结果: '通过', 状态: '已完成' },
            { 事项: '税金已计提', 结果: '通过', 状态: '已完成' },
          ],
        },
      ]
      return doc
    }
    case '未达项': {
      doc.subtitle = '未达账项明细'
      doc.sections = [
        kvOf(def, row),
        {
          title: '未达项',
          type: 'table',
          columns: [t('日期'), t('对方单位'), t('金额'), t('方向'), t('原因')],
          data: [
            { 日期: '2025-10-20', 对方单位: '云枢智造（杭州）', 金额: '¥ 12,800.00', 方向: '收入', 原因: '客户尚未收到对账单' },
            { 日期: '2025-10-18', 对方单位: '恒通物流', 金额: '¥ 3,240.00', 方向: '支出', 原因: '回单未回传' },
            { 日期: '2025-10-15', 对方单位: '中软数据服务', 金额: '¥ 26,000.00', 方向: '支出', 原因: '银行扣款手续费' },
          ],
        },
      ]
      return doc
    }

    /* ---------------- CRM / 平台 ---------------- */
    case '价格策略': {
      doc.subtitle = '阶梯价格与授权策略'
      doc.sections = [
        kvOf(def, row),
        {
          title: '价格阶梯',
          type: 'table',
          columns: [t('授权档位'), t('用户数'), t('单价'), t('折扣'), t('适用客户')],
          data: [
            { 授权档位: '标准版', 用户数: '≤ 50', 单价: '¥ 1,280 / 席位', 折扣: '—', 适用客户: '成长型客户' },
            { 授权档位: '专业版', 用户数: '51 ~ 200', 单价: '¥ 980 / 席位', 折扣: '8.5 折', 适用客户: '中型客户' },
            { 授权档位: '旗舰版', 用户数: '> 200', 单价: '¥ 760 / 席位', 折扣: '7.2 折', 适用客户: '集团型客户' },
          ],
        },
      ]
      return doc
    }
    case '字典项': {
      doc.subtitle = '字典项维护'
      doc.sections = [
        kvOf(def, row),
        {
          title: '字典项',
          type: 'table',
          columns: [t('标签'), t('值'), t('排序'), t('启用'), t('备注')],
          data: [
            { 标签: '待回款', 值: 'PENDING', 排序: '1', 启用: '是', 备注: '应收未到账' },
            { 标签: '部分回款', 值: 'PARTIAL', 排序: '2', 启用: '是', 备注: '部分核销' },
            { 标签: '已回款', 值: 'SETTLED', 排序: '3', 启用: '是', 备注: '结清' },
            { 标签: '已逾期', 值: 'OVERDUE', 排序: '4', 启用: '是', 备注: '超账期未回款' },
          ],
        },
      ]
      return doc
    }
    case '测试': {
      doc.subtitle = '编号生成规则测试'
      doc.sections = [
        kvOf(def, row),
        {
          title: '生成结果',
          type: 'code',
          code: `规则：${row?.rule ?? row?.pattern ?? 'PREFIX + YYYYMMDD + SEQ(4)'}\n\n示例：\n  CQ${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}0001\n  CQ${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}0002\n\n冲突检查：未发现重复编号`,
        },
      ]
      return doc
    }
    case '配置功能': {
      doc.subtitle = '租户已订阅的应用域与功能开关'
      doc.sections = [
        kvOf(def, row),
        {
          title: '应用域',
          type: 'checklist',
          data: [
            { 事项: 'CRM 客户关系', 范围: '旗舰版已包含', 状态: '已开通' },
            { 事项: 'OA 协同办公', 范围: '旗舰版已包含', 状态: '已开通' },
            { 事项: '财务中心', 范围: '旗舰版已包含', 状态: '已开通' },
            { 事项: '平台配置', 范围: '旗舰版已包含', 状态: '已开通' },
            { 事项: '开放平台 API', 范围: '需单独购买', 状态: '未开通' },
          ],
        },
      ]
      return doc
    }
    case '变更详情': {
      doc.subtitle = '数据变更快照'
      doc.sections = [
        kvOf(def, row),
        {
          title: '字段变更',
          type: 'table',
          columns: [t('字段'), t('变更前'), t('变更后'), t('变更时间')],
          data: [
            { 字段: 'status', 变更前: '草稿', 变更后: '已发布', 变更时间: row?.time ?? '—' },
            { 字段: 'owner', 变更前: '林越', 变更后: '苏念', 变更时间: row?.time ?? '—' },
          ],
        },
      ]
      return doc
    }
    default: {
      doc.subtitle = '该内容由演示数据自动生成'
      doc.sections = [kvOf(def, row)]
      return doc
    }
  }
}
