/** 确定性随机，保证每次刷新演示数据一致 */
export function makeRng(seed = 20261027) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}
export const rng = makeRng()

export const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)]
export const int = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min
export const money = (min: number, max: number, decimals = 2) =>
  +(min + rng() * (max - min)).toFixed(decimals)

export const pad = (n: number, len = 4) => String(n).padStart(len, '0')

/** 2024-01-01 ~ 2025-12-31 的随机日期 */
export function dateIn(seedYear = 2025) {
  const m = int(1, 12)
  const d = int(1, 28)
  return `${seedYear}-${pad(m, 2)}-${pad(d, 2)}`
}
export function dateTimeIn(seedYear = 2025) {
  const m = int(1, 12)
  const d = int(1, 28)
  const h = int(8, 20)
  const mi = int(0, 59)
  return `${seedYear}-${pad(m, 2)}-${pad(d, 2)} ${pad(h, 2)}:${pad(mi, 2)}`
}
export function monthIn() {
  return `2025-${pad(int(1, 12), 2)}`
}

export const surnames = '王李张刘陈杨黄赵周吴徐孙马朱胡林郭何高罗郑梁谢宋唐许韩冯邓曹彭'.split('')
export const givenNames = [
  '明轩', '思远', '静怡', '嘉禾', '博文', '雨薇', '子墨', '雅雯', '浩然', '一诺',
  '沐辰', '若曦', '承宇', '诗涵', '书瑶', '以恒', '清和', '念安', '砚青', '致远',
]
export const people = Array.from({ length: 40 }, (_, i) => {
  const name = pick(surnames) + pick(givenNames)
  return {
    id: `U${pad(i + 1, 5)}`,
    name,
    account: `${['chen', 'li', 'wang', 'zhao', 'sun', 'zhou', 'wu', 'xu'][i % 8]}${pad(i + 1, 3)}@cloudhub.cn`,
    phone: `1${pick(['3', '5', '7', '8', '9'])}${pad(int(100000000, 999999999), 9)}`,
  }
})

export const deptTree = [
  '集团管理中心', '销售中心', '市场中心', '研发中心', '交付服务中心', '财务中心', '人力资源中心', '供应链中心',
]

export const cityPool = [
  '北京', '上海', '深圳', '广州', '杭州', '成都', '南京', '武汉', '西安', '苏州',
  '合肥', '长沙', '青岛', '天津', '重庆', '厦门',
]

export const statusColors = {
  success: { text: '正常', color: 'success' },
  processing: { text: '进行中', color: 'processing' },
  warning: { text: '待处理', color: 'warning' },
  danger: { text: '已逾期', color: 'error' },
  default: { text: '草稿', color: 'default' },
}
