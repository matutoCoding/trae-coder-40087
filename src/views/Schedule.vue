<template>
  <div class="schedule">
    <h2 class="page-title">私桩排期管理</h2>

    <el-row :gutter="20" class="action-row">
      <el-col :span="24">
        <el-button type="primary" @click="openPileDialog">
          <el-icon><Plus /></el-icon>
          新增桩位
        </el-button>
        <el-button type="success" @click="scheduleView = !scheduleView" style="margin-left: 12px">
          <el-icon><Calendar /></el-icon>
          {{ scheduleView ? '返回列表视图' : '日历排班视图' }}
        </el-button>
      </el-col>
    </el-row>

    <template v-if="!scheduleView">
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
                  <el-button type="success" link size="small" @click="openScheduleView(pile)">排班</el-button>
                  <el-button type="primary" link size="small" @click="openBookingDialog(pile)">预约</el-button>
                  <el-button type="primary" link size="small" @click="editPile(pile)">编辑</el-button>
                  <el-button type="danger" link size="small" @click="handleDeletePile(pile.id)">删除</el-button>
                </div>
              </div>
            </template>

            <div class="pile-info">
              <div class="info-item"><span class="label">业主：</span><span>{{ pile.ownerName }}</span></div>
              <div class="info-item"><span class="label">位置：</span><span>{{ pile.location }}</span></div>
              <div class="info-item"><span class="label">功率：</span><span>{{ pile.power }}kW</span></div>
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
                  <span class="slot-days" v-if="slot.dayOfWeek">{{ formatDays(slot.dayOfWeek) }}</span>
                </div>
              </div>
              <el-empty v-else description="暂无开放时段" :image-size="60" />
            </div>
          </el-card>
        </el-col>
      </el-row>

      <el-empty v-if="scheduleStore.piles.length === 0" description="暂无桩位，点击上方按钮添加" />
    </template>

    <template v-else>
      <h3 class="section-title">日历排班视图</h3>
      <el-card class="schedule-view-card">
        <div class="schedule-toolbar">
          <div class="schedule-selectors">
            <el-date-picker
              v-model="scheduleDate"
              type="date"
              placeholder="选择日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              style="width: 180px; margin-right: 16px"
              :clearable="false"
            />
            <el-select
              v-model="selectedPileId"
              placeholder="选择桩位查看排班"
              style="width: 260px"
              @change="refreshDaySchedule"
            >
              <el-option
                v-for="p in scheduleStore.piles"
                :key="p.id"
                :label="`${p.code} - ${p.location}`"
                :value="p.id"
              />
            </el-select>
            <el-button type="primary" @click="refreshDaySchedule" style="margin-left: 8px">
              <el-icon><Refresh /></el-icon>刷新
            </el-button>
          </div>
          <div class="schedule-date-info" v-if="daySchedule">
            <el-tag size="small" :type="daySchedule.isOpenToPublic ? 'success' : 'info'">
              {{ daySchedule.isOpenToPublic ? '对外开放' : '仅自用' }}
            </el-tag>
            <el-tag size="small" :type="getStatusTagType(daySchedule.pileStatus)" style="margin-left: 8px">
              {{ getStatusText(daySchedule.pileStatus) }}
            </el-tag>
            <el-tag size="small" type="warning" style="margin-left: 8px">
              排队中 {{ daySchedule.queueCount }} 人
            </el-tag>
            <el-tag size="small" type="primary" style="margin-left: 8px">
              利用率 {{ getUtilization(daySchedule) }}%
            </el-tag>
          </div>
        </div>

        <template v-if="daySchedule">
          <div class="timeline-container" v-if="daySchedule.openSlots.length > 0">
            <div class="timeline-scale">
              <div v-for="h in 25" :key="h" class="scale-mark">{{ h - 1 }}:00</div>
            </div>
            <div class="timeline-tracks">
              <div class="track-row">
                <div class="track-label">开放时段</div>
                <div class="track-bar">
                  <div
                    v-for="(slot, idx) in daySchedule.openSlots"
                    :key="`open-${idx}`"
                    class="bar-block bar-open"
                    :style="getBlockStyle(slot)"
                  >
                    <span>{{ slot.start }} - {{ slot.end }}</span>
                  </div>
                </div>
              </div>
              <div class="track-row">
                <div class="track-label">已预约</div>
                <div class="track-bar">
                  <template v-if="daySchedule.bookedSlots.length > 0">
                    <div
                      v-for="slot in daySchedule.bookedSlots"
                      :key="`bk-${slot.id}`"
                      :class="['bar-block', slot.isEmergency ? 'bar-emergency' : 'bar-booked']"
                      :style="getBlockStyle(slot)"
                    >
                      <div class="block-title">
                        {{ slot.start }}-{{ slot.end }} · {{ slot.userName }}
                      </div>
                      <div class="block-sub">
                        <el-tag v-if="slot.isEmergency" type="danger" size="small">应急</el-tag>
                        <el-tag v-else type="success" size="small">{{ getBookingStatusText(slot.status) }}</el-tag>
                      </div>
                    </div>
                  </template>
                  <div v-else class="empty-block">暂无预约</div>
                </div>
              </div>
              <div class="track-row">
                <div class="track-label">空闲可约</div>
                <div class="track-bar">
                  <template v-if="daySchedule.freeSlots.length > 0">
                    <div
                      v-for="(slot, idx) in daySchedule.freeSlots"
                      :key="`free-${idx}`"
                      class="bar-block bar-free"
                      :style="getBlockStyle(slot)"
                      @click="bookFreeSlot(slot)"
                    >
                      <span class="click-hint">
                        <el-icon><EditPen /></el-icon>
                        {{ slot.start }} - {{ slot.end }} 点击预约
                      </span>
                    </div>
                  </template>
                  <div v-else class="empty-block">
                    {{ daySchedule.openSlots.length > 0 ? '当日已全部被预约' : '无开放时段' }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <el-empty v-else description="该桩位当日无开放时段设置" :image-size="80" />

          <el-divider />

          <h4 class="sub-title">当日预约详情</h4>
          <el-table :data="daySchedule.bookedSlots" size="small" v-if="daySchedule.bookedSlots.length > 0">
            <el-table-column label="时段">
              <template #default="s">{{ s.row.start }} - {{ s.row.end }}</template>
            </el-table-column>
            <el-table-column prop="userName" label="用户" width="100" />
            <el-table-column label="状态" width="100">
              <template #default="s">
                <el-tag :type="s.row.isEmergency ? 'danger' : 'success'" size="small">
                  {{ s.row.isEmergency ? '应急' : getBookingStatusText(s.row.status) }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="当日暂无预约" :image-size="60" />

          <h4 class="sub-title" style="margin-top: 20px">空闲时段（≥15分钟）</h4>
          <div v-if="daySchedule.freeSlots.length > 0" class="free-slot-list">
            <el-tag
              v-for="(s, i) in daySchedule.freeSlots"
              :key="i"
              type="primary"
              effect="plain"
              size="large"
              class="free-tag"
              @click="bookFreeSlot(s)"
            >
              <el-icon style="margin-right: 4px"><Plus /></el-icon>
              {{ s.start }} - {{ s.end }}（{{ durationText(s) }}）点击预约
            </el-tag>
          </div>
          <el-empty v-else description="当日无 ≥15 分钟的空闲段" :image-size="60" />
        </template>

        <el-empty v-else description="请先选择桩位查看排班" :image-size="80" />
      </el-card>
    </template>

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
        <el-table-column label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getBookingStatusType(scope.row.status)">
              {{ getBookingStatusText(scope.row.status) }}
            </el-tag>
            <el-tag v-if="scope.row.coveredByEmergency" type="warning" size="small" style="margin-left: 4px">被应急覆盖</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="紧急" width="80">
          <template #default="scope">
            <el-tag v-if="scope.row.isEmergency" type="danger" size="small">紧急</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240">
          <template #default="scope">
            <el-button
              v-if="scope.row.status === 'confirmed' && getTaskForBooking(scope.row.id)?.status === 'waiting'"
              type="success"
              link
              size="small"
              @click="handleStartCharging(scope.row)"
            >
              开始充电
            </el-button>
            <el-button
              v-if="scope.row.status === 'charging' && getTaskForBooking(scope.row.id)?.status === 'charging'"
              type="warning"
              link
              size="small"
              @click="handleFinishCharging(scope.row)"
            >
              结束充电
            </el-button>
            <el-button
              v-if="scope.row.status === 'pending' || scope.row.status === 'confirmed'"
              type="danger"
              link
              size="small"
              @click="handleCancelBooking(scope.row.id)"
            >
              取消
            </el-button>
            <span v-if="scope.row.status !== 'pending' && scope.row.status !== 'confirmed' && scope.row.status !== 'charging' && !(scope.row.status === 'confirmed' && getTaskForBooking(scope.row.id)?.status === 'waiting')">-</span>
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
      <el-form ref="pileFormRef" :model="pileForm" :rules="pileRules" label-width="100px">
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
          <el-switch v-model="pileForm.isOpenToPublic" active-text="对外开放" inactive-text="仅自用" />
        </el-form-item>
        <el-form-item label="开放时段" v-if="pileForm.isOpenToPublic">
          <div class="time-slot-form">
            <div v-for="(slot, index) in pileForm.openTimeSlots" :key="index" class="slot-form-item">
              <el-time-select v-model="slot.startTime" placeholder="开始时间" style="width: 140px" />
              <span class="slot-separator">-</span>
              <el-time-select v-model="slot.endTime" placeholder="结束时间" style="width: 140px" />
              <el-checkbox-group v-model="slot.dayOfWeek" style="margin-left: 12px">
                <el-checkbox :label="1">周一</el-checkbox>
                <el-checkbox :label="2">周二</el-checkbox>
                <el-checkbox :label="3">周三</el-checkbox>
                <el-checkbox :label="4">周四</el-checkbox>
                <el-checkbox :label="5">周五</el-checkbox>
                <el-checkbox :label="6">周六</el-checkbox>
                <el-checkbox :label="0">周日</el-checkbox>
              </el-checkbox-group>
              <el-button type="danger" link size="small" @click="removeTimeSlot(index)">删除</el-button>
            </div>
            <el-button type="primary" link size="small" @click="addTimeSlot">
              <el-icon><Plus /></el-icon>添加时段
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
      width="520px"
      @close="resetBookingForm"
    >
      <el-form ref="bookingFormRef" :model="bookingForm" :rules="bookingRules" label-width="100px">
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
            <el-option v-for="user in users" :key="user.id" :label="`${user.name} (${user.roomNumber})`" :value="user.id" />
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
          <el-switch v-model="bookingForm.isEmergency" active-text="是" inactive-text="否" />
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
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus, Calendar, Refresh, EditPen } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useScheduleStore } from '@/store/schedule'
import { useConflictStore } from '@/store/conflict'
import { useQueueStore } from '@/store/queue'
import { useTaskStore } from '@/store/task'
import { getUsers } from '@/utils/storage'
import type { ChargingPile, Booking, TimeSlot, User, ConflictResult, PileDaySchedule } from '@/types'

