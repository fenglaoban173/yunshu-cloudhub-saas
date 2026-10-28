/**
 * Ant Design Vue 4 主题定制 —— 把组件库收敛到自有设计语言
 * 商务科技 / 简约大气：低饱和、细边框、克制阴影、小圆角
 *
 * 注意：Ant Design Vue 4 采用 design token 体系，
 * 绝大多数组件（Table / Card / Button / Tag / Input …）不再提供
 * React 4 风格的组件级 token，需通过全局 alias token 统一控制。
 */
import type { ThemeConfig } from 'ant-design-vue/es/config-provider/context'

export const themeConfig: ThemeConfig = {
  token: {
    /* ---------- 主色系 ---------- */
    colorPrimary: '#165DFF',
    colorInfo: '#165DFF',
    colorSuccess: '#00B42A',
    colorWarning: '#FF7D00',
    colorError: '#F53F3F',
    colorLink: '#165DFF',
    colorLinkHover: '#4080FF',
    colorLinkActive: '#0E42D2',

    // 主色衍生：选中态底色 / 边框
    colorPrimaryBg: '#E8F3FF',
    colorPrimaryBgHover: '#BEDAFF',
    colorPrimaryBorder: '#BEDAFF',
    colorPrimaryBorderHover: '#6AA1FF',
    colorPrimaryText: '#165DFF',
    colorPrimaryTextHover: '#4080FF',
    colorPrimaryTextActive: '#0E42D2',

    /* ---------- 文本 ---------- */
    colorTextBase: '#1A1D21',
    colorText: '#1A1D21',
    colorTextHeading: '#1A1D21',
    colorTextLabel: '#1A1D21',
    colorTextSecondary: '#4E5969',
    colorTextDescription: '#4E5969',
    colorTextTertiary: '#86909C',
    colorTextQuaternary: '#C9CDD4',
    colorTextPlaceholder: '#B7BCC4',
    colorTextDisabled: '#C9CDD4',
    colorTextLightSolid: '#FFFFFF',

    /* ---------- 背景 ---------- */
    colorBgBase: '#F7F8FA',
    colorBgContainer: '#FFFFFF',
    colorBgElevated: '#FFFFFF',
    colorBgLayout: '#F7F8FA',
    colorBgTextHover: '#F7F9FC',
    colorBgTextActive: '#E8EAED',
    colorBgMask: 'rgba(29, 35, 41, 0.45)',

    /* ---------- 填充（表头 / 行 hover / 弱底色） ---------- */
    colorFill: '#F7F8FA',
    colorFillSecondary: '#F7F9FC',
    colorFillTertiary: '#F7F8FA',
    colorFillQuaternary: '#F7F8FA',
    colorFillContent: '#F7F9FC',

    /* ---------- 边框 ---------- */
    colorBorder: '#E8EAED',
    colorBorderSecondary: '#F0F1F3',
    colorSplit: '#F0F1F3',
    lineWidth: 1,

    /* ---------- 圆角 ---------- */
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,
    borderRadiusXS: 2,

    /* ---------- 字体 ---------- */
    fontFamily:
      "'PingFang SC', 'HarmonyOS Sans SC', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
    fontSize: 14,
    fontSizeLG: 16,
    fontSizeSM: 12,
    fontSizeHeading1: 38,
    fontSizeHeading2: 30,
    fontSizeHeading3: 24,
    fontSizeHeading4: 20,
    fontSizeHeading5: 16,
    fontWeightStrong: 600,
    lineHeight: 1.5714,
    wireframe: false,

    /* ---------- 尺寸（4px 栅格） ---------- */
    sizeUnit: 4,
    sizeStep: 4,
    controlHeight: 32,
    controlHeightSM: 24,
    controlHeightXS: 16,
    controlHeightLG: 40,

    /* ---------- 动效 ---------- */
    motionDurationFast: '0.1s',
    motionDurationMid: '0.18s',
    motionDurationSlow: '0.26s',
    motionEaseInOut: 'cubic-bezier(0.34, 0.69, 0.1, 1)',

    /* ---------- 阴影 ---------- */
    boxShadow: '0 4px 16px rgba(29, 35, 41, 0.08)',
    boxShadowSecondary: '0 2px 8px rgba(29, 35, 41, 0.06)',
    boxShadowTertiary: '0 1px 2px rgba(29, 35, 41, 0.03)',
  },

  components: {
    Layout: {
      colorBgHeader: '#FFFFFF',
      colorBgBody: '#F7F8FA',
      colorBgTrigger: '#17171A',
    },
    Menu: {
      radiusItem: 6,
      radiusSubMenuItem: 4,
      itemMarginInline: 8,
    },
  },
}
