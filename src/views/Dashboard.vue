<template>
  <div class="dashboard">
    <h2 class="page-title">总览面板</h2>

    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon blue">
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ totalPiles }}</div>
              <div class="stat-label">私桩总数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon green">
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ availablePilesCount }}</div>
              <div class="stat-label">可用桩数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon orange">
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ todayBookingsCount }}</div>
              <div class="stat-label">今日预约</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon red">
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ waitingCount }}</div>
              <div class="stat-label">等待排队人数</div>
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
              <el-button type="primary" size="small" @click="scheduleStore.loadData">
                <el-icon><Refresh /></el-icon>
                刷新
              </el-button>
            </div>
          </template>
          <el-table :data="recentBookings" v-loading="scheduleStore.loading" stripe>
            <el-table-column prop="pileCode" label="桩位编号" width="120" />
            <el-table-column prop="userName" label="用户" width="100" />
            <el-table-column prop="roomNumber" label="房间号" width="120" />
            <el-table-column label="预约时间">
              <template #default="scope">
                {{ formatDateTime(scope.row.startTime) }} - {{ formatTime(scope.row.endTime) }}
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="120">
              <template #default="scope">
                <el-tag :type="getStatusType(scope.row.status)">
                  {{ getStatusText(scope.row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="紧急" width="80">
              <template #default="scope">
                <el-tag v-if="scope.row.isEmergency" type="danger" size="small">紧急</el-tag>
                <span v-else>-</span>
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
import { computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useScheduleStore } from '@/store/schedule'
import { useQueueStore } from '@/store/queue'
import type { Booking } from '@/types'

const scheduleStore = useScheduleStore()
const queueStore = useQueueStore()

onMounted(() => {
  scheduleStore.loadData()
  queueStore.loadQueue()
})

const totalPiles = computed(() =>
  scheduleStore.piles.filter(p => p.type === 'private').length
)

const availablePilesCount = computed(() =>
  scheduleStore.availablePiles.length
)

const todayBookingsCount = computed(() => {
  const today = dayjs().format('YYYY-MM-DD')
  return scheduleStore.bookings.filter(b => {
    const bookingDate = dayjs(b.startTime).format('YYYY-MM-DD')
    return bookingDate === today && b.status !== 'cancelled'
  }).length
})

const waitingCount = computed(() => queueStore.waitingQueue.length
)

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

const getStatusType = (status: Booking['status']): 'success' | 'warning' | 'info' | 'danger' => {
  const typeMap: Record<string, 'success' | 'warning' | 'info' | 'danger'> = {
    pending: 'warning',
    confirmed: 'success',
    completed: 'info',
    cancelled: 'danger'
  }
  return typeMap[status]
}

const getStatusText = (status: Booking['status']): string => {
  const textMap: Record<string, string> = {
    pending: '待确认',
    confirmed: '已确认',
    completed: '已完成',
    cancelled: '已取消'
  }
  return textMap[status]
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
        gap: 16px;

        .stat-icon {
          width: 60px;
          height: 60px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;

          &.blue {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }

          &.green {
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
          }

          &.orange {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          }

          &.red {
            background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
          }
        }

        .stat-info {
          flex: 1;

          .stat-value {
            font-size: 32px;
            font-weight: 700;
            color: #303133;
            line-height: 1.2;
          }

          .stat-label {
            font-size: 14px;
            color: #909399;
            margin-top: 4px;
          }
        }
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
