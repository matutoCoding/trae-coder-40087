<template>
  <div class="queue-page">
    <el-row :gutter="20">
      <el-col :span="8">
        <el-card class="current-call-card" shadow="always">
          <template #header>
            <div class="card-header">
              <el-icon><Bell /></el-icon>
              <span>当前叫号 / 充电中</span>
            </div>
          </template>
          <div class="current-call-content">
            <div v-if="activeTask" class="charging">
              <div class="calling-label charging-label">
                <el-icon :size="24"><Lightning /></el-icon>
                充电进行中
              </div>
              <div class="task-info">
                <div class="info-row">
                  <span class="label">用户：</span>
                  <span class="value">{{ activeTask.userName }}（{{ activeTask.roomNumber }}）</span>
                </div>
                <div class="info-row">
                  <span class="label">桩位：</span>
                  <span class="value">{{ activeTask.pileCode }}</span>
                </div>
                <div class="info-row">
                  <span class="label">来源：</span>
                  <el-tag size="small" :type="activeTask.source === 'queue' ? 'warning' : 'success'" effect="dark">
                    {{ activeTask.source === 'queue' ? '排队叫号' : '预约' }}
                  </el-tag>
                </div>
                <div class="info-row">
                  <span class="label">开始：</span>
                  <span class="value">{{ formatDateTime(activeTask.actualStartTime || '') }}</span>
                </div>
                <div class="info-row">
                  <span class="label">已充电：</span>
                  <span class="value highlight">{{ elapsedText }}</span>
                </div>
                <div class="info-row" v-if="activeTask.powerConsumed">
                  <span class="label">预估电量：</span>
                  <span class="value">{{ activeTask.powerConsumed.toFixed(2) }} kWh</span>
                </div>
              </div>
              <el-button type="warning" size="large" @click="handleFinishCharging">
                <el-icon><SwitchButton /></el-icon>
                结束充电
              </el-button>
            </div>

            <div v-else-if="queueStore.currentCalledItem" class="calling">
              <div class="calling-label">正在叫号</div>
              <div class="calling-number">
                {{ getQueueNumber(queueStore.currentCalledItem) }}
              </div>
              <div class="calling-info">
                <div class="info-row">
                  <span class="label">用户：</span>
                  <span class="value">{{ queueStore.currentCalledItem.userName }}</span>
                </div>
                <div class="info-row">
                  <span class="label">房号：</span>
                  <span class="value">{{ queueStore.currentCalledItem.roomNumber }}</span>
                </div>
                <div class="info-row">
                  <span class="label">桩位：</span>
                  <span class="value">{{ queueStore.currentCalledItem.pileCode }}</span>
                </div>
                <div class="info-row">
                  <span class="label">等待：</span>
                  <span class="value">{{ queueStore.currentCalledItem.waitingMinutes || 0 }} 分钟</span>
                </div>
                <div class="info-row">
                  <span class="label">优先级：</span>
                  <el-tag
                    :color="priorityStore.getPriorityColor(queueStore.currentCalledItem.priority)"
                    effect="dark"
                    size="large"
                  >
                    {{ priorityStore.getPriorityLabel(queueStore.currentCalledItem.priority) }}
                  </el-tag>
                </div>
              </div>
              <div class="action-group">
                <el-button type="success" size="large" @click="handleStartCharging">
                  <el-icon><VideoPlay /></el-icon>
                  用户到场，开始充电
                </el-button>
                <el-button size="large" @click="handleCompleteCurrent">
                  跳过叫号
                </el-button>
              </div>
            </div>

            <div v-else class="no-calling">
              <el-icon :size="80" color="rgba(255,255,255,0.5)"><UserIcon /></el-icon>
              <p>暂无叫号</p>
              <p class="hint">点击下方按钮开始叫号</p>
            </div>
          </div>
        </el-card>

        <el-card class="stats-card" shadow="always">
          <template #header>
            <div class="card-header">
              <el-icon><DataAnalysis /></el-icon>
              <span>队列统计</span>
            </div>
          </template>
          <el-row :gutter="12">
            <el-col :span="8">
              <div class="stat-item emergency">
                <div class="stat-value">{{ queueStats.emergencyCount }}</div>
                <div class="stat-label">应急</div>
              </div>
            </el-col>
            <el-col :span="8">
              <div class="stat-item vip">
                <div class="stat-value">{{ queueStats.vipCount }}</div>
                <div class="stat-label">VIP</div>
              </div>
            </el-col>
            <el-col :span="8">
              <div class="stat-item normal">
                <div class="stat-value">{{ queueStats.normalCount }}</div>
                <div class="stat-label">普通</div>
              </div>
            </el-col>
          </el-row>
          <div class="total-waiting">
            等待总数：<span class="highlight">{{ queueStats.totalWaiting }}</span> 人
          </div>
          <el-divider />
          <div class="extra-stats">
            <div class="extra-stat">
              <span class="label">平均等待时长</span>
              <span class="value">{{ avgWaitingMin }} 分钟</span>
            </div>
            <div class="extra-stat">
              <span class="label">当前充电中</span>
              <span class="value">{{ chargingCount }} 个任务</span>
            </div>
          </div>
        </el-card>

        <el-card class="action-card" shadow="always">
          <template #header>
            <div class="card-header">
              <el-icon><Operation /></el-icon>
              <span>叫号操作</span>
            </div>
          </template>
          <div class="action-buttons">
            <el-button
              type="primary"
              size="large"
              :disabled="queueStats.totalWaiting === 0 || activeTask != null"
              @click="handleCallNext"
            >
              <el-icon><Right /></el-icon>
              叫下一位
            </el-button>
          </div>
          <div class="refresher" style="margin-top: 12px; text-align: center">
            <el-button link type="primary" @click="handleRefresh">
              <el-icon><Refresh /></el-icon>
              刷新数据
            </el-button>
          </div>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card class="form-card">
          <template #header>
            <div class="card-header">
              <el-icon><Tickets /></el-icon>
              <span>取号排队</span>
            </div>
          </template>
          <el-form
            ref="queueFormRef"
            :model="queueForm"
            :rules="queueRules"
            label-width="100px"
          >
            <el-form-item label="选择用户" prop="userId">
              <el-select
                v-model="queueForm.userId"
                placeholder="请选择用户"
                style="width: 100%"
                filterable
              >
                <el-option
                  v-for="user in users"
                  :key="user.id"
                  :label="`${user.name} (${user.roomNumber})`"
                  :value="user.id"
                >
                  <div class="user-option">
                    <span>{{ user.name }}</span>
                    <span class="room">{{ user.roomNumber }}</span>
                    <el-tag v-if="user.isVip" type="warning" size="small">VIP</el-tag>
                  </div>
                </el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="选择桩位" prop="pileId">
              <el-select
                v-model="queueForm.pileId"
                placeholder="请选择桩位"
                style="width: 100%"
                @change="handlePileChange"
              >
                <el-option
                  v-for="pile in bookablePiles"
                  :key="pile.id"
                  :label="`${pile.code} - ${pile.location}`"
                  :value="pile.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="充电时长" prop="expectedDuration">
              <el-input-number
                v-model="queueForm.expectedDuration"
                :min="15"
                :max="480"
                :step="15"
                style="width: 100%"
                controls-position="right"
              />
              <span class="unit">分钟</span>
            </el-form-item>
            <el-form-item label="是否应急">
              <el-switch v-model="queueForm.isEmergency" />
              <span class="hint-text">（应急充电将获得最高优先级）</span>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleJoinQueue">
                取号排队
              </el-button>
              <el-button @click="resetForm">
                重置
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card class="queue-list-card" shadow="always">
          <template #header>
            <div class="card-header">
              <el-icon><List /></el-icon>
              <span>排队队列</span>
              <el-tag type="info" style="margin-left: auto">
                {{ queueStore.waitingQueue.length }} 人等待
              </el-tag>
            </div>
          </template>
          <div class="queue-list">
            <div
              v-for="(item, index) in queueStore.waitingQueue"
              :key="item.id"
              class="queue-item"
              :class="{ 'first': index === 0 }"
            >
              <div class="queue-number">
                <span v-if="index === 0" class="badge first-badge">1</span>
                <span v-else class="badge">{{ index + 1 }}</span>
              </div>
              <div class="queue-info">
                <div class="user-info">
                  <span class="user-name">{{ item.userName }}</span>
                  <span class="room-number">{{ item.roomNumber }}</span>
                </div>
                <div class="pile-info">
                  <el-icon><Connection /></el-icon>
                  <span>{{ item.pileCode }}</span>
                  <span class="duration">预计 {{ item.expectedDuration }} 分钟</span>
                </div>
                <div class="time-info">
                  <el-icon><Clock /></el-icon>
                  <span>取号 {{ formatTime(item.createdAt) }}</span>
                </div>
              </div>
              <div class="queue-actions">
                <el-tag
                  :color="priorityStore.getPriorityColor(item.priority)"
                  effect="light"
                  size="small"
                >
                  {{ priorityStore.getPriorityLabel(item.priority) }}
                </el-tag>
                <el-button
                  type="danger"
                  size="small"
                  text
                  @click="handleCancelQueue(item.id)"
                >
                  取消
                </el-button>
              </div>
            </div>
            <el-empty
              v-if="queueStore.waitingQueue.length === 0"
              description="暂无排队人员"
              :image-size="100"
            />
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import {
  Bell,
  User as UserIcon,
  DataAnalysis,
  Operation,
  Right,
  Tickets,
  List,
  Connection,
  Clock,
  Lightning,
  VideoPlay,
  SwitchButton,
  Refresh
} from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useQueueStore } from '@/store/queue'
import { usePriorityStore } from '@/store/priority'
import { useScheduleStore } from '@/store/schedule'
import { useTaskStore } from '@/store/task'
import { getUsers } from '@/utils/storage'
import type { User, QueueItem, ChargingTask } from '@/types'

