import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { message } from 'ant-design-vue'
import { menuTree, type MenuNode } from '@/config/menu'
import type { AppCode } from '@/config/apps'
import { useUserStore } from '@/stores/user'
import { useTabsStore } from '@/stores/tabs'
import { destroyOpenDialogs } from '@/utils/confirm'

const ListPage = () => import('@/views/ListPage.vue')

/**
 * 递归生成路由。
 * app / group 沿树向下继承：
 * - app  用于权限校验（这个页面属于哪个应用域）
 * - group 用于面包屑与侧栏展开（这个页面属于哪个菜单分组）
 */
function buildRoutes(
  nodes: MenuNode[],
  parentPath = '',
  app?: AppCode,
  group?: string,
): RouteRecordRaw[] {
  const routes: RouteRecordRaw[] = []
  for (const node of nodes) {
    const full = node.path.startsWith('/') ? node.path : `${parentPath}/${node.path}`
    const nodeApp = node.app ?? app
    if (node.children?.length) {
      routes.push({
        path: full,
        name: node.key,
        meta: { title: node.title, docTitle: node.docTitle, group: node.key, app: nodeApp },
        component: () => import('@/views/Redirect.vue'),
        children: buildRoutes(node.children, full, nodeApp, node.key),
        redirect: node.children[0].path,
      })
    } else {
      routes.push({
        path: full,
        name: node.key,
        meta: {
          title: node.title,
          docTitle: node.docTitle,
          pageKey: node.pageKey,
          group: group ?? node.key,
          app: nodeApp,
          icon: node.icon,
        },
        component: node.component ?? ListPage,
      })
    }
  }
  return routes
}

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/login/index.vue'),
      meta: { public: true, title: '登录' },
    },
    {
      // 承接页：登录后先在这里选择要进入的系统（全屏，不带控制台外壳）
      path: '/portal',
      name: 'portal',
      component: () => import('@/views/portal/index.vue'),
      meta: { title: '应用门户' },
    },
    {
      path: '/',
      component: () => import('@/layouts/BasicLayout.vue'),
      children: [
        { path: '', redirect: '/portal' },
        ...buildRoutes(menuTree),
        { path: ':pathMatch(.*)*', redirect: '/portal' },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/portal' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach((to) => {
  const user = useUserStore()
  // 四个应用域的工作台菜单同名，靠 docTitle 在标签页上区分
  const doc = (to.meta.docTitle as string | undefined) ?? (to.meta.title as string | undefined)
  document.title = doc ? `${doc} · 云枢 CloudHub` : '云枢 CloudHub · 企业一体化管理平台'
  if (to.meta.public) return true
  if (!user.token) {
    return { name: 'login', query: to.fullPath === '/' ? undefined : { redirect: to.fullPath } }
  }
  // 应用域准入：没有该域权限就回到承接页
  const app = to.meta.app as AppCode | undefined
  if (app && !user.hasApp(app)) {
    message.warning('当前角色没有该应用的访问权限')
    return { name: 'portal' }
  }
  // 同步「当前所在应用域」，侧栏据此只展示对应菜单
  if (app && user.currentApp !== app) {
    user.switchApp(app)
    // 换应用时清掉其它应用域的页签（深链跳转同样适用）
    useTabsStore().closeOutside(app)
  }
  return true
})

// 切路由时销毁还开着的确认弹窗：命令式弹窗不随组件卸载消失，
// 不回收的话来回切几次页面，body 上会叠出一层遮罩把界面挡住。
router.afterEach(() => {
  destroyOpenDialogs()
})

export default router
