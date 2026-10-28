/**
 * 前端导出工具
 * ---------------------------------------------------------------------------
 * 演示项目没有后端导出接口，导出走浏览器原生能力：拼 CSV → Blob → <a download>。
 * 带 UTF-8 BOM，Excel 打开中文不乱码。
 */

export interface ExportColumn {
  key: string
  title: string
}

function csvCell(v: any): string {
  const s = v === null || v === undefined ? '' : String(v)
  return `"${s.replace(/"/g, '""')}"`
}

/** 触发浏览器下载 */
export function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 导出为 CSV */
export function exportCsv(filename: string, columns: ExportColumn[], rows: Record<string, any>[]) {
  const head = columns.map((c) => csvCell(c.title)).join(',')
  const body = rows.map((r) => columns.map((c) => csvCell(r[c.key])).join(',')).join('\r\n')
  downloadText(`${filename}.csv`, `${head}\r\n${body}`)
}

/** 复制到剪贴板（带降级） */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* 忽略，走降级方案 */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/** 生成时间戳，用于文件名 */
export function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}
