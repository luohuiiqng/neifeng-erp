<template>
  <div class="nf-login-wrap">
   
    <canvas
      ref="fountainCanvas"
      :class="['nf-fountain-canvas', !fxVisible ? 'nf-fountain-canvas--hidden' : '']"
      aria-hidden="true"
    ></canvas>
    <div class="nf-tools-hotzone" aria-hidden="true"></div>
    <div class="nf-login-tools">
      <span class="nf-tools-label"><span class="nf-tools-label-text">动效</span></span>
      <el-switch
        class="nf-fx-switch"
        v-model="effectsEnabled"
        :disabled="motionBlocked"
        inline-prompt
        active-text="开"
        inactive-text="关"
        @change="onToggleEffects"
      />
    </div>    
    <div class="nf-login-shell">
      <section class="nf-brand-panel">
        <div class="nf-brand-top">
          <div class="nf-mark"></div>
          <div>
            <h1 class="nf-brand-title">润丰 Rich Full</h1>
            <p class="nf-brand-sub">制造协同 ERP</p>
            <p class="nf-brand-sub-en">Manufacturing Collaboration ERP</p>
          </div>
        </div>
        <div class="nf-brand-main">
          <h2>浙江润丰机械有限公司</h2>
          <p>Zhejiang Runfeng Machinery Co., Ltd.</p>
        </div>
        <p class="nf-brand-note">仅限公司授权账号访问，请勿外传账号信息。</p>
      </section>

      <el-card class="nf-login-card" shadow="hover">
        <template #header>
          <div class="nf-login-title">润丰 ERP 登录</div>
        </template>
        <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
          <el-form-item label="账号" prop="username">
            <el-input v-model="form.username" placeholder="请输入账号，如 admin" />
          </el-form-item>
          <el-form-item label="密码" prop="password">
            <el-input v-model="form.password" type="password" show-password placeholder="请输入密码" @keyup.enter="onLogin" />
          </el-form-item>
          <el-button type="danger" class="nf-login-btn" @click="onLogin">登录系统</el-button>
        </el-form>
        <p class="nf-hint">默认管理员账号：admin / admin123</p>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
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
const fountainCanvas = ref(null)
const effectsEnabled = ref(true)
const motionBlocked = ref(false)
const fxVisible = ref(true)
let rafId = 0
let resizeTimer = 0
let ctx = null
let particles = []
let ripples = []
let splashes = []
let emitCarry = 0
let lastTs = 0
let effectRunning = false
const FX_STORAGE_KEY = 'nf.login.effect.enabled'

function rand(min, max) {
  return Math.random() * (max - min) + min
}

function spawnParticle(w, h) {
  const centerX = w * 0.5
  const spread = Math.max(90, w * 0.16)
  return {
    x: centerX + rand(-spread, spread),
    y: rand(-h * 0.28, -12),
    vx: rand(-18, 18),
    vy: rand(90, 220),
    g: rand(26, 58),
    life: rand(9.2, 13.5),
    age: 0,
    size: rand(1.8, 6.8),
    hue: rand(40, 50),
    alpha: rand(0.48, 0.95),
    rot: rand(0, Math.PI * 2),
    rotSpeed: rand(-2.8, 2.8),
    swayAmp: rand(4, 24),
    swaySpeed: rand(1.1, 2.8),
    seed: rand(0, Math.PI * 2),
  }
}

