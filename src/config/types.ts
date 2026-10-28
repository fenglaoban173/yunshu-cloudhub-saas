export type ColumnType =
  | 'text'
  | 'money'
  | 'number'
  | 'date'
  | 'tag'
  | 'progress'
  | 'avatar'
  | 'link'
  | 'code'

export interface StatusMeta {
  text: string
  color: string
}

export interface ColumnDef {
  key: string
  title: string
  type?: ColumnType
  width?: number
  minWidth?: number
  align?: 'left' | 'right' | 'center'
  fixed?: 'left' | 'right'
  ellipsis?: boolean
  statusMap?: Record<string, StatusMeta>
  suffix?: string
  /** 自定义渲染（返回字符串或 VNode 名称标记） */
  render?: 'owner' | 'money' | 'progress'
}

export interface SearchField {
  key: string
  label: string
  type: 'input' | 'select' | 'date' | 'daterange'
  options?: { label: string; value: string }[]
  width?: number
  span?: number
}

export interface StatDef {
  label: string
  value: string
  unit?: string
  trend?: number
  tone?: 'brand' | 'success' | 'warning' | 'danger'
  icon?: string
  hint?: string
}

export interface PageDef {
  key: string
  title: string
  desc?: string
  columns: ColumnDef[]
  search?: SearchField[]
  data: Record<string, any>[]
  stats?: StatDef[]
  toolbar?: string[]
  /**
   * 批量动作：只在勾选了行之后才出现在工具栏上。
   * 全部带 needSelect 语义 —— 没勾选就点不到，勾选了才对选中行生效。
   */
  batchActions?: string[]
  rowActions?: string[]
  primaryAction?: string
  tabs?: string[]
}
