/**
 * 全站统一的「二次确认」弹窗。
 *
 * `Modal.confirm` 是命令式挂载到 body 上的：不点「确认 / 取消」它就一直留在 DOM 里，
 * 组件卸载（切路由）也不会自动销毁 —— 来回切几次页面，body 上就会叠出一堆遮罩，
 * 后面的按钮全点不动。这里统一登记打开中的弹窗，切路由时统一销毁。
 */
import { Modal } from 'ant-design-vue'
import type { ModalFuncProps } from 'ant-design-vue/es/modal/Modal'

type ConfirmHandle = { destroy: () => void }

/** 当前打开中的确认弹窗 */
const opened = new Set<ConfirmHandle>()

/**
 * 打开一个可被统一回收的确认弹窗。
 * 用法与 `Modal.confirm` 完全一致，只是额外登记了句柄。
 */
export function confirmDialog(props: ModalFuncProps) {
  const handle = Modal.confirm({
    ...props,
    afterClose: () => {
      opened.delete(handle)
      props.afterClose?.()
    },
  })
  opened.add(handle)
  return handle
}

/** 销毁所有还开着的确认弹窗（路由切换时调用） */
export function destroyOpenDialogs() {
  opened.forEach((h) => {
    try {
      h.destroy()
    } catch {
      /* 已经销毁过 */
    }
  })
  opened.clear()
}