const queueStore = useQueueStore()
const priorityStore = usePriorityStore()
const scheduleStore = useScheduleStore()
const taskStore = useTaskStore()

const bookablePiles = computed(() =>
  scheduleStore.piles.filter(p => p.isOpenToPublic && p.status === 'available')
)

const queueFormRef = ref<FormInstance>()
const users = ref<User[]>([])
const queueStats = ref({
  totalWaiting: 0,
  emergencyCount: 0,
  vipCount: 0,
  normalCount: 0
})
const elapsedSeconds = ref(0)
let timer: any = null

const queueForm = reactive({
  userId: '',
  pileId: '',
  pileCode: '',
  expectedDuration: 60,
  isEmergency: false
})

const queueRules: FormRules = {
  userId: [{ required: true, message: '请选择用户', trigger: 'change' }],
  pileId: [{ required: true, message: '请选择桩位', trigger: 'change' }],
  expectedDuration: [
    { required: true, message: '请输入充电时长', trigger: 'blur' },
    { type: 'number', min: 15, max: 480, message: '时长需在15-480分钟之间', trigger: 'blur' }
  ]
}

const activeTask = computed<ChargingTask | null>(() => {
  taskStore.loadTasks()
  const chargingTask = taskStore.tasks.find(t => t.status === 'charging')
  if (chargingTask) {
    if (!queueStore.currentCalledItem && chargingTask.queueItemId) {
      const qi = queueStore.queueItems.find(q => q.id === chargingTask.queueItemId)
      if (qi && qi.status === 'called') {
        queueStore.currentCalledItem = qi
      }
    }
    return chargingTask
  }
  const called = queueStore.currentCalledItem
  if (called?.taskId) {
    const t = taskStore.tasks.find(x => x.id === called.taskId && x.status === 'waiting')
    if (t) return null
  }
  return null
})

