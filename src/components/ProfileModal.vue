<script setup lang="ts">
/**
 * 个人中心
 * ---------------------------------------------------------------------------
 * 展示当前登录人的身份与授权范围，并提供「修改密码」表单。
 * 密码规则在前端校验（演示环境不落库，仅给出反馈）。
 */
import { computed, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import AppIcon from '@/components/AppIcon.vue'
import { useUserStore } from '@/stores/user'
import { useChromeStore } from '@/stores/chrome'

const user = useUserStore()
const chrome = useChromeStore()

const pwdOpen = ref(false)
const pwd = reactive({ old: '', next: '', confirm: '' })
const errors = reactive<Record<string, string>>({})

const apps = computed(() => user.appMetas)

watch(
  () => chrome.profileOpen,
  (v) => {
    if (v) {
      pwdOpen.value = false
      pwd.old = pwd.next = pwd.confirm = ''
      errors.old = errors.next = errors.confirm = ''
    }
  },
)

function submitPwd() {
  errors.old = errors.next = errors.confirm = ''
  if (!pwd.old) errors.old = '请输入原密码'
  if (!pwd.next) errors.next = '请输入新密码'
  else if (pwd.next.length < 8) errors.next = '新密码至少 8 位'
  if (!pwd.confirm) errors.confirm = '请再次输入新密码'
  else if (pwd.next !== pwd.confirm) errors.confirm = '两次输入的密码不一致'
  if (errors.old || errors.next || errors.confirm) return
  message.success('密码修改成功（演示环境未真实落库）')
  pwdOpen.value = false
  pwd.old = pwd.next = pwd.confirm = ''
}
</script>

<template>
  <a-modal
    :open="chrome.profileOpen"
    title="个人中心"
    :width="560"
    :footer="null"
    @cancel="chrome.closeProfile()"
  >
    <!-- ---------- 身份 ---------- -->
    <div class="pf-top">
      <a-avatar :size="52" style="background: #165dff">{{ user.user.avatarText }}</a-avatar>
      <div class="pf-id">
        <div class="pf-name">
          {{ user.user.name }}
          <a-tag color="processing" :bordered="false">{{ user.user.role }}</a-tag>
        </div>
        <div class="pf-sub">{{ user.user.account }} · {{ user.user.dept }}</div>
        <div class="pf-sub">{{ user.user.tenant }} · {{ user.user.tenantPlan }}</div>
      </div>
    </div>

    <a-descriptions :column="2" size="small" bordered class="pf-desc">
      <a-descriptions-item label="登录账号">{{ user.user.account }}</a-descriptions-item>
      <a-descriptions-item label="所属部门">{{ user.user.dept }}</a-descriptions-item>
      <a-descriptions-item label="当前角色">{{ user.user.role }}</a-descriptions-item>
      <a-descriptions-item label="当前租户">{{ user.user.tenant }}</a-descriptions-item>
    </a-descriptions>

    <!-- ---------- 授权应用 ---------- -->
    <div class="pf-block">
      <div class="pf-block-title">
        已授权应用
        <span class="pf-block-sub">共 {{ apps.length }} 个</span>
      </div>
      <div class="pf-apps">
        <span
          v-for="a in apps"
          :key="a.code"
          class="pf-app"
          :style="{ color: a.color, background: a.color + '14', borderColor: a.color + '33' }"
        >
          <AppIcon :name="a.icon" :size="13" />
          {{ a.name }}
        </span>
      </div>
    </div>

    <!-- ---------- 修改密码 ---------- -->
    <div v-if="!pwdOpen" class="pf-actions">
      <a-button @click="chrome.closeProfile()">关闭</a-button>
      <a-button type="primary" @click="pwdOpen = true">修改密码</a-button>
    </div>

    <div v-else class="pf-pwd">
      <a-form layout="vertical">
        <a-form-item label="原密码" :validate-status="errors.old ? 'error' : ''" :help="errors.old">
          <a-input-password v-model:value="pwd.old" placeholder="请输入原密码" />
        </a-form-item>
        <a-form-item label="新密码" :validate-status="errors.next ? 'error' : ''" :help="errors.next">
          <a-input-password v-model:value="pwd.next" placeholder="至少 8 位" />
        </a-form-item>
        <a-form-item label="确认新密码" :validate-status="errors.confirm ? 'error' : ''" :help="errors.confirm">
          <a-input-password v-model:value="pwd.confirm" placeholder="再次输入新密码" />
        </a-form-item>
      </a-form>
      <div class="pf-actions">
        <a-button @click="pwdOpen = false">取消</a-button>
        <a-button type="primary" @click="submitPwd">保存</a-button>
      </div>
    </div>
  </a-modal>
</template>

<style scoped>
.pf-top {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}
.pf-id {
  min-width: 0;
}
.pf-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-1);
}
.pf-sub {
  font-size: 12.5px;
  color: var(--text-3);
  margin-top: 3px;
}
.pf-desc {
  margin-bottom: 16px;
}
.pf-block {
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: 12px 14px;
}
.pf-block-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-1);
  margin-bottom: 10px;
}
.pf-block-sub {
  font-size: 11.5px;
  color: var(--text-3);
  font-weight: 400;
}
.pf-apps {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.pf-app {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  padding: 4px 9px;
  border-radius: var(--r-sm);
  border: 1px solid transparent;
}
.pf-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 18px;
}
.pf-pwd {
  border-top: 1px solid var(--border-subtle);
  margin-top: 16px;
  padding-top: 4px;
}
</style>
