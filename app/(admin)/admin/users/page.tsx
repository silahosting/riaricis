'use client'

import { useEffect, useState } from 'react'
import { NeoCard, NeoCardHeader, NeoCardTitle, NeoCardContent } from '@/components/ui/neo-card'
import { NeoButton } from '@/components/ui/neo-button'
import { NeoInput } from '@/components/ui/neo-input'
import { NeoBadge } from '@/components/ui/neo-badge'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Users, 
  Mail, 
  Calendar, 
  Shield, 
  Loader2, 
  Wallet, 
  Plus, 
  Minus, 
  TrendingUp,
  TrendingDown,
  History,
  Banknote,
  UserX,
  Trash2,
  Clock,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react'
import { toast } from 'sonner'

interface User {
  id: string
  email: string
  name: string
  role: 'user' | 'admin'
  createdAt: string
  lastLogin?: string | null
}

interface UserBalanceInfo {
  id: string
  name: string
  email: string
  totalRevenue: number
  totalWithdrawn: number
  totalAdjustments: number
  availableBalance: number
  adjustments: Array<{
    id: string
    amount: number
    type: 'add' | 'deduct'
    reason: string
    adminName: string
    createdAt: string
  }>
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getInactiveDays(lastLogin: string | null, createdAt: string): number {
  const referenceDate = lastLogin ? new Date(lastLogin) : new Date(createdAt)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - referenceDate.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [usersWithActivity, setUsersWithActivity] = useState<User[]>([])
  const [usersWithBalance, setUsersWithBalance] = useState<UserBalanceInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<UserBalanceInfo | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showHistoryDialog, setShowHistoryDialog] = useState(false)
  const [processing, setProcessing] = useState(false)
  
  // Delete user state
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [inactiveMonths, setInactiveMonths] = useState('3')
  
  // Form state
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [adjustType, setAdjustType] = useState<'add' | 'deduct'>('add')

