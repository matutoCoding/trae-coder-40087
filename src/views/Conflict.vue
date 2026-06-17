<template>
  <div class="conflict-page">
    <el-row :gutter="20">
      <el-col :span="12">
        <el-card class="form-card">
          <template #header>
            <div class="card-header">
              <el-icon><Warning /></el-icon>
              <span>冲突检测</span>
            </div>
          </template>
          <el-form
            ref="conflictFormRef"
            :model="conflictForm"
            :rules="conflictRules"
            label-width="100px"
          >
            <el-form-item label="选择桩位" prop="pileId">
              <el-select
                v-model="conflictForm.pileId"
                placeholder="请选择桩位"
                style="width: 100%"
                @change="handlePileChange"
              >
                <el-option
                  v-for="pile in scheduleStore.piles"
                  :key="pile.id"
                  :label="`${pile.code} - ${pile.location}`"
                  :value="pile.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="开始时间" prop="startTime">
              <el-date-picker
                v-model="conflictForm.startTime"
                type="datetime"
                placeholder="选择开始时间"
                style="width: 100%"
                value-format="YYYY-MM-DDTHH:mm:ss"
              />
            </el-form-item>
            <el-form-item label="结束时间" prop="endTime">
              <el-date-picker
                v-model="conflictForm.endTime"
                type="datetime"
                placeholder="选择结束时间"
                style="width: 100%"
                value-format="YYYY-MM-DDTHH:mm:ss"
              />
            </el-form-item>
            <el-form-item label="是否紧急">
              <el-switch v-model="conflictForm.isEmergency" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleCheckConflict">
                检测冲突
              </el-button>
              <el-button type="success" @click="handleFullValidation">
                完整校验
              </el-button>
              <el-button @click="handleQueryAvailable">
                查询可用时段
              </el-button>
            </el-form-item>
          </el-form>

          <el-alert
            v-if="conflictResult"
            :title="conflictResult.message"
            :type="conflictResult.hasConflict ? 'error' : 'success'"
            show-icon
            :closable="false"
          >
            <div v-if="conflictResult.conflictingBookings.length > 0">
              <div
                v-for="booking in conflictResult.conflictingBookings"
                :key="booking.id"
                class="conflict-item"
              >
                <el-tag :type="booking.isEmergency ? 'danger' : 'warning'">
                  {{ booking.isEmergency ? '紧急' : '普通' }}
                </el-tag>
                <span>{{ booking.userName }} ({{ booking.roomNumber }})</span>
                <span class="time">
                  {{ formatDateTime(booking.startTime) }} - {{ formatDateTime(booking.endTime) }}
                </span>
              </div>
            </div>
          </el-alert>
        </el-card>

        <el-card class="release-card" style="margin-top: 20px">
          <template #header>
            <div class="card-header">
              <el-icon><Delete /></el-icon>
              <span>退订管理</span>
            </div>
          </template>
          <el-form label-width="100px">
            <el-form-item label="选择预约">
              <el-select
                v-model="selectedBookingId"
                placeholder="请选择要取消的预约"
                style="width: 100%"
                filterable
              >
                <el-option
                  v-for="booking in activeBookings"
                  :key="booking.id"
                  :label="`${booking.pileCode} - ${booking.userName} - ${formatDateTime(booking.startTime)}`"
                  :value="booking.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button
                type="danger"
                :disabled="!selectedBookingId"
                @click="handleReleaseBooking"
              >
                取消预约
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card class="visualization-card">
          <template #header>
            <div class="card-header">
              <el-icon><Calendar /></el-icon>
              <span>桩位时段占用情况</span>
            </div>
          </template>
          <el-form label-width="100px">
            <el-form-item label="选择桩位">
              <el-select
                v-model="visualizationPileId"
                placeholder="请选择桩位"
                style="width: 100%"
                @change="loadOccupiedSlots"
              >
                <el-option
                  v-for="pile in scheduleStore.piles"
                  :key="pile.id"
                  :label="`${pile.code} - ${pile.location}`"
                  :value="pile.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="选择日期">
              <el-date-picker
                v-model="visualizationDate"
                type="date"
                placeholder="选择日期"
                style="width: 100%"
                value-format="YYYY-MM-DD"
                @change="loadOccupiedSlots"
              />
            </el-form-item>
          </el-form>

          <div v-if="visualizationPileId" class="timeline-container">
            <div class="timeline-header">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>24:00</span>
            </div>
            <div class="timeline-track">
              <div
                v-for="slot in occupiedSlots"
                :key="slot.id"
                class="timeline-slot occupied"
                :style="getSlotStyle(slot)"
              >
                <div class="slot-info">
                  <div class="slot-time">
                    {{ formatTime(slot.startTime) }} - {{ formatTime(slot.endTime) }}
                  </div>
                </div>
              </div>
              <div
                v-for="slot in availableSlots"
                :key="slot.id"
                class="timeline-slot available"
                :style="getSlotStyle(slot)"
              >
                <div class="slot-info">
                  <div class="slot-time">
                    {{ formatTime(slot.startTime) }} - {{ formatTime(slot.endTime) }}
                  </div>
                </div>
              </div>
            </div>
            <div class="timeline-legend">
              <div class="legend-item">
                <span class="legend-color occupied"></span>
                <span>已占用</span>
              </div>
              <div class="legend-item">
                <span class="legend-color available"></span>
                <span>可用</span>
              </div>
            </div>
          </div>

          <el-empty
            v-else
            description="请选择桩位查看时段占用情况"
            :image-size="100"
          />
        </el-card>

        <el-card class="available-card" style="margin-top: 20px">
          <template #header>
            <div class="card-header">
              <el-icon><Clock /></el-icon>
              <span>可用时段列表</span>
            </div>
          </template>
          <el-table
            v-if="availableSlots.length > 0"
            :data="availableSlots"
            border
            stripe
          >
            <el-table-column label="开始时间" width="180">
              <template #default="{ row }">
                {{ formatDateTime(row.startTime) }}
              </template>
            </el-table-column>
            <el-table-column label="结束时间" width="180">
              <template #default="{ row }">
                {{ formatDateTime(row.endTime) }}
              </template>
            </el-table-column>
            <el-table-column label="时长">
              <template #default="{ row }">
                {{ getDuration(row.startTime, row.endTime) }}
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="暂无可用时段" :image-size="80" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Warning, Calendar, Clock, Delete } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useConflictStore } from '@/store/conflict'
import { useScheduleStore } from '@/store/schedule'
import type { ConflictResult, TimeSlot, Booking } from '@/types'

