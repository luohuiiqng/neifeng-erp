import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { approvals as seedFromMock } from '@/mock/data'

const STORAGE_KEY = 'nf_erp_proto_approvals'

function clone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length) return parsed
    }
  } catch {
    /* ignore */
  }
  return clone(seedFromMock)
}

export const useApprovalsStore = defineStore('approvals', () => {
  const items = ref(loadInitial())

  watch(
    items,
    (v) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(v))
      } catch {
        /* ignore */
      }
    },
    { deep: true },
  )

  function findById(id) {
    return items.value.find((a) => a.id === id)
  }

  function addPending(payload) {
    const id = payload.id
    if (items.value.some((a) => a.id === id)) return false
    items.value.unshift({
      id,
      type: payload.type,
      ref: payload.ref,
      customer: payload.customer || '—',
      submitter: payload.submitter || '—',
      time: payload.time || '',
      status: '待审批',
    })
    return true
  }

  function setStatus(id, status) {
    const a = findById(id)
    if (a) a.status = status
  }

  function hasPendingTypeRef(type, ref) {
    return items.value.some((a) => a.type === type && a.ref === ref && a.status === '待审批')
  }

  return { items, findById, addPending, setStatus, hasPendingTypeRef }
})
