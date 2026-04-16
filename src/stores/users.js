import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

const STORAGE_USERS = 'nf_erp_users'
const STORAGE_CURRENT = 'nf_erp_current_user_id'
const SCHEMA_KEY = 'nf_erp_users_schema'
const SCHEMA_VER = '1'

const defaultUsers = () => [
  { id: 'u-admin', username: 'admin', password: 'admin123', name: '系统管理员', roleCode: 'admin', enabled: true },
  { id: 'u-director', username: 'director', password: 'director123', name: '张厂长', roleCode: 'director', enabled: true },
  { id: 'u-workshop', username: 'workshop', password: 'workshop123', name: '王主任', roleCode: 'workshop', enabled: true },
  { id: 'u-design', username: 'design', password: 'design123', name: '李工', roleCode: 'design', enabled: true },
  { id: 'u-purchase', username: 'purchase', password: 'purchase123', name: '赵采购', roleCode: 'purchase', enabled: true },
  { id: 'u-finance', username: 'finance', password: 'finance123', name: '周财务', roleCode: 'finance', enabled: true },
]

function loadUsers() {
  if (localStorage.getItem(SCHEMA_KEY) !== SCHEMA_VER) {
    localStorage.removeItem(STORAGE_USERS)
    localStorage.removeItem(STORAGE_CURRENT)
    localStorage.setItem(SCHEMA_KEY, SCHEMA_VER)
  }
  try {
    const raw = localStorage.getItem(STORAGE_USERS)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length) return parsed
    }
  } catch {
    /* ignore */
  }
  return defaultUsers()
}

function loadCurrentUserId(users) {
  const id = localStorage.getItem(STORAGE_CURRENT) || ''
  if (id && users.some((u) => u.id === id && u.enabled !== false)) return id
  return ''
}

export const useUserStore = defineStore('users', () => {
  const users = ref(loadUsers())
  const currentUserId = ref(loadCurrentUserId(users.value))

  watch(
    users,
    (v) => {
      try {
        localStorage.setItem(STORAGE_USERS, JSON.stringify(v))
      } catch {
        /* ignore */
      }
    },
    { deep: true },
  )

  watch(currentUserId, (v) => {
    localStorage.setItem(STORAGE_CURRENT, v || '')
  })

  const currentUser = computed(() => users.value.find((u) => u.id === currentUserId.value && u.enabled !== false) || null)
  const isLoggedIn = computed(() => !!currentUser.value)

  function login(username, password) {
    const u = users.value.find((x) => x.username === username)
    if (!u) return { ok: false, message: '账号不存在' }
    if (!u.enabled) return { ok: false, message: '账号已禁用，请联系管理员' }
    if (u.password !== password) return { ok: false, message: '密码错误' }
    currentUserId.value = u.id
    return { ok: true }
  }

  function logout() {
    currentUserId.value = ''
  }

  function upsertUser(payload) {
    const username = String(payload.username || '').trim()
    if (!username) return { ok: false, message: '请填写登录账号' }
    const duplicate = users.value.some((u) => u.username === username && u.id !== payload.id)
    if (duplicate) return { ok: false, message: '登录账号已存在' }

    const roleCode = String(payload.roleCode || '').trim() || 'director'
    const name = String(payload.name || '').trim() || username
    const enabled = payload.enabled !== false
    const password = String(payload.password || '').trim()

    const i = users.value.findIndex((u) => u.id === payload.id)
    if (i >= 0) {
      const old = users.value[i]
      users.value[i] = {
        ...old,
        username,
        name,
        roleCode,
        enabled,
        password: password || old.password,
      }
      return { ok: true }
    }

    if (!password) return { ok: false, message: '新建账号必须填写初始密码' }
    users.value.push({
      id: `u-${Date.now()}`,
      username,
      password,
      name,
      roleCode,
      enabled,
    })
    return { ok: true }
  }

  function removeUser(id) {
    const u = users.value.find((x) => x.id === id)
    if (!u) return { ok: false, message: '账号不存在' }
    if (u.username === 'admin') return { ok: false, message: '默认管理员账号不可删除' }
    if (id === currentUserId.value) return { ok: false, message: '不能删除当前登录账号' }
    users.value = users.value.filter((x) => x.id !== id)
    return { ok: true }
  }

  function reassignRole(fromRole, toRole = 'director') {
    for (const u of users.value) {
      if (u.roleCode === fromRole) u.roleCode = toRole
    }
  }

  return {
    users,
    currentUserId,
    currentUser,
    isLoggedIn,
    login,
    logout,
    upsertUser,
    removeUser,
    reassignRole,
  }
})