const conflictStore = useConflictStore()
const scheduleStore = useScheduleStore()

const conflictFormRef = ref<FormInstance>()
const conflictForm = reactive({
  pileId: '',
  startTime: '',
  endTime: '',
  isEmergency: false
})

const conflictRules: FormRules = {
  pileId: [{ required: true, message: '请选择桩位', trigger: 'change' }],
  startTime: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
  endTime: [{ required: true, message: '请选择结束时间', trigger: 'change' }]
}

const conflictResult = ref<ConflictResult | null>(null)
const selectedBookingId = ref('')
const visualizationPileId = ref('')
const visualizationDate = ref(dayjs().format('YYYY-MM-DD'))
const occupiedSlots = ref<TimeSlot[]>([])
const availableSlots = ref<TimeSlot[]>([])

const activeBookings = computed(() => {
  return scheduleStore.bookings.filter(
    (b: Booking) => b.status !== 'cancelled' && b.status !== 'completed'
  )
})

const formatDateTime = (dateStr: string): string => {
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm')
}

const formatTime = (dateStr: string): string => {
  return dayjs(dateStr).format('HH:mm')
}

const getDuration = (start: string, end: string): string => {
  const duration = dayjs(end).diff(dayjs(start), 'minute')
  const hours = Math.floor(duration / 60)
  const minutes = duration % 60
  if (hours > 0) {
    return `${hours}小时${minutes}分钟`
  }
  return `${minutes}分钟`
}

const getSlotStyle = (slot: TimeSlot) => {
  const startDate = dayjs(slot.startTime)
  const endDate = dayjs(slot.endTime)
  const dayStart = startDate.startOf('day')
  
  const startPercent = startDate.diff(dayStart, 'minute') / (24 * 60) * 100
  const endPercent = endDate.diff(dayStart, 'minute') / (24 * 60) * 100
  const width = endPercent - startPercent
  
  return {
    left: `${startPercent}%`,
    width: `${width}%`
  }
}

const handlePileChange = () => {
  conflictResult.value = null
}

