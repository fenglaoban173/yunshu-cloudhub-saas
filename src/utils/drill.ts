/**
 * 图表下钻的统一出口
 * ---------------------------------------------------------------------------
 * 图表点一下要落到哪里，全站走同一套约定：
 *  - 柱 / 折线图点的是坐标轴分类（`name`），堆叠柱还要看 `seriesName`（点中的哪一段）
 *  - 饼图 / 漏斗图点的是扇区名（`name`）
 *  - 跳到明细页时把点中的那一项放进地址栏查询条件，列表页据此自动套上筛选
 *    （见 `views/ListPage.vue` 的深链筛选），否则跳过去还是一屏全量，等于没下钻
 */
import { message } from 'ant-design-vue'
import type { Router } from 'vue-router'

/** 取图表点的名称（分类轴标签 / 扇区名） */
export function chartName(p: any): string {
  return String(p?.name ?? '').trim()
}

/** 取图表点的系列名（堆叠柱里点中的具体是哪个系列） */
export function chartSeries(p: any): string {
  return String(p?.seriesName ?? '').trim()
}

/** 跳到明细页并带上筛选条件 */
export function drillTo(
  router: Router,
  path: string,
  query?: Record<string, any>,
  tip?: string,
) {
  router.push({ path, query })
  if (tip) message.info(tip)
}
