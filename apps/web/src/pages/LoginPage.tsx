import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { GitMerge, Lock, Mail } from 'lucide-react'

import { useAuthStore } from '../stores/useAuthStore'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const initialized = useAuthStore((state) => state.initialized)
  const initialize = useAuthStore((state) => state.initialize)
  const login = useAuthStore((state) => state.login)
  const loginError = useAuthStore((state) => state.loginError)
  const [email, setEmail] = useState('68284537@qq.com')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fromPath = (location.state as { from?: string } | null)?.from ?? '/app/books'

  useEffect(() => {
    if (!initialized) {
      void initialize()
    }
  }, [initialize, initialized])

  useEffect(() => {
    if (initialized && user) {
      navigate(fromPath, { replace: true })
    }
  }, [fromPath, initialized, navigate, user])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    const success = await login(email, password)
    setIsSubmitting(false)
    if (success) {
      navigate(fromPath, { replace: true })
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <div className="login-logo">
            <GitMerge size={24} />
          </div>
          <div>
            <div className="login-title">CogTree</div>
            <div className="login-subtitle">登录你的知识工作台</div>
          </div>
        </div>

        <label className="login-field">
          <span>账号邮箱</span>
          <div className="login-input-wrap">
            <Mail size={16} />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="请输入邮箱"
              autoComplete="email"
            />
          </div>
        </label>

        <label className="login-field">
          <span>密码</span>
          <div className="login-input-wrap">
            <Lock size={16} />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="请输入密码"
              autoComplete="current-password"
            />
          </div>
        </label>

        {loginError && <div className="login-error">{loginError}</div>}

        <button className="login-submit" type="submit" disabled={isSubmitting || !email.trim() || !password}>
          {isSubmitting ? '登录中...' : '登录'}
        </button>
      </form>
    </div>
  )
}
