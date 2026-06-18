<template>
  <div class="schedule">
    <h2 class="page-title">私桩排期管理</h2>

    <el-row :gutter="20" class="action-row">
      <el-col :span="24">
        <el-button type="primary" @click="openPileDialog">
          <el-icon><Plus /></el-icon>
          新增桩位
        </el-button>
      </el-col>
    </el-row>

    <h3 class="section-title">桩位列表</h3>
    <el-row :gutter="20" class="pile-list">
      <el-col :span="8" v-for="pile in scheduleStore.piles" :key="pile.id">
        <el-card class="pile-card" shadow="hover">
          <template #header>
            <div class="pile-header">
              <div class="pile-title">
                <span class="pile-code">{{ pile.code }}</span>
                <el-tag :type="getStatusTagType(pile.status)" size="small">
                  {{ getStatusText(pile.status) }}
                </el-tag>
              </div>
              <div class="pile-actions">
                <el-button type="primary" link size="small" @click="openBookingDialog(pile)">
                  预约
                </el-button>
                <el-button type="primary" link size="small" @click="editPile(pile)">
                  编辑
                </el-button>
                <el-button type="danger" link size="small" @click="handleDeletePile(pile.id)">
                  删除
                </el-button>
              </div>
            </div>
          </template>

          <div class="pile-info">
            <div class="info-item">
              <span class="label">业主：</span>
              <span>{{ pile.ownerName }}</span>
            </div>
            <div class="info-item">
              <span class="label">位置：</span>
              <span>{{ pile.location }}</span>
            </div>
            <div class="info-item">
              <span class="label">功率：</span>
              <span>{{ pile.power }}kW</span>
            </div>
            <div class="info-item">
              <span class="label">开放状态：</span>
              <el-tag :type="pile.isOpenToPublic ? 'success' : 'info'" size="small">
                {{ pile.isOpenToPublic ? '对外开放' : '仅自用' }}
              </el-tag>
            </div>
          </div>

          <el-divider />

          <div class="time-slots">
            <div class="slots-title">开放时段</div>
            <div v-if="pile.openTimeSlots.length > 0" class="slots-list">
              <div v-for="slot in pile.openTimeSlots" :key="slot.id" class="slot-item">
                <span>{{ slot.startTime }} - {{ slot.endTime }}</span>
                <span class="slot-days" v-if="slot.dayOfWeek">
                  {{ formatDays(slot.dayOfWeek) }}
                </span>
              </div>
            </div>
            <el-empty v-else description="暂无开放时段" :image-size="60" />
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-empty v-if="scheduleStore.piles.length === 0" description="暂无桩位，点击上方按钮添加" />

    <h3 class="section-title">预约列表</h3>
    <el-card class="bookings-card">
      <el-table :data="sortedBookings" v-loading="scheduleStore.loading" stripe>
        <el-table-column prop="pileCode" label="桩位编号" width="120" />
        <el-table-column prop="userName" label="用户" width="100" />
        <el-table-column prop="roomNumber" label="房间号" width="120" />
        <el-table-column label="预约时间" min-width="200">
          <template #default="scope">
            <div>{{ formatDateTime(scope.row.startTime) }}</div>
            <div class="time-range">至 {{ formatDateTime(scope.row.endTime) }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getBookingStatusType(scope.row.status)">
              {{ getBookingStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="紧急" width="80">
          <template #default="scope">
            <el-tag v-if="scope.row.isEmergency" type="danger" size="small">紧急</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="scope">
            <el-button
              v-if="scope.row.status === 'pending' || scope.row.status === 'confirmed'"
              type="danger"
              link
              size="small"
              @click="handleCancelBooking(scope.row.id)"
            >
              取消
            </el-button>
            <span v-else>-</span>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="scheduleStore.bookings.length === 0" description="暂无预约记录" />
    </el-card>

    <el-dialog
      v-model="pileDialogVisible"
      :title="editingPile ? '编辑桩位' : '新增桩位'"
      width="600px"
      @close="resetPileForm"
    >
      <el-form
        ref="pileFormRef"
        :model="pileForm"
        :rules="pileRules"
        label-width="100px"
      >
        <el-form-item label="桩位编号" prop="code">
          <el-input v-model="pileForm.code" placeholder="请输入桩位编号" />
        </el-form-item>
        <el-form-item label="业主" prop="ownerId">
          <el-select v-model="pileForm.ownerId" placeholder="请选择业主" style="width: 100%">
            <el-option
              v-for="user in users"
              :key="user.id"
              :label="`${user.name} (${user.roomNumber})`"
              :value="user.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="位置" prop="location">
          <el-input v-model="pileForm.location" placeholder="请输入位置" />
        </el-form-item>
        <el-form-item label="功率(kW)" prop="power">
          <el-input-number v-model="pileForm.power" :min="3" :max="22" :step="1" />
        </el-form-item>
        <el-form-item label="开放状态" prop="isOpenToPublic">
          <el-switch
            v-model="pileForm.isOpenToPublic"
            active-text="对外开放"
            inactive-text="仅自用"
          />
        </el-form-item>
        <el-form-item label="开放时段" v-if="pileForm.isOpenToPublic">
          <div class="time-slot-form">
            <div
              v-for="(slot, index) in pileForm.openTimeSlots"
              :key="index"
              class="slot-form-item"
            >
              <el-time-select
                v-model="slot.startTime"
                placeholder="开始时间"
                style="width: 140px"
              />
              <span class="slot-separator">-</span>
              <el-time-select
                v-model="slot.endTime"
                placeholder="结束时间"
                style="width: 140px"
              />
              <el-checkbox-group v-model="slot.dayOfWeek" style="margin-left: 12px">
                <el-checkbox :label="1">周一</el-checkbox>
                <el-checkbox :label="2">周二</el-checkbox>
                <el-checkbox :label="3">周三</el-checkbox>
                <el-checkbox :label="4">周四</el-checkbox>
                <el-checkbox :label="5">周五</el-checkbox>
                <el-checkbox :label="6">周六</el-checkbox>
                <el-checkbox :label="0">周日</el-checkbox>
              </el-checkbox-group>
              <el-button
                type="danger"
                link
                size="small"
                @click="removeTimeSlot(index)"
              >
                删除
              </el-button>
            </div>
            <el-button type="primary" link size="small" @click="addTimeSlot">
              <el-icon><Plus /></el-icon>
              添加时段
            </el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pileDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitPileForm">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="bookingDialogVisible"
      title="创建预约"
      width="500px"
      @close="resetBookingForm"
    >
      <el-form
        ref="bookingFormRef"
        :model="bookingForm"
        :rules="bookingRules"
        label-width="100px"
      >
        <el-form-item label="选择桩位" prop="pileId">
          <el-select v-model="bookingForm.pileId" placeholder="请选择桩位" style="width: 100%" @change="handlePileChange">
            <el-option
              v-for="pile in bookablePiles"
              :key="pile.id"
              :label="`${pile.code} - ${pile.location}`"
              :value="pile.id"
              :disabled="!pile.isOpenToPublic || pile.status !== 'available'"
            >
              <span>{{ pile.code }} - {{ pile.location }}</span>
              <el-tag v-if="!pile.isOpenToPublic" type="info" size="small" style="margin-left: 8px">仅自用</el-tag>
              <el-tag v-else-if="pile.status !== 'available'" type="warning" size="small" style="margin-left: 8px">{{ getStatusText(pile.status) }}</el-tag>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="选择用户" prop="userId">
          <el-select v-model="bookingForm.userId" placeholder="请选择用户" style="width: 100%">
            <el-option
              v-for="user in users"
              :key="user.id"
              :label="`${user.name} (${user.roomNumber})`"
              :value="user.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="开始时间" prop="startTime">
          <el-date-picker
            v-model="bookingForm.startTime"
            type="datetime"
            placeholder="选择开始时间"
            style="width: 100%"
            format="YYYY-MM-DD HH:mm"
            value-format="YYYY-MM-DDTHH:mm:ss"
          />
        </el-form-item>
        <el-form-item label="结束时间" prop="endTime">
          <el-date-picker
            v-model="bookingForm.endTime"
            type="datetime"
            placeholder="选择结束时间"
            style="width: 100%"
            format="YYYY-MM-DD HH:mm"
            value-format="YYYY-MM-DDTHH:mm:ss"
          />
        </el-form-item>
        <el-form-item label="紧急预约" prop="isEmergency">
          <el-switch
            v-model="bookingForm.isEmergency"
            active-text="是"
            inactive-text="否"
          />
        </el-form-item>
        <el-form-item v-if="conflictResult.message" label="冲突检测">
          <el-alert
            :title="conflictResult.message"
            :type="conflictResult.hasConflict && !bookingForm.isEmergency ? 'error' : 'warning'"
            :closable="false"
            show-icon
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bookingDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitBookingForm">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useScheduleStore } from '@/store/schedule'
import { useConflictStore } from '@/store/conflict'
import { useQueueStore } from '@/store/queue'
import { getUsers } from '@/utils/storage'
import type { ChargingPile, Booking, TimeSlot, User, ConflictResult } from '@/types'

const scheduleStore = useScheduleStore()
const conflictStore = useConflictStore()
const queueStore = useQueueStore()

const users = ref<User[]>([])

onMounted(() => {
  scheduleStore.loadData()
  conflictStore.loadBookings()
  users.value = getUsers()
})

const pileDialogVisible = ref(false)
const bookingDialogVisible = ref(false)
const editingPile = ref<ChargingPile | null>(null)

const pileFormRef = ref<FormInstance>()
const bookingFormRef = ref<FormInstance>()

const conflictResult = reactive<ConflictResult>({
  hasConflict: false,
  conflictingBookings: [],
  message: ''
})

interface PileForm {
  code: string
  ownerId: string
  ownerName: string
  location: string
  power: number
  isOpenToPublic: boolean
  openTimeSlots: Array<{
    startTime: string
    endTime: string
    dayOfWeek: number[]
  }>
}

const pileForm = reactive<PileForm>({
  code: '',
  ownerId: '',
  ownerName: '',
  location: '',
  power: 7,
  isOpenToPublic: false,
  openTimeSlots: []
})

const pileRules: FormRules = {
  code: [{ required: true, message: '请输入桩位编号', trigger: 'blur' }],
  ownerId: [{ required: true, message: '请选择业主', trigger: 'change' }],
  location: [{ required: true, message: '请输入位置', trigger: 'blur' }],
  power: [{ required: true, message: '请输入功率', trigger: 'blur' }]
}

interface BookingForm {
  pileId: string
  pileCode: string
  userId: string
  userName: string
  roomNumber: string
  startTime: string
  endTime: string
  isEmergency: boolean
}

const bookingForm = reactive<BookingForm>({
  pileId: '',
  pileCode: '',
  userId: '',
  userName: '',
  roomNumber: '',
  startTime: '',
  endTime: '',
  isEmergency: false
})

const bookingRules: FormRules = {
  pileId: [{ required: true, message: '请选择桩位', trigger: 'change' }],
  userId: [{ required: true, message: '请选择用户', trigger: 'change' }],
  startTime: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
  endTime: [{ required: true, message: '请选择结束时间', trigger: 'change' }]
}

const sortedBookings = computed(() => {
  return [...scheduleStore.bookings].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
})

const bookablePiles = computed(() => {
  return scheduleStore.piles.map(pile => ({
    ...pile,
    _bookable: pile.isOpenToPublic && pile.status === 'available'
  })).sort((a, b) => {
    if (a._bookable && !b._bookable) return -1
    if (!a._bookable && b._bookable) return 1
    return 0
  })
})

watch(
  () => [bookingForm.pileId, bookingForm.startTime, bookingForm.endTime, bookingForm.isEmergency],
  () => {
    if (bookingForm.pileId && bookingForm.startTime && bookingForm.endTime) {
      const result = conflictStore.fullBookingValidation(
        bookingForm.pileId,
        bookingForm.startTime,
        bookingForm.endTime,
        bookingForm.isEmergency
      )
      conflictResult.hasConflict = result.hasConflict
      conflictResult.conflictingBookings = result.conflictingBookings
      conflictResult.message = result.message
    } else {
      conflictResult.hasConflict = false
      conflictResult.conflictingBookings = []
      conflictResult.message = ''
    }
  }
)

watch(
  () => pileForm.ownerId,
  (newId) => {
    const user = users.value.find(u => u.id === newId)
    if (user) {
      pileForm.ownerName = user.name
    }
  }
)

watch(
  () => bookingForm.userId,
  (newId) => {
    const user = users.value.find(u => u.id === newId)
    if (user) {
      bookingForm.userName = user.name
      bookingForm.roomNumber = user.roomNumber
    }
  }
)

const openPileDialog = () => {
  editingPile.value = null
  resetPileForm()
  pileDialogVisible.value = true
}

const editPile = (pile: ChargingPile) => {
  editingPile.value = pile
  pileForm.code = pile.code
  pileForm.ownerId = pile.ownerId
  pileForm.ownerName = pile.ownerName
  pileForm.location = pile.location
  pileForm.power = pile.power
  pileForm.isOpenToPublic = pile.isOpenToPublic
  pileForm.openTimeSlots = pile.openTimeSlots.map(slot => ({
    startTime: slot.startTime,
    endTime: slot.endTime,
    dayOfWeek: slot.dayOfWeek || [1, 2, 3, 4, 5, 6, 0]
  }))
  pileDialogVisible.value = true
}

const resetPileForm = () => {
  pileForm.code = ''
  pileForm.ownerId = ''
  pileForm.ownerName = ''
  pileForm.location = ''
  pileForm.power = 7
  pileForm.isOpenToPublic = false
  pileForm.openTimeSlots = []
  pileFormRef.value?.resetFields()
}

const addTimeSlot = () => {
  pileForm.openTimeSlots.push({
    startTime: '',
    endTime: '',
    dayOfWeek: [1, 2, 3, 4, 5, 6, 0]
  })
}

const removeTimeSlot = (index: number) => {
  pileForm.openTimeSlots.splice(index, 1)
}

const submitPileForm = async () => {
  if (!pileFormRef.value) return

  await pileFormRef.value.validate((valid) => {
    if (!valid) return

    if (pileForm.isOpenToPublic) {
      for (const slot of pileForm.openTimeSlots) {
        if (!slot.startTime || !slot.endTime) {
          ElMessage.error('请完善开放时段信息')
          return
        }
      }
    }

    const openTimeSlots: TimeSlot[] = pileForm.openTimeSlots.map(slot => ({
      id: '',
      startTime: slot.startTime,
      endTime: slot.endTime,
      dayOfWeek: slot.dayOfWeek.length === 7 ? undefined : slot.dayOfWeek
    }))

    if (editingPile.value) {
      scheduleStore.updatePile(editingPile.value.id, {
        code: pileForm.code,
        ownerId: pileForm.ownerId,
        ownerName: pileForm.ownerName,
        location: pileForm.location,
        power: pileForm.power,
        isOpenToPublic: pileForm.isOpenToPublic,
        openTimeSlots
      })
      ElMessage.success('桩位更新成功')
    } else {
      scheduleStore.addPile({
        code: pileForm.code,
        ownerId: pileForm.ownerId,
        ownerName: pileForm.ownerName,
        location: pileForm.location,
        power: pileForm.power,
        isOpenToPublic: pileForm.isOpenToPublic,
        openTimeSlots
      })
      ElMessage.success('桩位添加成功')
    }

    pileDialogVisible.value = false
  })
}

const handleDeletePile = (id: string) => {
  ElMessageBox.confirm('确定要删除该桩位吗？', '删除确认', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => {
      scheduleStore.deletePile(id)
      ElMessage.success('删除成功')
    })
    .catch(() => {})
}

const openBookingDialog = (pile?: ChargingPile) => {
  resetBookingForm()
  if (pile) {
    bookingForm.pileId = pile.id
    bookingForm.pileCode = pile.code
  }
  bookingDialogVisible.value = true
}

const handlePileChange = (pileId: string) => {
  const pile = scheduleStore.getPileById(pileId)
  if (pile) {
    bookingForm.pileCode = pile.code
  }
}

const resetBookingForm = () => {
  bookingForm.pileId = ''
  bookingForm.pileCode = ''
  bookingForm.userId = ''
  bookingForm.userName = ''
  bookingForm.roomNumber = ''
  bookingForm.startTime = ''
  bookingForm.endTime = ''
  bookingForm.isEmergency = false
  conflictResult.hasConflict = false
  conflictResult.conflictingBookings = []
  conflictResult.message = ''
  bookingFormRef.value?.resetFields()
}

const submitBookingForm = async () => {
  if (!bookingFormRef.value) return

  await bookingFormRef.value.validate((valid) => {
    if (!valid) return

    const pileValidation = conflictStore.validatePileAvailability(bookingForm.pileId)
    if (!pileValidation.valid) {
      ElMessage.error(pileValidation.message)
      return
    }

    const openTimeValidation = conflictStore.isBookingTimeInOpenSlots(
      bookingForm.pileId,
      bookingForm.startTime,
      bookingForm.endTime
    )
    if (!openTimeValidation.valid) {
      ElMessage.error(openTimeValidation.message)
      return
    }

    if (conflictResult.hasConflict && !bookingForm.isEmergency) {
      ElMessage.error(conflictResult.message)
      return
    }

    if (bookingForm.isEmergency) {
      const conflictingIds = conflictResult.conflictingBookings
        .filter(b => !b.isEmergency)
        .map(b => b.id)

      scheduleStore.createEmergencyBooking({
        pileId: bookingForm.pileId,
        pileCode: bookingForm.pileCode,
        userId: bookingForm.userId,
        userName: bookingForm.userName,
        roomNumber: bookingForm.roomNumber,
        startTime: bookingForm.startTime,
        endTime: bookingForm.endTime
      }, conflictingIds)
    } else {
      const newBooking = scheduleStore.createBooking({
        pileId: bookingForm.pileId,
        pileCode: bookingForm.pileCode,
        userId: bookingForm.userId,
        userName: bookingForm.userName,
        roomNumber: bookingForm.roomNumber,
        startTime: bookingForm.startTime,
        endTime: bookingForm.endTime,
        isEmergency: false
      })
      scheduleStore.updateBookingStatus(newBooking.id, 'confirmed')
    }

    conflictStore.loadBookings()
    scheduleStore.loadData()
    ElMessage.success(bookingForm.isEmergency ? '应急预约创建成功，已覆盖冲突的普通预约' : '预约创建成功')
    bookingDialogVisible.value = false
  })
}

const handleCancelBooking = (id: string) => {
  ElMessageBox.confirm('确定要取消该预约吗？取消后系统将自动叫号排队中优先级最高的用户。', '取消确认', {
    confirmButtonText: '确定取消',
    cancelButtonText: '返回',
    type: 'warning'
  })
    .then(() => {
      scheduleStore.cancelBooking(id)
      conflictStore.loadBookings()
      scheduleStore.loadData()
      queueStore.loadQueue()
      ElMessage.success('预约已取消，已自动通知下一位排队用户')
    })
    .catch(() => {})
}

const getStatusTagType = (status: ChargingPile['status']): 'success' | 'warning' | 'info' | 'danger' => {
  const typeMap: Record<string, 'success' | 'warning' | 'info' | 'danger'> = {
    available: 'success',
    occupied: 'warning',
    maintenance: 'info',
    offline: 'danger'
  }
  return typeMap[status]
}

const getStatusText = (status: ChargingPile['status']): string => {
  const textMap: Record<string, string> = {
    available: '可用',
    occupied: '占用中',
    maintenance: '维护中',
    offline: '离线'
  }
  return textMap[status]
}

const getBookingStatusType = (status: Booking['status']): 'success' | 'warning' | 'info' | 'danger' => {
  const typeMap: Record<string, 'success' | 'warning' | 'info' | 'danger'> = {
    pending: 'warning',
    confirmed: 'success',
    completed: 'info',
    cancelled: 'danger'
  }
  return typeMap[status]
}

const getBookingStatusText = (status: Booking['status']): string => {
  const textMap: Record<string, string> = {
    pending: '待确认',
    confirmed: '已确认',
    completed: '已完成',
    cancelled: '已取消'
  }
  return textMap[status]
}

const formatDays = (days: number[]): string => {
  if (days.length === 7) return '每天'
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return days.map(d => dayNames[d]).join('、')
}

const formatDateTime = (dateStr: string): string => {
  return dayjs(dateStr).format('M/D HH:mm')
}
</script>

<style scoped lang="scss">
.schedule {
  padding: 20px;

  .page-title {
    font-size: 24px;
    font-weight: 600;
    margin-bottom: 20px;
    color: #303133;
  }

  .section-title {
    font-size: 18px;
    font-weight: 600;
    margin: 30px 0 15px;
    color: #303133;
  }

  .action-row {
    margin-bottom: 20px;
  }

  .pile-list {
    .pile-card {
      border-radius: 8px;
      margin-bottom: 20px;

      .pile-header {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .pile-title {
          display: flex;
          align-items: center;
          gap: 10px;

          .pile-code {
            font-size: 16px;
            font-weight: 600;
            color: #303133;
          }
        }

        .pile-actions {
          display: flex;
          gap: 8px;
        }
      }

      .pile-info {
        .info-item {
          margin-bottom: 8px;
          font-size: 14px;
          color: #606266;

          .label {
            color: #909399;
          }
        }
      }

      .time-slots {
        .slots-title {
          font-size: 14px;
          font-weight: 500;
          color: #606266;
          margin-bottom: 10px;
        }

        .slots-list {
          .slot-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 12px;
            background-color: #f5f7fa;
            border-radius: 4px;
            margin-bottom: 6px;
            font-size: 13px;
            color: #606266;

            .slot-days {
              color: #909399;
              font-size: 12px;
            }
          }
        }
      }
    }
  }

  .bookings-card {
    border-radius: 8px;

    .time-range {
      font-size: 12px;
      color: #909399;
    }
  }

  .time-slot-form {
    width: 100%;

    .slot-form-item {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;

      .slot-separator {
        color: #909399;
      }
    }
  }
}
</style>
