<template>
  <div class="priority-container">
    <el-alert
      title="优先级说明"
      type="info"
      :closable="false"
      show-icon
      class="priority-alert"
    >
      <template #default>
        <div class="priority-info">
          <el-tag color="#f56c6c" effect="dark">应急 = 100</el-tag>
          <el-tag color="#e6a23c" effect="dark">VIP = 50</el-tag>
          <el-tag color="#909399" effect="dark">普通 = 10</el-tag>
          <span class="priority-desc">优先级数值越高，排队越靠前</span>
        </div>
      </template>
    </el-alert>

    <div class="action-bar">
      <el-button type="primary" @click="handleRecalculate">
        <el-icon><Refresh /></el-icon>
        重新计算所有优先级
      </el-button>
      <el-button type="success" @click="handleReorder">
        <el-icon><Sort /></el-icon>
        队列重新排序
      </el-button>
      <el-tag type="danger" v-if="emergencyCount > 0">
        应急: {{ emergencyCount }} 人
      </el-tag>
      <el-tag type="warning" v-if="vipCount > 0">
        VIP: {{ vipCount }} 人
      </el-tag>
      <el-tag type="info">
        等待中: {{ waitingQueue.length }} 人
      </el-tag>
    </div>

    <el-row :gutter="20" class="form-section">
      <el-col :span="12">
        <el-card class="form-card">
          <template #header>
            <div class="card-header">
              <el-icon color="#e6a23c"><Medal /></el-icon>
              <span>VIP 插队</span>
            </div>
          </template>
          <el-form :model="vipForm" :rules="vipRules" ref="vipFormRef" label-width="80px">
            <el-form-item label="VIP用户" prop="userId">
              <el-select v-model="vipForm.userId" placeholder="请选择VIP用户" style="width: 100%">
                <el-option
                  v-for="user in vipUsers"
                  :key="user.id"
                  :label="`${user.name} (${user.roomNumber})`"
                  :value="user.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="桩位" prop="pileId">
              <el-select v-model="vipForm.pileId" placeholder="请选择桩位" style="width: 100%">
                <el-option
                  v-for="pile in availablePiles"
                  :key="pile.id"
                  :label="`${pile.code} - ${pile.location}`"
                  :value="pile.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="时长" prop="expectedDuration">
              <el-input-number
                v-model="vipForm.expectedDuration"
                :min="15"
                :max="240"
                :step="15"
                style="width: 100%"
              />
              <span class="unit">分钟</span>
            </el-form-item>
            <el-form-item>
              <el-button type="warning" @click="handleVipInsert" style="width: 100%">
                <el-icon><Medal /></el-icon>
                VIP 插队加入队列
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card class="form-card">
          <template #header>
            <div class="card-header">
              <el-icon color="#f56c6c"><Warning /></el-icon>
              <span>应急充电插队</span>
            </div>
          </template>
          <el-form :model="emergencyForm" :rules="emergencyRules" ref="emergencyFormRef" label-width="80px">
            <el-form-item label="用户" prop="userId">
              <el-select v-model="emergencyForm.userId" placeholder="请选择用户" style="width: 100%">
                <el-option
                  v-for="user in allUsers"
                  :key="user.id"
                  :label="`${user.name} (${user.roomNumber})`"
                  :value="user.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="桩位" prop="pileId">
              <el-select v-model="emergencyForm.pileId" placeholder="请选择桩位" style="width: 100%">
                <el-option
                  v-for="pile in availablePiles"
                  :key="pile.id"
                  :label="`${pile.code} - ${pile.location}`"
                  :value="pile.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="时长" prop="expectedDuration">
              <el-input-number
                v-model="emergencyForm.expectedDuration"
                :min="15"
                :max="240"
                :step="15"
                style="width: 100%"
              />
              <span class="unit">分钟</span>
            </el-form-item>
            <el-form-item>
              <el-button type="danger" @click="handleEmergencyInsert" style="width: 100%">
                <el-icon><Warning /></el-icon>
                应急最高优先级插队
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="table-card">
      <template #header>
        <div class="card-header">
          <el-icon color="#409eff"><Tickets /></el-icon>
          <span>等待队列 - 升级优先级</span>
        </div>
      </template>
      <el-table :data="waitingQueue" border stripe style="width: 100%">
        <el-table-column type="index" label="序号" width="60" align="center" />
        <el-table-column prop="userName" label="姓名" width="100" />
        <el-table-column prop="roomNumber" label="房号" width="100" />
        <el-table-column prop="pileCode" label="桩位" width="100" />
        <el-table-column prop="expectedDuration" label="时长(分钟)" width="120" align="center" />
        <el-table-column label="优先级" width="120" align="center">
          <template #default="{ row }">
            <el-tag :color="getPriorityColor(row.priority)" effect="dark">
              {{ getPriorityLabel(row.priority) }} ({{ row.priority }})
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="加入时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" align="center" fixed="right">
          <template #default="{ row }">
            <el-button
              type="warning"
              size="small"
              :disabled="row.isVip || row.isEmergency"
              @click="handleUpgradeToVip(row.id)"
            >
              <el-icon><Medal /></el-icon>
              升级VIP
            </el-button>
            <el-button
              type="danger"
              size="small"
              :disabled="row.isEmergency"
              @click="handleUpgradeToEmergency(row.id)"
            >
              <el-icon><Warning /></el-icon>
              升级应急
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="waitingQueue.length === 0" description="暂无等待中的排队项" />
    </el-card>

    <el-card class="table-card">
      <template #header>
        <div class="card-header">
          <el-icon color="#909399"><Clock /></el-icon>
          <span>优先级变更历史记录</span>
          <el-button
            v-if="priorityHistory.length > 0"
            type="text"
            size="small"
            @click="handleClearHistory"
            style="margin-left: auto"
          >
            清空记录
          </el-button>
        </div>
      </template>
      <el-table :data="priorityHistory" border stripe style="width: 100%">
        <el-table-column prop="queueItemId" label="排队ID" width="140" show-overflow-tooltip />
        <el-table-column label="优先级变更" width="180" align="center">
          <template #default="{ row }">
            <el-tag :color="getPriorityColor(row.oldPriority)" effect="light" size="small">
              {{ getPriorityLabel(row.oldPriority) }} ({{ row.oldPriority }})
            </el-tag>
            <el-icon class="arrow-icon"><Right /></el-icon>
            <el-tag :color="getPriorityColor(row.newPriority)" effect="dark" size="small">
              {{ getPriorityLabel(row.newPriority) }} ({{ row.newPriority }})
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="变更原因" min-width="200" show-overflow-tooltip />
        <el-table-column prop="createdAt" label="变更时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.createdAt) }}
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="priorityHistory.length === 0" description="暂无优先级变更记录" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Refresh, Sort, Medal, Warning, Tickets, Clock, Right } from '@element-plus/icons-vue'
import { usePriorityStore } from '@/store/priority'
import { useQueueStore } from '@/store/queue'
import { getUsers, getPiles } from '@/utils/storage'
import type { User, ChargingPile } from '@/types'
import dayjs from 'dayjs'

