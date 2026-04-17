import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'nf_erp_proto_warehouse'
const SCHEMA_KEY = 'nf_erp_proto_warehouse_schema'
const SCHEMA_VER = '2'

function todayStr() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function nextCode(items) {
  let max = 0
  for (const m of items) {
    const code = String(m?.code || '')
    if (!code.startsWith('MAT-')) continue
    const n = parseInt(code.slice(4), 10)
    if (!Number.isNaN(n)) max = Math.max(max, n)
  }
  return `MAT-${String(max + 1).padStart(4, '0')}`
}

function nextTxId(txs) {
  let max = 0
  for (const t of txs) {
    const id = String(t?.id || '')
    if (!id.startsWith('TX-')) continue
    const n = parseInt(id.slice(3), 10)
    if (!Number.isNaN(n)) max = Math.max(max, n)
  }
  return `TX-${String(max + 1).padStart(6, '0')}`
}

const CATEGORIES = ['原材料', '半成品', '零部件', '成品']

const RAW_TEMPLATES = [
  { name: 'Q235B 钢板', unit: '张', specs: ['4mm*1500*6000', '6mm*1500*6000', '8mm*1500*6000'] },
  { name: '304 不锈钢板', unit: '张', specs: ['2mm*1220*2440', '3mm*1220*2440'] },
  { name: '45# 圆钢', unit: '米', specs: ['Φ20', 'Φ30', 'Φ40'] },
  { name: '铝型材', unit: '米', specs: ['40*40', '60*60'] },
  { name: '同步带胚料', unit: '卷', specs: ['S8M-30', 'S8M-50'] },
  { name: '工业电缆', unit: '米', specs: ['4芯1.5平方', '4芯2.5平方'] },
  { name: '气管', unit: '卷', specs: ['PU8*5', 'PU10*6.5'] },
  { name: '热熔胶', unit: '箱', specs: ['25kg/箱'] },
  { name: '包装薄膜', unit: '卷', specs: ['BOPP 30um', 'PE 50um'] },
  { name: '工业油墨', unit: '桶', specs: ['黑色 20kg', '红色 20kg'] },
]

const SEMI_TEMPLATES = [
  { name: '主机机架焊接总成', unit: '套', specs: ['RF-800', 'RF-1300'] },
  { name: '放卷轴总成', unit: '套', specs: ['标准型', '重载型'] },
  { name: '收卷轴总成', unit: '套', specs: ['标准型', '气胀轴型'] },
  { name: '热切刀梁总成', unit: '套', specs: ['单刀', '双刀'] },
  { name: '超声波焊接座总成', unit: '套', specs: ['20KHz', '28KHz'] },
  { name: '输送机架总成', unit: '套', specs: ['2m', '3m'] },
  { name: '压辊总成', unit: '件', specs: ['Φ80', 'Φ120'] },
  { name: '纠偏支架总成', unit: '套', specs: ['单边', '双边'] },
  { name: '电控柜预装总成', unit: '台', specs: ['单门', '双门'] },
  { name: '气路集成板总成', unit: '套', specs: ['8回路', '12回路'] },
]

const PART_TEMPLATES = [
  { name: '伺服电机', unit: '台', specs: ['1.5kW', '2.0kW', '3.0kW'] },
  { name: '伺服驱动器', unit: '台', specs: ['220V', '380V'] },
  { name: 'PLC 控制器', unit: '台', specs: ['中型', '大型'] },
  { name: '触摸屏 HMI', unit: '台', specs: ['10寸', '12寸'] },
  { name: '光电传感器', unit: '个', specs: ['漫反射', '对射'] },
  { name: '电磁阀', unit: '个', specs: ['2位5通', '3位5通'] },
  { name: '气缸', unit: '支', specs: ['SC63*100', 'SC80*150'] },
  { name: '减速机', unit: '台', specs: ['RV090', 'RV110'] },
  { name: '轴承', unit: '套', specs: ['6206', '6208', '6210'] },
  { name: '同步轮', unit: '个', specs: ['S8M-30', 'S8M-50'] },
]

function normalizeCategory(category) {
  const c = String(category || '').trim()
  if (!c) return '零部件'
  if (CATEGORIES.includes(c)) return c
  if (c.includes('半成')) return '半成品'
  if (c.includes('成品') || c === '产成品') return '成品'
  if (c.includes('原材') || c.includes('板材') || c.includes('型材')) return '原材料'
  return '零部件'
}

