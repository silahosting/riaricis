import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { 
  getUserSubscription, 
  createSubscription, 
  activateSubscription,
  getUserBalance,
  createBalanceAdjustment,
  getUserById
} from '@/lib/github-db'

const BOT_SUBSCRIPTION_PRICE = 25000 // Rp 25.000 for 3 months

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const subscription = await getUserSubscription(session.id)
    const balance = await getUserBalance(session.id)
    
    // Check if subscription is expired
    let isActive = false
    let daysRemaining = 0
    
    if (subscription && subscription.status === 'active' && subscription.endDate) {
      const endDate = new Date(subscription.endDate)
      const now = new Date()
      if (endDate > now) {
        isActive = true
        daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      }
    }

    return NextResponse.json({
      subscription,
      isActive,
      daysRemaining,
      balance: balance.availableBalance,
      price: BOT_SUBSCRIPTION_PRICE,
    })
  } catch (error) {
    console.error('Error fetching subscription:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { paymentMethod } = body

    if (paymentMethod !== 'saldo') {
      return NextResponse.json({ error: 'Metode pembayaran tidak valid. Gunakan saldo.' }, { status: 400 })
    }

    // Check if user already has active subscription
    const existingSubscription = await getUserSubscription(session.id)
    if (existingSubscription) {
      return NextResponse.json({ error: 'Anda sudah memiliki langganan aktif' }, { status: 400 })
    }

    // Check user balance
    const balance = await getUserBalance(session.id)
    if (balance.availableBalance < BOT_SUBSCRIPTION_PRICE) {
      return NextResponse.json({ 
        error: `Saldo tidak mencukupi. Saldo Anda: Rp ${balance.availableBalance.toLocaleString('id-ID')}, Harga: Rp ${BOT_SUBSCRIPTION_PRICE.toLocaleString('id-ID')}` 
      }, { status: 400 })
    }

    // Get user info
    const user = await getUserById(session.id)
    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
    }

    // Create subscription
    const now = new Date()
    const endDate = new Date(now)
    endDate.setMonth(endDate.getMonth() + 3)

    const subscription = await createSubscription({
      userId: session.id,
      userName: user.name,
      userEmail: user.email,
      plan: '3month',
      price: BOT_SUBSCRIPTION_PRICE,
      status: 'active',
      paymentMethod: 'saldo',
      startDate: now.toISOString(),
      endDate: endDate.toISOString(),
    })

    if (!subscription) {
      return NextResponse.json({ error: 'Gagal membuat langganan' }, { status: 500 })
    }

    // Deduct balance
    await createBalanceAdjustment({
      userId: session.id,
      userName: user.name,
      userEmail: user.email,
      amount: BOT_SUBSCRIPTION_PRICE,
      type: 'deduct',
      reason: 'Pembelian Sewa Auto Bot Order (3 Bulan)',
      adminId: 'system',
      adminName: 'System',
    })

    return NextResponse.json({
      success: true,
      subscription,
      message: 'Langganan berhasil diaktifkan!',
    })
  } catch (error) {
    console.error('Error creating subscription:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
