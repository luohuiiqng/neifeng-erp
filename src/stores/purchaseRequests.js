import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { purchaseRequests as seedFromMock } from '@/mock/data'
import { useWarehouseStore } from '@/stores/warehouse'

const STORAGE_KEY = 'nf_erp_proto_purchase_requests'
const SCHEMA_KEY = 'nf_erp_proto_purchase_requests_schema'
const SCHEMA_VER = '2'

function clone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

function nowDate() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function nextRequestId(existing) {
  const d = new Date()
  const y = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const prefix = `PR-${y}-${mm}${dd}-`
  let maxSeq = 0
  for (const r of existing) {
    const id = String(r?.id || '')
    if (!id.startsWith(prefix)) continue
    const n = parseInt(id.slice(prefix.length), 10)
    if (!Number.isNaN(n)) maxSeq = Math.max(maxSeq, n)
  }
  return `${prefix}${String(maxSeq + 1).padStart(2, '0')}`
}

function normalizeRequest(r) {
  if (!r || typeof r !== 'object') return
  if (!Array.isArray(r.lines)) r.lines = []
  if (!['草稿', '待审批', '已通过', '已退回'].includes(r.status)) {
    r.status = r.status === '已通过' ? '已通过' : '草稿'
  }
  if (typeof r.date !== 'string' || !r.date) r.date = nowDate()
  for (const line of r.lines) {
    if (!line || typeof line !== 'object') continue
    if (!line.desc) line.desc = '未命名物料'
    if (!line.spec) line.spec = ''
    if (!line.unit) line.unit = '件'
    if (!Number.isFinite(Number(line.qty))) line.qty = 0
    if (!line.materialCode) line.materialCode = ''
  }
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
        parsed.forEach(normalizeRequest)
        return parsed
      }
    }
  } catch {
    /* ignore */
  }
  const seed = clone(seedFromMock)
  seed.forEach(normalizeRequest)
  return seed
}

export const usePurchaseRequestStore = defineStore('purchaseRequests', () => {
  const requests = ref(loadInitial())
  const warehouseStore = useWarehouseStore()

  function autoLinkByMeta(line) {
    const name = String(line?.desc || '').trim()
    const spec = String(line?.spec || '').trim()
    const unit = String(line?.unit || '件').trim() || '件'
    const m = warehouseStore.data.materials.find(
      (x) => String(x.name || '').trim() === name && String(x.spec || '').trim() === spec && String(x.unit || '件').trim() === unit,
    )
    return m?.code || ''
  }

  function normalizeRequestMaterialLinks() {
    for (const req of requests.value) {
      for (const line of req.lines || []) {
        const code = String(line.materialCode || '').trim()
        if (code && warehouseStore.materialByCode(code)) continue
        line.materialCode = autoLinkByMeta(line)
      }
    }
  }
  normalizeRequestMaterialLinks()

  watch(
    requests,
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
    return requests.value.find((r) => r.id === id)
  }

  function setStatus(id, status) {
    const r = getById(id)
    if (!r) return false
    r.status = status
    return true
  }

  function submitApproval(id) {
    const r = getById(id)
    if (!r) return false
    if (r.status === '已通过') return false
    r.status = '待审批'
    return true
  }

  function validateRequestForSubmit(id) {
    const req = getById(id)
    if (!req) return { ok: false, message: '未找到申请单' }
    for (let i = 0; i < (req.lines || []).length; i += 1) {
      const line = req.lines[i]
      if (!warehouseStore.materialByCode(line.materialCode)) {
        return { ok: false, message: `第 ${i + 1} 行未关联仓库物料` }
      }
      if ((Number(line.qty) || 0) <= 0) {
        return { ok: false, message: `第 ${i + 1} 行数量需大于 0` }
      }
    }
    return { ok: true }
  }

  function setLineMaterialCode(id, lineIndex, materialCode) {
    const req = getById(id)
    if (!req) return false
    const idx = Number(lineIndex)
    if (!Number.isInteger(idx) || !req.lines[idx]) return false
    const line = req.lines[idx]
    const m = warehouseStore.materialByCode(materialCode)
    if (!m) return false
    line.materialCode = m.code
    line.desc = m.name
    line.spec = m.spec
    line.unit = m.unit
    return true
  }

  function createRequest(payload) {
    if (!payload) return null
    const productionOrderId = String(payload.productionOrderId || '').trim()
    const applicant = String(payload.applicant || '').trim()
    const date = String(payload.date || nowDate()).trim()
    const sourceLines = Array.isArray(payload.lines) ? payload.lines : []
    if (!productionOrderId || !applicant || !sourceLines.length) return null
    const lines = []
    for (const l of sourceLines) {
      const qty = Number(l?.qty) || 0
      if (qty <= 0) continue
      const code = String(l?.materialCode || '').trim()
      const m = warehouseStore.materialByCode(code)
      if (!m) continue
      lines.push({
        materialCode: m.code,
        desc: m.name,
        spec: m.spec || '',
        qty,
        unit: m.unit || '件',
        needDate: String(l?.needDate || date).trim() || date,
        supplier: String(l?.supplier || '').trim(),
        note: String(l?.note || '').trim(),
      })
    }
    if (!lines.length) return null
    const id = nextRequestId(requests.value)
    requests.value.unshift({
      id,
      productionOrderId,
      applicant,
      date,
      status: '草稿',
      lines,
    })
    return id
  }

  return {
    requests,
    getById,
    setStatus,
    submitApproval,
    validateRequestForSubmit,
    setLineMaterialCode,
    createRequest,
  }
})