function defaultLocationByCategory(category) {
  const cat = normalizeCategory(category)
  if (cat === '原材料') return 'R-待分配'
  if (cat === '半成品') return 'S-待分配'
  if (cat === '成品') return 'F-待分配'
  return 'P-待分配'
}

function buildCategoryMaterials(startIndex, category, zonePrefix, templates, count) {
  const out = []
  for (let i = 0; i < count; i += 1) {
    const t = templates[i % templates.length]
    const spec = t.specs[i % t.specs.length]
    const row = String(Math.floor(i / 10) + 1).padStart(2, '0')
    const col = String((i % 10) + 1).padStart(2, '0')
    const safetyBase = category === '原材料' ? 8 : category === '半成品' ? 3 : 6
    const safetyQty = safetyBase + (i % 4)
    const stockQty = safetyQty + ((i * 3) % 11)
    out.push({
      code: `MAT-${String(startIndex + i).padStart(4, '0')}`,
      name: t.name,
      spec,
      unit: t.unit,
      category,
      location: `${zonePrefix}-${row}-${col}`,
      safetyQty,
      stockQty,
      lastInDate: '',
      lastOutDate: '',
    })
  }
  return out
}

function buildDefaultMaterials() {
  const raws = buildCategoryMaterials(1, '原材料', 'R', RAW_TEMPLATES, 100)
  const semis = buildCategoryMaterials(101, '半成品', 'S', SEMI_TEMPLATES, 100)
  const parts = buildCategoryMaterials(201, '零部件', 'P', PART_TEMPLATES, 100)
  return [...raws, ...semis, ...parts]
}

function defaultData() {
  return {
    materials: buildDefaultMaterials(),
    transactions: [],
  }
}

function normalizeData(data) {
  if (!data || typeof data !== 'object') return defaultData()
  const materials = Array.isArray(data.materials) ? data.materials : []
  const transactions = Array.isArray(data.transactions) ? data.transactions : []
  for (const m of materials) {
    if (!m.code) m.code = nextCode(materials)
    if (!m.name) m.name = '未命名物料'
    if (!m.unit) m.unit = '件'
    if (!Number.isFinite(Number(m.stockQty))) m.stockQty = 0
    if (!Number.isFinite(Number(m.safetyQty))) m.safetyQty = 0
    if (!m.location) m.location = '待分配'
    m.category = normalizeCategory(m.category)
    if (!m.spec) m.spec = ''
    if (!m.lastInDate) m.lastInDate = ''
    if (!m.lastOutDate) m.lastOutDate = ''
  }
  return { materials, transactions }
}

function loadInitial() {
  if (localStorage.getItem(SCHEMA_KEY) !== SCHEMA_VER) {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.setItem(SCHEMA_KEY, SCHEMA_VER)
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return normalizeData(JSON.parse(raw))
  } catch {
    /* ignore */
  }
  return defaultData()
}