function drawParticle(p) {
  const fade = 1 - p.age / p.life
  if (fade <= 0) return
  const radius = p.size * (0.72 + fade * 0.58)
  const flip = Math.abs(Math.sin(p.rot))
  const ry = radius * (0.26 + flip * 0.74)

  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(p.rot)

  ctx.shadowColor = `hsla(${p.hue}, 100%, 62%, ${0.65 * fade})`
  ctx.shadowBlur = 12 * fade

  ctx.beginPath()
  ctx.fillStyle = `hsla(${p.hue}, 95%, ${56 + fade * 20}%, ${p.alpha * fade})`
  ctx.ellipse(0, 0, radius, ry, 0, 0, Math.PI * 2)
  ctx.fill()

  // 硬币高光边缘，模拟翻转时的金属反光
  ctx.beginPath()
  ctx.strokeStyle = `hsla(${p.hue + 4}, 92%, 78%, ${0.56 * fade})`
  ctx.lineWidth = Math.max(0.7, radius * 0.22)
  ctx.ellipse(0, 0, radius * 0.74, ry * 0.74, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

function spawnRipple(x, y) {
  ripples.push({
    x,
    y,
    age: 0,
    life: rand(0.8, 1.3),
    maxR: rand(22, 42),
    alpha: rand(0.28, 0.5),
  })
}

function spawnSplash(x, y) {
  const n = Math.round(rand(2, 5))
  for (let i = 0; i < n; i += 1) {
    splashes.push({
      x: x + rand(-4, 4),
      y: y + rand(-1, 1),
      vx: rand(-42, 42),
      vy: rand(-120, -58),
      g: rand(340, 420),
      age: 0,
      life: rand(0.3, 0.55),
      size: rand(1, 2.4),
      alpha: rand(0.4, 0.8),
    })
  }
}

function drawPond(w, h, ts) {
  const cx = w * 0.5
  const cy = h * 0.87
  const rw = Math.max(140, w * 0.28)
  const rh = Math.max(26, h * 0.042)
  const wave = Math.sin(ts * 0.0024) * 0.5 + 0.5

  const pondGlow = ctx.createRadialGradient(cx, cy + 3, 8, cx, cy + 3, rw * 1.4)
  pondGlow.addColorStop(0, 'rgba(65, 140, 255, 0.22)')
  pondGlow.addColorStop(1, 'rgba(65, 140, 255, 0)')
  ctx.fillStyle = pondGlow
  ctx.beginPath()
  ctx.ellipse(cx, cy + 6, rw * 1.35, rh * 1.9, 0, 0, Math.PI * 2)
  ctx.fill()

  const pondGrad = ctx.createLinearGradient(cx, cy - rh, cx, cy + rh)
  pondGrad.addColorStop(0, 'rgba(36, 121, 232, 0.3)')
  pondGrad.addColorStop(0.55, 'rgba(18, 92, 188, 0.42)')
  pondGrad.addColorStop(1, 'rgba(9, 58, 126, 0.5)')
  ctx.fillStyle = pondGrad
  ctx.beginPath()
  ctx.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = `rgba(184, 224, 255, ${0.2 + wave * 0.18})`
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.ellipse(cx, cy - 1, rw * 0.88, rh * 0.64, 0, 0, Math.PI * 2)
  ctx.stroke()

  // 中央吸附涡点
  const swirl = 0.45 + Math.sin(ts * 0.004) * 0.2
  const core = ctx.createRadialGradient(cx, cy + 1, 1, cx, cy + 1, rw * 0.28)
  core.addColorStop(0, `rgba(20, 57, 112, ${0.46 + swirl * 0.18})`)
  core.addColorStop(0.55, 'rgba(26, 89, 177, 0.18)')
  core.addColorStop(1, 'rgba(26, 89, 177, 0)')
  ctx.fillStyle = core
  ctx.beginPath()
  ctx.ellipse(cx, cy + 1, rw * 0.28, rh * 0.24, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawRipples(dt) {
  for (let i = ripples.length - 1; i >= 0; i -= 1) {
    const r = ripples[i]
    r.age += dt
    const k = r.age / r.life
    if (k >= 1) {
      ripples.splice(i, 1)
      continue
    }
    const radius = 2 + r.maxR * k
    const alpha = r.alpha * (1 - k)
    ctx.beginPath()
    ctx.strokeStyle = `rgba(173, 219, 255, ${alpha})`
    ctx.lineWidth = Math.max(0.7, 1.5 * (1 - k))
    ctx.ellipse(r.x, r.y, radius, radius * 0.24, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
}

function drawSplashes(dt) {
  for (let i = splashes.length - 1; i >= 0; i -= 1) {
    const s = splashes[i]
    s.age += dt
    if (s.age >= s.life) {
      splashes.splice(i, 1)
      continue
    }
    s.vy += s.g * dt
    s.x += s.vx * dt
    s.y += s.vy * dt
    const k = 1 - s.age / s.life
    ctx.beginPath()
    ctx.fillStyle = `rgba(255, 217, 122, ${s.alpha * k})`
    ctx.arc(s.x, s.y, s.size * (0.65 + k * 0.5), 0, Math.PI * 2)
    ctx.fill()
  }
}

function frame(ts) {
  const canvas = fountainCanvas.value
  if (!canvas || !ctx) return
  if (!lastTs) lastTs = ts
  const dt = Math.min((ts - lastTs) / 1000, 0.032)
  lastTs = ts
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  const pondX = w * 0.5
  const pondY = h * 0.87
  const pondRx = Math.max(140, w * 0.28)
  const pondRy = Math.max(26, h * 0.042)

  ctx.clearRect(0, 0, w, h)

  const isMobile = w < 900
  const targetCount = isMobile ? 62 : 116
  const emitRate = isMobile ? 26 : 44
  emitCarry += emitRate * dt
  while (emitCarry >= 1 && particles.length < targetCount) {
    particles.push(spawnParticle(w, h))
    emitCarry -= 1
  }

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i]
    p.age += dt
    p.vy += p.g * dt
    p.rot += p.rotSpeed * dt

    // 全程向水潭中心汇聚；越靠近水面吸附越强
    const dx = pondX - p.x
    const dy = pondY - p.y
    const dist = Math.hypot(dx, dy) || 1
    const progress = Math.min(1, Math.max(0, (p.y + h * 0.3) / (pondY + h * 0.3)))
    const globalPull = 22 + 150 * progress * progress
    p.vx += (dx / dist) * globalPull * dt
    p.vy += (dy / dist) * (globalPull * 0.46) * dt

    const absorbRange = pondRx * 1.85
    if (p.y > pondY - pondRy * 5.5 && dist < absorbRange) {
      const t = 1 - dist / absorbRange
      const pull = 130 + 680 * t * t
      p.vx += (dx / dist) * pull * dt
      p.vy += (dy / dist) * pull * dt + 170 * t * dt
      p.vx *= 0.996
    }

    const swayFactor = 1 - progress * 0.88
    p.x += (p.vx + Math.sin((p.age + p.seed) * p.swaySpeed) * p.swayAmp * Math.max(0.08, swayFactor)) * dt
    p.y += p.vy * dt

    const centerDx = Math.abs(p.x - pondX)
    const inCore = centerDx < pondRx * 0.14 && p.y > pondY - pondRy * 0.45
    const centerImpact = p.y >= pondY - pondRy * 0.05 && centerDx < pondRx * 0.18
    if (inCore || centerImpact) {
      const impactX = pondX + rand(-pondRx * 0.05, pondRx * 0.05)
      spawnRipple(impactX, pondY + rand(0, 4))
      spawnSplash(impactX, pondY - 1)
      particles.splice(i, 1)
      continue
    }
    // 已触达水面但偏离中心时，沿水面继续被拉向中心
    if (p.y > pondY - pondRy * 0.08 && centerDx >= pondRx * 0.18) {
      p.y = pondY - pondRy * 0.08
      p.vy *= 0.25
    }
    if (p.y > h + 28 || p.x < -36 || p.x > w + 36 || p.age > p.life) {
      particles.splice(i, 1)
      continue
    }
    drawParticle(p)
  }
  drawPond(w, h, ts)
  drawRipples(dt)
  drawSplashes(dt)
  ctx.shadowBlur = 0

  rafId = window.requestAnimationFrame(frame)
}

function resizeCanvas() {
  const canvas = fountainCanvas.value
  if (!canvas) return
  const dpr = window.devicePixelRatio || 1
  const { width, height } = canvas.getBoundingClientRect()
  canvas.width = Math.max(1, Math.floor(width * dpr))
  canvas.height = Math.max(1, Math.floor(height * dpr))
  ctx = canvas.getContext('2d')
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function onResize() {
  window.clearTimeout(resizeTimer)
  resizeTimer = window.setTimeout(() => {
    resizeCanvas()
  }, 80)
}

function resetEffectState() {
  particles = []
  ripples = []
  splashes = []
  emitCarry = 0
  lastTs = 0
}

function clearCanvas() {
  const canvas = fountainCanvas.value
  if (!canvas || !ctx) return
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)
}

function startEffect() {
  if (effectRunning || motionBlocked.value || !effectsEnabled.value) return
  resizeCanvas()
  window.addEventListener('resize', onResize, { passive: true })
  rafId = window.requestAnimationFrame(frame)
  effectRunning = true
  fxVisible.value = true
}

function stopEffect() {
  if (rafId) window.cancelAnimationFrame(rafId)
  rafId = 0
  window.removeEventListener('resize', onResize)
  window.clearTimeout(resizeTimer)
  effectRunning = false
  resetEffectState()
  clearCanvas()
  fxVisible.value = false
}

function onToggleEffects(v) {
  localStorage.setItem(FX_STORAGE_KEY, v ? '1' : '0')
  if (v) startEffect()
  else stopEffect()
}

onMounted(() => {
  motionBlocked.value = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false
  const saved = localStorage.getItem(FX_STORAGE_KEY)
  effectsEnabled.value = saved == null ? false : saved === '1'
  if (motionBlocked.value) {
    effectsEnabled.value = false
    fxVisible.value = false
    return
  }
  if (effectsEnabled.value) startEffect()
  else fxVisible.value = false
})

onBeforeUnmount(() => {
  stopEffect()
})

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
  position: relative;
  overflow: hidden;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f7f8fb 0%, #edf1f8 62%, #f6f7fa 100%);
  padding: 24px;
}
.nf-top-slogan {
  position: absolute;
  top: 16px;
  left: 50%;
  z-index: 3;
  transform: translateX(-50%);
  padding: 8px 20px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(4px);
  color: #334155;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 3px;
  user-select: none;
}
.nf-login-wrap::before,
.nf-login-wrap::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  filter: blur(2px);
}
.nf-login-wrap::before {
  width: 420px;
  height: 420px;
  top: -120px;
  left: -120px;
  background: radial-gradient(circle, rgba(180, 26, 33, 0.08) 0%, rgba(180, 26, 33, 0) 70%);
  animation: floatGlowA 12s ease-in-out infinite;
}
.nf-login-wrap::after {
  width: 360px;
  height: 360px;
  bottom: -140px;
  right: -110px;
  background: radial-gradient(circle, rgba(32, 82, 156, 0.08) 0%, rgba(32, 82, 156, 0) 72%);
  animation: floatGlowB 14s ease-in-out infinite;
}
.nf-fountain-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  opacity: 0.72;
  mix-blend-mode: normal;
  transition: opacity 220ms ease;
}
.nf-fountain-canvas--hidden {
  opacity: 0;
}
.nf-login-shell {
  position: relative;
  z-index: 1;
  width: 1080px;
  max-width: 100%;
  display: grid;
  grid-template-columns: minmax(460px, 1fr) 380px;
  gap: 20px;
  animation: shellIn 520ms ease-out both;
}
.nf-login-tools {
  position: absolute;
  top: 16px;
  right: 22px;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 9px 6px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.76);
  border: 1px solid rgba(148, 163, 184, 0.32);
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.06);
  backdrop-filter: blur(6px);
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
  pointer-events: none;
  transition: opacity 180ms ease, transform 180ms ease, box-shadow 180ms ease, background 180ms ease;
}
.nf-tools-hotzone {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 140px;
  height: 52px;
  z-index: 2;
}
.nf-tools-hotzone:hover + .nf-login-tools,
.nf-login-tools:hover,
.nf-login-tools:focus-within {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.1);
}
.nf-tools-label {
  position: relative;
  display: inline-flex;
  align-items: center;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
  padding-left: 10px;
}
.nf-tools-label::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: radial-gradient(circle, #f59e0b 0%, #facc15 100%);
  transform: translateY(-50%);
  box-shadow: 0 0 10px rgba(245, 158, 11, 0.4);
}
.nf-tools-label-text {
  max-width: 0;
  opacity: 0;
  overflow: hidden;
  white-space: nowrap;
  letter-spacing: 0.2px;
  transform: translateX(-4px);
  transition: max-width 180ms ease, opacity 180ms ease, transform 180ms ease;
}
.nf-login-tools:hover .nf-tools-label-text,
.nf-login-tools:focus-within .nf-tools-label-text {
  max-width: 28px;
  opacity: 1;
  transform: translateX(0);
}