  async function fetchUsers() {
    try {
      const res = await fetch('/api/admin/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  async function fetchUsersWithActivity() {
    try {
      const res = await fetch('/api/admin/users?withActivity=true')
      if (res.ok) {
        const data = await res.json()
        setUsersWithActivity(data.users || [])
      }
    } catch (error) {
      console.error('Failed to fetch users with activity:', error)
    }
  }

  async function fetchBalanceData() {
    try {
      const res = await fetch('/api/admin/balance')
      if (res.ok) {
        const data = await res.json()
        setUsersWithBalance(data.users || [])
      }
    } catch (error) {
      console.error('Failed to fetch balance data:', error)
    }
  }

  useEffect(() => {
    async function fetchAll() {
      setLoading(true)
      await Promise.all([fetchUsers(), fetchUsersWithActivity(), fetchBalanceData()])
      setLoading(false)
    }
    fetchAll()
  }, [])

  async function handleAddBalance() {
    if (!selectedUser || !amount || !reason) return
    
    setProcessing(true)
    try {
      const res = await fetch('/api/admin/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          amount: Number(amount),
          type: adjustType,
          reason,
        }),
      })

      if (res.ok) {
        await fetchBalanceData()
        setShowAddDialog(false)
        setAmount('')
        setReason('')
        setSelectedUser(null)
      } else {
        const data = await res.json()
        alert(data.error || 'Gagal menambah saldo')
      }
    } catch (error) {
      console.error('Error adding balance:', error)
      alert('Terjadi kesalahan')
    } finally {
      setProcessing(false)
    }
  }

  async function handleDeleteUser() {
    if (!userToDelete) return
    
    setDeleting(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userToDelete.id }),
      })

      if (res.ok) {
        toast.success(`User ${userToDelete.name} berhasil dihapus`)
        await Promise.all([fetchUsers(), fetchUsersWithActivity(), fetchBalanceData()])
        setShowDeleteDialog(false)
        setUserToDelete(null)
      } else {
        const data = await res.json()
        toast.error(data.error || 'Gagal menghapus user')
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      toast.error('Terjadi kesalahan saat menghapus user')
    } finally {
      setDeleting(false)
    }
  }

  function openAddDialog(user: UserBalanceInfo) {
    setSelectedUser(user)
    setAdjustType('add')
    setAmount('')
    setReason('')
    setShowAddDialog(true)
  }

  function openHistoryDialog(user: UserBalanceInfo) {
    setSelectedUser(user)
    setShowHistoryDialog(true)
  }

  function openDeleteDialog(user: User) {
    setUserToDelete(user)
    setShowDeleteDialog(true)
  }

  // Filter inactive users based on selected months
  const inactiveUsers = usersWithActivity.filter(user => {
    if (user.role === 'admin') return false // Don't show admins in inactive list
    const days = getInactiveDays(user.lastLogin || null, user.createdAt)
    const months = parseInt(inactiveMonths)
    return days >= months * 30
  })

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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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

        <NeoCard className="bg-[#111111]/90 backdrop-blur-xl border border-white/5">
          <NeoCardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
                <UserX className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-white/60 text-sm">Tidak Aktif</p>
                <p className="text-2xl font-bold text-white">{inactiveUsers.length}</p>
              </div>
            </div>
          </NeoCardContent>
        </NeoCard>

        <NeoCard className="bg-[#111111]/90 backdrop-blur-xl border border-white/5">
          <NeoCardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-white/60 text-sm">Total Saldo User</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(usersWithBalance.reduce((sum, u) => sum + u.availableBalance, 0))}
                </p>
              </div>
            </div>
          </NeoCardContent>
        </NeoCard>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="bg-[#111111]/90 border border-white/5">
          <TabsTrigger value="users" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Users className="w-4 h-4 mr-2" />
            Daftar User
          </TabsTrigger>
          <TabsTrigger value="inactive" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <UserX className="w-4 h-4 mr-2" />
            Tidak Aktif
            {inactiveUsers.length > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs">
                {inactiveUsers.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="balance" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Wallet className="w-4 h-4 mr-2" />
            Kelola Saldo
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users">
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
        </TabsContent>

        {/* Inactive Users Tab */}
        <TabsContent value="inactive">
          <NeoCard className="bg-[#111111]/90 backdrop-blur-xl border border-white/5">
            <NeoCardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <NeoCardTitle className="text-white flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                    <UserX className="w-4 h-4 text-red-400" />
                  </div>
                  User Tidak Aktif
                </NeoCardTitle>
                <div className="flex items-center gap-3">
                  <Label className="text-white/60 text-sm whitespace-nowrap">Tidak login selama:</Label>
                  <Select value={inactiveMonths} onValueChange={setInactiveMonths}>
                    <SelectTrigger className="w-[140px] bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a1a] border-white/10">
                      <SelectItem value="1">1 Bulan</SelectItem>
                      <SelectItem value="2">2 Bulan</SelectItem>
                      <SelectItem value="3">3 Bulan</SelectItem>
                      <SelectItem value="6">6 Bulan</SelectItem>
                      <SelectItem value="12">12 Bulan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </NeoCardHeader>
            <NeoCardContent>
              {inactiveUsers.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500/40 mx-auto mb-4" />
                  <p className="text-white/60">Tidak ada user yang tidak aktif selama {inactiveMonths} bulan</p>
                  <p className="text-white/40 text-sm mt-1">Semua user aktif menggunakan platform</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-amber-300 text-sm font-medium">Perhatian</p>
                        <p className="text-amber-200/70 text-sm">
                          Menghapus user akan menghapus semua data terkait termasuk produk, pesanan, dan saldo. Tindakan ini tidak dapat dibatalkan.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {inactiveUsers.map((user) => {
                    const inactiveDays = getInactiveDays(user.lastLogin || null, user.createdAt)
                    const inactiveMonthsCount = Math.floor(inactiveDays / 30)
                    
                    return (
                      <div
                        key={user.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-red-500/20 transition-colors gap-4"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-500 to-gray-700 flex items-center justify-center text-white font-bold text-sm opacity-50">
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
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-2">
                              <Clock className="w-3 h-3 text-red-400" />
                              <span className="text-red-400 text-sm font-medium">
                                {inactiveMonthsCount > 0 
                                  ? `${inactiveMonthsCount} bulan ${inactiveDays % 30} hari`
                                  : `${inactiveDays} hari`
                                } tidak aktif
                              </span>
                            </div>
                            <span className="text-white/40 text-xs">
                              {user.lastLogin 
                                ? `Login terakhir: ${formatDate(user.lastLogin)}`
                                : `Belum pernah login sejak daftar`
                              }
                            </span>
                          </div>
                          <NeoButton
                            size="sm"
                            variant="outline"
                            onClick={() => openDeleteDialog(user)}
                            className="border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Hapus
                          </NeoButton>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </NeoCardContent>
          </NeoCard>
        </TabsContent>

        {/* Balance Tab */}
        <TabsContent value="balance">
          <NeoCard className="bg-[#111111]/90 backdrop-blur-xl border border-white/5">
            <NeoCardHeader>
              <NeoCardTitle className="text-white flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-amber-400" />
                </div>
                Kelola Saldo User
              </NeoCardTitle>
            </NeoCardHeader>
            <NeoCardContent>
              {usersWithBalance.length === 0 ? (
                <div className="text-center py-12">
                  <Wallet className="w-12 h-12 text-white/20 mx-auto mb-4" />
                  <p className="text-white/40">Belum ada user dengan saldo</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {usersWithBalance.map((user) => (
                    <div
                      key={user.id}
                      className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0 shadow-lg">
                            <span className="text-white font-bold">{user.name.charAt(0).toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="text-white font-semibold">{user.name}</p>
                            <p className="text-white/40 text-sm">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex flex-col items-end">
                            <span className="text-white/40 text-xs">Saldo</span>
                            <span className="text-emerald-400 font-bold">{formatCurrency(user.availableBalance)}</span>
                          </div>
                          <div className="flex gap-2">
                            <NeoButton
                              size="sm"
                              variant="default"
                              onClick={() => openAddDialog(user)}
                              className="bg-emerald-600 hover:bg-emerald-700"
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Tambah
                            </NeoButton>
                            {user.adjustments.length > 0 && (
                              <NeoButton
                                size="sm"
                                variant="outline"
                                onClick={() => openHistoryDialog(user)}
                              >
                                <History className="w-4 h-4 mr-1" />
                                Riwayat
                              </NeoButton>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-white/40 text-xs">Pendapatan</p>
                          <p className="text-white text-sm font-medium">{formatCurrency(user.totalRevenue)}</p>
                        </div>
                        <div>
                          <p className="text-white/40 text-xs">Dicairkan</p>
                          <p className="text-orange-400 text-sm font-medium">{formatCurrency(user.totalWithdrawn)}</p>
                        </div>
                        <div>
                          <p className="text-white/40 text-xs">Penyesuaian</p>
                          <p className={`text-sm font-medium ${user.totalAdjustments >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {user.totalAdjustments >= 0 ? '+' : ''}{formatCurrency(user.totalAdjustments)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </NeoCardContent>
          </NeoCard>
        </TabsContent>
      </Tabs>

      {/* Add Balance Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-[#111111] border border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-emerald-400" />
              {adjustType === 'add' ? 'Tambah' : 'Kurangi'} Saldo
            </DialogTitle>
            <DialogDescription className="text-white/60">
              {selectedUser?.name} - {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="flex gap-2">
              <button
                onClick={() => setAdjustType('add')}
                className={`flex-1 p-3 rounded-lg border transition-all flex items-center justify-center gap-2 ${
                  adjustType === 'add'
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                    : 'border-white/10 text-white/60 hover:border-white/20'
                }`}
              >
                <Plus className="w-4 h-4" />
                Tambah
              </button>
              <button
                onClick={() => setAdjustType('deduct')}
                className={`flex-1 p-3 rounded-lg border transition-all flex items-center justify-center gap-2 ${
                  adjustType === 'deduct'
                    ? 'border-red-500 bg-red-500/20 text-red-400'
                    : 'border-white/10 text-white/60 hover:border-white/20'
                }`}
              >
                <Minus className="w-4 h-4" />
                Kurangi
              </button>
            </div>
            <div className="space-y-2">
              <Label>Jumlah (Rp)</Label>
              <NeoInput
                type="number"
                placeholder="Contoh: 50000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-white/5 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label>Alasan</Label>
              <NeoInput
                type="text"
                placeholder="Contoh: Bonus, Refund, dll"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="bg-white/5 border-white/10"
              />
            </div>
            {amount && (
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-white/60 text-sm">Saldo setelah penyesuaian:</p>
                <p className={`text-lg font-bold ${adjustType === 'add' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(
                    (selectedUser?.availableBalance || 0) + 
                    (adjustType === 'add' ? Number(amount) : -Number(amount))
                  )}
                </p>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <NeoButton
                variant="outline"
                onClick={() => setShowAddDialog(false)}
                className="flex-1"
              >
                Batal
              </NeoButton>
              <NeoButton
                onClick={handleAddBalance}
                disabled={!amount || !reason || processing}
                className={`flex-1 ${adjustType === 'add' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {adjustType === 'add' ? 'Tambah' : 'Kurangi'} Saldo
              </NeoButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="bg-[#111111] border border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-cyan-400" />
              Riwayat Penyesuaian Saldo
            </DialogTitle>
            <DialogDescription className="text-white/60">
              {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-4 max-h-[400px] overflow-y-auto">
            {selectedUser?.adjustments.map((adj) => (
              <div
                key={adj.id}
                className="p-3 rounded-lg bg-white/5 border border-white/5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {adj.type === 'add' ? (
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-400" />
                    )}
                    <span className={`font-bold ${adj.type === 'add' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {adj.type === 'add' ? '+' : '-'}{formatCurrency(adj.amount)}
                    </span>
                  </div>
                  <span className="text-white/40 text-xs">{formatDate(adj.createdAt)}</span>
                </div>
                <p className="text-white/60 text-sm mt-1">{adj.reason}</p>
                <p className="text-white/40 text-xs mt-1">oleh {adj.adminName}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-[#111111] border border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-400" />
              Hapus User
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              Apakah Anda yakin ingin menghapus user <span className="text-white font-medium">{userToDelete?.name}</span> ({userToDelete?.email})?
              <br /><br />
              <span className="text-red-400">Tindakan ini akan menghapus semua data terkait termasuk:</span>
              <ul className="list-disc list-inside mt-2 text-white/60">
                <li>Pengaturan bot</li>
                <li>Semua produk dan kategori</li>
                <li>Semua pesanan</li>
                <li>Semua pembayaran</li>
                <li>Saldo dan riwayat pencairan</li>
                <li>Langganan bot</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Hapus User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
