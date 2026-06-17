import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { QueueItem } from '@/types'
import { getQueueItems, saveQueueItems, generateId, getUsers } from '@/utils/storage'
import { useQueueStore } from './queue'

const PRIORITY_LEVELS = {
  EMERGENCY: 100,
  VIP: 50,
  NORMAL: 10
}

export const usePriorityStore = defineStore('priority', () => {
  const priorityHistory = ref<Array<{
    id: string
    queueItemId: string
    oldPriority: number
    newPriority: number
    reason: string
    createdAt: string
  }>>([])

  const priorityLevels = ref(PRIORITY_LEVELS)

  const calculatePriority = (isEmergency: boolean, isVip: boolean): number => {
    if (isEmergency) return priorityLevels.value.EMERGENCY
    if (isVip) return priorityLevels.value.VIP
    return priorityLevels.value.NORMAL
  }

  const sortQueueByPriority = (items: QueueItem[]): QueueItem[] => {
    return [...items].sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
  }

  const getEmergencyCount = computed(() => {
    const items = getQueueItems()
    return items.filter(item => item.status === 'waiting' && item.isEmergency).length
  })

  const getVipCount = computed(() => {
    const items = getQueueItems()
    return items.filter(item => item.status === 'waiting' && item.isVip && !item.isEmergency).length
  })

  const vipInsertQueue = (
    userId: string,
    pileId: string,
    pileCode: string,
    expectedDuration: number = 60
  ): QueueItem | null => {
    const users = getUsers()
    const user = users.find(u => u.id === userId)

    if (!user) {
      console.error('User not found')
      return null
    }

    if (!user.isVip) {
      console.error('User is not a VIP')
      return null
    }

    const queueItems = getQueueItems()

    const existingItem = queueItems.find(
      item => item.userId === userId && item.status === 'waiting'
    )
    if (existingItem) {
      if (!existingItem.isVip || existingItem.priority < priorityLevels.value.VIP) {
        existingItem.isVip = true
        existingItem.priority = priorityLevels.value.VIP
        const sortedItems = sortQueueByPriority(queueItems)
        saveQueueItems(sortedItems)
        recordPriorityChange(
          existingItem.id,
          existingItem.priority,
          priorityLevels.value.VIP,
          'VIP 用户身份确认，提升优先级'
        )
        return existingItem
      }
      return existingItem
    }

    const newItem: QueueItem = {
      id: generateId(),
      userId: user.id,
      userName: user.name,
      roomNumber: user.roomNumber,
      pileId,
      pileCode,
      priority: priorityLevels.value.VIP,
      isEmergency: false,
      isVip: true,
      expectedDuration,
      createdAt: new Date().toISOString(),
      status: 'waiting'
    }

    queueItems.push(newItem)
    const sortedItems = sortQueueByPriority(queueItems)
    saveQueueItems(sortedItems)

    const queueStore = useQueueStore()
    queueStore.loadQueue()

    recordPriorityChange(
      newItem.id,
      priorityLevels.value.NORMAL,
      priorityLevels.value.VIP,
      'VIP 用户插队加入队列'
    )

    return newItem
  }

  const emergencyInsertQueue = (
    userId: string,
    pileId: string,
    pileCode: string,
    expectedDuration: number = 60
  ): QueueItem | null => {
    const users = getUsers()
    const user = users.find(u => u.id === userId)

    if (!user) {
      console.error('User not found')
      return null
    }

    const queueItems = getQueueItems()

    const existingItem = queueItems.find(
      item => item.userId === userId && item.status === 'waiting'
    )
    if (existingItem) {
      const oldPriority = existingItem.priority
      existingItem.isEmergency = true
      existingItem.priority = priorityLevels.value.EMERGENCY
      const sortedItems = sortQueueByPriority(queueItems)
      saveQueueItems(sortedItems)
      recordPriorityChange(
        existingItem.id,
        oldPriority,
        priorityLevels.value.EMERGENCY,
        '应急充电，提升至最高优先级'
      )

      const queueStore = useQueueStore()
      queueStore.loadQueue()

      return existingItem
    }

    const newItem: QueueItem = {
      id: generateId(),
      userId: user.id,
      userName: user.name,
      roomNumber: user.roomNumber,
      pileId,
      pileCode,
      priority: priorityLevels.value.EMERGENCY,
      isEmergency: true,
      isVip: user.isVip,
      expectedDuration,
      createdAt: new Date().toISOString(),
      status: 'waiting'
    }

    queueItems.push(newItem)
    const sortedItems = sortQueueByPriority(queueItems)
    saveQueueItems(sortedItems)

    const queueStore = useQueueStore()
    queueStore.loadQueue()

    recordPriorityChange(
      newItem.id,
      priorityLevels.value.NORMAL,
      priorityLevels.value.EMERGENCY,
      '应急充电插队加入队列'
    )

    return newItem
  }

  const recalculateAllPriorities = (): void => {
    const queueItems = getQueueItems()
    const waitingItems = queueItems.filter(item => item.status === 'waiting')
    const users = getUsers()

    waitingItems.forEach(item => {
      const user = users.find(u => u.id === item.userId)
      if (user) {
        const oldPriority = item.priority
        const newPriority = calculatePriority(item.isEmergency, user.isVip)

        if (oldPriority !== newPriority) {
          item.priority = newPriority
          item.isVip = user.isVip
          recordPriorityChange(
            item.id,
            oldPriority,
            newPriority,
            '重新计算优先级'
          )
        }
      }
    })

    const sortedItems = sortQueueByPriority(queueItems)
    saveQueueItems(sortedItems)

    const queueStore = useQueueStore()
    queueStore.loadQueue()
  }

  const reorderQueue = (): QueueItem[] => {
    const queueItems = getQueueItems()
    const sortedItems = sortQueueByPriority(queueItems)
    saveQueueItems(sortedItems)

    const queueStore = useQueueStore()
    queueStore.loadQueue()

    return sortedItems
  }

  const updateItemToEmergency = (queueId: string): boolean => {
    const queueItems = getQueueItems()
    const index = queueItems.findIndex(item => item.id === queueId)

    if (index === -1 || queueItems[index].status !== 'waiting') {
      return false
    }

    const oldPriority = queueItems[index].priority
    queueItems[index].isEmergency = true
    queueItems[index].priority = priorityLevels.value.EMERGENCY

    const sortedItems = sortQueueByPriority(queueItems)
    saveQueueItems(sortedItems)

    recordPriorityChange(
      queueId,
      oldPriority,
      priorityLevels.value.EMERGENCY,
      '标记为应急充电，提升优先级'
    )

    const queueStore = useQueueStore()
    queueStore.loadQueue()

    return true
  }

  const updateItemToVip = (queueId: string): boolean => {
    const queueItems = getQueueItems()
    const index = queueItems.findIndex(item => item.id === queueId)

    if (index === -1 || queueItems[index].status !== 'waiting') {
      return false
    }

    if (queueItems[index].isEmergency) {
      console.warn('Emergency items keep highest priority')
      return true
    }

    const oldPriority = queueItems[index].priority
    queueItems[index].isVip = true
    queueItems[index].priority = priorityLevels.value.VIP

    const sortedItems = sortQueueByPriority(queueItems)
    saveQueueItems(sortedItems)

    recordPriorityChange(
      queueId,
      oldPriority,
      priorityLevels.value.VIP,
      '标记为VIP用户，提升优先级'
    )

    const queueStore = useQueueStore()
    queueStore.loadQueue()

    return true
  }

  const recordPriorityChange = (
    queueItemId: string,
    oldPriority: number,
    newPriority: number,
    reason: string
  ): void => {
    priorityHistory.value.push({
      id: generateId(),
      queueItemId,
      oldPriority,
      newPriority,
      reason,
      createdAt: new Date().toISOString()
    })
  }

  const getPriorityLabel = (priority: number): string => {
    if (priority >= priorityLevels.value.EMERGENCY) return '应急充电'
    if (priority >= priorityLevels.value.VIP) return 'VIP'
    return '普通'
  }

  const getPriorityColor = (priority: number): string => {
    if (priority >= priorityLevels.value.EMERGENCY) return '#f56c6c'
    if (priority >= priorityLevels.value.VIP) return '#e6a23c'
    return '#909399'
  }

  const clearPriorityHistory = (): void => {
    priorityHistory.value = []
  }

  return {
    priorityHistory,
    priorityLevels,
    getEmergencyCount,
    getVipCount,
    calculatePriority,
    sortQueueByPriority,
    vipInsertQueue,
    emergencyInsertQueue,
    recalculateAllPriorities,
    reorderQueue,
    updateItemToEmergency,
    updateItemToVip,
    recordPriorityChange,
    getPriorityLabel,
    getPriorityColor,
    clearPriorityHistory
  }
})
