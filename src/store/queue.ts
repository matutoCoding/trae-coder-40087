import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { QueueItem, ChargingPile, Booking } from '@/types'
import {
  getQueueItems,
  saveQueueItems,
  generateId,
  getUsers,
  getPiles,
  getBookings,
  saveBookings
} from '@/utils/storage'
import { useTaskStore } from './task'

const CURRENT_CALLED_KEY = 'queue_current_called'

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
    try {
      const raw = localStorage.getItem(CURRENT_CALLED_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as QueueItem
        const fresh = queueItems.value.find(q => q.id === saved.id)
        currentCalledItem.value = (fresh && fresh.status === 'called') ? fresh : null
      }
    } catch {
      currentCalledItem.value = null
    }
    sortQueue()
  }

  const _saveCurrentCalled = () => {
    if (currentCalledItem.value) {
      localStorage.setItem(CURRENT_CALLED_KEY, JSON.stringify(currentCalledItem.value))
    } else {
      localStorage.removeItem(CURRENT_CALLED_KEY)
    }
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

  const completedQueue = computed(() =>
    queueItems.value.filter(i => i.status === 'completed' || i.status === 'cancelled')
  )

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

    queueItems.value[index] = {
      ...queueItems.value[index],
      status: 'cancelled',
      cancelledAt: new Date().toISOString()
    }
    saveQueueItems(queueItems.value)

    if (currentCalledItem.value?.id === queueId) {
      currentCalledItem.value = null
      _saveCurrentCalled()
    }

    return true
  }

  const isPileAvailable = (pileId: string): boolean => {
    const allPiles = getPiles()
    const pile = allPiles.find(p => p.id === pileId)
    if (!pile) return false
    return pile.status === 'available' && pile.isOpenToPublic
  }

  const _createBookingForCalled = (queueItem: QueueItem): Booking | null => {
    try {
      const now = new Date()
      const endTime = new Date(now.getTime() + queueItem.expectedDuration * 60 * 1000)

      const booking: Booking = {
        id: generateId(),
        pileId: queueItem.pileId,
        pileCode: queueItem.pileCode,
        userId: queueItem.userId,
        userName: queueItem.userName,
        roomNumber: queueItem.roomNumber,
        startTime: now.toISOString(),
        endTime: endTime.toISOString(),
        status: 'confirmed',
        createdAt: new Date().toISOString(),
        isEmergency: queueItem.isEmergency
      }

      const allBookings = getBookings()
      allBookings.push(booking)
      saveBookings(allBookings)

      try {
        const taskStore = useTaskStore()
        taskStore.loadTasks()
        const task = taskStore.createTaskFromQueue(queueItem, booking)
        if (task) {
          const idx = allBookings.findIndex(b => b.id === booking.id)
          if (idx !== -1) {
            allBookings[idx] = { ...booking, taskId: task.id }
            saveBookings(allBookings)
          }
          queueItem.taskId = task.id
          queueItem.bookingId = booking.id
        }
      } catch (e) {
        console.error('创建排队充电任务失败:', e)
      }

      return booking
    } catch (e) {
      console.error('叫号生成预约失败:', e)
      return null
    }
  }

  const callNext = (availablePile?: ChargingPile): QueueItem | null => {
    loadQueue()
    const waitingItems = waitingQueue.value
    if (waitingItems.length === 0) {
      currentCalledItem.value = null
      _saveCurrentCalled()
      return null
    }

    let nextItem: QueueItem | undefined

    if (availablePile) {
      const matchingItems = waitingItems.filter(item => item.pileId === availablePile.id)
      for (const item of matchingItems) {
        if (isPileAvailable(availablePile.id)) {
          nextItem = item
          break
        }
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
      _saveCurrentCalled()
      return null
    }

    const now = new Date()
    const createdAt = new Date(nextItem.createdAt)
    const waitingMinutes = Math.max(0, Math.round((now.getTime() - createdAt.getTime()) / 60000))

    nextItem.status = 'called'
    nextItem.calledAt = now.toISOString()
    nextItem.waitingMinutes = waitingMinutes
    currentCalledItem.value = nextItem
    _saveCurrentCalled()

    _createBookingForCalled(nextItem)

    const idx = queueItems.value.findIndex(q => q.id === nextItem!.id)
    if (idx !== -1) {
      queueItems.value[idx] = { ...nextItem }
    }
    saveQueueItems(queueItems.value)
    sortQueue()

    return nextItem
  }

  const callNextForPile = (pile: ChargingPile): QueueItem | null => {
    if (!pile) return null
    if (!isPileAvailable(pile.id)) {
      return null
    }
    return callNext(pile)
  }

  const completeQueue = (queueId: string): boolean => {
    const index = queueItems.value.findIndex(item => item.id === queueId)
    if (index === -1) return false

    queueItems.value[index] = {
      ...queueItems.value[index],
      status: 'completed',
      completedAt: new Date().toISOString()
    }
    saveQueueItems(queueItems.value)

    if (currentCalledItem.value?.id === queueId) {
      currentCalledItem.value = null
      _saveCurrentCalled()
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
    _saveCurrentCalled()
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

  const getAverageWaitingMinutes = (): number => {
    loadQueue()
    const finished = queueItems.value.filter(
      item => (item.status === 'called' || item.status === 'completed') && item.waitingMinutes != null
    )
    if (finished.length === 0) return 0
    const total = finished.reduce((sum, item) => sum + (item.waitingMinutes || 0), 0)
    return Math.round(total / finished.length)
  }

  const getWaitingCountForPile = (pileId: string): number => {
    return waitingQueue.value.filter(i => i.pileId === pileId).length
  }

  return {
    queueItems,
    currentCalledItem,
    isLoading,
    waitingQueue,
    completedQueue,
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
    getQueueStats,
    getAverageWaitingMinutes,
    getWaitingCountForPile
  }
})
