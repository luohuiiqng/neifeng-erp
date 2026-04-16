import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'nf_erp_proto_customers_master'

function newId() {
  return `cust-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    /* ignore */
  }
  return []
}

export const useCustomerStore = defineStore('customersMaster', () => {
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

  /**
   * @returns {{ ok: true } | { ok: false, error: string }}
   */
  function addCustomer({ name, customerType, remark }) {
    const n = String(name || '').trim()
    if (!n) return { ok: false, error: '请填写客户/项目名称' }
    const dup = list.value.some((c) => String(c.name || '').trim() === n)
    if (dup) return { ok: false, error: '主数据中已有同名客户' }
    list.value.push({
      id: newId(),
      name: n,
      customerType: customerType === '出口' ? '出口' : '国内',
      remark: String(remark || '').trim(),
      createdAt: todayStr(),
    })
    return { ok: true }
  }

  /** 用于生产订单「客户/项目」下拉的名称列表（去重、排序） */
  const nameOptions = () =>
    [...list.value]
      .map((c) => String(c.name || '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'zh-CN'))

  return { list, addCustomer, nameOptions }
})
