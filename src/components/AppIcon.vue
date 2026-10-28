<script setup lang="ts">
import {
  AimOutlined, ApiOutlined, ApartmentOutlined, AppstoreOutlined, AreaChartOutlined,
  AuditOutlined, BankOutlined, BarChartOutlined, BlockOutlined, BookOutlined,
  CalendarOutlined, CarryOutOutlined, CheckCircleOutlined, ClockCircleOutlined,
  ClusterOutlined, CoffeeOutlined, CompassOutlined, ContainerOutlined, ControlOutlined,
  DashboardOutlined, DatabaseOutlined, DeleteOutlined, DollarOutlined, DownloadOutlined,
  EditOutlined, EnvironmentOutlined, ExclamationCircleOutlined, FallOutlined, FileDoneOutlined,
  FileProtectOutlined, FileSearchOutlined, FileTextOutlined, FilterOutlined, FlagOutlined,
  FolderOpenOutlined, FormOutlined, GlobalOutlined, GoldOutlined, HistoryOutlined, IdcardOutlined,
  InboxOutlined, LaptopOutlined, LineChartOutlined, LockOutlined, LoginOutlined,
  LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined, MessageOutlined, MoneyCollectOutlined,
  BulbOutlined, MoreOutlined, NotificationOutlined, NumberOutlined, PartitionOutlined,
  PayCircleOutlined, PhoneOutlined, PieChartOutlined, ProfileOutlined, ReadOutlined,
  ReconciliationOutlined, RiseOutlined, SafetyCertificateOutlined, SafetyOutlined,
  ScheduleOutlined, SearchOutlined, SettingOutlined, SolutionOutlined, HighlightOutlined,
  SwapOutlined, SyncOutlined, TagsOutlined, TeamOutlined, ThunderboltOutlined,
  TrophyOutlined, UploadOutlined, UserOutlined, UserSwitchOutlined, VideoCameraOutlined,
  ShopOutlined, WalletOutlined,
  CloseOutlined, CloseCircleOutlined, DownOutlined, PlusOutlined, UpOutlined, RightOutlined, WarningOutlined,
} from '@ant-design/icons-vue'
import type { Component } from 'vue'

const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 16 })

const map: Record<string, Component> = {
  AimOutlined, ApiOutlined, ApartmentOutlined, AppstoreOutlined, AreaChartOutlined,
  AuditOutlined, BankOutlined, BarChartOutlined, BlockOutlined, BookOutlined,
  CalendarOutlined, CarryOutOutlined, CheckCircleOutlined, ClockCircleOutlined,
  ClusterOutlined, CoffeeOutlined, CompassOutlined, ContainerOutlined, ControlOutlined,
  DashboardOutlined, DatabaseOutlined, DeleteOutlined, DollarOutlined, DownloadOutlined,
  EditOutlined, EnvironmentOutlined, ExclamationCircleOutlined, FallOutlined, FileDoneOutlined,
  FileProtectOutlined, FileSearchOutlined, FileTextOutlined, FilterOutlined, FlagOutlined,
  FolderOpenOutlined, FormOutlined, GlobalOutlined, GoldOutlined, HistoryOutlined, IdcardOutlined,
  InboxOutlined, LaptopOutlined, LineChartOutlined, LockOutlined, LoginOutlined,
  LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined, MessageOutlined, MoneyCollectOutlined,
  BulbOutlined, MoreOutlined, NotificationOutlined, NumberOutlined, PartitionOutlined,
  PayCircleOutlined, PhoneOutlined, PieChartOutlined, ProfileOutlined, ReadOutlined,
  ReconciliationOutlined, RiseOutlined, SafetyCertificateOutlined, SafetyOutlined,
  ScheduleOutlined, SearchOutlined, SettingOutlined, SolutionOutlined, HighlightOutlined,
  SwapOutlined, SyncOutlined, TagsOutlined, TeamOutlined, ThunderboltOutlined,
  TrophyOutlined, UploadOutlined, UserOutlined, UserSwitchOutlined, VideoCameraOutlined,
  ShopOutlined, WalletOutlined,
  CloseOutlined, CloseCircleOutlined, DownOutlined, PlusOutlined, UpOutlined, RightOutlined, WarningOutlined,
}
</script>

<template>
  <component :is="map[props.name] || AppstoreOutlined" :style="{ fontSize: `${props.size}px` }" />
</template>
