import { permissionTip, permissionTitle } from '@/utils/permissionMeta'

export function approvalPermissionKey(approval) {
  if (!approval) return ''
  if (approval.type === '结案审批') return 'action_approve_close'
  if (approval.type === '采购申请') return 'action_approve_pr'
  if (approval.type === '采购单财务审核') return 'action_finance_audit_po'
  return ''
}

export function approvalPermissionTitle(approval) {
  const key = approvalPermissionKey(approval)
  return key ? permissionTitle(key) : ''
}

export function approvalPermissionTip(approval) {
  const key = approvalPermissionKey(approval)
  return key ? permissionTip(key) : '需要申请对应审批权限'
}