:deep(.nf-fx-switch.el-switch) {
  --el-switch-on-color: #b41a21;
  --el-switch-off-color: #cbd5e1;
  height: 22px;
  width: 0;
  opacity: 0;
  overflow: hidden;
  transform: translateX(6px);
  pointer-events: none;
  transition: width 180ms ease, opacity 180ms ease, transform 180ms ease;
}
.nf-login-tools:hover :deep(.nf-fx-switch.el-switch),
.nf-login-tools:focus-within :deep(.nf-fx-switch.el-switch) {
  width: 44px;
  opacity: 1;
  transform: translateX(0);
  pointer-events: auto;
}
:deep(.nf-fx-switch .el-switch__core) {
  min-width: 44px !important;
  height: 22px;
  border-radius: 999px;
}
:deep(.nf-fx-switch .el-switch__action) {
  width: 18px;
  height: 18px;
}
:deep(.nf-fx-switch .el-switch__inner .is-text) {
  font-size: 10px;
  font-weight: 600;
}
.nf-brand-panel {
  position: relative;
  overflow: hidden;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #ebeef5;
  backdrop-filter: blur(2px);
  padding: 28px 30px;
  animation: panelIn 640ms ease-out 80ms both;
}
.nf-brand-panel::after {
  content: '';
  position: absolute;
  right: -90px;
  bottom: -90px;
  width: 260px;
  height: 260px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(180, 26, 33, 0.16) 0%, rgba(180, 26, 33, 0) 65%);
}
.nf-brand-top {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}
.nf-mark {
  width: 10px;
  height: 52px;
  border-radius: 2px;
  background: #b41a21;
  animation: markPulse 2.4s ease-in-out infinite;
}
.nf-brand-title {
  margin: 0;
  font-size: 34px;
  line-height: 1.15;
  color: #1f2937;
  font-weight: 700;
}
.nf-brand-sub {
  margin: 8px 0 0;
  color: #111827;
  font-size: 17px;
  font-weight: 600;
}
.nf-brand-sub-en {
  margin: 5px 0 0;
  color: #4b5563;
  font-size: 14px;
}
.nf-brand-main {
  margin-top: 28px;
  padding-top: 18px;
  border-top: 1px solid #e5e7eb;
}
.nf-brand-main h2 {
  margin: 0;
  font-size: 37px;
  letter-spacing: 1px;
  color: #1f2937;
}
.nf-brand-main p {
  margin: 6px 0 0;
  color: #4b5563;
  font-size: 16px;
}
.nf-brand-note {
  margin: 24px 0 0;
  padding: 12px 14px;
  border-radius: 8px;
  background: #f9fafb;
  color: #4b5563;
  font-size: 14px;
  border: 1px dashed #d1d5db;
}
.nf-login-card {
  width: 100%;
  align-self: center;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #ebeef5;
  border-top: 3px solid #b41a21;
  animation: panelIn 640ms ease-out 160ms both;
}
.nf-login-title {
  font-size: 21px;
  font-weight: 700;
  text-align: center;
  color: #1f2937;
}
.nf-login-btn {
  width: 100%;
  margin-top: 6px;
  transition: transform 180ms ease, box-shadow 180ms ease, filter 180ms ease;
}
.nf-login-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 18px rgba(180, 26, 33, 0.22);
  filter: saturate(1.06);
}
.nf-login-btn:active {
  transform: translateY(0);
  box-shadow: 0 4px 10px rgba(180, 26, 33, 0.18);
}
.nf-hint {
  margin: 12px 0 0;
  color: #6b7280;
  font-size: 12px;
  text-align: center;
}

