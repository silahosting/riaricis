'use client'

import { useState } from 'react'
import { NeoCard, NeoCardHeader, NeoCardTitle, NeoCardDescription, NeoCardContent } from '@/components/ui/neo-card'
import { NeoButton } from '@/components/ui/neo-button'
import { NeoInput } from '@/components/ui/neo-input'
import { Settings, Save, AlertCircle, CheckCircle, Loader2, Info } from 'lucide-react'

export default function AdminSettingsPage() {
  const [adminEmails, setAdminEmails] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    
    // In production, this would save to environment variables or database
    // For now, show info message
    setTimeout(() => {
      setMessage({ 
        type: 'info', 
        text: 'Admin emails are configured via ADMIN_EMAILS environment variable on Vercel.' 
      })
      setSaving(false)
    }, 1000)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">Admin Settings</h1>
        <p className="text-white/60 mt-1">Configure system-wide settings</p>
      </div>

      {/* Alert Message */}
      {message && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${
          message.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : message.type === 'info'
            ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : message.type === 'info' ? (
            <Info className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}

      {/* Admin Emails */}
      <NeoCard className="bg-[#111111]/90 backdrop-blur-xl border border-white/5">
        <NeoCardHeader>
          <NeoCardTitle className="text-white flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <Settings className="w-4 h-4 text-violet-400" />
            </div>
            Admin Access
          </NeoCardTitle>
          <NeoCardDescription className="text-white/60">
            Configure which users have admin access to this panel
          </NeoCardDescription>
        </NeoCardHeader>
        <NeoCardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80">Admin Emails</label>
            <NeoInput
              value={adminEmails}
              onChange={(e) => setAdminEmails(e.target.value)}
              placeholder="admin@example.com, admin2@example.com"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
            />
            <p className="text-white/40 text-xs">Comma-separated list of admin email addresses</p>
          </div>

          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-400 font-medium text-sm">Environment Variable Required</p>
                <p className="text-amber-400/80 text-xs mt-1">
                  To add admin access, set the <code className="bg-amber-500/20 px-1.5 py-0.5 rounded">ADMIN_EMAILS</code> environment 
                  variable on Vercel with comma-separated email addresses.
                </p>
              </div>
            </div>
          </div>

          <NeoButton
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-600 hover:to-violet-700 text-white border-0"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Settings
              </>
            )}
          </NeoButton>
        </NeoCardContent>
      </NeoCard>

      {/* Midtrans Webhook Info */}
      <NeoCard className="bg-[#111111]/90 backdrop-blur-xl border border-white/5">
        <NeoCardHeader>
          <NeoCardTitle className="text-white flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <Info className="w-4 h-4 text-cyan-400" />
            </div>
            Webhook Configuration
          </NeoCardTitle>
        </NeoCardHeader>
        <NeoCardContent className="space-y-4">
          <div className="p-4 rounded-xl bg-white/5 border border-white/5">
            <p className="text-white/80 text-sm font-medium mb-2">Midtrans Webhook URL</p>
            <code className="text-cyan-400 text-xs bg-cyan-500/10 px-3 py-2 rounded-lg block break-all">
              {typeof window !== 'undefined' ? `${window.location.origin}/api/payments/midtrans/webhook` : '/api/payments/midtrans/webhook'}
            </code>
            <p className="text-white/40 text-xs mt-2">
              Set this URL in your Midtrans dashboard under Settings &gt; Configuration &gt; Payment Notification URL
            </p>
          </div>
        </NeoCardContent>
      </NeoCard>
    </div>
  )
}
