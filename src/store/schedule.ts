import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ChargingPile, TimeSlot, Booking } from '@/types'
import { getPiles, savePiles, getBookings, saveBookings, generateId } from '@/utils/storage'
import { useQueueStore } from './queue'

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
    bookings.value.filter(booking => booking.status === 'confirmed')
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
      status: 'pending',
      createdAt: new Date().toISOString()
    }
    bookings.value.push(newBooking)
    saveBookings(bookings.value)
    return newBooking
  }

  function updateBookingStatus(id: string, status: Booking['status']) {
    const index = bookings.value.findIndex(b => b.id === id)
    if (index !== -1) {
      bookings.value[index].status = status
      saveBookings(bookings.value)
      return bookings.value[index]
    }
    return null
  }

  function cancelBooking(id: string) {
    const booking = bookings.value.find(b => b.id === id)
    const result = updateBookingStatus(id, 'cancelled')
    if (result && booking) {
      try {
        const queueStore = useQueueStore()
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

  function createEmergencyBooking(bookingData: Omit<Booking, 'id' | 'status' | 'createdAt' | 'isEmergency'>, conflictingIds: string[]) {
    for (const conflictId of conflictingIds) {
      const index = bookings.value.findIndex(b => b.id === conflictId)
      if (index !== -1 && !bookings.value[index].isEmergency) {
        bookings.value[index].status = 'cancelled'
      }
    }

    const newBooking: Booking = {
      ...bookingData,
      id: generateId(),
      status: 'confirmed',
      isEmergency: true,
      createdAt: new Date().toISOString()
    }
    bookings.value.push(newBooking)
    saveBookings(bookings.value)
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
    getBookingsByUserId
  }
})
