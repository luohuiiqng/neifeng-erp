<template>
  <div class="nf-login-wrap">
    <el-card class="nf-login-card" shadow="hover">
      <template #header>
        <div class="nf-login-title">内丰 ERP 登录</div>
      </template>
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="账号" prop="username">
          <el-input v-model="form.username" placeholder="请输入账号，如 admin" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" show-password placeholder="请输入密码" @keyup.enter="onLogin" />
        </el-form-item>
        <el-button type="primary" style="width: 100%" @click="onLogin">登录</el-button>
      </el-form>
      <p class="nf-hint">默认管理员账号：admin / admin123</p>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/users'

const router = useRouter()
const userStore = useUserStore()
const formRef = ref()

const form = reactive({
  username: '',
  password: '',
})

const rules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function onLogin() {
  try {
    await formRef.value?.validate?.()
  } catch {
    return
  }
  const r = userStore.login(form.username.trim(), form.password)
  if (!r.ok) {
    ElMessage.error(r.message)
    return
  }
  ElMessage.success('登录成功')
  router.replace('/dashboard')
}
</script>

<style scoped>
.nf-login-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f3f6fb;
  padding: 24px;
}
.nf-login-card {
  width: 420px;
  max-width: 100%;
}
.nf-login-title {
  font-size: 20px;
  font-weight: 700;
  text-align: center;
}
.nf-hint {
  margin: 12px 0 0;
  color: #6b7280;
  font-size: 12px;
}
</style>