const scheduleStore = useScheduleStore()
const conflictStore = useConflictStore()
const queueStore = useQueueStore()
const taskStore = useTaskStore()

const users = ref<User[]>([])

onMounted(() => {
  scheduleStore.loadData()
  conflictStore.loadBookings()
  conflictStore.loadPiles()
  queueStore.loadQueue()
  taskStore.loadTasks()
  users.value = getUsers()
  nextTick(refreshDaySchedule)
})

const pileDialogVisible = ref(false)
const bookingDialogVisible = ref(false)
const editingPile = ref<ChargingPile | null>(null)
const scheduleView = ref(false)
const scheduleDate = ref<string>(dayjs().format('YYYY-MM-DD'))
const selectedPileId = ref<string>('')
const daySchedule = ref<PileDaySchedule | null>(null)

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
  openTimeSlots: Array<{ startTime: string; endTime: string; dayOfWeek: number[] }>
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

const sortedBookings = computed(() =>
  [...scheduleStore.bookings].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
)

const bookablePiles = computed(() =>
  scheduleStore.piles
    .map(pile => ({ ...pile, _bookable: pile.isOpenToPublic && pile.status === 'available' }))
    .sort((a, b) => (a._bookable === b._bookable ? 0 : a._bookable ? -1 : 1))
)

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

