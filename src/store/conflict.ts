import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Booking, ConflictResult, TimeSlot, ChargingPile } from '@/types'
import { getBookings, saveBookings, getPiles } from '@/utils/storage'
import { useQueueStore } from './queue'

export const useConflictStore = defineStore('conflict', () => {
  const bookings = ref<Booking[]>([])
  const piles = ref<ChargingPile[]>([])

  function loadBookings() {
    bookings.value = getBookings()
  }

  function loadPiles() {
    piles.value = getPiles()
  }

  function validatePileAvailability(pileId: string): { valid: boolean; message: string } {
    loadPiles()
    const pile = piles.value.find(p => p.id === pileId)
    if (!pile) {
      return { valid: false, message: '桩位不存在' }
    }
    if (pile.status !== 'available') {
      const statusText: Record<string, string> = {
        occupied: '占用中',
        maintenance: '维护中',
        offline: '离线'
      }
      return { valid: false, message: `桩位当前${statusText[pile.status] || '不可用'}，无法预约` }
    }
    if (!pile.isOpenToPublic) {
      return { valid: false, message: '该桩位为仅自用状态，未对外开放' }
    }
    return { valid: true, message: '桩位可用' }
  }

  function isBookingTimeInOpenSlots(
    pileId: string,
    startTime: string,
    endTime: string
  ): { valid: boolean; message: string } {
    loadPiles()
    const pile = piles.value.find(p => p.id === pileId)
    if (!pile) {
      return { valid: false, message: '桩位不存在' }
    }
    if (!pile.isOpenToPublic || pile.openTimeSlots.length === 0) {
      return { valid: false, message: '该桩位未设置开放时段' }
    }

    const start = new Date(startTime)
    const end = new Date(endTime)
    const dayOfWeek = start.getDay()
    const startMinutes = start.getHours() * 60 + start.getMinutes()
    const endMinutes = end.getHours() * 60 + end.getMinutes()

    if (start.toDateString() !== end.toDateString()) {
      return { valid: false, message: '预约必须在同一天内完成' }
    }

    for (const slot of pile.openTimeSlots) {
      if (slot.dayOfWeek && !slot.dayOfWeek.includes(dayOfWeek)) continue

      const [sHour, sMin] = slot.startTime.split(':').map(Number)
      const [eHour, eMin] = slot.endTime.split(':').map(Number)
      const slotStartMinutes = sHour * 60 + sMin
      const slotEndMinutes = eHour * 60 + eMin

      if (startMinutes >= slotStartMinutes && endMinutes <= slotEndMinutes) {
        return { valid: true, message: '预约时段在开放范围内' }
      }
    }

    const openTimeRanges = pile.openTimeSlots
      .filter(slot => !slot.dayOfWeek || slot.dayOfWeek.includes(dayOfWeek))
      .map(slot => `${slot.startTime}-${slot.endTime}`)
      .join('、')

    if (openTimeRanges) {
      return { valid: false, message: `预约时段不在开放范围内，当日开放时段：${openTimeRanges}` }
    }
    return { valid: false, message: '当日该桩位无开放时段' }
  }

  function isTimeOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string
  ): boolean {
    const s1 = new Date(start1).getTime()
    const e1 = new Date(end1).getTime()
    const s2 = new Date(start2).getTime()
    const e2 = new Date(end2).getTime()

    return s1 < e2 && s2 < e1
  }

  function isTimeSlotOverlap(slot1: TimeSlot, slot2: TimeSlot): boolean {
    const daysOverlap = !slot1.dayOfWeek || !slot2.dayOfWeek
      ? true
      : slot1.dayOfWeek.some(day => slot2.dayOfWeek!.includes(day))

    if (!daysOverlap) return false

    return isTimeOverlap(
      `2000-01-01T${slot1.startTime}`,
      `2000-01-01T${slot1.endTime}`,
      `2000-01-01T${slot2.startTime}`,
      `2000-01-01T${slot2.endTime}`
    )
  }

  function checkBookingConflict(
    pileId: string,
    startTime: string,
    endTime: string,
    excludeBookingId?: string
  ): ConflictResult {
    const conflictingBookings: Booking[] = []

    for (const booking of bookings.value) {
      if (booking.pileId !== pileId) continue
      if (excludeBookingId && booking.id === excludeBookingId) continue
      if (booking.status === 'cancelled') continue

      if (isTimeOverlap(startTime, endTime, booking.startTime, booking.endTime)) {
        conflictingBookings.push(booking)
      }
    }

    if (conflictingBookings.length > 0) {
      const times = conflictingBookings
        .map(b => `${new Date(b.startTime).toLocaleString()} - ${new Date(b.endTime).toLocaleString()}`)
        .join('、')
      return {
        hasConflict: true,
        conflictingBookings,
        message: `该时段与现有预约冲突：${times}`
      }
    }

    return {
      hasConflict: false,
      conflictingBookings: [],
      message: '时段可用'
    }
  }

  function checkEmergencyBookingConflict(
    pileId: string,
    startTime: string,
    endTime: string
  ): ConflictResult {
    const result = checkBookingConflict(pileId, startTime, endTime)

    if (result.hasConflict) {
      const hasEmergencyConflict = result.conflictingBookings.some(b => b.isEmergency)
      if (hasEmergencyConflict) {
        const emergencyConflict = result.conflictingBookings.find(b => b.isEmergency)
        const conflictInfo = emergencyConflict
          ? `${new Date(emergencyConflict.startTime).toLocaleTimeString()} - ${new Date(emergencyConflict.endTime).toLocaleTimeString()}（${emergencyConflict.userName}）`
          : ''
        return {
          hasConflict: true,
          conflictingBookings: result.conflictingBookings.filter(b => b.isEmergency),
          message: `该时段已存在另一条应急预约：${conflictInfo}，无法创建新的应急预约`
        }
      }
      return {
        ...result,
        message: `紧急预约存在冲突，但可覆盖普通预约。共${result.conflictingBookings.length}条普通预约将被取消释放`
      }
    }

    return result
  }

  function releaseBookingSlot(bookingId: string): boolean {
    const index = bookings.value.findIndex(b => b.id === bookingId)
    if (index === -1) return false

    const booking = bookings.value[index]
    bookings.value[index].status = 'cancelled'
    saveBookings(bookings.value)

    try {
      const queueStore = useQueueStore()
      loadPiles()
      const pile = piles.value.find(p => p.id === booking.pileId)
      if (pile) {
        queueStore.callNextForPile(pile)
      }
    } catch (e) {
      console.error('自动叫号失败:', e)
    }

    return true
  }

  function canBookPile(pileId: string, startTime: string, endTime: string): boolean {
    const result = checkBookingConflict(pileId, startTime, endTime)
    return !result.hasConflict
  }

  function getPileOccupiedTimeSlots(pileId: string, date?: string): TimeSlot[] {
    const slots: TimeSlot[] = []
    const targetDate = date ? new Date(date).toDateString() : null

    for (const booking of bookings.value) {
      if (booking.pileId !== pileId) continue
      if (booking.status === 'cancelled') continue

      if (targetDate) {
        const bookingDate = new Date(booking.startTime).toDateString()
        if (bookingDate !== targetDate) continue
      }

      slots.push({
        id: booking.id,
        startTime: booking.startTime,
        endTime: booking.endTime
      })
    }

    return slots.sort((a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    )
  }

  function getPileAvailableTimeSlots(
    pileId: string,
    openSlots: TimeSlot[],
    date: string
  ): TimeSlot[] {
    const occupiedSlots = getPileOccupiedTimeSlots(pileId, date)
    const availableSlots: TimeSlot[] = []

    for (const openSlot of openSlots) {
      if (openSlot.dayOfWeek) {
        const dayOfWeek = new Date(date).getDay()
        if (!openSlot.dayOfWeek.includes(dayOfWeek)) continue
      }

      const openStart = new Date(`${date}T${openSlot.startTime}`)
      const openEnd = new Date(`${date}T${openSlot.endTime}`)

      let currentStart = openStart.getTime()
      const openEndTime = openEnd.getTime()

      const dayOccupied = occupiedSlots
        .map(s => ({
          start: new Date(s.startTime).getTime(),
          end: new Date(s.endTime).getTime()
        }))
        .sort((a, b) => a.start - b.start)

      for (const occupied of dayOccupied) {
        if (occupied.end <= currentStart || occupied.start >= openEndTime) continue

        if (occupied.start > currentStart) {
          availableSlots.push({
            id: `slot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            startTime: new Date(currentStart).toISOString(),
            endTime: new Date(occupied.start).toISOString()
          })
        }

        currentStart = Math.max(currentStart, occupied.end)
      }

      if (currentStart < openEndTime) {
        availableSlots.push({
          id: `slot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          startTime: new Date(currentStart).toISOString(),
          endTime: new Date(openEndTime).toISOString()
        })
      }
    }

    return availableSlots
  }

  function validateBookingDuration(
    startTime: string,
    endTime: string,
    minMinutes: number = 15,
    maxHours: number = 8
  ): { valid: boolean; message: string } {
    const start = new Date(startTime).getTime()
    const end = new Date(endTime).getTime()
    const durationMs = end - start
    const durationMinutes = durationMs / (1000 * 60)

    if (durationMinutes < minMinutes) {
      return {
        valid: false,
        message: `预约时长不能少于${minMinutes}分钟`
      }
    }

    if (durationMinutes > maxHours * 60) {
      return {
        valid: false,
        message: `预约时长不能超过${maxHours}小时`
      }
    }

    return { valid: true, message: '时长有效' }
  }

  function validateBookingTime(startTime: string): { valid: boolean; message: string } {
    const start = new Date(startTime).getTime()
    const now = Date.now()

    if (start < now) {
      return { valid: false, message: '预约开始时间不能早于当前时间' }
    }

    const maxFutureDays = 7
    const maxFutureTime = now + maxFutureDays * 24 * 60 * 60 * 1000
    if (start > maxFutureTime) {
      return { valid: false, message: `只能预约未来${maxFutureDays}天内的时段` }
    }

    return { valid: true, message: '时间有效' }
  }

  function fullBookingValidation(
    pileId: string,
    startTime: string,
    endTime: string,
    isEmergency: boolean = false
  ): ConflictResult {
    const pileValidation = validatePileAvailability(pileId)
    if (!pileValidation.valid) {
      return {
        hasConflict: true,
        conflictingBookings: [],
        message: pileValidation.message
      }
    }

    const timeValidation = validateBookingTime(startTime)
    if (!timeValidation.valid) {
      return {
        hasConflict: true,
        conflictingBookings: [],
        message: timeValidation.message
      }
    }

    const durationValidation = validateBookingDuration(startTime, endTime)
    if (!durationValidation.valid) {
      return {
        hasConflict: true,
        conflictingBookings: [],
        message: durationValidation.message
      }
    }

    const openTimeValidation = isBookingTimeInOpenSlots(pileId, startTime, endTime)
    if (!openTimeValidation.valid) {
      return {
        hasConflict: true,
        conflictingBookings: [],
        message: openTimeValidation.message
      }
    }

    const conflictCheck = isEmergency
      ? checkEmergencyBookingConflict(pileId, startTime, endTime)
      : checkBookingConflict(pileId, startTime, endTime)

    if (conflictCheck.hasConflict && !isEmergency) {
      return conflictCheck
    }

    return {
      hasConflict: false,
      conflictingBookings: conflictCheck.conflictingBookings,
      message: isEmergency && conflictCheck.hasConflict
        ? '紧急预约可创建，将覆盖普通预约'
        : '预约有效'
    }
  }

  loadBookings()

  return {
    bookings,
    piles,
    loadBookings,
    loadPiles,
    validatePileAvailability,
    isBookingTimeInOpenSlots,
    isTimeOverlap,
    isTimeSlotOverlap,
    checkBookingConflict,
    checkEmergencyBookingConflict,
    releaseBookingSlot,
    canBookPile,
    getPileOccupiedTimeSlots,
    getPileAvailableTimeSlots,
    validateBookingDuration,
    validateBookingTime,
    fullBookingValidation
  }
})
