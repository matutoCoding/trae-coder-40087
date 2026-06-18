import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ChargingPile, TimeSlot, Booking, PileDaySchedule, OperationalStats } from '@/types'
import {
  getPiles,
  savePiles,
  getBookings,
  saveBookings,
  generateId
} from '@/utils/storage'
import { useQueueStore } from './queue'
import { useTaskStore } from './task'

export const useScheduleStore = defineStore('schedule', () => {
  const piles = ref<ChargingPile[]>([])
  const bookings = ref<Booking[]>([])
  const loading = ref(false)

  const availablePiles = computed(() =>
    piles.value.filter(pile => pile.status === 'available' && pile.type === 'private')
  )

  const openPiles = computed(() =>
    piles.value.filter(pile => pile.isOpenToPublic && pile.status === 'available')
  )

  const pendingBookings = computed(() =>
    bookings.value.filter(booking => booking.status === 'pending')
  )

  const confirmedBookings = computed(() =>
    bookings.value.filter(booking => booking.status === 'confirmed' || booking.status === 'charging')
  )

  function loadData() {
    loading.value = true
    try {
      piles.value = getPiles()
      bookings.value = getBookings()
    } finally {
      loading.value = false
    }
  }

  function addPile(pileData: Omit<ChargingPile, 'id' | 'createdAt' | 'type' | 'status'>) {
    const newPile: ChargingPile = {
      ...pileData,
      id: generateId(),
      type: 'private',
      status: 'available',
      createdAt: new Date().toISOString()
    }
    piles.value.push(newPile)
    savePiles(piles.value)
    return newPile
  }

  function updatePile(id: string, updates: Partial<Omit<ChargingPile, 'id' | 'type' | 'createdAt'>>) {
    const index = piles.value.findIndex(pile => pile.id === id)
    if (index !== -1) {
      piles.value[index] = { ...piles.value[index], ...updates }
      savePiles(piles.value)
      return piles.value[index]
    }
    return null
  }

  function deletePile(id: string) {
    const index = piles.value.findIndex(pile => pile.id === id)
    if (index !== -1) {
      piles.value.splice(index, 1)
      savePiles(piles.value)
      return true
    }
    return false
  }

  function updatePileStatus(id: string, status: ChargingPile['status']) {
    return updatePile(id, { status })
  }

  function addOpenTimeSlot(pileId: string, slot: Omit<TimeSlot, 'id'>) {
    const pile = piles.value.find(p => p.id === pileId)
    if (!pile) return null

    const newSlot: TimeSlot = {
      ...slot,
      id: generateId()
    }
    pile.openTimeSlots.push(newSlot)
    savePiles(piles.value)
    return newSlot
  }

  function updateOpenTimeSlot(pileId: string, slotId: string, updates: Partial<Omit<TimeSlot, 'id'>>) {
    const pile = piles.value.find(p => p.id === pileId)
    if (!pile) return null

    const slotIndex = pile.openTimeSlots.findIndex(s => s.id === slotId)
    if (slotIndex === -1) return null

    pile.openTimeSlots[slotIndex] = { ...pile.openTimeSlots[slotIndex], ...updates }
    savePiles(piles.value)
    return pile.openTimeSlots[slotIndex]
  }

  function deleteOpenTimeSlot(pileId: string, slotId: string) {
    const pile = piles.value.find(p => p.id === pileId)
    if (!pile) return false

    const slotIndex = pile.openTimeSlots.findIndex(s => s.id === slotId)
    if (slotIndex === -1) return false

    pile.openTimeSlots.splice(slotIndex, 1)
    savePiles(piles.value)
    return true
  }

  function setPilePublicStatus(pileId: string, isOpen: boolean) {
    return updatePile(pileId, { isOpenToPublic: isOpen })
  }

  function createBooking(bookingData: Omit<Booking, 'id' | 'status' | 'createdAt'>) {
    const newBooking: Booking = {
      ...bookingData,
      id: generateId(),
      status: 'confirmed',
      createdAt: new Date().toISOString()
    }
    bookings.value.push(newBooking)
    saveBookings(bookings.value)

    try {
      const taskStore = useTaskStore()
      taskStore.loadTasks()
      const task = taskStore.createTaskFromBooking(newBooking)
      if (task) {
        const idx = bookings.value.findIndex(b => b.id === newBooking.id)
        if (idx !== -1) {
          bookings.value[idx] = { ...bookings.value[idx], taskId: task.id }
          saveBookings(bookings.value)
        }
      }
    } catch (e) {
      console.error('创建充电任务失败:', e)
    }

    return newBooking
  }

  function updateBookingStatus(id: string, status: Booking['status']) {
    const index = bookings.value.findIndex(b => b.id === id)
    if (index !== -1) {
      const updates: Partial<Booking> = { status }
      if (status === 'cancelled') {
        updates.cancelledAt = new Date().toISOString()
      }
      bookings.value[index] = { ...bookings.value[index], ...updates }
      saveBookings(bookings.value)
      return bookings.value[index]
    }
    return null
  }

  function cancelBooking(id: string) {
    loadData()
    const booking = bookings.value.find(b => b.id === id)
    if (!booking) return null

    const result = updateBookingStatus(id, 'cancelled')

    if (booking.taskId) {
      try {
        const taskStore = useTaskStore()
        taskStore.loadTasks()
        taskStore.cancelTask(booking.taskId)
      } catch (e) {
        console.error('取消充电任务失败:', e)
      }
    }

    if (result && booking) {
      try {
        const queueStore = useQueueStore()
        queueStore.loadQueue()
        loadData()
        const pile = piles.value.find(p => p.id === booking.pileId)
        if (pile) {
          queueStore.callNextForPile(pile)
        }
      } catch (e) {
        console.error('自动叫号失败:', e)
      }
    }
    return result
  }

  function createEmergencyBooking(
    bookingData: Omit<Booking, 'id' | 'status' | 'createdAt' | 'isEmergency'>,
    conflictingIds: string[]
  ) {
    loadData()
    const now = new Date().toISOString()
    for (const conflictId of conflictingIds) {
      const index = bookings.value.findIndex(b => b.id === conflictId)
      if (index !== -1 && !bookings.value[index].isEmergency) {
        const oldBooking = bookings.value[index]
        bookings.value[index] = {
          ...oldBooking,
          status: 'cancelled',
          coveredByEmergency: true,
          cancelledAt: now
        }

        if (oldBooking.taskId) {
          try {
            const taskStore = useTaskStore()
            taskStore.loadTasks()
            taskStore.cancelTask(oldBooking.taskId)
          } catch (e) {
            console.error('取消被覆盖预约的任务失败:', e)
          }
        }
      }
    }

    const newBooking: Booking = {
      ...bookingData,
      id: generateId(),
      status: 'confirmed',
      isEmergency: true,
      createdAt: now
    }
    bookings.value.push(newBooking)

    for (const conflictId of conflictingIds) {
      const idx = bookings.value.findIndex(b => b.id === conflictId)
      if (idx !== -1 && bookings.value[idx].coveredByEmergency) {
        bookings.value[idx].coveredByBookingId = newBooking.id
      }
    }

    saveBookings(bookings.value)

    try {
      const taskStore = useTaskStore()
      taskStore.loadTasks()
      const task = taskStore.createTaskFromBooking(newBooking)
      if (task) {
        const idx = bookings.value.findIndex(b => b.id === newBooking.id)
        if (idx !== -1) {
          bookings.value[idx] = { ...bookings.value[idx], taskId: task.id }
          saveBookings(bookings.value)
        }
      }
    } catch (e) {
      console.error('创建应急充电任务失败:', e)
    }

    return newBooking
  }

  function getPileById(id: string) {
    return piles.value.find(pile => pile.id === id)
  }

  function getBookingsByPileId(pileId: string) {
    return bookings.value.filter(
      b => b.pileId === pileId && b.status !== 'cancelled'
    )
  }

  function getBookingsByUserId(userId: string) {
    return bookings.value.filter(b => b.userId === userId)
  }

  const _minutesBetween = (startISO: string, endISO: string): number => {
    return Math.max(0, Math.round((new Date(endISO).getTime() - new Date(startISO).getTime()) / 60000))
  }

  const _timeToMinutes = (hhmm: string): number => {
    const [h, m] = hhmm.split(':').map(Number)
    return h * 60 + m
  }

  function getPileDaySchedule(pileId: string, dateStr: string): PileDaySchedule {
    const pile = getPileById(pileId)
    const d = new Date(dateStr)
    const dateKey = d.toDateString()
    const dayOfWeek = d.getDay()

    const openSlots: Array<{ start: string; end: string }> = []
    let openMinutes = 0
    if (pile && pile.isOpenToPublic) {
      for (const slot of pile.openTimeSlots) {
        if (slot.dayOfWeek && !slot.dayOfWeek.includes(dayOfWeek)) continue
        openSlots.push({ start: slot.startTime, end: slot.endTime })
        openMinutes += _timeToMinutes(slot.endTime) - _timeToMinutes(slot.startTime)
      }
    }

    const dayBookings = bookings.value.filter(b => {
      if (b.pileId !== pileId) return false
      if (b.status === 'cancelled') return false
      return new Date(b.startTime).toDateString() === dateKey
    })

    const bookedSlots = dayBookings.map(b => ({
      id: b.id,
      start: new Date(b.startTime).toTimeString().slice(0, 5),
      end: new Date(b.endTime).toTimeString().slice(0, 5),
      userName: b.userName,
      status: b.status,
      isEmergency: b.isEmergency
    }))

    let bookedMinutes = 0
    for (const b of dayBookings) {
      bookedMinutes += _minutesBetween(b.startTime, b.endTime)
    }

    const freeSlots: Array<{ start: string; end: string }> = []
    for (const slot of openSlots) {
      const slotStartMin = _timeToMinutes(slot.start)
      const slotEndMin = _timeToMinutes(slot.end)
      const occupied = bookedSlots
        .map(bs => ({ s: _timeToMinutes(bs.start), e: _timeToMinutes(bs.end) }))
        .sort((a, b) => a.s - b.s)

      let cur = slotStartMin
      for (const occ of occupied) {
        if (occ.e <= cur || occ.s >= slotEndMin) continue
        if (occ.s > cur) {
          freeSlots.push({
            start: `${String(Math.floor(cur / 60)).padStart(2, '0')}:${String(cur % 60).padStart(2, '0')}`,
            end: `${String(Math.floor(occ.s / 60)).padStart(2, '0')}:${String(occ.s % 60).padStart(2, '0')}`
          })
        }
        cur = Math.max(cur, occ.e)
      }
      if (cur < slotEndMin) {
        freeSlots.push({
          start: `${String(Math.floor(cur / 60)).padStart(2, '0')}:${String(cur % 60).padStart(2, '0')}`,
          end: `${String(Math.floor(slotEndMin / 60)).padStart(2, '0')}:${String(slotEndMin % 60).padStart(2, '0')}`
        })
      }
    }

    let queueCount = 0
    try {
      const queueStore = useQueueStore()
      queueStore.loadQueue()
      queueCount = queueStore.getWaitingCountForPile(pileId)
    } catch {
      queueCount = 0
    }

    return {
      pileId,
      pileCode: pile?.code || '',
      location: pile?.location || '',
      date: dateStr,
      isOpenToPublic: pile?.isOpenToPublic || false,
      pileStatus: pile?.status || 'offline',
      openSlots,
      bookedSlots,
      freeSlots: freeSlots.filter(fs => _timeToMinutes(fs.end) - _timeToMinutes(fs.start) >= 15),
      queueCount,
      openMinutes,
      bookedMinutes
    }
  }

  function getOperationalStats(dateStr?: string): OperationalStats {
    loadData()
    const target = dateStr ? new Date(dateStr) : new Date()
    const todayKey = target.toDateString()

    const allPiles = getPiles()
    const totalOpenPiles = allPiles.filter(p => p.isOpenToPublic).length
    const availablePiles = allPiles.filter(p => p.isOpenToPublic && p.status === 'available').length
    const occupiedPiles = allPiles.filter(p => p.status === 'occupied').length
    const maintenancePiles = allPiles.filter(p => p.status === 'maintenance').length

    const todayBookings = bookings.value.filter(b => new Date(b.createdAt).toDateString() === todayKey)
    const todayCompleted = todayBookings.filter(b => b.status === 'completed').length
    const todayCancelled = todayBookings.filter(b => b.status === 'cancelled').length
    const coveredByEmergencyCount = bookings.value.filter(b => b.coveredByEmergency && new Date(b.cancelledAt || b.createdAt).toDateString() === todayKey).length

    const queueStore = useQueueStore()
    queueStore.loadQueue()
    const avgWaitingMinutes = queueStore.getAverageWaitingMinutes()
    const waitingQueueSize = queueStore.waitingQueue.length

    let totalOpenMin = 0
    let totalBookedMin = 0
    const dow = target.getDay()
    for (const pile of allPiles) {
      if (!pile.isOpenToPublic) continue
      for (const slot of pile.openTimeSlots) {
        if (slot.dayOfWeek && !slot.dayOfWeek.includes(dow)) continue
        totalOpenMin += _timeToMinutes(slot.endTime) - _timeToMinutes(slot.startTime)
      }
    }
    for (const b of bookings.value) {
      if (b.status === 'cancelled' && !b.coveredByEmergency) continue
      if (new Date(b.startTime).toDateString() !== todayKey) continue
      totalBookedMin += _minutesBetween(b.startTime, b.endTime)
    }

    const utilizationRate = totalOpenMin > 0
      ? Math.min(100, Math.round((totalBookedMin / totalOpenMin) * 100))
      : 0

    let todayChargingMinutes = 0
    try {
      const taskStore = useTaskStore()
      taskStore.loadTasks()
      for (const t of taskStore.tasks) {
        if (t.status === 'completed' && t.actualStartTime && t.actualEndTime) {
          if (new Date(t.actualStartTime).toDateString() === todayKey) {
            todayChargingMinutes += _minutesBetween(t.actualStartTime, t.actualEndTime)
          }
        }
      }
    } catch {
      todayChargingMinutes = totalBookedMin
    }

    return {
      totalOpenPiles,
      availablePiles,
      occupiedPiles,
      maintenancePiles,
      utilizationRate,
      coveredByEmergencyCount,
      avgWaitingMinutes,
      todayBookings: todayBookings.length,
      todayCompletedBookings: todayCompleted,
      todayCancelledBookings: todayCancelled,
      waitingQueueSize,
      todayChargingMinutes
    }
  }

  loadData()

  return {
    piles,
    bookings,
    loading,
    availablePiles,
    openPiles,
    pendingBookings,
    confirmedBookings,
    loadData,
    addPile,
    updatePile,
    deletePile,
    updatePileStatus,
    addOpenTimeSlot,
    updateOpenTimeSlot,
    deleteOpenTimeSlot,
    setPilePublicStatus,
    createBooking,
    createEmergencyBooking,
    updateBookingStatus,
    cancelBooking,
    getPileById,
    getBookingsByPileId,
    getBookingsByUserId,
    getPileDaySchedule,
    getOperationalStats
  }
})
