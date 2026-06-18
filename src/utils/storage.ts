import type { ChargingPile, Booking, QueueItem, User, ChargingTask } from '@/types'

const STORAGE_KEYS = {
  PILES: 'charging_piles',
  BOOKINGS: 'bookings',
  QUEUE: 'queue_items',
  USERS: 'users',
  TASKS: 'charging_tasks',
  CURRENT_USER: 'current_user'
}

function getData<T>(key: string, defaultValue: T): T {
  try {
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : defaultValue
  } catch {
    return defaultValue
  }
}

function setData<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data))
}

export function getPiles(): ChargingPile[] {
  return getData<ChargingPile[]>(STORAGE_KEYS.PILES, [])
}

export function savePiles(piles: ChargingPile[]): void {
  setData(STORAGE_KEYS.PILES, piles)
}

export function getBookings(): Booking[] {
  return getData<Booking[]>(STORAGE_KEYS.BOOKINGS, [])
}

export function saveBookings(bookings: Booking[]): void {
  setData(STORAGE_KEYS.BOOKINGS, bookings)
}

export function getQueueItems(): QueueItem[] {
  return getData<QueueItem[]>(STORAGE_KEYS.QUEUE, [])
}

export function saveQueueItems(items: QueueItem[]): void {
  setData(STORAGE_KEYS.QUEUE, items)
}

export function getUsers(): User[] {
  return getData<User[]>(STORAGE_KEYS.USERS, [])
}

export function saveUsers(users: User[]): void {
  setData(STORAGE_KEYS.USERS, users)
}

export function getTasks(): ChargingTask[] {
  return getData<ChargingTask[]>(STORAGE_KEYS.TASKS, [])
}

export function saveTasks(tasks: ChargingTask[]): void {
  setData(STORAGE_KEYS.TASKS, tasks)
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

export function initMockData(): void {
  if (getUsers().length === 0) {
    const mockUsers: User[] = [
      { id: 'u1', name: '张三', phone: '13800138001', roomNumber: '1栋101', isVip: true },
      { id: 'u2', name: '李四', phone: '13800138002', roomNumber: '2栋302', isVip: false },
      { id: 'u3', name: '王五', phone: '13800138003', roomNumber: '3栋503', isVip: true },
      { id: 'u4', name: '赵六', phone: '13800138004', roomNumber: '1栋201', isVip: false },
      { id: 'u5', name: '孙七', phone: '13800138005', roomNumber: '2栋404', isVip: false }
    ]
    saveUsers(mockUsers)
  }

  if (getPiles().length === 0) {
    const users = getUsers()
    const mockPiles: ChargingPile[] = [
      {
        id: 'p1',
        code: 'A-001',
        ownerId: users[0].id,
        ownerName: users[0].name,
        location: '地下车库A区01号',
        power: 7,
        type: 'private',
        isOpenToPublic: true,
        openTimeSlots: [
          { id: 'ts1', startTime: '08:00', endTime: '12:00', dayOfWeek: [1, 2, 3, 4, 5, 6, 7] },
          { id: 'ts2', startTime: '18:00', endTime: '22:00', dayOfWeek: [1, 2, 3, 4, 5, 6, 7] }
        ],
        status: 'available',
        createdAt: new Date().toISOString()
      },
      {
        id: 'p2',
        code: 'A-002',
        ownerId: users[1].id,
        ownerName: users[1].name,
        location: '地下车库A区02号',
        power: 7,
        type: 'private',
        isOpenToPublic: true,
        openTimeSlots: [
          { id: 'ts3', startTime: '09:00', endTime: '17:00', dayOfWeek: [1, 2, 3, 4, 5] }
        ],
        status: 'available',
        createdAt: new Date().toISOString()
      },
      {
        id: 'p3',
        code: 'B-001',
        ownerId: users[2].id,
        ownerName: users[2].name,
        location: '地下车库B区01号',
        power: 11,
        type: 'private',
        isOpenToPublic: false,
        openTimeSlots: [],
        status: 'available',
        createdAt: new Date().toISOString()
      },
      {
        id: 'p4',
        code: 'B-002',
        ownerId: users[3].id,
        ownerName: users[3].name,
        location: '地下车库B区02号',
        power: 7,
        type: 'private',
        isOpenToPublic: true,
        openTimeSlots: [
          { id: 'ts4', startTime: '10:00', endTime: '20:00', dayOfWeek: [6, 0] }
        ],
        status: 'maintenance',
        createdAt: new Date().toISOString()
      }
    ]
    savePiles(mockPiles)
  }

  if (getBookings().length === 0) {
    const now = new Date()
    const startTime = new Date(now.getTime() + 30 * 60 * 1000).toISOString()
    const endTime = new Date(now.getTime() + 90 * 60 * 1000).toISOString()
    
    const mockBookings: Booking[] = [
      {
        id: 'b1',
        pileId: 'p1',
        pileCode: 'A-001',
        userId: 'u2',
        userName: '李四',
        roomNumber: '2栋302',
        startTime,
        endTime,
        status: 'confirmed',
        createdAt: new Date().toISOString(),
        isEmergency: false
      }
    ]
    saveBookings(mockBookings)
  }
}
