<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart, FunnelChart, GaugeChart, LineChart, PieChart, RadarChart } from 'echarts/charts'
import {
  DatasetComponent, GridComponent, LegendComponent, TitleComponent, TooltipComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([
  BarChart, LineChart, PieChart, FunnelChart, GaugeChart, RadarChart,
  GridComponent, TooltipComponent, LegendComponent, TitleComponent, DatasetComponent,
  CanvasRenderer,
])

const props = withDefaults(
  defineProps<{ option: any; height?: string | number; clickable?: boolean }>(),
  { height: 280, clickable: false },
)

/** 点击图表元素时把 ECharts 的事件参数抛给调用方（用于下钻 / 联动筛选） */
const emit = defineEmits<{ (e: 'point-click', params: any): void }>()

const el = ref<HTMLDivElement>()
const chart = shallowRef<echarts.ECharts>()

/** 统一图表主题：克制、无网格线重绘 */
const baseOption = {
  color: ['#165DFF', '#14C9C9', '#00B42A', '#FF7D00', '#722ED1', '#F5319D', '#3491FA', '#86909C'],
  textStyle: { fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif' },
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'line', lineStyle: { color: '#D9DDE3', type: 'dashed' } },
    backgroundColor: 'rgba(23,23,26,0.92)',
    borderWidth: 0,
    textStyle: { color: '#fff', fontSize: 12 },
    padding: [8, 12],
  },
  grid: { left: 8, right: 16, top: 32, bottom: 4, containLabel: true },
}

function render() {
  if (!el.value) return
  if (!chart.value) chart.value = echarts.init(el.value, undefined, { renderer: 'canvas' })
  const option: any = { ...baseOption, ...props.option }
  if (props.clickable && Array.isArray(option.series)) {
    // 可点击的图表：鼠标移上去变成手型，暗示「这里能点」
    option.series = option.series.map((s: any) =>
      Array.isArray(s) ? s : { ...s, cursor: 'pointer', ...(s.type === 'line' ? { triggerLineEvent: true } : {}) },
    )
  }
  chart.value.setOption(option, true)
}

/**
 * 点在折线的「线段」上（而不是数据点上）时，ECharts 只给系列名，不给 dataIndex；
 * 而折线往往盖在柱子上（例如「目标」柱 + 「实际」面积线），默认还不响应线段点击。
 * 这里统一处理：开启 triggerLineEvent 后按横坐标反查最近的类目下标，
 * 并把类目名补进 name，页面里「按月份取数」的逻辑无论点哪儿都成立。
 */
function withNearestIndex(params: any) {
  if (!params || params.dataIndex != null) return params
  if (params.seriesType !== 'line') return params
  const x = params.event?.offsetX
  if (typeof x !== 'number') return params
  const inst = chart.value
  if (!inst) return params
  try {
    // 只用公开 API：getModel 是私有的，getOption 拿到的类目轴信息足够反查
    const opt = inst.getOption() as any
    const xAxis = opt?.xAxis?.[0]
    if (!xAxis || xAxis.type !== 'category') return params
    const idx = Math.round(inst.convertFromPixel({ xAxisIndex: 0 }, x))
    if (!Number.isFinite(idx)) return params
    const name = (xAxis.data ?? [])[idx]
    return { ...params, dataIndex: idx, name: params.name ?? name }
  } catch {
    // 非直角坐标系没有 x 轴，忽略即可
    return params
  }
}

/** 图表点击 → 抛给页面做下钻 */
function onChartClick(params: any) {
  if (!props.clickable) return
  emit('point-click', withNearestIndex(params))
}

function resize() {
  chart.value?.resize()
}

onMounted(() => {
  render()
  chart.value?.on('click', onChartClick)
  window.addEventListener('resize', resize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  chart.value?.dispose()
})

watch(() => props.option, render, { deep: true })
</script>

<template>
  <div ref="el" :style="{ height: typeof height === 'number' ? `${height}px` : height, width: '100%' }" />
</template>
