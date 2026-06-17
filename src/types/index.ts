export interface User {
  id: string
  name: string
  phone: string
  roomNumber: string
  isVip: boolean
}

export interface ChargingPile {
  id: string
  code: string
  ownerId: string
  ownerName: string
  location: string
  power: number
  type: 'private' | 'public'
  isOpenToPublic: boolean
  openTimeSlots: TimeSlot[]
  status: 'available' | 'occupied' | 'maintenance' | 'offline'
  createdAt: string
}

export interface TimeSlot {
  id: string
  startTime: string
  endTime: string
  dayOfWeek?: number[]
}

export interface Booking {
  id: string
  pileId: string
  pileCode: string
  userId: string
  userName: string
  roomNumber: string
  startTime: string
  endTime: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  createdAt: string
  isEmergency: boolean
}

export interface QueueItem {
  id: string
  userId: string
  userName: string
  roomNumber: string
  pileId: string
  pileCode: string
  priority: number
  isEmergency: boolean
  isVip: boolean
  expectedDuration: number
  createdAt: string
  status: 'waiting' | 'called' | 'cancelled' | 'completed'
}

export interface ConflictResult {
  hasConflict: boolean
  conflictingBookings: Booking[]
  message: string
}

export type ModuleType = 'schedule' | 'conflict' | 'queue' | 'priority'

export interface ModuleInfo {
  key: ModuleType
  name: string
  icon: string
  description: string
}
