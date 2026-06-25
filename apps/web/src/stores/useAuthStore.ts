import { create } from 'zustand'

import { fetchJson } from '../lib/api'

type AuthUser = {
  id: string
  email: string
  displayName: string
  avatarText: string
}

type LoginResponse = {
  success: true
  data: {
    token: string
    user: AuthUser
  }
}

type MeResponse = {
  success: true
  data: AuthUser
}

type AuthState = {
  user: AuthUser | null
  token: string | null
  initialized: boolean
  loginError: string | null
  initialize: () => Promise<void>
  login: (email: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
}

const tokenStorageKey = 'cogtree-auth-token'

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: typeof window === 'undefined' ? null : window.localStorage.getItem(tokenStorageKey),
  initialized: false,
  loginError: null,

  initialize: async () => {
    const token = typeof window === 'undefined' ? null : window.localStorage.getItem(tokenStorageKey)
    if (!token) {
      set({ token: null, user: null, initialized: true })
      return
    }

    try {
      const response = await fetchJson<MeResponse>('/auth/me')
      set({ token, user: response.data, initialized: true, loginError: null })
    } catch {
      if (typeof window !== 'undefined') window.localStorage.removeItem(tokenStorageKey)
      set({ token: null, user: null, initialized: true })
    }
  },

  login: async (email, password) => {
    set({ loginError: null })
    try {
      const response = await fetchJson<LoginResponse>('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (typeof window !== 'undefined') window.localStorage.setItem(tokenStorageKey, response.data.token)
      set({
        token: response.data.token,
        user: response.data.user,
        initialized: true,
        loginError: null,
      })
      return true
    } catch {
      set({ loginError: '账号或密码不正确' })
      return false
    }
  },

  logout: async () => {
    try {
      await fetchJson('/auth/logout', { method: 'POST' })
    } catch {
      // Local logout should still succeed if the server is unavailable.
    }
    if (typeof window !== 'undefined') window.localStorage.removeItem(tokenStorageKey)
    set({ token: null, user: null, initialized: true, loginError: null })
  },
}))
