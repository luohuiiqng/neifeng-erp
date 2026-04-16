import { ACTION_DEFS, MENU_DEFS } from '@/mock/data'

const MAP = new Map()

for (const x of MENU_DEFS) {
  MAP.set(x.key, x.title)
}
for (const x of ACTION_DEFS) {
  MAP.set(x.key, x.title)
}

export function permissionTitle(key) {
  return MAP.get(String(key || '').trim()) || String(key || '').trim()
}

export function permissionTip(key) {
  return `需要申请权限：${permissionTitle(key)}`
}
