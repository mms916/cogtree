import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, Clock, X } from 'lucide-react'

const DEFAULT_MINUTES = 25
const PRESET_MINUTES = [20, 25, 45]

function formatSeconds(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function FocusTimerButton() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_MINUTES)
  const [customMinutes, setCustomMinutes] = useState(String(DEFAULT_MINUTES))
  const [remainingSeconds, setRemainingSeconds] = useState(DEFAULT_MINUTES * 60)
  const [running, setRunning] = useState(false)
  const [finishedMinutes, setFinishedMinutes] = useState<number | null>(null)

  const label = useMemo(() => formatSeconds(remainingSeconds), [remainingSeconds])

  useEffect(() => {
    if (!running) return

    const intervalId = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(intervalId)
          setRunning(false)
          setFinishedMinutes(durationMinutes)
          return 0
        }

        return current - 1
      })
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [durationMinutes, running])

  const startTimer = (minutes: number) => {
    const nextMinutes = Math.max(1, Math.min(240, Math.round(minutes)))
    setDurationMinutes(nextMinutes)
    setCustomMinutes(String(nextMinutes))
    setRemainingSeconds(nextMinutes * 60)
    setRunning(true)
    setMenuOpen(false)
    setFinishedMinutes(null)
  }

  const pauseOrResume = () => {
    if (remainingSeconds <= 0) {
      startTimer(durationMinutes)
      return
    }
    setRunning((current) => !current)
  }

  const applyCustomMinutes = () => {
    const parsedMinutes = Number(customMinutes)
    if (!Number.isFinite(parsedMinutes)) return
    startTimer(parsedMinutes)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setMenuOpen((current) => !current)}>
        <Clock size={14} />
        {label}
        <ChevronDown size={14} style={{ marginLeft: 4 }} />
      </button>

      {menuOpen && (
        <div
          className="canvas-context-menu"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            left: 'auto',
            width: '190px',
            zIndex: 50,
            padding: '8px'
          }}
        >
          <div style={{ padding: '3px 5px 8px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>
            专注时长
          </div>
          {PRESET_MINUTES.map((minutes) => (
            <button
              key={minutes}
              className="canvas-context-menu-item"
              onClick={() => startTimer(minutes)}
              style={{ justifyContent: 'space-between' }}
            >
              <span>{minutes} 分钟</span>
              {durationMinutes === minutes && <Check size={13} />}
            </button>
          ))}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: '6px',
              marginTop: '8px',
              paddingTop: '8px',
              borderTop: '1px solid rgba(148, 163, 184, 0.12)'
            }}
          >
            <input
              type="number"
              min={1}
              max={240}
              value={customMinutes}
              onChange={(event) => setCustomMinutes(event.target.value)}
              style={{
                width: '100%',
                minWidth: 0,
                height: '30px',
                borderRadius: '6px',
                border: '1px solid rgba(45, 212, 191, 0.22)',
                background: 'rgba(9, 11, 16, 0.84)',
                color: 'var(--text-primary)',
                padding: '0 8px',
                outline: 'none'
              }}
            />
            <button className="canvas-context-menu-item" onClick={applyCustomMinutes} style={{ width: '56px', padding: 0, justifyContent: 'center' }}>
              开始
            </button>
          </div>
          <button className="canvas-context-menu-item" onClick={pauseOrResume} style={{ marginTop: '6px' }}>
            {running ? '暂停倒计时' : remainingSeconds <= 0 ? '重新开始' : '继续倒计时'}
          </button>
        </div>
      )}

      {finishedMinutes !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(3, 7, 18, 0.64)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(8px)'
          }}
        >
          <div
            style={{
              width: '360px',
              maxWidth: 'calc(100vw - 40px)',
              borderRadius: '12px',
              border: '1px solid rgba(45, 212, 191, 0.24)',
              background: 'rgba(12, 17, 25, 0.96)',
              boxShadow: '0 22px 60px rgba(0,0,0,0.45)',
              padding: '20px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <strong style={{ color: 'var(--text-primary)', fontSize: '17px' }}>专注完成</strong>
              <button className="icon-btn" onClick={() => setFinishedMinutes(null)} title="关闭">
                <X size={16} />
              </button>
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.7 }}>
              你已经专注了 {finishedMinutes} 分钟。现在可以站起来活动一下，喝口水，让大脑休息一会儿。
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
              <button onClick={() => setFinishedMinutes(null)}>稍后休息</button>
              <button className="primary" onClick={() => startTimer(durationMinutes)}>再来一轮</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
