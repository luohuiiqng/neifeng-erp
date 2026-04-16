import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'nf_erp_proto_suppliers'
const SCHEMA_KEY = 'nf_erp_proto_suppliers_schema'
const SCHEMA_VER = '1'

function clone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

function defaultSuppliers() {
  return [
    {
      id: 'SUP-001',
      name: '华东机电',
      contact: '王工',
      phone: '13800010001',
      email: 'sales@hdjd.com',
      address: '江苏苏州工业园区',
      leadDays: 12,
      paymentTerms: '月结30天',
      category: '电气与驱动',
      enabled: true,
    },
    {
      id: 'SUP-002',
      name: '超声科技',
      contact: '陈经理',
      phone: '13800010002',
      email: 'service@ultra-tech.com',
      address: '浙江宁波高新区',
      leadDays: 10,
      paymentTerms: '预付30%，到货70%',
      category: '超声波组件',
      enabled: true,
    },
    {
      id: 'SUP-003',
      name: '江南气动',
      contact: '赵工',
      phone: '13800010003',
      email: 'biz@jnqd.com',
      address: '上海松江区',
      leadDays: 7,
      paymentTerms: '货到15天',
      category: '气动元件',
      enabled: true,
    },
    {
      id: 'SUP-004',
      name: '瑞邦轴承',
      contact: '刘经理',
      phone: '13800010004',
      email: 'order@rbbearing.com',
      address: '山东临清市',
      leadDays: 6,
      paymentTerms: '货到月结',
      category: '轴承与传动',
      enabled: true,
    },
    {
      id: 'SUP-005',
      name: '浙南板材',
      contact: '孙总',
      phone: '13800010005',
      email: 'market@znsteel.com',
      address: '浙江温州龙湾区',
      leadDays: 5,
      paymentTerms: '现款现货',
      category: '板材型材',
      enabled: true,
    },
  ]
}

function normalizeRow(row) {
  if (!row || typeof row !== 'object') return
  if (!row.id) row.id = `SUP-${Date.now()}`
  if (!row.name) row.name = '未命名供应商'
  if (!row.contact) row.contact = ''
  if (!row.phone) row.phone = ''
  if (!row.email) row.email = ''
  if (!row.address) row.address = ''
  if (!Number.isFinite(Number(row.leadDays))) row.leadDays = 0
  if (!row.paymentTerms) row.paymentTerms = ''
  if (!row.category) row.category = ''
  if (typeof row.enabled !== 'boolean') row.enabled = true
}

function loadInitial() {
  if (localStorage.getItem(SCHEMA_KEY) !== SCHEMA_VER) {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.setItem(SCHEMA_KEY, SCHEMA_VER)
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length) {
        parsed.forEach(normalizeRow)
        return parsed
      }
    }
  } catch {
    /* ignore */
  }
  return clone(defaultSuppliers())
}

export const useSupplierStore = defineStore('suppliers', () => {
  const list = ref(loadInitial())

  watch(
    list,
    (v) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(v))
      } catch {
        /* ignore */
      }
    },
    { deep: true },
  )

  function getById(id) {
    return list.value.find((x) => x.id === id) || null
  }

  function findByName(name) {
    const n = String(name || '').trim()
    if (!n) return null
    return list.value.find((x) => String(x.name || '').trim() === n) || null
  }

  function enabledOptions() {
    return list.value.filter((x) => x.enabled)
  }

  function upsert(row) {
    const next = { ...row }
    normalizeRow(next)
    const i = list.value.findIndex((x) => x.id === next.id)
    if (i >= 0) list.value[i] = { ...list.value[i], ...next }
    else list.value.unshift(next)
    return next.id
  }

  function remove(id) {
    const i = list.value.findIndex((x) => x.id === id)
    if (i < 0) return false
    list.value.splice(i, 1)
    return true
  }

  return { list, getById, findByName, enabledOptions, upsert, remove }
})
