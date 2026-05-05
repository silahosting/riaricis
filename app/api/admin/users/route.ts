import { NextResponse } from 'next/server'
import { isCurrentUserAdmin } from '@/lib/auth'
import { getAllUsers } from '@/lib/github-db'

export async function GET() {
  try {
    const isAdmin = await isCurrentUserAdmin()
    
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const users = await getAllUsers()

    // Remove passwords from response
    const safeUsers = users.map(({ password, ...user }) => user)

    return NextResponse.json({ users: safeUsers })
  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
