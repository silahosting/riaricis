import { NextResponse } from 'next/server'
import { isCurrentUserAdmin } from '@/lib/auth'
import { getAllUsers, getAllOrders, getPaymentSettings } from '@/lib/github-db'

export async function GET() {
  try {
    const isAdmin = await isCurrentUserAdmin()
    
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const [users, orders, paymentSettings] = await Promise.all([
      getAllUsers(),
      getAllOrders(),
      getPaymentSettings(),
    ])

    const totalRevenue = orders
      .filter((o) => o.status === 'completed')
      .reduce((sum, o) => sum + o.totalPrice, 0)

    let activePaymentMethods = 0
    if (paymentSettings?.orkutEnabled) activePaymentMethods++
    if (paymentSettings?.midtransEnabled) activePaymentMethods++

    return NextResponse.json({
      totalUsers: users.length,
      totalOrders: orders.length,
      totalRevenue,
      activePaymentMethods,
      orkutEnabled: paymentSettings?.orkutEnabled || false,
      midtransEnabled: paymentSettings?.midtransEnabled || false,
    })
  } catch (error) {
    console.error('Admin stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
