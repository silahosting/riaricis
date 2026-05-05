'use client'

import { useEffect, useState } from 'react'
import { NeoCard, NeoCardHeader, NeoCardTitle, NeoCardContent } from '@/components/ui/neo-card'
import { NeoBadge } from '@/components/ui/neo-badge'
import { CreditCard, Users, ShoppingCart, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface AdminStats {
  totalUsers: number
  totalOrders: number
  totalRevenue: number
  activePaymentMethods: number
  orkutEnabled: boolean
  midtransEnabled: boolean
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/admin/stats')
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  const statsCards = [
    {
      title: 'Total Users',
      value: stats?.totalUsers || 0,
      icon: Users,
      change: '+12%',
      trend: 'up',
      gradient: 'from-cyan-500 to-blue-600',
    },
    {
      title: 'Total Orders',
      value: stats?.totalOrders || 0,
      icon: ShoppingCart,
      change: '+8%',
      trend: 'up',
      gradient: 'from-violet-500 to-purple-600',
    },
    {
      title: 'Total Revenue',
      value: `Rp ${(stats?.totalRevenue || 0).toLocaleString('id-ID')}`,
      icon: TrendingUp,
      change: '+23%',
      trend: 'up',
      gradient: 'from-emerald-500 to-green-600',
    },
    {
      title: 'Payment Methods',
      value: stats?.activePaymentMethods || 0,
      icon: CreditCard,
      change: 'Active',
      trend: 'neutral',
      gradient: 'from-orange-500 to-amber-600',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">Admin Dashboard</h1>
        <p className="text-white/60 mt-1">Overview of your payment platform</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat) => (
          <div
            key={stat.title}
            className="relative group"
          >
            <div className="absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl blur-xl" 
              style={{ background: `linear-gradient(to right, var(--tw-gradient-stops))` }} 
            />
            <NeoCard className="relative bg-[#111111]/90 backdrop-blur-xl border border-white/5 hover:border-white/10 transition-all duration-300">
              <NeoCardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-medium ${
                    stat.trend === 'up' ? 'text-emerald-400' : stat.trend === 'down' ? 'text-red-400' : 'text-white/60'
                  }`}>
                    {stat.trend === 'up' && <ArrowUpRight className="w-3 h-3" />}
                    {stat.trend === 'down' && <ArrowDownRight className="w-3 h-3" />}
                    {stat.change}
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-white/60 text-sm">{stat.title}</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {loading ? (
                      <span className="inline-block w-20 h-7 bg-white/10 rounded animate-pulse" />
                    ) : (
                      stat.value
                    )}
                  </p>
                </div>
              </NeoCardContent>
            </NeoCard>
          </div>
        ))}
      </div>

      {/* Payment Methods Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <NeoCard className="bg-[#111111]/90 backdrop-blur-xl border border-white/5">
          <NeoCardHeader>
            <NeoCardTitle className="text-white flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-cyan-400" />
              </div>
              Payment Methods Status
            </NeoCardTitle>
          </NeoCardHeader>
          <NeoCardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">OK</span>
                </div>
                <div>
                  <p className="text-white font-medium">Orkut QRIS</p>
                  <p className="text-white/40 text-sm">Order Kuota Payment</p>
                </div>
              </div>
              <NeoBadge variant={stats?.orkutEnabled ? 'success' : 'destructive'}>
                {loading ? '...' : stats?.orkutEnabled ? 'Active' : 'Inactive'}
              </NeoBadge>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">MT</span>
                </div>
                <div>
                  <p className="text-white font-medium">Midtrans QRIS</p>
                  <p className="text-white/40 text-sm">Midtrans Payment Gateway</p>
                </div>
              </div>
              <NeoBadge variant={stats?.midtransEnabled ? 'success' : 'destructive'}>
                {loading ? '...' : stats?.midtransEnabled ? 'Active' : 'Inactive'}
              </NeoBadge>
            </div>
          </NeoCardContent>
        </NeoCard>

        {/* Quick Actions */}
        <NeoCard className="bg-[#111111]/90 backdrop-blur-xl border border-white/5">
          <NeoCardHeader>
            <NeoCardTitle className="text-white flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-violet-400" />
              </div>
              Quick Actions
            </NeoCardTitle>
          </NeoCardHeader>
          <NeoCardContent className="space-y-3">
            <a 
              href="/admin/payments"
              className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-cyan-400" />
                <span className="text-white font-medium">Configure Payment Methods</span>
              </div>
              <ArrowUpRight className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" />
            </a>
            <a 
              href="/admin/users"
              className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-violet-400" />
                <span className="text-white font-medium">Manage Users</span>
              </div>
              <ArrowUpRight className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" />
            </a>
          </NeoCardContent>
        </NeoCard>
      </div>
    </div>
  )
}