watch(() => pileForm.ownerId, newId => {
  const u = users.value.find(x => x.id === newId)
  if (u) pileForm.ownerName = u.name
})

watch(() => bookingForm.userId, newId => {
  const u = users.value.find(x => x.id === newId)
  if (u) {
    bookingForm.userName = u.name
    bookingForm.roomNumber = u.roomNumber
  }
})

watch([scheduleDate, () => scheduleStore.piles.length], () => refreshDaySchedule())

const openScheduleView = (pile: ChargingPile) => {
  selectedPileId.value = pile.id
  scheduleView.value = true
  nextTick(refreshDaySchedule)
}

const refreshDaySchedule = () => {
  if (!selectedPileId.value) {
    daySchedule.value = null
    return
  }
  scheduleStore.loadData()
  queueStore.loadQueue()
  daySchedule.value = scheduleStore.getPileDaySchedule(selectedPileId.value, scheduleDate.value)
}

const getBlockStyle = (slot: { start: string; end: string }) => {
  const [sh, sm] = slot.start.split(':').map(Number)
  const [eh, em] = slot.end.split(':').map(Number)
  const start = sh + sm / 60
  const end = eh + em / 60
  return {
    left: `${(start / 24) * 100}%`,
    width: `${Math.max(0.5, ((end - start) / 24) * 100)}%`
  }
}

