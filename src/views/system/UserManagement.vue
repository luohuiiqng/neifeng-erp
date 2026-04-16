<template>
  <div class="nf-page">
    <el-card shadow="never">
      <template #header>
        <div class="nf-toolbar">
          <div>
            <span class="nf-toolbar__title">用户账号管理</span>
            <p class="nf-toolbar__desc">管理员可新建账号并绑定角色。页面/内容/操作权限由所绑定角色决定。</p>
          </div>
          <el-button type="primary" @click="openEdit()">新建用户</el-button>
        </div>
      </template>

      <el-table :data="userStore.users" stripe>
        <el-table-column prop="username" label="登录账号" width="140" />
        <el-table-column prop="name" label="姓名" width="140" />
        <el-table-column label="角色" width="160">
          <template #default="{ row }">{{ roleName(row.roleCode) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '启用' : '禁用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="openEdit(row)">编辑</el-button>
            <el-button type="danger" link @click="onRemove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="visible" :title="dialogTitle" width="520px" destroy-on-close @closed="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="登录账号" prop="username">
          <el-input v-model="form.username" :disabled="isEdit && form.username === 'admin'" />
        </el-form-item>
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="角色" prop="roleCode">
          <el-select v-model="form.roleCode" style="width: 100%">
            <el-option v-for="r in rolesStore.roles" :key="r.code" :label="r.name" :value="r.code" />
          </el-select>
        </el-form-item>
        <el-form-item :label="isEdit ? '重置密码' : '初始密码'" prop="password">
          <el-input v-model="form.password" type="password" show-password :placeholder="isEdit ? '留空表示不修改' : '必填'" />
        </el-form-item>
        <el-form-item label="启用状态">
          <el-switch v-model="form.enabled" :disabled="isEdit && form.username === 'admin'" />
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
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRolesStore } from '@/stores/roles'
import { useUserStore } from '@/stores/users'

const rolesStore = useRolesStore()
const userStore = useUserStore()

const visible = ref(false)
const isEdit = ref(false)
const formRef = ref()
const form = reactive({
  id: '',
  username: '',
  name: '',
  roleCode: 'director',
  password: '',
  enabled: true,
})

const dialogTitle = computed(() => (isEdit.value ? '编辑用户' : '新建用户'))
const rules = {
  username: [{ required: true, message: '请输入登录账号', trigger: 'blur' }],
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  roleCode: [{ required: true, message: '请选择角色', trigger: 'change' }],
}

function roleName(code) {
  return rolesStore.roles.find((r) => r.code === code)?.name || code || '—'
}

function openEdit(row) {
  isEdit.value = !!row
  if (row) {
    form.id = row.id
    form.username = row.username
    form.name = row.name
    form.roleCode = row.roleCode || 'director'
    form.password = ''
    form.enabled = row.enabled !== false
  } else {
    form.id = ''
    form.username = ''
    form.name = ''
    form.roleCode = 'director'
    form.password = ''
    form.enabled = true
  }
  visible.value = true
}

function resetForm() {
  formRef.value?.clearValidate?.()
}

async function submit() {
  try {
    await formRef.value?.validate?.()
  } catch {
    return
  }
  const r = userStore.upsertUser({
    id: form.id || undefined,
    username: form.username.trim(),
    name: form.name.trim(),
    roleCode: form.roleCode,
    password: form.password,
    enabled: form.enabled,
  })
  if (!r.ok) {
    ElMessage.warning(r.message)
    return
  }
  visible.value = false
  ElMessage.success('已保存用户账号')
}

async function onRemove(row) {
  await ElMessageBox.confirm(`确定删除账号「${row.username}」？`, '提示', { type: 'warning' })
  const r = userStore.removeUser(row.id)
  if (!r.ok) {
    ElMessage.warning(r.message)
    return
  }
  ElMessage.success('已删除')
}
</script>

<style scoped>
.nf-page {
  max-width: 1000px;
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
}
</style>
