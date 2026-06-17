<template>
  <div class="layout-container">
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-title">
          <el-icon :size="24" color="#3498db">
            <Charger />
          </el-icon>
          <span>充电桩共享系统</span>
        </div>
      </div>
      <nav class="sidebar-menu">
        <div
          v-for="item in menuItems"
          :key="item.path"
          class="menu-item"
          :class="{ active: $route.path === item.path }"
          @click="navigateTo(item.path)"
        >
          <el-icon class="menu-icon">
            <component :is="item.icon" />
          </el-icon>
          <span class="menu-text">{{ item.name }}</span>
        </div>
      </nav>
    </aside>
    <main class="main-content">
      <header class="content-header">
        <div class="page-title">{{ currentPageTitle }}</div>
        <div class="header-right">
          <el-tag type="success">系统运行中</el-tag>
        </div>
      </header>
      <section class="content-body">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  DataAnalysis,
  Calendar,
  Warning,
  Tickets,
  Medal
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()

const menuItems = [
  { path: '/dashboard', name: '总览面板', icon: 'DataAnalysis' },
  { path: '/schedule', name: '私桩排期', icon: 'Calendar' },
  { path: '/conflict', name: '冲突校验', icon: 'Warning' },
  { path: '/queue', name: '排队叫号', icon: 'Tickets' },
  { path: '/priority', name: '优先插队', icon: 'Medal' }
]

const currentPageTitle = computed(() => {
  const current = menuItems.find(item => item.path === route.path)
  return current ? current.name : '充电桩共享系统'
})

function navigateTo(path: string) {
  router.push(path)
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}
</style>
