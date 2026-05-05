'use client'

import { useEffect, useState } from 'react'
import { NeoCard, NeoCardHeader, NeoCardTitle, NeoCardContent } from '@/components/ui/neo-card'
import { NeoBadge } from '@/components/ui/neo-badge'
import { Users, Mail, Calendar, Shield, Loader2 } from 'lucide-react'

interface User {
  id: string
  email: string
  name: string
  role: 'user' | 'admin'
  createdAt: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch('/api/admin/users')
        if (res.ok) {
          const data = await res.json()
          setUsers(data.users || [])
        }
      } catch (error) {
        console.error('Failed to fetch users:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchUsers()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-white/60 text-sm">Loading users...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">User Management</h1>
        <p className="text-white/60 mt-1">View and manage registered users</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <NeoCard className="bg-[#111111]/90 backdrop-blur-xl border border-white/5">
          <NeoCardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-white/60 text-sm">Total Users</p>
                <p className="text-2xl font-bold text-white">{users.length}</p>
              </div>
            </div>
          </NeoCardContent>
        </NeoCard>

        <NeoCard className="bg-[#111111]/90 backdrop-blur-xl border border-white/5">
          <NeoCardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-white/60 text-sm">Admins</p>
                <p className="text-2xl font-bold text-white">{users.filter(u => u.role === 'admin').length}</p>
              </div>
            </div>
          </NeoCardContent>
        </NeoCard>

        <NeoCard className="bg-[#111111]/90 backdrop-blur-xl border border-white/5">
          <NeoCardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-white/60 text-sm">Regular Users</p>
                <p className="text-2xl font-bold text-white">{users.filter(u => u.role === 'user' || !u.role).length}</p>
              </div>
            </div>
          </NeoCardContent>
        </NeoCard>
      </div>

      {/* Users List */}
      <NeoCard className="bg-[#111111]/90 backdrop-blur-xl border border-white/5">
        <NeoCardHeader>
          <NeoCardTitle className="text-white flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <Users className="w-4 h-4 text-cyan-400" />
            </div>
            Registered Users
          </NeoCardTitle>
        </NeoCardHeader>
        <NeoCardContent>
          {users.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/40">No users registered yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white font-medium">{user.name}</p>
                      <div className="flex items-center gap-2 text-white/40 text-sm">
                        <Mail className="w-3 h-3" />
                        {user.email}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <div className="flex items-center gap-1 text-white/40 text-xs">
                        <Calendar className="w-3 h-3" />
                        {new Date(user.createdAt).toLocaleDateString('id-ID')}
                      </div>
                    </div>
                    <NeoBadge variant={user.role === 'admin' ? 'accent' : 'outline'}>
                      {user.role === 'admin' ? 'Admin' : 'User'}
                    </NeoBadge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </NeoCardContent>
      </NeoCard>
    </div>
  )
}
