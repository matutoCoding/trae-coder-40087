import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ChargingTask, Booking, QueueItem } from '@/types'
import { getTasks, saveTasks, getPiles, savePiles, getBookings, saveBookings, getQueueItems, saveQueueItems, generateId } from '@/utils/storage'
import { useQueueStore } from './queue'

export const useTaskStore = defineStore('task', () => {
  const tasks = ref<ChargingTask[]>([])

  function loadTasks() {
    tasks.value = getTasks()
  }

  function createTaskFromBooking(booking: Booking): ChargingTask | null {
    loadTasks()
    if (tasks.value.find(t => t.bookingId === booking.id && t.status !== 'cancelled')) {
      return null
    }
    const task: ChargingTask = {
      id: generateId(),
      bookingId: booking.id,
      pileId: booking.pileId,
      pileCode: booking.pileCode,
      userId: booking.userId,
      userName: booking.userName,
      roomNumber: booking.roomNumber,
      scheduledStartTime: booking.startTime,
      scheduledEndTime: booking.endTime,
      status: 'waiting',
      source: 'booking',
      isEmergency: booking.isEmergency,
      createdAt: new Date().toISOString()
    }
    tasks.value.push(task)
    saveTasks(tasks.value)
    return task
  }

  function createTaskFromQueue(queueItem: QueueItem, booking: Booking): ChargingTask | null {
    loadTasks()
    const now = new Date()
    const endTime = new Date(now.getTime() + queueItem.expectedDuration * 60 * 1000)
    const task: ChargingTask = {
      id: generateId(),
      bookingId: booking.id,
      queueItemId: queueItem.id,
      pileId: booking.pileId,
      pileCode: booking.pileCode,
      userId: booking.userId,
      userName: booking.userName,
      roomNumber: booking.roomNumber,
      scheduledStartTime: now.toISOString(),
      scheduledEndTime: endTime.toISOString(),
      status: 'waiting',
      source: 'queue',
      isEmergency: queueItem.isEmergency,
      createdAt: new Date().toISOString(),
      calledAt: new Date().toISOString()
    }
    tasks.value.push(task)
    saveTasks(tasks.value)
    return task
  }

  function startCharging(taskId: string): ChargingTask | null {
    loadTasks()
    const taskIndex = tasks.value.findIndex(t => t.id === taskId)
    if (taskIndex === -1) return null
    const task = tasks.value[taskIndex]
    if (task.status !== 'waiting') return null

    const now = new Date()
    tasks.value[taskIndex] = {
      ...task,
      status: 'charging',
      actualStartTime: now.toISOString(),
      startedAt: now.toISOString()
    }
    saveTasks(tasks.value)

    const allPiles = getPiles()
    const pileIndex = allPiles.findIndex(p => p.id === task.pileId)
    if (pileIndex !== -1 && allPiles[pileIndex].status === 'available') {
      allPiles[pileIndex] = { ...allPiles[pileIndex], status: 'occupied' as const }
      savePiles(allPiles)
    }

    const allBookings = getBookings()
    const bookingIndex = allBookings.findIndex(b => b.id === task.bookingId)
    if (bookingIndex !== -1 && allBookings[bookingIndex].status === 'confirmed') {
      allBookings[bookingIndex] = { ...allBookings[bookingIndex], status: 'charging' as const }
      saveBookings(allBookings)
    }

    return tasks.value[taskIndex]
  }

  function finishCharging(taskId: string): ChargingTask | null {
    loadTasks()
    const taskIndex = tasks.value.findIndex(t => t.id === taskId)
    if (taskIndex === -1) return null
    const task = tasks.value[taskIndex]
    if (task.status !== 'charging') return null

    const now = new Date()
    const start = task.actualStartTime ? new Date(task.actualStartTime) : now
    const minutes = Math.max(1, Math.round((now.getTime() - start.getTime()) / 60000))
    const power = parseFloat(((minutes / 60) * 7).toFixed(2))

    tasks.value[taskIndex] = {
      ...task,
      status: 'completed',
      actualEndTime: now.toISOString(),
      finishedAt: now.toISOString(),
      powerConsumed: power
    }
    saveTasks(tasks.value)

    const allPiles = getPiles()
    const pileIndex = allPiles.findIndex(p => p.id === task.pileId)
    if (pileIndex !== -1 && allPiles[pileIndex].status === 'occupied') {
      allPiles[pileIndex] = { ...allPiles[pileIndex], status: 'available' as const }
      savePiles(allPiles)
    }

    const allBookings = getBookings()
    const bookingIndex = allBookings.findIndex(b => b.id === task.bookingId)
    if (bookingIndex !== -1 && (allBookings[bookingIndex].status === 'confirmed' || allBookings[bookingIndex].status === 'charging')) {
      allBookings[bookingIndex] = { ...allBookings[bookingIndex], status: 'completed' as const }
      saveBookings(allBookings)
    }

    if (task.queueItemId) {
      const allQueue = getQueueItems()
      const qIndex = allQueue.findIndex(q => q.id === task.queueItemId)
      if (qIndex !== -1) {
        allQueue[qIndex] = { ...allQueue[qIndex], status: 'completed' as const, completedAt: now.toISOString() }
        saveQueueItems(allQueue)
      }
    }

    const pile = getPiles().find(p => p.id === task.pileId)
    if (pile) {
      try {
        const queueStore = useQueueStore()
        queueStore.loadQueue()
        queueStore.callNextForPile(pile)
      } catch (e) {
        console.error('充电完成后自动叫号失败:', e)
      }
    }

    return tasks.value[taskIndex]
  }

  function cancelTask(taskId: string): boolean {
    loadTasks()
    const taskIndex = tasks.value.findIndex(t => t.id === taskId)
    if (taskIndex === -1) return false
    const task = tasks.value[taskIndex]
    if (task.status === 'completed') return false

    tasks.value[taskIndex] = { ...task, status: 'cancelled' }
    saveTasks(tasks.value)

    if (task.status === 'charging') {
      const allPiles = getPiles()
      const pileIndex = allPiles.findIndex(p => p.id === task.pileId)
      if (pileIndex !== -1 && allPiles[pileIndex].status === 'occupied') {
        allPiles[pileIndex] = { ...allPiles[pileIndex], status: 'available' as const }
        savePiles(allPiles)
      }
    }

    return true
  }

  function getTaskByBooking(bookingId: string): ChargingTask | undefined {
    loadTasks()
    return tasks.value.find(t => t.bookingId === bookingId && t.status !== 'cancelled')
  }

  function getTasksForPile(pileId: string, date?: string): ChargingTask[] {
    loadTasks()
    let result = tasks.value.filter(t => t.pileId === pileId)
    if (date) {
      result = result.filter(t => {
        const d = new Date(t.scheduledStartTime)
        return d.toDateString() === new Date(date).toDateString()
      })
    }
    return result
  }

  const activeTasks = computed(() =>
    tasks.value.filter(t => t.status === 'waiting' || t.status === 'charging')
  )

  const todayTasks = computed(() => {
    const today = new Date().toDateString()
    return tasks.value.filter(t => new Date(t.createdAt).toDateString() === today)
  })

  return {
    tasks,
    loadTasks,
    createTaskFromBooking,
    createTaskFromQueue,
    startCharging,
    finishCharging,
    cancelTask,
    getTaskByBooking,
    getTasksForPile,
    activeTasks,
    todayTasks
  }
})
