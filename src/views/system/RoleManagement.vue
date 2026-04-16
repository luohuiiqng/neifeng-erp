<template>
  <div class="nf-page">
    <el-card shadow="never">
      <template #header>
        <div class="nf-toolbar">
          <div>
            <span class="nf-toolbar__title">角色管理</span>
            <p class="nf-toolbar__desc">配置角色的<strong>页面权限</strong>、<strong>内容权限</strong>与<strong>操作权限</strong>；用户账号绑定此角色后自动生效。数据保存在本机浏览器。</p>
          </div>
          <div class="nf-toolbar__actions">
            <el-button @click="onReset">恢复默认角色</el-button>
            <el-button type="primary" @click="openEdit()">新增角色</el-button>
          </div>
        </div>
      </template>

      <el-table :data="rolesStore.roles" stripe>
        <el-table-column prop="name" label="角色名称" width="140" />
        <el-table-column prop="code" label="编码" width="120" />
        <el-table-column prop="description" label="说明" min-width="160" show-overflow-tooltip />
        <el-table-column label="权限" min-width="220">
          <template #default="{ row }">
            <el-tag v-if="row.permissions?.includes('*')" type="danger" size="small">全部功能</el-tag>
            <template v-else>
              <el-tag v-for="k in row.permissions" :key="k" size="small" class="nf-perm-tag">
                {{ permLabel(k) }}
              </el-tag>
            </template>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="openEdit(row)">编辑</el-button>
            <el-button
              v-if="row.code !== 'admin'"
              type="danger"
              link
              @click="onRemove(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="visible" :title="dialogTitle" width="640px" destroy-on-close @closed="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="88px">
        <el-form-item label="角色名称" prop="name">
          <el-input v-model="form.name" placeholder="如：跟单员" :disabled="form.code === 'admin'" />
        </el-form-item>
        <el-form-item label="编码" prop="code">
          <el-input v-model="form.code" placeholder="英文小写，如 clerk" :disabled="isEdit && form.code === 'admin'" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" type="textarea" rows="2" placeholder="职责描述" />
        </el-form-item>
        <el-form-item label="菜单与操作">
          <el-checkbox v-model="allAccess" :disabled="form.code === 'admin'">全部功能（*）</el-checkbox>
          <el-checkbox-group
            v-model="permSet"
            class="nf-check-grid"
            :disabled="allAccess || form.code === 'admin'"
          >
            <el-checkbox v-for="opt in permOptions" :key="opt.key" :label="opt.key">
              {{ opt.title }}
            </el-checkbox>
          </el-checkbox-group>
          <p v-if="form.code === 'admin'" class="nf-hint">系统管理员固定为全部权限，不可缩减。</p>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { MENU_DEFS, ACTION_DEFS } from '@/mock/data'
import { useRolesStore } from '@/stores/roles'

const rolesStore = useRolesStore()

const permOptions = [...MENU_DEFS.filter((m) => !m.placeholder), ...ACTION_DEFS]

const visible = ref(false)
const formRef = ref()
const isEdit = ref(false)

const form = reactive({
  id: '',
  name: '',
  code: '',
  description: '',
  permissions: [],
})

const permSet = ref([])
const allAccess = ref(false)

const dialogTitle = computed(() => (isEdit.value ? '编辑角色' : '新增角色'))

const rules = {
  name: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入编码', trigger: 'blur' }],
}

watch(allAccess, (v) => {
  if (v) permSet.value = []
})

function permLabel(key) {
  const m = MENU_DEFS.find((x) => x.key === key) || ACTION_DEFS.find((x) => x.key === key)
  return m?.title || key
}

function openEdit(row) {
  isEdit.value = !!row
  if (row) {
    form.id = row.id
    form.name = row.name
    form.code = row.code
    form.description = row.description || ''
    const p = row.permissions || []
    allAccess.value = p.includes('*')
    permSet.value = allAccess.value ? [] : [...p]
    form.permissions = [...p]
  } else {
    form.id = `r-${Date.now()}`
    form.name = ''
    form.code = ''
    form.description = ''
    allAccess.value = false
    permSet.value = ['dashboard', 'production_order']
    form.permissions = [...permSet.value]
  }
  visible.value = true
}

function resetForm() {
  formRef.value?.resetFields?.()
}

async function submit() {
  await formRef.value?.validate?.()
  if (form.code !== 'admin' && !allAccess.value && permSet.value.length === 0) {
    ElMessage.warning('请至少勾选一项权限，或勾选「全部功能」')
    return
  }
  const permissions = form.code === 'admin' ? ['*'] : allAccess.value ? ['*'] : [...permSet.value]
  rolesStore.upsertRole({
    id: form.id,
    name: form.name,
    code: form.code,
    description: form.description,
    permissions,
  })
  ElMessage.success('已保存（本地）')
  visible.value = false
}

async function onRemove(row) {
  await ElMessageBox.confirm(`确定删除角色「${row.name}」？`, '提示', { type: 'warning' })
  rolesStore.removeRole(row.id)
  ElMessage.success('已删除')
}

function onReset() {
  rolesStore.resetToDefault()
  ElMessage.success('已恢复默认角色与当前身份')
}
</script>

<style scoped>
.nf-page {
  max-width: 1100px;
  margin: 0 auto;
}
.nf-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}
.nf-toolbar__title {
  font-weight: 600;
  font-size: 16px;
  display: block;
}
.nf-toolbar__desc {
  margin: 6px 0 0;
  font-size: 13px;
  color: #6b7280;
  max-width: 520px;
  line-height: 1.5;
}
.nf-toolbar__actions {
  display: flex;
  gap: 8px;
}
.nf-perm-tag {
  margin-right: 6px;
  margin-bottom: 4px;
}
.nf-check-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
  width: 100%;
}
.nf-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: #9ca3af;
}
</style>
