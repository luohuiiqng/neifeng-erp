/**
 * 出货台数是否已全部登记（与流程状态「待出货」无必然一致：待出货表示已放行可登记，未必已出齐）。
 * @param {object | null | undefined} o 生产订单
 * @returns {boolean}
 */
export function isProductionOrderFullyShipped(o) {
  if (!o || typeof o !== 'object') return false
  const total = Math.max(0, Number(o.totalQty) || 0)
  const shipped = Math.max(0, Number(o.shippedQty) || 0)
  return total > 0 && shipped >= total
}

/**
 * 财务申请结案 / 审批同意结案：须台数出齐且流程状态为「已出货」（出货页登记满额后由系统自动从「待出货」转入）。
 * @param {object | null | undefined} o 生产订单
 * @returns {boolean}
 */
export function isProductionOrderReadyForCaseClose(o) {
  if (!isProductionOrderFullyShipped(o)) return false
  return String(o?.status || '').trim() === '已出货'
}

/**
 * 已登记回款是否禁止再改：仅「已结案」后锁定；未结案前（含已出齐台数）仍可改。
 * @param {object | null | undefined} o 生产订单
 * @returns {boolean}
 */
export function isProductionOrderReceivedAmountLocked(o) {
  if (!o || typeof o !== 'object') return false
  return String(o.status || '').trim() === '已结案'
}
