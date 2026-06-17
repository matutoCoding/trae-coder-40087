import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue')
  },
  {
    path: '/schedule',
    name: 'Schedule',
    component: () => import('@/views/Schedule.vue')
  },
  {
    path: '/conflict',
    name: 'Conflict',
    component: () => import('@/views/Conflict.vue')
  },
  {
    path: '/queue',
    name: 'Queue',
    component: () => import('@/views/Queue.vue')
  },
  {
    path: '/priority',
    name: 'Priority',
    component: () => import('@/views/Priority.vue')
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