export const useWarehouseStore = defineStore('warehouse', () => {
  const data = ref(loadInitial())

  watch(
    data,
    (v) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(v))
      } catch {
        /* ignore */
      }
    },
    { deep: true },
  )

  function materialByCode(code) {
    return data.value.materials.find((m) => m.code === code) || null
  }

  function ensureMaterial(payload = {}) {
    const code = String(payload.code || '').trim()
    if (code) {
      const exists = materialByCode(code)
      if (exists) return exists.code
    }
    const name = String(payload.name || '').trim()
    const spec = String(payload.spec || '').trim()
    const unit = String(payload.unit || '').trim() || '件'
    const existsByMeta = data.value.materials.find(
      (m) => m.name === name && String(m.spec || '') === spec && String(m.unit || '件') === unit,
    )
    if (existsByMeta) return existsByMeta.code
    const newCode = nextCode(data.value.materials)
    const cat = normalizeCategory(payload.category)
    data.value.materials.push({
      code: newCode,
      name: name || '未命名物料',
      spec,
      unit,
      category: cat,
      location: String(payload.location || '').trim() || defaultLocationByCategory(cat),
      safetyQty: Math.max(0, Number(payload.safetyQty) || 0),
      stockQty: Math.max(0, Number(payload.stockQty) || 0),
      lastInDate: '',
      lastOutDate: '',
    })
    return newCode
  }

  function addTransaction(payload) {
    data.value.transactions.unshift({
      id: nextTxId(data.value.transactions),
      type: payload.type,
      materialCode: payload.materialCode,
      qty: Number(payload.qty) || 0,
      date: payload.date || todayStr(),
      operator: payload.operator || '—',
      refType: payload.refType || '手工',
      refId: payload.refId || '',
      note: payload.note || '',
    })
  }

  function receiveInbound(payload) {
    const qty = Math.max(0, Number(payload.qty) || 0)
    if (!qty) return false
    const code = ensureMaterial(payload)
    const m = materialByCode(code)
    if (!m) return false
    m.stockQty = Math.max(0, Number(m.stockQty) || 0) + qty
    m.lastInDate = payload.date || todayStr()
    addTransaction({
      type: '入库',
      materialCode: code,
      qty,
      date: payload.date || todayStr(),
      operator: payload.operator || '采购',
      refType: payload.refType || '采购到货',
      refId: payload.refId || '',
      note: payload.note || '',
    })
    return true
  }

  function issueOutbound(payload) {
    const qty = Math.max(0, Number(payload.qty) || 0)
    const code = String(payload.materialCode || '').trim()
    const m = materialByCode(code)
    if (!m || !qty) return { ok: false, message: '物料或数量无效' }
    if ((Number(m.stockQty) || 0) < qty) return { ok: false, message: '库存不足' }
    m.stockQty = (Number(m.stockQty) || 0) - qty
    m.lastOutDate = payload.date || todayStr()
    addTransaction({
      type: '出库',
      materialCode: code,
      qty,
      date: payload.date || todayStr(),
      operator: payload.operator || '仓管',
      refType: payload.refType || '生产领料',
      refId: payload.refId || '',
      note: payload.note || '',
    })
    return { ok: true }
  }

  /**
   * 仓库手工新增物料（原材料 / 半成品 / 成品 / 零部件）
   * @returns {{ ok: true, code: string } | { ok: false, message: string }}
   */
  function addMaterial(payload = {}) {
    const name = String(payload.name || '').trim()
    if (!name) return { ok: false, message: '请输入物料名称' }
    const category = normalizeCategory(payload.category)
    const unit = String(payload.unit || '').trim() || '件'
    const spec = String(payload.spec || '').trim()
    const dup = data.value.materials.find(
      (m) =>
        m.name === name &&
        String(m.spec || '') === spec &&
        String(m.unit || '') === unit &&
        m.category === category,
    )
    if (dup) return { ok: false, message: `同分类下已存在相同名称/规格/单位：${dup.code}` }
    const newCode = nextCode(data.value.materials)
    const location = String(payload.location || '').trim() || defaultLocationByCategory(category)
    const safetyQty = Math.max(0, Number(payload.safetyQty) || 0)
    const initialStock = Math.max(0, Number(payload.stockQty ?? payload.initialStock) || 0)
    const date = String(payload.date || todayStr()).trim() || todayStr()
    const operator = String(payload.operator || '').trim() || '仓管'

    data.value.materials.push({
      code: newCode,
      name,
      spec,
      unit,
      category,
      location,
      safetyQty,
      stockQty: initialStock,
      lastInDate: initialStock > 0 ? date : '',
      lastOutDate: '',
    })
    if (initialStock > 0) {
      addTransaction({
        type: '入库',
        materialCode: newCode,
        qty: initialStock,
        date,
        operator,
        refType: '手工建档',
        refId: '',
        note: String(payload.note || '').trim() || '新增物料期初库存',
      })
    }
    return { ok: true, code: newCode }
  }

  function adjustStock(payload) {
    const code = String(payload.materialCode || '').trim()
    const m = materialByCode(code)
    if (!m) return { ok: false, message: '未找到物料' }
    const next = Math.max(0, Number(payload.newQty) || 0)
    const delta = next - (Number(m.stockQty) || 0)
    m.stockQty = next
    addTransaction({
      type: '盘点调整',
      materialCode: code,
      qty: Math.abs(delta),
      date: payload.date || todayStr(),
      operator: payload.operator || '仓管',
      refType: '盘点',
      refId: payload.refId || '',
      note: payload.note || (delta >= 0 ? '盘盈调整' : '盘亏调整'),
    })
    return { ok: true }
  }

  return {
    data,
    materialByCode,
    ensureMaterial,
    addMaterial,
    receiveInbound,
    issueOutbound,
    adjustStock,
  }
})