const getUtilization = (s: PileDaySchedule): number => {
  if (!s.openMinutes) return 0
  return Math.min(100, Math.round((s.bookedMinutes / s.openMinutes) * 100))
}

const durationText = (s: { start: string; end: string }) => {
  const [sh, sm] = s.start.split(':').map(Number)
  const [eh, em] = s.end.split(':').map(Number)
  const min = eh * 60 + em - (sh * 60 + sm)
  return min >= 60 ? `${Math.floor(min / 60)}小时${min % 60 ? min % 60 + '分' : ''}` : `${min}分钟`
}

const bookFreeSlot = (s: { start: string; end: string }) => {
  const pile = scheduleStore.getPileById(selectedPileId.value)
  if (!pile) {
    ElMessage.warning('桩位不存在')
    return
  }
  if (!pile.isOpenToPublic || pile.status !== 'available') {
    ElMessage.warning('该桩位当前不可预约，仅自用或非可用状态')
    return
  }
  resetBookingForm()
  bookingForm.pileId = pile.id
  bookingForm.pileCode = pile.code
  bookingForm.startTime = `${scheduleDate.value}T${s.start}:00`
  bookingForm.endTime = `${scheduleDate.value}T${s.end}:00`
  bookingDialogVisible.value = true
}

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
  pileForm.openTimeSlots.push({ startTime: '', endTime: '', dayOfWeek: [1, 2, 3, 4, 5, 6, 0] })
}

const removeTimeSlot = (index: number) => {
  pileForm.openTimeSlots.splice(index, 1)
}