const priorityStore = usePriorityStore()
const queueStore = useQueueStore()

const vipFormRef = ref<FormInstance>()
const emergencyFormRef = ref<FormInstance>()

const allUsers = ref<User[]>([])
const allPiles = ref<ChargingPile[]>([])

const vipForm = ref({
  userId: '',
  pileId: '',
  expectedDuration: 60
})

const emergencyForm = ref({
  userId: '',
  pileId: '',
  expectedDuration: 60
})

const vipRules: FormRules = {
  userId: [{ required: true, message: '请选择VIP用户', trigger: 'change' }],
  pileId: [{ required: true, message: '请选择桩位', trigger: 'change' }],
  expectedDuration: [{ required: true, message: '请选择充电时长', trigger: 'change' }]
}

const emergencyRules: FormRules = {
  userId: [{ required: true, message: '请选择用户', trigger: 'change' }],
  pileId: [{ required: true, message: '请选择桩位', trigger: 'change' }],
  expectedDuration: [{ required: true, message: '请选择充电时长', trigger: 'change' }]
}

const vipUsers = computed(() => allUsers.value.filter(user => user.isVip))

const availablePiles = computed(() =>
  allPiles.value.filter(pile => pile.isOpenToPublic && pile.status === 'available')
)

const waitingQueue = computed(() => queueStore.waitingQueue)

const priorityHistory = computed(() => priorityStore.priorityHistory)

const emergencyCount = computed(() => priorityStore.getEmergencyCount)

