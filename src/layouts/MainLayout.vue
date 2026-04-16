<template>
  <el-container class="nf-layout">
    <el-aside width="240px" class="nf-aside">
      <div class="nf-brand">
        <div class="nf-brand__logo">NF</div>
        <div class="nf-brand__text">
          <div class="nf-brand__title">ERP</div>
          <div class="nf-brand__sub">设备制造</div>
        </div>
      </div>
      <el-scrollbar class="nf-menu-scroll">
        <el-menu
          :default-active="activeMenu"
          router
          class="nf-menu"
          background-color="transparent"
          text-color="#374151"
          active-text-color="#1e40af"
        >
          <template v-for="item in visibleMenus" :key="item.path">
            <el-menu-item :index="item.path" :class="{ 'is-placeholder': item.placeholder }">
              <el-icon><component :is="item.icon" /></el-icon>
              <span>{{ item.title }}</span>
              <el-tag v-if="item.placeholder" size="small" type="info" class="nf-menu-tag">规划中</el-tag>
            </el-menu-item>
          </template>
        </el-menu>
      </el-scrollbar>
      <div class="nf-aside-foot">
        <span class="nf-aside-foot__t">数据保存在本机浏览器</span>
      </div>
    </el-aside>

    <el-container direction="vertical" class="nf-main">
      <el-header class="nf-header" height="56px">
        <div class="nf-header__left">
          <span class="nf-crumb">{{ pageTitle }}</span>
        </div>
        <div class="nf-header__right">
          <el-tag type="primary" effect="plain" round>
            {{ rolesStore.currentRole?.name || '未登录' }}
          </el-tag>
          <el-dropdown trigger="click" @command="onCommand">
            <span class="nf-user">
              <el-avatar :size="32" class="nf-user__avatar">演</el-avatar>
              <span class="nf-user__name">{{ userStore.currentUser?.name || '访客' }}</span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      <el-main class="nf-body">
        <router-view v-slot="{ Component }">
          <transition name="nf-fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowDown } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import { MENU_DEFS } from '@/mock/data'
import { useRolesStore } from '@/stores/roles'
import { useUserStore } from '@/stores/users'

const route = useRoute()
const router = useRouter()
const rolesStore = useRolesStore()
const userStore = useUserStore()

async function onCommand(command) {
  if (command !== 'logout') return
  try {
    await ElMessageBox.confirm('确认退出当前登录账号？', '提示', { type: 'warning' })
    userStore.logout()
    router.replace('/login')
  } catch {
    /* cancelled */
  }
}

const activeMenu = computed(() => {
  const p = route.path
  if (p.startsWith('/production-orders')) return '/production-orders'
  if (p.startsWith('/customers')) return '/customers'
  if (p.startsWith('/purchase/orders')) return '/purchase/requests'
  if (p.startsWith('/purchase/requests')) return '/purchase/requests'
  if (p.startsWith('/approval')) return '/approval'
  return p
})

const pageTitle = computed(() => route.meta?.title || '工作台')

const visibleMenus = computed(() =>
  MENU_DEFS.filter((item) => {
    if (item.placeholder) return rolesStore.can('dashboard')
    return rolesStore.can(item.key)
  }).map((item) => ({
    ...item,
    path: item.path,
    icon: item.icon,
  })),
)
</script>

<style scoped>
.nf-layout {
  height: 100%;
  min-height: 100vh;
}

.nf-aside {
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  border-right: 1px solid #e8eaef;
  display: flex;
  flex-direction: column;
  box-shadow: 2px 0 12px rgba(15, 23, 42, 0.04);
}

.nf-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 20px 16px;
  border-bottom: 1px solid #eef0f4;
}

.nf-brand__logo {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, #1e40af, #3b5ccc);
  color: #fff;
  font-weight: 700;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nf-brand__title {
  font-weight: 600;
  font-size: 16px;
  color: #111827;
}

.nf-brand__sub {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 2px;
}

.nf-menu-scroll {
  flex: 1;
  padding: 8px 0;
}

.nf-menu {
  border-right: none;
  padding: 0 10px;
}

.nf-menu :deep(.el-menu-item) {
  border-radius: 8px;
  margin-bottom: 4px;
  height: 44px;
}

.nf-menu :deep(.el-menu-item.is-active) {
  background: rgba(30, 64, 175, 0.08) !important;
  font-weight: 600;
}

.nf-menu :deep(.el-menu-item.is-placeholder) {
  opacity: 0.55;
}

.nf-menu-tag {
  margin-left: auto;
}

.nf-aside-foot {
  padding: 12px 16px 16px;
  font-size: 11px;
  color: #9ca3af;
  line-height: 1.4;
}

.nf-main {
  background: var(--nf-bg);
}

.nf-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: #fff;
  border-bottom: 1px solid #e8eaef;
  box-shadow: var(--nf-shadow);
}

.nf-crumb {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.nf-header__right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nf-user {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: #374151;
}

.nf-user__avatar {
  background: #1e40af !important;
}

.nf-user__name {
  font-size: 14px;
}

.nf-body {
  padding: 20px 24px 32px;
  overflow: auto;
}

.nf-fade-enter-active,
.nf-fade-leave-active {
  transition: opacity 0.15s ease;
}
.nf-fade-enter-from,
.nf-fade-leave-to {
  opacity: 0;
}
</style>