const submitPileForm = async () => {
  if (!pileFormRef.value) return
  await pileFormRef.value.validate(valid => {
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
    refreshDaySchedule()
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
      if (selectedPileId.value === id) {
        selectedPileId.value = ''
        daySchedule.value = null
      }
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
  if (pile) bookingForm.pileCode = pile.code
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
  await bookingFormRef.value.validate(valid => {
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

    if (bookingForm.isEmergency) {
      const emergencyCheck = conflictStore.checkEmergencyBookingConflict(
        bookingForm.pileId,
        bookingForm.startTime,
        bookingForm.endTime
      )
      if (emergencyCheck.hasConflict && emergencyCheck.conflictingBookings.some(b => b.isEmergency)) {
        ElMessage.error(emergencyCheck.message)
        return
      }
      const conflictingIds = (emergencyCheck.conflictingBookings || [])
        .filter(b => !b.isEmergency)
        .map(b => b.id)
      scheduleStore.createEmergencyBooking(
        {
          pileId: bookingForm.pileId,
          pileCode: bookingForm.pileCode,
          userId: bookingForm.userId,
          userName: bookingForm.userName,
          roomNumber: bookingForm.roomNumber,
          startTime: bookingForm.startTime,
          endTime: bookingForm.endTime
        },
        conflictingIds
      )
      ElMessage.success(
        conflictingIds.length > 0
          ? `应急预约创建成功，已覆盖${conflictingIds.length}条普通预约`
          : '应急预约创建成功'
      )
    } else {
      if (conflictResult.hasConflict) {
        ElMessage.error(conflictResult.message)
        return
      }
      scheduleStore.createBooking({
        pileId: bookingForm.pileId,
        pileCode: bookingForm.pileCode,
        userId: bookingForm.userId,
        userName: bookingForm.userName,
        roomNumber: bookingForm.roomNumber,
        startTime: bookingForm.startTime,
        endTime: bookingForm.endTime,
        isEmergency: false
      })
      ElMessage.success('预约创建成功，已生成待充电任务')
    }

    conflictStore.loadBookings()
    scheduleStore.loadData()
    taskStore.loadTasks()
    refreshDaySchedule()
    bookingDialogVisible.value = false
  })
}

const handleCancelBooking = (id: string) => {
  ElMessageBox.confirm(
    '确定要取消该预约吗？取消后系统将自动叫号该桩位排队中优先级最高的用户。',
    '取消确认',
    { confirmButtonText: '确定取消', cancelButtonText: '返回', type: 'warning' }
  )
    .then(() => {
      scheduleStore.cancelBooking(id)
      conflictStore.loadBookings()
      scheduleStore.loadData()
      queueStore.loadQueue()
      taskStore.loadTasks()
      refreshDaySchedule()
      ElMessage.success('预约已取消，已自动通知下一位排队用户')
    })
    .catch(() => {})
}

const getTaskForBooking = (bookingId: string) => {
  taskStore.loadTasks()
  return taskStore.tasks.find(t => t.bookingId === bookingId && t.status !== 'cancelled')
}

const handleStartCharging = (booking: Booking) => {
  const task = getTaskForBooking(booking.id)
  if (!task || task.status !== 'waiting') {
    ElMessage.error('未找到待充电任务')
    return
  }
  ElMessageBox.confirm(
    `确认用户 ${booking.userName} 在桩位 ${booking.pileCode} 开始充电？`,
    '开始充电确认',
    { type: 'success', confirmButtonText: '开始充电' }
  )
    .then(() => {
      const result = taskStore.startCharging(task.id)
      if (result) {
        scheduleStore.loadData()
        queueStore.loadQueue()
        refreshDaySchedule()
        ElMessage.success('充电已开始')
      } else {
        ElMessage.error('开始充电失败')
      }
    })
    .catch(() => {})
}

const handleFinishCharging = (booking: Booking) => {
  const task = getTaskForBooking(booking.id)
  if (!task || task.status !== 'charging') {
    ElMessage.error('未找到充电中的任务')
    return
  }
  ElMessageBox.confirm(
    `确认结束 ${booking.userName} 的充电？将释放桩位并自动叫号下一位。`,
    '结束充电确认',
    { type: 'warning', confirmButtonText: '确认结束' }
  )
    .then(() => {
      const result = taskStore.finishCharging(task.id)
      if (result) {
        if (result.queueItemId) {
          queueStore.completeQueue(result.queueItemId)
        }
        scheduleStore.loadData()
        queueStore.loadQueue()
        taskStore.loadTasks()
        refreshDaySchedule()
        ElMessage.success('充电已完成，桩位已释放')
      } else {
        ElMessage.error('结束充电失败')
      }
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
    charging: 'primary' as any,
    completed: 'info',
    cancelled: 'danger'
  }
  return typeMap[status]
}

const getBookingStatusText = (status: Booking['status']): string => {
  const textMap: Record<string, string> = {
    pending: '待确认',
    confirmed: '已确认',
    charging: '充电中',
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

const formatDateTime = (dateStr: string): string => dayjs(dateStr).format('M/D HH:mm')
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

  .sub-title {
    font-size: 15px;
    font-weight: 600;
    margin: 12px 0;
    color: #303133;
  }

  .action-row { margin-bottom: 20px; }

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
          gap: 8px;
          .pile-code {
            font-size: 16px;
            font-weight: 600;
            color: #303133;
          }
        }
        .pile-actions {
          display: flex;
          gap: 4px;
        }
      }
      .pile-info {
        .info-item {
          padding: 4px 0;
          .label {
            color: #909399;
            margin-right: 8px;
          }
        }
      }
      .time-slots {
        .slots-title {
          font-weight: 600;
          margin-bottom: 8px;
          color: #606266;
        }
        .slots-list {
          .slot-item {
            display: flex;
            justify-content: space-between;
            padding: 6px 8px;
            background: #f5f7fa;
            border-radius: 4px;
            margin-bottom: 4px;
            .slot-days {
              color: #909399;
              font-size: 12px;
            }
          }
        }
      }
    }
  }

  .schedule-view-card {
    border-radius: 8px;
    .schedule-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 12px;
      .schedule-selectors {
        display: flex;
        align-items: center;
      }
    }

    .timeline-container {
      border: 1px solid #ebeef5;
      border-radius: 8px;
      padding: 16px;
      overflow-x: auto;

      .timeline-scale {
        display: flex;
        border-bottom: 1px dashed #e4e7ed;
        padding-bottom: 6px;
        margin-bottom: 8px;
        .scale-mark {
          flex: 0 0 4%;
          text-align: left;
          font-size: 10px;
          color: #909399;
        }
      }

      .timeline-tracks {
        .track-row {
          display: flex;
          align-items: stretch;
          min-height: 56px;
          margin-bottom: 10px;
          .track-label {
            flex: 0 0 90px;
            padding-right: 12px;
            color: #606266;
            font-weight: 600;
            line-height: 56px;
            text-align: right;
          }
          .track-bar {
            flex: 1;
            position: relative;
            background: #fafbfc;
            border-radius: 4px;
            min-height: 56px;
            .bar-block {
              position: absolute;
              top: 6px;
              bottom: 6px;
              border-radius: 6px;
              padding: 6px 8px;
              color: #fff;
              font-size: 12px;
              box-sizing: border-box;
              overflow: hidden;
              display: flex;
              flex-direction: column;
              justify-content: center;
              cursor: default;
              .block-title { font-weight: 600; }
              .block-sub { margin-top: 2px; }
              &.bar-open {
                background: rgba(64, 158, 255, 0.18);
                color: #409eff;
                border: 1px dashed rgba(64, 158, 255, 0.5);
                align-items: center;
              }
              &.bar-booked {
                background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%);
                box-shadow: 0 2px 6px rgba(103,194,58,0.3);
              }
              &.bar-emergency {
                background: linear-gradient(135deg, #f56c6c 0%, #f78989 100%);
                box-shadow: 0 2px 6px rgba(245,108,108,0.3);
              }
              &.bar-free {
                background: linear-gradient(135deg, #52c41a22 0%, #73d13d44 100%);
                color: #389e0d;
                border: 1px dashed #95de64;
                cursor: pointer;
                transition: all 0.2s;
                align-items: center;
                justify-content: center;
                &:hover {
                  background: linear-gradient(135deg, #73d13d 0%, #95de64 100%);
                  color: #fff;
                  box-shadow: 0 4px 10px rgba(115,209,61,0.3);
                  .click-hint { font-weight: 600; }
                }
                .click-hint {
                  display: flex;
                  align-items: center;
                  gap: 4px;
                }
              }
            }
            .empty-block {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              color: #c0c4cc;
              font-size: 12px;
            }
          }
        }
      }
    }
  }

  .free-slot-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    .free-tag {
      cursor: pointer;
      transition: all 0.2s;
      &:hover {
        transform: translateY(-1px);
      }
    }
  }

  .bookings-card {
    border-radius: 8px;
    .time-range {
      color: #909399;
      font-size: 12px;
    }
  }

  .time-slot-form {
    width: 100%;
    .slot-form-item {
      display: flex;
      align-items: center;
      margin-bottom: 8px;
      flex-wrap: wrap;
      gap: 6px;
      .slot-separator {
        padding: 0 6px;
        color: #909399;
      }
    }
  }
}
</style>
