import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { QueueItem, ChargingPile } from '@/types'
import { getQueueItems, saveQueueItems, generateId, getUsers, getPiles } from '@/utils/storage'

const PRIORITY_LEVELS = {
  EMERGENCY: 100,
  VIP: 50,
  NORMAL: 10
}

export const useQueueStore = defineStore('queue', () => {
  const queueItems = ref<QueueItem[]>([])
  const currentCalledItem = ref<QueueItem | null>(null)
  const isLoading = ref(false)

  const loadQueue = () => {
    queueItems.value = getQueueItems()
    sortQueue()
  }

  const calculatePriority = (isEmergency: boolean, isVip: boolean): number => {
    if (isEmergency) return PRIORITY_LEVELS.EMERGENCY
    if (isVip) return PRIORITY_LEVELS.VIP
    return PRIORITY_LEVELS.NORMAL
  }

  const sortQueue = () => {
    queueItems.value.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
  }

  const waitingQueue = computed(() => {
    return queueItems.value.filter(item => item.status === 'waiting')
  })

  const getQueuePosition = (userId: string): number => {
    const index = waitingQueue.value.findIndex(item => item.userId === userId && item.status === 'waiting')
    return index === -1 ? -1 : index + 1
  }

  const getUserQueueItem = (userId: string): QueueItem | undefined => {
    return queueItems.value.find(item => item.userId === userId && item.status === 'waiting')
  }

  const joinQueue = (
    userId: string,
    pileId: string,
    pileCode: string,
    isEmergency: boolean = false,
    expectedDuration: number = 60
  ): QueueItem | null => {
    const users = getUsers()
    const user = users.find(u => u.id === userId)

    if (!user) {
      console.error('User not found')
      return null
    }

    if (!isPileAvailable(pileId)) {
      console.error('Pile not available for queue')
      return null
    }

    const existingItem = queueItems.value.find(
      item => item.userId === userId && item.status === 'waiting'
    )
    if (existingItem) {
      console.warn('User already in queue')
      return existingItem
    }

    const priority = calculatePriority(isEmergency, user.isVip)

    const newItem: QueueItem = {
      id: generateId(),
      userId: user.id,
      userName: user.name,
      roomNumber: user.roomNumber,
      pileId,
      pileCode,
      priority,
      isEmergency,
      isVip: user.isVip,
      expectedDuration,
      createdAt: new Date().toISOString(),
      status: 'waiting'
    }

    queueItems.value.push(newItem)
    sortQueue()
    saveQueueItems(queueItems.value)

    return newItem
  }

  const cancelQueue = (queueId: string): boolean => {
    const index = queueItems.value.findIndex(item => item.id === queueId)
    if (index === -1) return false

    queueItems.value[index].status = 'cancelled'
    saveQueueItems(queueItems.value)
    return true
  }

  const isPileAvailable = (pileId: string): boolean => {
    const allPiles = getPiles()
    const pile = allPiles.find(p => p.id === pileId)
    if (!pile) return false
    return pile.status === 'available' && pile.isOpenToPublic
  }

  const callNext = (availablePile?: ChargingPile): QueueItem | null => {
    const waitingItems = waitingQueue.value
    if (waitingItems.length === 0) {
      currentCalledItem.value = null
      return null
    }

    let nextItem: QueueItem | undefined

    if (availablePile) {
      const matchingItem = waitingItems.find(item => item.pileId === availablePile.id)
      if (matchingItem && isPileAvailable(availablePile.id)) {
        nextItem = matchingItem
      }
    }

    if (!nextItem) {
      for (const item of waitingItems) {
        if (isPileAvailable(item.pileId)) {
          nextItem = item
          break
        }
      }
    }

    if (!nextItem) {
      currentCalledItem.value = null
      return null
    }

    nextItem.status = 'called'
    currentCalledItem.value = nextItem
    saveQueueItems(queueItems.value)
    sortQueue()

    return nextItem
  }

  const callNextForPile = (pile: ChargingPile): QueueItem | null => {
    if (!pile || !isPileAvailable(pile.id)) {
      return null
    }
    return callNext(pile)
  }

  const completeQueue = (queueId: string): boolean => {
    const index = queueItems.value.findIndex(item => item.id === queueId)
    if (index === -1) return false

    queueItems.value[index].status = 'completed'
    saveQueueItems(queueItems.value)

    if (currentCalledItem.value?.id === queueId) {
      currentCalledItem.value = null
    }

    return true
  }

  const updateItemPriority = (queueId: string, priority: number): boolean => {
    const index = queueItems.value.findIndex(item => item.id === queueId)
    if (index === -1) return false

    queueItems.value[index].priority = priority
    sortQueue()
    saveQueueItems(queueItems.value)
    return true
  }

  const clearQueue = () => {
    queueItems.value = []
    currentCalledItem.value = null
    saveQueueItems([])
  }

  const getQueueStats = () => {
    const waiting = waitingQueue.value.length
    const emergencyCount = queueItems.value.filter(
      item => item.status === 'waiting' && item.isEmergency
    ).length
    const vipCount = queueItems.value.filter(
      item => item.status === 'waiting' && item.isVip && !item.isEmergency
    ).length
    const normalCount = queueItems.value.filter(
      item => item.status === 'waiting' && !item.isVip && !item.isEmergency
    ).length

    return {
      totalWaiting: waiting,
      emergencyCount,
      vipCount,
      normalCount
    }
  }

  return {
    queueItems,
    currentCalledItem,
    isLoading,
    waitingQueue,
    loadQueue,
    calculatePriority,
    sortQueue,
    getQueuePosition,
    getUserQueueItem,
    isPileAvailable,
    joinQueue,
    cancelQueue,
    callNext,
    callNextForPile,
    completeQueue,
    updateItemPriority,
    clearQueue,
    getQueueStats
  }
})