const chargingCount = computed(() =>
  taskStore.tasks.filter(t => t.status === 'charging').length
)

const avgWaitingMin = computed(() => queueStore.getAverageWaitingMinutes())

const elapsedText = computed(() => {
  if (!activeTask.value?.actualStartTime) return '--'
  const sec = elapsedSeconds.value
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}小时${m}分${s}秒`
  if (m > 0) return `${m}分${s}秒`
  return `${s}秒`
})

const _tickElapsed = () => {
  if (activeTask.value?.actualStartTime) {
    elapsedSeconds.value = Math.max(0, Math.floor(
      (Date.now() - new Date(activeTask.value.actualStartTime).getTime()) / 1000
    ))
  } else {
    elapsedSeconds.value = 0
  }
}

const updateStats = () => {
  queueStats.value = queueStore.getQueueStats()
}

const formatTime = (dateStr: string): string => dayjs(dateStr).format('HH:mm:ss')
const formatDateTime = (dateStr: string): string => {
  if (!dateStr) return '--'
  return dayjs(dateStr).format('MM-DD HH:mm:ss')
}

const getQueueNumber = (item: QueueItem): string => {
  const prefix = item.isEmergency ? 'E' : item.isVip ? 'V' : 'N'
  return `${prefix}${item.id.slice(-4).toUpperCase()}`
}

const handlePileChange = (pileId: string) => {
  const pile = scheduleStore.getPileById(pileId)
  if (pile) queueForm.pileCode = pile.code
}

const handleJoinQueue = () => {
  if (!queueFormRef.value) return
  queueFormRef.value.validate((valid) => {
    if (valid) {
      if (!queueStore.isPileAvailable(queueForm.pileId)) {
        ElMessage.error('该桩位当前不可用（可能已改为仅自用或维护中），请选择其他桩位')
        return
      }
      const result = queueStore.joinQueue(
        queueForm.userId,
        queueForm.pileId,
        queueForm.pileCode,
        queueForm.isEmergency,
        queueForm.expectedDuration
      )
      if (result) {
        ElMessage.success(`取号成功，您的号码是：${getQueueNumber(result)}`)
        updateStats()
        resetForm()
      } else {
        ElMessage.error('取号失败，请检查桩位是否可用或您是否已在队列中')
      }
    }
  })
}

const handleCallNext = () => {
  const result = queueStore.callNext()
  taskStore.loadTasks()
  if (result) {
    ElMessage.success(`已叫号：${getQueueNumber(result)} - ${result.userName}`)
    updateStats()
  } else {
    ElMessage.warning('暂无等待人员，或所有匹配桩位不可用')
  }
}

const handleStartCharging = () => {
  const called = queueStore.currentCalledItem
  if (!called) return
  taskStore.loadTasks()
  const task = called.taskId
    ? taskStore.tasks.find(t => t.id === called.taskId)
    : taskStore.tasks.find(t =>
        t.bookingId === called.bookingId || t.queueItemId === called.id
      )
  if (!task) {
    ElMessage.error('未找到对应的充电任务，请尝试刷新数据')
    return
  }
  ElMessageBox.confirm(
    `确认用户 ${called.userName} 已到场，在桩位 ${called.pileCode} 开始充电？`,
    '开始充电确认',
    { type: 'success', confirmButtonText: '开始充电' }
  )
    .then(() => {
      const result = taskStore.startCharging(task.id)
      if (result) {
        queueStore.loadQueue()
        scheduleStore.loadData()
        _tickElapsed()
        ElMessage.success('充电已开始')
      } else {
        ElMessage.error('开始充电失败，请检查任务状态')
      }
    })
    .catch(() => {})
}

const handleFinishCharging = () => {
  if (!activeTask.value) return
  ElMessageBox.confirm(
    `确认结束 ${activeTask.value.userName} 的充电？将释放桩位并自动叫号下一位。`,
    '结束充电确认',
    { type: 'warning', confirmButtonText: '确认结束' }
  )
    .then(() => {
      const result = taskStore.finishCharging(activeTask.value!.id)
      if (result) {
        if (result.queueItemId) {
          queueStore.completeQueue(result.queueItemId)
        }
        taskStore.loadTasks()
        queueStore.loadQueue()
        scheduleStore.loadData()
        elapsedSeconds.value = 0
        ElMessage.success(
          `充电已完成，耗时约 ${Math.max(1, Math.round(((result.actualEndTime ? new Date(result.actualEndTime).getTime() : Date.now()) - new Date(result.actualStartTime || Date.now()).getTime()) / 60000))} 分钟，消耗 ${(result.powerConsumed || 0).toFixed(2)} kWh`
        )
        updateStats()
      } else {
        ElMessage.error('结束充电失败')
      }
    })
    .catch(() => {})
}

const handleCompleteCurrent = () => {
  if (!queueStore.currentCalledItem) return
  ElMessageBox.confirm(
    '跳过当前叫号？该用户将从叫号移除，不占用桩位。',
    '跳过叫号确认',
    { type: 'warning' }
  )
    .then(() => {
      const success = queueStore.completeQueue(queueStore.currentCalledItem!.id)
      if (success) {
        ElMessage.success('已跳过当前叫号')
        updateStats()
      } else {
        ElMessage.error('操作失败')
      }
    })
    .catch(() => {})
}

const handleCancelQueue = (queueId: string) => {
  const success = queueStore.cancelQueue(queueId)
  if (success) {
    ElMessage.success('已取消排队')
    updateStats()
  } else {
    ElMessage.error('取消失败')
  }
}

const resetForm = () => {
  queueForm.userId = ''
  queueForm.pileId = ''
  queueForm.pileCode = ''
  queueForm.expectedDuration = 60
  queueForm.isEmergency = false
  queueFormRef.value?.resetFields()
}

const handleRefresh = () => {
  queueStore.loadQueue()
  scheduleStore.loadData()
  taskStore.loadTasks()
  updateStats()
  _tickElapsed()
  ElMessage.success('数据已刷新')
}

watch(
  () => queueStore.queueItems,
  () => updateStats(),
  { deep: true }
)

watch(
  () => queueStore.currentCalledItem,
  () => {
    _tickElapsed()
  }
)

onMounted(() => {
  queueStore.loadQueue()
  scheduleStore.loadData()
  taskStore.loadTasks()
  users.value = getUsers()
  updateStats()
  _tickElapsed()
  timer = setInterval(_tickElapsed, 1000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped lang="scss">
.queue-page {
  padding: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 16px;
}

.current-call-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;

  :deep(.el-card__header) {
    background: rgba(255, 255, 255, 0.1);
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    color: #fff;
  }

  .el-icon {
    color: #fff;
  }
}

.current-call-content {
  text-align: center;
  min-height: 300px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.charging {
  .calling-label.charging-label {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 20px;
    margin-bottom: 20px;
    color: #fde68a;
    font-weight: 600;
  }
  .task-info {
    background: rgba(255,255,255,0.15);
    border-radius: 12px;
    padding: 18px 20px;
    margin-bottom: 24px;
    text-align: left;
    .info-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 7px 0;
      .label { width: 80px; opacity: 0.85; }
      .value { flex: 1; }
      .value.highlight {
        color: #fff7ed;
        font-weight: 600;
        font-size: 16px;
      }
    }
  }
}

.calling {
  .calling-label {
    font-size: 18px;
    margin-bottom: 16px;
    opacity: 0.9;
  }
  .calling-number {
    font-size: 72px;
    font-weight: bold;
    margin-bottom: 24px;
    text-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    animation: pulse 2s infinite;
  }
  .calling-info {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 24px;
    text-align: left;
    .info-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
      .label { width: 60px; opacity: 0.8; }
      .value { flex: 1; }
    }
  }
  .action-group {
    display: flex;
    gap: 10px;
    justify-content: center;
    flex-wrap: wrap;
  }
}

.no-calling {
  color: rgba(255, 255, 255, 0.7);
  p { margin: 16px 0 8px; font-size: 18px; }
  .hint { font-size: 14px; opacity: 0.7; }
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.stats-card {
  margin-top: 20px;
  .stat-item {
    text-align: center;
    padding: 16px 8px;
    border-radius: 8px;
    &.emergency {
      background: linear-gradient(135deg, #fef0f0 0%, #fde2e2 100%);
      .stat-value { color: #f56c6c; }
    }
    &.vip {
      background: linear-gradient(135deg, #fdf6ec 0%, #faecd8 100%);
      .stat-value { color: #e6a23c; }
    }
    &.normal {
      background: linear-gradient(135deg, #f4f4f5 0%, #e9e9eb 100%);
      .stat-value { color: #909399; }
    }
    .stat-value { font-size: 32px; font-weight: bold; }
    .stat-label { font-size: 13px; color: #606266; margin-top: 4px; }
  }
  .total-waiting {
    margin-top: 14px;
    text-align: center;
    padding: 10px;
    background: #f0f9ff;
    border-radius: 6px;
    font-size: 14px;
    color: #606266;
    .highlight { color: #409eff; font-weight: bold; font-size: 18px; }
  }
  .extra-stats {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    .extra-stat {
      flex: 1;
      padding: 10px;
      background: #fafafa;
      border-radius: 6px;
      text-align: center;
      .label { display: block; color: #909399; font-size: 12px; margin-bottom: 4px; }
      .value { color: #303133; font-weight: 600; font-size: 15px; }
    }
  }
}

.action-card {
  margin-top: 20px;
  .action-buttons {
    text-align: center;
    padding: 10px 0;
  }
}

.form-card,
.queue-list-card {
  height: 100%;
  .user-option {
    display: flex;
    align-items: center;
    gap: 10px;
    .room { color: #909399; font-size: 12px; }
  }
  .unit {
    margin-left: 8px;
    color: #909399;
    font-size: 12px;
  }
  .hint-text {
    margin-left: 10px;
    color: #909399;
    font-size: 12px;
  }
}

.queue-list {
  max-height: 620px;
  overflow-y: auto;
  .queue-item {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px;
    border: 1px solid #ebeef5;
    border-radius: 10px;
    margin-bottom: 10px;
    transition: all 0.2s;
    &.first {
      background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
      border-color: #6ee7b7;
    }
    &:hover {
      box-shadow: 0 3px 10px rgba(0,0,0,0.06);
    }
    .queue-number {
      .badge {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #f0f2f5;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        color: #606266;
        &.first-badge {
          background: #409eff;
          color: #fff;
          box-shadow: 0 2px 8px rgba(64,158,255,0.35);
        }
      }
    }
    .queue-info {
      flex: 1;
      min-width: 0;
      .user-info {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
        .user-name { font-weight: 600; color: #303133; }
        .room-number { color: #909399; font-size: 12px; }
      }
      .pile-info, .time-info {
        display: flex;
        align-items: center;
        gap: 4px;
        color: #606266;
        font-size: 12px;
        margin-top: 2px;
        .duration { margin-left: 10px; color: #909399; }
      }
    }
    .queue-actions {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 6px;
    }
  }
}
</style>