@keyframes shellIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes panelIn {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes markPulse {
  0%,
  100% {
    box-shadow: 0 0 0 rgba(180, 26, 33, 0.2);
  }
  50% {
    box-shadow: 0 0 14px rgba(180, 26, 33, 0.28);
  }
}

@keyframes floatGlowA {
  0%,
  100% {
    transform: translate(0, 0);
  }
  50% {
    transform: translate(16px, 10px);
  }
}

@keyframes floatGlowB {
  0%,
  100% {
    transform: translate(0, 0);
  }
  50% {
    transform: translate(-12px, -14px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .nf-login-wrap::before,
  .nf-login-wrap::after,
  .nf-login-shell,
  .nf-brand-panel,
  .nf-login-card,
  .nf-mark {
    animation: none !important;
  }
  .nf-login-btn {
    transition: none;
  }
  .nf-fountain-canvas {
    opacity: 0 !important;
  }
}

@media (max-width: 980px) {
  .nf-top-slogan {
    top: 10px;
    font-size: 16px;
    letter-spacing: 2px;
  }
  .nf-login-tools {
    top: 10px;
    right: 10px;
  }
  .nf-tools-hotzone {
    top: 4px;
    right: 4px;
  }
  .nf-login-shell {
    grid-template-columns: 1fr;
    width: 560px;
  }
  .nf-brand-title {
    font-size: 29px;
  }
  .nf-brand-main h2 {
    font-size: 29px;
  }
}

@media (hover: none) {
  .nf-tools-hotzone {
    display: none;
  }
  .nf-login-tools {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }
  .nf-tools-label-text {
    max-width: 28px;
    opacity: 1;
    transform: translateX(0);
  }
  :deep(.nf-fx-switch.el-switch) {
    width: 44px;
    opacity: 1;
    transform: translateX(0);
    pointer-events: auto;
  }
}

@media (max-width: 560px) {
  .nf-login-wrap {
    padding: 12px;
  }
  .nf-brand-panel {
    padding: 20px 18px;
  }
  .nf-brand-title {
    font-size: 24px;
  }
  .nf-brand-sub {
    font-size: 15px;
  }
  .nf-brand-main h2 {
    font-size: 22px;
  }
}
</style>
