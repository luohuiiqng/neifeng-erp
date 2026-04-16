<template>
  <div class="nf-page">
    <el-result icon="info" :title="title" sub-title="该模块尚未实现，后续版本将补充。">
      <template #extra>
        <el-card shadow="never" class="nf-card">
          <h3 class="nf-h3">规划方向（供评审讨论）</h3>
          <ul class="nf-list">
            <template v-if="pageKind === 'sales'">
              <li>客户档案、报价、合同与销售订单（与生产订单的衔接方式）</li>
              <li>内销/外销、回款计划与信用控制</li>
              <li>与财务、出货单据的打通</li>
            </template>
            <template v-else-if="pageKind === 'production'">
              <li>生产工单 / 装配工单、工艺路线、报工</li>
              <li>与 MES 对接的可行边界</li>
              <li>序列号、质检记录与出货联动</li>
            </template>
            <template v-else>
              <li>库存账务、批次/库位、出入库单</li>
              <li>采购到货与入库、生产领料</li>
              <li>盘点与呆滞料分析</li>
            </template>
          </ul>
          <el-button type="primary" @click="$router.push('/dashboard')">返回工作台</el-button>
        </el-card>
      </template>
    </el-result>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const title = computed(() => `${route.meta.title || '模块'} · 规划中`)
const pageKind = computed(() => route.meta.page || (route.path.includes('warehouse') ? 'warehouse' : 'production'))
</script>

<style scoped>
.nf-page {
  max-width: 560px;
  margin: 40px auto;
}
.nf-card {
  text-align: left;
  max-width: 480px;
  margin: 0 auto;
}
.nf-h3 {
  margin: 0 0 12px;
  font-size: 15px;
}
.nf-list {
  margin: 0 0 20px;
  padding-left: 20px;
  color: #4b5563;
  line-height: 1.8;
  font-size: 14px;
}
</style>
