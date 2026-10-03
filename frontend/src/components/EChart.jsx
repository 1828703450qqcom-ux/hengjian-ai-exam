import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { BarChart, PieChart, LineChart, RadarChart, GaugeChart, GraphChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, GridComponent, LegendComponent, DataZoomComponent, MarkLineComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([
  BarChart, PieChart, LineChart, RadarChart, GaugeChart, GraphChart,
  TitleComponent, TooltipComponent, GridComponent, LegendComponent, DataZoomComponent, MarkLineComponent,
  CanvasRenderer,
])

export default function EChart({ option, height = 320, dark = false }) {
  const ref = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!ref.current) return
    chartRef.current = echarts.init(ref.current, dark ? 'dark' : undefined)
    const chart = chartRef.current
    chart.setOption(option || {})
    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); chart.dispose() }
  }, [])

  useEffect(() => {
    if (chartRef.current) chartRef.current.setOption(option || {}, true)
  }, [option])

  return <div ref={ref} style={{ width: '100%', height }} />
}