const handleCheckConflict = () => {
  if (!conflictFormRef.value) return
  
  conflictFormRef.value.validate((valid) => {
    if (valid) {
      conflictResult.value = conflictStore.checkBookingConflict(
        conflictForm.pileId,
        conflictForm.startTime,
        conflictForm.endTime
      )
      if (conflictResult.value.hasConflict) {
        ElMessage.warning(conflictResult.value.message)
      } else {
        ElMessage.success(conflictResult.value.message)
      }
    }
  })
}

const handleFullValidation = () => {
  if (!conflictFormRef.value) return
  
  conflictFormRef.value.validate((valid) => {
    if (valid) {
      conflictResult.value = conflictStore.fullBookingValidation(
        conflictForm.pileId,
        conflictForm.startTime,
        conflictForm.endTime,
        conflictForm.isEmergency
      )
      if (conflictResult.value.hasConflict) {
        ElMessage.warning(conflictResult.value.message)
      } else {
        ElMessage.success(conflictResult.value.message)
      }
    }
  })
}

const handleQueryAvailable = () => {
  if (!conflictForm.pileId) {
    ElMessage.warning('请先选择桩位')
    return
  }
  
  const pile = scheduleStore.getPileById(conflictForm.pileId)
  if (!pile) {
    ElMessage.error('桩位不存在')
    return
  }
  
  const queryDate = conflictForm.startTime 
    ? dayjs(conflictForm.startTime).format('YYYY-MM-DD')
    : visualizationDate.value
  
  availableSlots.value = conflictStore.getPileAvailableTimeSlots(
    conflictForm.pileId,
    pile.openTimeSlots,
    queryDate
  )
  
  visualizationPileId.value = conflictForm.pileId
  visualizationDate.value = queryDate
  loadOccupiedSlots()
  
  ElMessage.success(`查询到 ${availableSlots.value.length} 个可用时段`)
}

const handleReleaseBooking = () => {
  if (!selectedBookingId.value) {
    ElMessage.warning('请选择要取消的预约')
    return
  }
  
  const success = conflictStore.releaseBookingSlot(selectedBookingId.value)
  if (success) {
    ElMessage.success('预约已取消，时段已释放')
    selectedBookingId.value = ''
    conflictStore.loadBookings()
    scheduleStore.loadData()
    if (visualizationPileId.value) {
      loadOccupiedSlots()
    }
  } else {
    ElMessage.error('取消预约失败')
  }
}

const loadOccupiedSlots = () => {
  if (!visualizationPileId.value) return
  
  occupiedSlots.value = conflictStore.getPileOccupiedTimeSlots(
    visualizationPileId.value,
    visualizationDate.value
  )
  
  const pile = scheduleStore.getPileById(visualizationPileId.value)
  if (pile) {
    availableSlots.value = conflictStore.getPileAvailableTimeSlots(
      visualizationPileId.value,
      pile.openTimeSlots,
      visualizationDate.value
    )
  }
}

onMounted(() => {
  conflictStore.loadBookings()
  scheduleStore.loadData()
})
</script>

<style scoped lang="scss">
.conflict-page {
  padding: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 16px;
}

.conflict-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px dashed #e4e7ed;
  
  &:last-child {
    border-bottom: none;
  }
  
  .time {
    margin-left: auto;
    color: #909399;
    font-size: 13px;
  }
}

.timeline-container {
  margin-top: 20px;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  padding: 0 8px;
  margin-bottom: 8px;
  font-size: 12px;
  color: #909399;
}

.timeline-track {
  position: relative;
  height: 60px;
  background: #f5f7fa;
  border-radius: 6px;
  border: 1px solid #e4e7ed;
}

.timeline-slot {
  position: absolute;
  top: 8px;
  bottom: 8px;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
  
  &.occupied {
    background: linear-gradient(135deg, #f56c6c 0%, #c45656 100%);
  }
  
  &.available {
    background: linear-gradient(135deg, #67c23a 0%, #529b2e 100%);
  }
  
  &:hover {
    transform: scaleY(1.1);
    z-index: 10;
  }
}

.slot-info {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 12px;
}

.slot-time {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 8px;
}

.timeline-legend {
  display: flex;
  gap: 24px;
  margin-top: 12px;
  justify-content: center;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  
  &.occupied {
    background: #f56c6c;
  }
  
  &.available {
    background: #67c23a;
  }
}

.form-card,
.release-card,
.visualization-card,
.available-card {
  margin-bottom: 20px;
}
</style>
