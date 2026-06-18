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
  status: 'pending' | 'confirmed' | 'charging' | 'completed' | 'cancelled'
  createdAt: string
  isEmergency: boolean
  coveredByEmergency?: boolean
  coveredByBookingId?: string
  taskId?: string
  cancelledAt?: string
}

export interface ChargingTask {
  id: string
  bookingId: string
  queueItemId?: string
  pileId: string
  pileCode: string
  userId: string
  userName: string
  roomNumber: string
  scheduledStartTime: string
  scheduledEndTime: string
  actualStartTime?: string
  actualEndTime?: string
  powerConsumed?: number
  status: 'waiting' | 'charging' | 'completed' | 'cancelled'
  source: 'booking' | 'queue'
  isEmergency: boolean
  createdAt: string
  calledAt?: string
  startedAt?: string
  finishedAt?: string
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
  calledAt?: string
  cancelledAt?: string
  completedAt?: string
  waitingMinutes?: number
  status: 'waiting' | 'called' | 'cancelled' | 'completed'
  taskId?: string
  bookingId?: string
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

export interface OperationalStats {
  totalOpenPiles: number
  availablePiles: number
  occupiedPiles: number
  maintenancePiles: number
  utilizationRate: number
  coveredByEmergencyCount: number
  avgWaitingMinutes: number
  todayBookings: number
  todayCompletedBookings: number
  todayCancelledBookings: number
  waitingQueueSize: number
  todayChargingMinutes: number
}

export interface PileDaySchedule {
  pileId: string
  pileCode: string
  location: string
  date: string
  isOpenToPublic: boolean
  pileStatus: ChargingPile['status']
  openSlots: Array<{ start: string; end: string }>
  bookedSlots: Array<{ id: string; start: string; end: string; userName: string; status: Booking['status']; isEmergency: boolean }>
  freeSlots: Array<{ start: string; end: string }>
  queueCount: number
  openMinutes: number
  bookedMinutes: number
}