const vipCount = computed(() => priorityStore.getVipCount)

const getPriorityLabel = (priority: number): string => priorityStore.getPriorityLabel(priority)

const getPriorityColor = (priority: number): string => priorityStore.getPriorityColor(priority)

const formatTime = (time: string): string => dayjs(time).format('YYYY-MM-DD HH:mm:ss')

const loadData = () => {
  allUsers.value = getUsers()
  allPiles.value = getPiles()
  queueStore.loadQueue()
}

const handleVipInsert = async () => {
  if (!vipFormRef.value) return
  await vipFormRef.value.validate((valid) => {
    if (valid) {
      const pile = allPiles.value.find(p => p.id === vipForm.value.pileId)
      if (!pile) {
        ElMessage.error('桩位信息不存在')
        return
      }
      if (!priorityStore.isPileAvailable(vipForm.value.pileId)) {
        ElMessage.error('该桩位当前不可用（可能已改为仅自用或维护中），请选择其他桩位')
        return
      }
      const result = priorityStore.vipInsertQueue(
        vipForm.value.userId,
        vipForm.value.pileId,
        pile.code,
        vipForm.value.expectedDuration
      )
      if (result) {
        ElMessage.success('VIP插队成功，已优先加入队列')
        vipFormRef.value?.resetFields()
        vipForm.value.expectedDuration = 60
        loadData()
      } else {
        ElMessage.error('VIP插队失败，请检查用户是否为VIP或桩位是否可用')
      }
    }
  })
}

const handleEmergencyInsert = async () => {
  if (!emergencyFormRef.value) return
  await emergencyFormRef.value.validate((valid) => {
    if (valid) {
      const pile = allPiles.value.find(p => p.id === emergencyForm.value.pileId)
      if (!pile) {
        ElMessage.error('桩位信息不存在')
        return
      }
      if (!priorityStore.isPileAvailable(emergencyForm.value.pileId)) {
        ElMessage.error('该桩位当前不可用（可能已改为仅自用或维护中），请选择其他桩位')
        return
      }
      const result = priorityStore.emergencyInsertQueue(
        emergencyForm.value.userId,
        emergencyForm.value.pileId,
        pile.code,
        emergencyForm.value.expectedDuration
      )
      if (result) {
        ElMessage.success('应急插队成功，已提升至最高优先级')
        emergencyFormRef.value?.resetFields()
        emergencyForm.value.expectedDuration = 60
        loadData()
      } else {
        ElMessage.error('应急插队失败，请检查桩位是否可用')
      }
    }
  })
}

const handleUpgradeToVip = (queueId: string) => {
  const result = priorityStore.updateItemToVip(queueId)
  if (result) {
    ElMessage.success('已升级为VIP优先级')
    loadData()
  } else {
    ElMessage.error('升级失败，排队项不存在或已处理')
  }
}

const handleUpgradeToEmergency = (queueId: string) => {
  const result = priorityStore.updateItemToEmergency(queueId)
  if (result) {
    ElMessage.success('已升级为应急最高优先级')
    loadData()
  } else {
    ElMessage.error('升级失败，排队项不存在或已处理')
  }
}

const handleRecalculate = () => {
  priorityStore.recalculateAllPriorities()
  ElMessage.success('已重新计算所有优先级')
  loadData()
}

const handleReorder = () => {
  priorityStore.reorderQueue()
  ElMessage.success('队列已按优先级重新排序')
  loadData()
}

const handleClearHistory = () => {
  priorityStore.clearPriorityHistory()
  ElMessage.success('已清空历史记录')
}

onMounted(() => {
  loadData()
})
</script>

<style scoped lang="scss">
.priority-container {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.priority-alert {
  :deep(.el-alert__content) {
    width: 100%;
  }
}

.priority-info {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;

  .priority-desc {
    color: #909399;
    font-size: 14px;
  }
}

.action-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.form-section {
  margin-bottom: 0;
}

.form-card {
  height: 100%;

  :deep(.el-card__body) {
    padding: 20px;
  }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 16px;
}

.unit {
  margin-left: 8px;
  color: #909399;
  font-size: 14px;
}

.table-card {
  :deep(.el-card__body) {
    padding: 20px;
  }
}

.arrow-icon {
  margin: 0 8px;
  color: #909399;
}
</style>
