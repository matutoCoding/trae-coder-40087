<template>
  <div class="queue-page">
    <el-row :gutter="20">
      <el-col :span="8">
        <el-card class="current-call-card" shadow="always">
          <template #header>
            <div class="card-header">
              <el-icon><Bell /></el-icon>
              <span>当前叫号</span>
            </div>
          </template>
          <div class="current-call-content">
            <div v-if="queueStore.currentCalledItem" class="calling">
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
              <el-button
                type="success"
                size="large"
                @click="handleCompleteCurrent"
              >
                完成叫号
              </el-button>
            </div>
            <div v-else class="no-calling">
              <el-icon :size="80" color="#dcdfe6"><User /></el-icon>
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
              :disabled="queueStats.totalWaiting === 0"
              @click="handleCallNext"
            >
              <el-icon><Right /></el-icon>
              叫下一位
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
                  <el-icon><Charger /></el-icon>
                  <span>{{ item.pileCode }}</span>
                  <span class="duration">预计 {{ item.expectedDuration }} 分钟</span>
                </div>
                <div class="time-info">
                  <el-icon><Clock /></el-icon>
                  <span>{{ formatTime(item.createdAt) }}</span>
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
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import {
  Bell,
  User,
  DataAnalysis,
  Operation,
  Right,
  Tickets,
  List,
  Charger,
  Clock
} from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useQueueStore } from '@/store/queue'
import { usePriorityStore } from '@/store/priority'
import { useScheduleStore } from '@/store/schedule'
import { getUsers } from '@/utils/storage'
import type { User, QueueItem } from '@/types'

const queueStore = useQueueStore()
const priorityStore = usePriorityStore()
const scheduleStore = useScheduleStore()

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

const updateStats = () => {
  queueStats.value = queueStore.getQueueStats()
}

const formatTime = (dateStr: string): string => {
  return dayjs(dateStr).format('HH:mm:ss')
}

const getQueueNumber = (item: QueueItem): string => {
  const prefix = item.isEmergency ? 'E' : item.isVip ? 'V' : 'N'
  return `${prefix}${item.id.slice(-4).toUpperCase()}`
}

const handlePileChange = (pileId: string) => {
  const pile = scheduleStore.getPileById(pileId)
  if (pile) {
    queueForm.pileCode = pile.code
  }
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
  if (result) {
    ElMessage.success(`已叫号：${getQueueNumber(result)} - ${result.userName}`)
    updateStats()
  } else {
    ElMessage.warning('暂无等待人员')
  }
}

const handleCompleteCurrent = () => {
  if (!queueStore.currentCalledItem) return

  const success = queueStore.completeQueue(queueStore.currentCalledItem.id)
  if (success) {
    ElMessage.success('叫号已完成')
    updateStats()
  } else {
    ElMessage.error('操作失败')
  }
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

watch(
  () => queueStore.queueItems,
  () => {
    updateStats()
  },
  { deep: true }
)

onMounted(() => {
  queueStore.loadQueue()
  scheduleStore.loadData()
  users.value = getUsers()
  updateStats()
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

      .label {
        width: 60px;
        opacity: 0.8;
      }

      .value {
        flex: 1;
      }
    }
  }
}

.no-calling {
  color: rgba(255, 255, 255, 0.7);

  p {
    margin: 16px 0 8px;
    font-size: 18px;
  }

  .hint {
    font-size: 14px;
    opacity: 0.7;
  }
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

.stats-card {
  margin-top: 20px;

  .stat-item {
    text-align: center;
    padding: 16px 8px;
    border-radius: 8px;

    &.emergency {
      background: linear-gradient(135deg, #fef0f0 0%, #fde2e2 100%);

      .stat-value {
        color: #f56c6c;
      }
    }

    &.vip {
      background: linear-gradient(135deg, #fdf6ec 0%, #faecd8 100%);

      .stat-value {
        color: #e6a23c;
      }
    }

    &.normal {
      background: linear-gradient(135deg, #f4f4f5 0%, #e9e9eb 100%);

      .stat-value {
        color: #909399;
      }
    }

    .stat-value {
      font-size: 32px;
      font-weight: bold;
      line-height: 1.2;
    }

    .stat-label {
      font-size: 13px;
      margin-top: 4px;
      color: #606266;
    }
  }

  .total-waiting {
    text-align: center;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px dashed #e4e7ed;
    color: #606266;

    .highlight {
      color: #409eff;
      font-size: 20px;
      font-weight: bold;
    }
  }
}

.action-card {
  margin-top: 20px;

  .action-buttons {
    display: flex;
    justify-content: center;

    .el-button {
      width: 100%;
      height: 50px;
      font-size: 18px;
    }
  }
}

.form-card {
  min-height: 400px;

  .user-option {
    display: flex;
    align-items: center;
    gap: 8px;

    .room {
      color: #909399;
      font-size: 13px;
    }

    .el-tag {
      margin-left: auto;
    }
  }

  .unit {
    margin-left: 8px;
    color: #909399;
  }

  .hint-text {
    margin-left: 8px;
    color: #909399;
    font-size: 12px;
  }
}

.queue-list-card {
  :deep(.el-card__header) {
    display: flex;
    align-items: center;
  }

  .queue-list {
    max-height: 600px;
    overflow-y: auto;
  }

  .queue-item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    border-radius: 8px;
    margin-bottom: 12px;
    background: #fafafa;
    border: 1px solid #e4e7ed;
    transition: all 0.2s;

    &:hover {
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
    }

    &.first {
      background: linear-gradient(135deg, #ecf5ff 0%, #d9ecff 100%);
      border-color: #a0cfff;

      .first-badge {
        background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
        color: #fff;
      }
    }

    .queue-number {
      .badge {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: #e4e7ed;
        color: #606266;
        font-weight: bold;
        font-size: 16px;
      }
    }

    .queue-info {
      flex: 1;

      .user-info {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;

        .user-name {
          font-weight: 600;
          color: #303133;
        }

        .room-number {
          color: #909399;
          font-size: 13px;
        }
      }

      .pile-info,
      .time-info {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: #606266;
        margin-top: 4px;

        .el-icon {
          font-size: 14px;
        }

        .duration {
          margin-left: auto;
          color: #909399;
        }
      }
    }

    .queue-actions {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
    }
  }
}
</style>
