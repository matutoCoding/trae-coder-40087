<template>
  <div class="dashboard">
    <h2 class="page-title">总览面板</h2>

    <el-row :gutter="20" class="stats-row">
      <el-col :span="4">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon blue">
              <el-icon :size="28"><ChargingPile /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ opsStats.totalOpenPiles }}</div>
              <div class="stat-label">今日开放桩位</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon green">
              <el-icon :size="28"><CircleCheck /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ opsStats.availablePiles }}</div>
              <div class="stat-label">可用桩数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon orange">
              <el-icon :size="28"><Lightning /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ opsStats.occupiedPiles }}</div>
              <div class="stat-label">充电中</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon purple">
              <el-icon :size="28"><Calendar /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ opsStats.todayBookings }}</div>
              <div class="stat-label">今日预约</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon pink">
              <el-icon :size="28"><Aim /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ opsStats.waitingQueueSize }}</div>
              <div class="stat-label">排队人数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon gray">
              <el-icon :size="28"><Tools /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ opsStats.maintenancePiles }}</div>
              <div class="stat-label">维护中</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="ops-card" shadow="hover">
          <div class="ops-header">
            <span class="ops-title">桩位利用率</span>
            <el-tag type="primary" size="small">今日</el-tag>
          </div>
          <div class="ops-body utilization">
            <el-progress
              type="dashboard"
              :percentage="opsStats.utilizationRate"
              :color="utilizationColor"
              :width="140"
              :stroke-width="10"
            />
            <div class="ops-subtext">
              已预约 {{ bookedMinutes }} 分钟 / 开放 {{ openMinutes }} 分钟
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="6">
        <el-card class="ops-card" shadow="hover">
          <div class="ops-header">
            <span class="ops-title">应急覆盖</span>
            <el-tag type="danger" size="small">今日</el-tag>
          </div>
          <div class="ops-body emergency-covered">
            <div class="big-number danger">{{ opsStats.coveredByEmergencyCount }}</div>
            <div class="ops-subtext">普通预约被应急插队覆盖</div>
            <div class="mini-row">
              <div class="mini-item">
                <span class="mini-label">完成预约</span>
                <span class="mini-value success">{{ opsStats.todayCompletedBookings }}</span>
              </div>
              <div class="mini-item">
                <span class="mini-label">取消预约</span>
                <span class="mini-value info">{{ opsStats.todayCancelledBookings }}</span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="6">
        <el-card class="ops-card" shadow="hover">
          <div class="ops-header">
            <span class="ops-title">平均排队等待</span>
            <el-tag type="warning" size="small">历史</el-tag>
          </div>
          <div class="ops-body avg-wait">
            <div class="big-number warning">{{ formatAvgWait }}</div>
            <div class="ops-subtext">从入队到被叫号的平均耗时</div>
            <el-progress
              :percentage="waitProgressPercent"
              :show-text="false"
              :color="waitColor"
              :stroke-width="8"
              style="margin-top: 12px"
            />
            <div class="mini-hint">
              {{ waitHint }}
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="6">
        <el-card class="ops-card" shadow="hover">
          <div class="ops-header">
            <span class="ops-title">今日充电</span>
            <el-tag type="success" size="small">累计</el-tag>
          </div>
          <div class="ops-body charging-stat">
            <div class="big-number success">{{ formatChargingHours }}</div>
            <div class="ops-subtext">总充电时长 (小时)</div>
            <div class="mini-row">
              <div class="mini-item">
                <span class="mini-label">充电分钟</span>
                <span class="mini-value">{{ opsStats.todayChargingMinutes }} min</span>
              </div>
              <div class="mini-item">
                <span class="mini-label">平均每单</span>
                <span class="mini-value">{{ avgPerBooking }} min</span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="content-row">
      <el-col :span="16">
        <el-card class="content-card">
          <template #header>
            <div class="card-header">
              <span>最近预约列表</span>
              <el-button type="primary" size="small" @click="refreshAll">
                <el-icon><Refresh /></el-icon>
                刷新
              </el-button>
            </div>
          </template>
          <el-table :data="recentBookings" v-loading="scheduleStore.loading" stripe>
            <el-table-column prop="pileCode" label="桩位编号" width="110" />
            <el-table-column prop="userName" label="用户" width="90" />
            <el-table-column prop="roomNumber" label="房间号" width="100" />
            <el-table-column label="预约时间" width="200">
              <template #default="scope">
                {{ formatDateTime(scope.row.startTime) }} - {{ formatTime(scope.row.endTime) }}
              </template>
            </el-table-column>
            <el-table-column label="状态" width="120">
              <template #default="scope">
                <el-tag :type="getStatusType(scope.row.status)">
                  {{ getStatusText(scope.row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="标签" min-width="160">
              <template #default="scope">
                <el-tag v-if="scope.row.isEmergency" type="danger" size="small" effect="dark">应急</el-tag>
                <el-tag v-if="scope.row.coveredByEmergency" type="warning" size="small" effect="plain">被应急覆盖</el-tag>
                <el-tag v-if="scope.row.status === 'charging'" type="primary" size="small" effect="dark">充电中</el-tag>
                <span v-if="!scope.row.isEmergency && !scope.row.coveredByEmergency && scope.row.status !== 'charging'">-</span>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="recentBookings.length === 0" description="暂无预约记录" />
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card class="content-card">
          <template #header>
            <div class="card-header">
              <span>当前排队情况</span>
              <el-tag :type="queueStats.totalWaiting > 0 ? 'warning' : 'success'">
                {{ queueStats.totalWaiting }} 人等待
              </el-tag>
            </div>
          </template>

          <div class="queue-stats">
            <div class="queue-stat-item emergency">
              <span class="stat-dot"></span>
              <span>紧急：{{ queueStats.emergencyCount }}</span>
            </div>
            <div class="queue-stat-item vip">
              <span class="stat-dot"></span>
              <span>VIP：{{ queueStats.vipCount }}</span>
            </div>
            <div class="queue-stat-item normal">
              <span class="stat-dot"></span>
              <span>普通：{{ queueStats.normalCount }}</span>
            </div>
          </div>

          <el-divider />

          <div class="queue-list">
            <div
              v-for="(item, index) in waitingQueue"
              :key="item.id"
              class="queue-item"
            >
              <div class="queue-rank" :class="getPriorityClass(item)">
                {{ index + 1 }}
              </div>
              <div class="queue-info">
                <div class="queue-user">
                  <span class="user-name">{{ item.userName }}</span>
                  <el-tag v-if="item.isEmergency" type="danger" size="small">紧急</el-tag>
                  <el-tag v-else-if="item.isVip" type="warning" size="small">VIP</el-tag>
                </div>
                <div class="queue-detail">
                  <span>{{ item.roomNumber }}</span>
                  <span class="divider">|</span>
                  <span>{{ item.pileCode }}</span>
                </div>
              </div>
            </div>
            <el-empty v-if="waitingQueue.length === 0" description="暂无排队" :image-size="80" />
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Refresh,
  ChargingPile,
  CircleCheck,
  Lightning,
  Calendar,
  Aim,
  Tools
} from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useScheduleStore } from '@/store/schedule'
import { useQueueStore } from '@/store/queue'
import { useTaskStore } from '@/store/task'
import type { Booking, OperationalStats } from '@/types'

const scheduleStore = useScheduleStore()
const queueStore = useQueueStore()
const taskStore = useTaskStore()

const _opsCache = ref<OperationalStats>({
  totalOpenPiles: 0,
  availablePiles: 0,
  occupiedPiles: 0,
  maintenancePiles: 0,
  utilizationRate: 0,
  coveredByEmergencyCount: 0,
  avgWaitingMinutes: 0,
  todayBookings: 0,
  todayCompletedBookings: 0,
  todayCancelledBookings: 0,
  waitingQueueSize: 0,
  todayChargingMinutes: 0
})

const refreshAll = () => {
  scheduleStore.loadData()
  queueStore.loadQueue()
  taskStore.loadTasks()
  _opsCache.value = scheduleStore.getOperationalStats()
  ElMessage.success('数据已刷新')
}

onMounted(() => {
  refreshAll()
})

const opsStats = computed<OperationalStats>(() => {
  try {
    return scheduleStore.getOperationalStats()
  } catch {
    return _opsCache.value
  }
})

const totalPiles = computed(() =>
  scheduleStore.piles.filter(p => p.type === 'private').length
)

const openMinutes = computed(() => {
  let total = 0
  const dow = new Date().getDay()
  for (const pile of scheduleStore.piles) {
    if (!pile.isOpenToPublic) continue
    for (const slot of pile.openTimeSlots) {
      if (slot.dayOfWeek && !slot.dayOfWeek.includes(dow)) continue
      const s = dayjs(`2000-01-01 ${slot.startTime}`)
      const e = dayjs(`2000-01-01 ${slot.endTime}`)
      total += e.diff(s, 'minute')
    }
  }
  return total
})

const bookedMinutes = computed(() => {
  return Math.round((opsStats.value.utilizationRate / 100) * openMinutes.value)
})

const utilizationColor = computed(() => {
  const p = opsStats.value.utilizationRate
  if (p >= 80) return '#f56c6c'
  if (p >= 50) return '#e6a23c'
  return '#67c23a'
})

const formatAvgWait = computed(() => {
  const m = Math.round(opsStats.value.avgWaitingMinutes)
  if (m < 60) return `${m} 分钟`
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${h}h ${mm}m`
})

const waitProgressPercent = computed(() => {
  const MAX_GOOD = 30
  const m = opsStats.value.avgWaitingMinutes
  return Math.min(100, Math.round((m / MAX_GOOD) * 100))
})

const waitColor = computed(() => {
  const m = opsStats.value.avgWaitingMinutes
  if (m >= 30) return '#f56c6c'
  if (m >= 15) return '#e6a23c'
  return '#67c23a'
})

const waitHint = computed(() => {
  const m = opsStats.value.avgWaitingMinutes
  if (m === 0) return '暂无叫号历史数据'
  if (m < 15) return '排队体验优秀'
  if (m < 30) return '排队体验良好'
  return '等待偏长，建议增加开放桩位'
})

const formatChargingHours = computed(() => {
  const h = opsStats.value.todayChargingMinutes / 60
  return h.toFixed(1)
})

const avgPerBooking = computed(() => {
  if (opsStats.value.todayCompletedBookings <= 0) return 0
  return Math.round(opsStats.value.todayChargingMinutes / opsStats.value.todayCompletedBookings)
})

const recentBookings = computed(() => {
  return [...scheduleStore.bookings]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10)
})

const waitingQueue = computed(() => queueStore.waitingQueue)

const queueStats = computed(() => queueStore.getQueueStats())

const formatDateTime = (dateStr: string): string => {
  return dayjs(dateStr).format('M/D HH:mm')
}

const formatTime = (dateStr: string): string => {
  return dayjs(dateStr).format('HH:mm')
}

const getStatusType = (status: Booking['status']): 'success' | 'warning' | 'info' | 'danger' | 'primary' => {
  const typeMap: Record<string, 'success' | 'warning' | 'info' | 'danger' | 'primary'> = {
    pending: 'warning',
    confirmed: 'success',
    charging: 'primary',
    completed: 'info',
    cancelled: 'danger'
  }
  return typeMap[status] ?? 'info'
}

const getStatusText = (status: Booking['status']): string => {
  const textMap: Record<string, string> = {
    pending: '待确认',
    confirmed: '已确认',
    charging: '充电中',
    completed: '已完成',
    cancelled: '已取消'
  }
  return textMap[status] ?? status
}

const getPriorityClass = (item: { isEmergency: boolean; isVip: boolean }): string => {
  if (item.isEmergency) return 'emergency'
  if (item.isVip) return 'vip'
  return 'normal'
}
</script>

<style scoped lang="scss">
.dashboard {
  padding: 20px;

  .page-title {
    font-size: 24px;
    font-weight: 600;
    margin-bottom: 20px;
    color: #303133;
  }

  .stats-row {
    margin-bottom: 20px;

    .stat-card {
      border-radius: 8px;

      .stat-content {
        display: flex;
        align-items: center;
        gap: 14px;

        .stat-icon {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          flex-shrink: 0;

          &.blue {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }

          &.green {
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
          }

          &.orange {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          }

          &.purple {
            background: linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%);
          }

          &.pink {
            background: linear-gradient(135deg, #ff6a88 0%, #ff99ac 100%);
          }

          &.gray {
            background: linear-gradient(135deg, #636e72 0%, #b2bec3 100%);
          }
        }

        .stat-info {
          flex: 1;
          min-width: 0;

          .stat-value {
            font-size: 28px;
            font-weight: 700;
            color: #303133;
            line-height: 1.2;
          }

          .stat-label {
            font-size: 13px;
            color: #909399;
            margin-top: 4px;
          }
        }
      }
    }
  }

  .ops-card {
    border-radius: 8px;
    height: 100%;

    .ops-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;

      .ops-title {
        font-size: 15px;
        font-weight: 600;
        color: #303133;
      }
    }

    .ops-body {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 4px 0 8px;

      .big-number {
        font-size: 38px;
        font-weight: 700;
        line-height: 1.2;

        &.danger { color: #f56c6c; }
        &.warning { color: #e6a23c; }
        &.success { color: #67c23a; }
      }

      .ops-subtext {
        font-size: 12px;
        color: #909399;
        margin-top: 6px;
      }

      .mini-row {
        margin-top: 18px;
        display: flex;
        width: 100%;
        gap: 10px;

        .mini-item {
          flex: 1;
          background: #f7f8fa;
          border-radius: 8px;
          padding: 8px 10px;
          text-align: center;

          .mini-label {
            display: block;
            font-size: 11px;
            color: #909399;
            margin-bottom: 2px;
          }

          .mini-value {
            display: block;
            font-size: 14px;
            font-weight: 600;
            color: #303133;

            &.success { color: #67c23a; }
            &.info { color: #909399; }
          }
        }
      }

      .mini-hint {
        margin-top: 6px;
        font-size: 12px;
        color: #606266;
      }
    }
  }

  .content-row {
    .content-card {
      border-radius: 8px;

      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: 600;
      }
    }
  }

  .queue-stats {
    display: flex;
    justify-content: space-around;
    padding: 10px 0;

    .queue-stat-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: #606266;

      .stat-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
      }

      &.emergency .stat-dot {
        background-color: #f56c6c;
      }

      &.vip .stat-dot {
        background-color: #e6a23c;
      }

      &.normal .stat-dot {
        background-color: #67c23a;
      }
    }
  }

  .queue-list {
    max-height: 400px;
    overflow-y: auto;

    .queue-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid #f0f0f0;

      &:last-child {
        border-bottom: none;
      }

      .queue-rank {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 600;
        color: #fff;
        background-color: #c0c4cc;

        &.emergency {
          background-color: #f56c6c;
        }

        &.vip {
          background-color: #e6a23c;
        }

        &.normal {
          background-color: #67c23a;
        }
      }

      .queue-info {
        flex: 1;

        .queue-user {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 500;
          color: #303133;
          margin-bottom: 4px;

          .user-name {
            font-size: 15px;
          }
        }

        .queue-detail {
          font-size: 12px;
          color: #909399;
          display: flex;
          align-items: center;
          gap: 8px;

          .divider {
            color: #dcdfe6;
          }
        }
      }
    }
  }
}
</style>
