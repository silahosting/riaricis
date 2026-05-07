import { GITHUB_CONFIG } from './constants'
import type { Database, User, BotSettings, ProductCategory, Product, Order, QrisSettings, Payment, PaymentSettings, Withdrawal, BalanceAdjustment, BotSubscription, AdminFeeIncome, BotActivityLog } from '@/types'

const defaultDatabase: Database = {
  users: [],
  botSettings: [],
  productCategories: [],
  products: [],
  orders: [],
  qrisSettings: [],
  payments: [],
  paymentSettings: null,
  withdrawals: [],
  balanceAdjustments: [],
  botSubscriptions: [],
  adminFeeIncomes: [],
  botActivityLogs: [],
}

const API_BASE = "https://api-orkut-iota-seven.vercel.app" // ganti dengan URL API kamu

// Tidak perlu lagi — token ditangani di server
async function getGitHubHeaders() {
  return {
    'Content-Type': 'application/json',
  }
}

async function getFileContent(): Promise<{ content: Database; sha: string | null }> {
  // Tidak perlu cek token/owner/repo — server yang handle
  try {
    const response = await fetch(`${API_BASE}/api/database`, {
      headers: await getGitHubHeaders(),
      cache: 'no-store',
    })

    if (!response.ok) {
      console.error('API error:', response.status, await response.text())
      return { content: defaultDatabase, sha: null }
    }

    // Server sudah handle 404 + auto createFile di dalamnya
    const data = await response.json() // { content, sha }
    
    // Ensure all arrays exist with proper defaults
    const content: Database = {
      users: Array.isArray(data.content?.users) ? data.content.users : [],
      botSettings: Array.isArray(data.content?.botSettings) ? data.content.botSettings : [],
      productCategories: Array.isArray(data.content?.productCategories) ? data.content.productCategories : [],
      products: Array.isArray(data.content?.products) ? data.content.products : [],
      orders: Array.isArray(data.content?.orders) ? data.content.orders : [],
      qrisSettings: Array.isArray(data.content?.qrisSettings) ? data.content.qrisSettings : [],
      payments: Array.isArray(data.content?.payments) ? data.content.payments : [],
      paymentSettings: data.content?.paymentSettings || null,
      withdrawals: Array.isArray(data.content?.withdrawals) ? data.content.withdrawals : [],
      balanceAdjustments: Array.isArray(data.content?.balanceAdjustments) ? data.content.balanceAdjustments : [],
      botSubscriptions: Array.isArray(data.content?.botSubscriptions) ? data.content.botSubscriptions : [],
      adminFeeIncomes: Array.isArray(data.content?.adminFeeIncomes) ? data.content.adminFeeIncomes : [],
      botActivityLogs: Array.isArray(data.content?.botActivityLogs) ? data.content.botActivityLogs : [],
    }
    
    return { content, sha: data.sha || null }
  } catch (error) {
    console.error('Error fetching database:', error)
    return { content: defaultDatabase, sha: null }
  }
}

async function createFile(): Promise<void> {
  // Tidak perlu cek token/owner/repo — server yang handle
  try {
    const response = await fetch(`${API_BASE}/api/database/init`, {
      method: 'POST',
      headers: await getGitHubHeaders(),
    })

    if (!response.ok) {
      console.error('API error saat init:', response.status, await response.text())
    }
  } catch (error) {
    console.error('Error creating database file:', error)
  }
}

async function updateFile(database: Database, sha: string | null): Promise<boolean> {
  // Tidak perlu cek token/owner/repo — server yang handle
  try {
    const response = await fetch(`${API_BASE}/api/database`, {
      method: 'PUT',
      headers: await getGitHubHeaders(),
      body: JSON.stringify({ database, sha }),
    })

    if (!response.ok) {
      console.error('API error saat update:', response.status, await response.text())
      return false
    }

    return true
  } catch (error) {
    console.error('Error updating database:', error)
    return false
  }
}

// Generate unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// User operations
export async function getUsers(): Promise<User[]> {
  const { content } = await getFileContent()
  return content.users
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const { content } = await getFileContent()
  return content.users.find((u) => u.email === email) || null
}

export async function getUserById(id: string): Promise<User | null> {
  const { content } = await getFileContent()
  return content.users.find((u) => u.id === id) || null
}

export async function createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User | null> {
  const { content, sha } = await getFileContent()
  
  const existingUser = content.users.find((u) => u.email === userData.email)
  if (existingUser) {
    return null
  }

  const now = new Date().toISOString()
  const newUser: User = {
    ...userData,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  }

  content.users.push(newUser)
  const success = await updateFile(content, sha)
  return success ? newUser : null
}

export async function updateUser(id: string, userData: Partial<User>): Promise<User | null> {
  const { content, sha } = await getFileContent()
  const index = content.users.findIndex((u) => u.id === id)
  
  if (index === -1) return null

  content.users[index] = {
    ...content.users[index],
    ...userData,
    updatedAt: new Date().toISOString(),
  }

  const success = await updateFile(content, sha)
  return success ? content.users[index] : null
}

// Bot Settings operations
export async function getBotSettings(userId: string): Promise<BotSettings | null> {
  const { content } = await getFileContent()
  return content.botSettings.find((s) => s.userId === userId) || null
}

export async function getBotSettingsByToken(botToken: string): Promise<BotSettings | null> {
  const { content } = await getFileContent()
  return content.botSettings.find((s) => s.botToken === botToken) || null
}

  // Get all products (for bot - no userId filter)
export async function getAllProducts(): Promise<Product[]> {
  const { content } = await getFileContent()
  return content.products
  }

// Get products by userId (for bot - filter by owner)
export async function getProductsByUserId(userId: string): Promise<Product[]> {
  const { content } = await getFileContent()
  return content.products.filter(p => p.userId === userId)
}

// Get all orders (for bot stats)
export async function getAllOrders(): Promise<Order[]> {
  const { content } = await getFileContent()
  return content.orders
}

export async function createOrUpdateBotSettings(
  userId: string,
  settings: Omit<BotSettings, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<BotSettings | null> {
  const { content, sha } = await getFileContent()
  const index = content.botSettings.findIndex((s) => s.userId === userId)
  const now = new Date().toISOString()

  if (index === -1) {
    const newSettings: BotSettings = {
      ...settings,
      id: generateId(),
      userId,
      createdAt: now,
      updatedAt: now,
    }
    content.botSettings.push(newSettings)
    const success = await updateFile(content, sha)
    return success ? newSettings : null
  } else {
    content.botSettings[index] = {
      ...content.botSettings[index],
      ...settings,
      updatedAt: now,
    }
    const success = await updateFile(content, sha)
    return success ? content.botSettings[index] : null
  }
}

// Product Category operations
export async function getProductCategories(userId: string): Promise<ProductCategory[]> {
  const { content } = await getFileContent()
  return content.productCategories.filter((c) => c.userId === userId)
}

export async function getProductCategoryById(id: string): Promise<ProductCategory | null> {
  const { content } = await getFileContent()
  return content.productCategories.find((c) => c.id === id) || null
}

export async function getProductCategoryByCode(userId: string, code: string): Promise<ProductCategory | null> {
  const { content } = await getFileContent()
  return content.productCategories.find((c) => c.userId === userId && c.code === code) || null
}

export async function createProductCategory(
  categoryData: Omit<ProductCategory, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ProductCategory | null> {
  const { content, sha } = await getFileContent()
  const now = new Date().toISOString()

  // Check if code already exists for this user
  const existing = content.productCategories.find(
    (c) => c.userId === categoryData.userId && c.code.toUpperCase() === categoryData.code.toUpperCase()
  )
  if (existing) {
    return null // Code already exists
  }

  const newCategory: ProductCategory = {
    ...categoryData,
    code: categoryData.code.toUpperCase(),
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  }

  content.productCategories.push(newCategory)
  const success = await updateFile(content, sha)
  return success ? newCategory : null
}

export async function updateProductCategory(id: string, data: Partial<ProductCategory>): Promise<ProductCategory | null> {
  const { content, sha } = await getFileContent()
  const index = content.productCategories.findIndex((c) => c.id === id)

  if (index === -1) return null

  content.productCategories[index] = {
    ...content.productCategories[index],
    ...data,
    updatedAt: new Date().toISOString(),
  }

  const success = await updateFile(content, sha)
  return success ? content.productCategories[index] : null
}

export async function deleteProductCategory(id: string): Promise<boolean> {
  const { content, sha } = await getFileContent()
  const index = content.productCategories.findIndex((c) => c.id === id)

  if (index === -1) return false

  // Also delete all products in this category
  const category = content.productCategories[index]
  content.products = content.products.filter(
    (p) => !(p.userId === category.userId && p.categoryCode === category.code)
  )

  content.productCategories.splice(index, 1)
  return await updateFile(content, sha)
}

// Product operations
export async function getProducts(userId: string): Promise<Product[]> {
  const { content } = await getFileContent()
  return content.products.filter((p) => p.userId === userId)
}

export async function getProductsByCategoryCode(userId: string, categoryCode: string): Promise<Product[]> {
  const { content } = await getFileContent()
  return content.products.filter((p) => p.userId === userId && p.categoryCode === categoryCode)
}

export async function getProductByCode(userId: string, code: string): Promise<Product | null> {
  const { content } = await getFileContent()
  return content.products.find((p) => p.userId === userId && p.code === code) || null
}

export async function getProductById(id: string): Promise<Product | null> {
  const { content } = await getFileContent()
  return content.products.find((p) => p.id === id) || null
}

export async function createProduct(
  productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Product | null> {
  const { content, sha } = await getFileContent()
  const now = new Date().toISOString()

  const newProduct: Product = {
    ...productData,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  }

  content.products.push(newProduct)
  const success = await updateFile(content, sha)
  return success ? newProduct : null
}

export async function updateProduct(id: string, productData: Partial<Product>): Promise<Product | null> {
  const { content, sha } = await getFileContent()
  const index = content.products.findIndex((p) => p.id === id)

  if (index === -1) return null

  content.products[index] = {
    ...content.products[index],
    ...productData,
    updatedAt: new Date().toISOString(),
  }

  const success = await updateFile(content, sha)
  return success ? content.products[index] : null
}

export async function deleteProduct(id: string): Promise<boolean> {
  const { content, sha } = await getFileContent()
  const index = content.products.findIndex((p) => p.id === id)

  if (index === -1) return false

  content.products.splice(index, 1)
  return await updateFile(content, sha)
}

// Order operations
export async function getOrders(userId: string): Promise<Order[]> {
  const { content } = await getFileContent()
  return content.orders.filter((o) => o.userId === userId)
}

export async function getOrderById(id: string): Promise<Order | null> {
  const { content } = await getFileContent()
  return content.orders.find((o) => o.id === id) || null
}

// Get orders by seller userId (for bot stats)
export async function getOrdersByUserId(userId: string): Promise<Order[]> {
  const { content } = await getFileContent()
  return content.orders.filter(o => o.userId === userId)
}

export async function createOrder(orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Promise<Order | null> {
  const { content, sha } = await getFileContent()
  const now = new Date().toISOString()

  const newOrder: Order = {
    ...orderData,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  }

  content.orders.push(newOrder)
  const success = await updateFile(content, sha)
  return success ? newOrder : null
}

export async function updateOrder(id: string, orderData: Partial<Order>): Promise<Order | null> {
  const { content, sha } = await getFileContent()
  const index = content.orders.findIndex((o) => o.id === id)

  if (index === -1) return null

  content.orders[index] = {
    ...content.orders[index],
    ...orderData,
    updatedAt: new Date().toISOString(),
  }

  const success = await updateFile(content, sha)
  return success ? content.orders[index] : null
}

export async function deleteOrder(id: string): Promise<boolean> {
  const { content, sha } = await getFileContent()
  const index = content.orders.findIndex((o) => o.id === id)

  if (index === -1) return false

  content.orders.splice(index, 1)
  return await updateFile(content, sha)
}

// Stats
export async function getDashboardStats(userId: string) {
  const { content } = await getFileContent()
  const products = content.products.filter((p) => p.userId === userId)
  const orders = content.orders.filter((o) => o.userId === userId)
  const botSettings = content.botSettings.find((s) => s.userId === userId)

  const totalProducts = products.length
  const activeProducts = products.filter((p) => p.isActive).length
  const totalOrders = orders.length
  const pendingOrders = orders.filter((o) => o.status === 'pending').length
  const completedOrders = orders.filter((o) => o.status === 'completed').length
  // Exclude sandbox orders from revenue calculation (sandbox = testing, not real money)
  const totalRevenue = orders
    .filter((o) => o.status === 'completed' && !o.isSandbox)
    .reduce((sum, o) => sum + o.totalPrice, 0)
  const isBotActive = botSettings?.isActive || false

  return {
    totalProducts,
    activeProducts,
    totalOrders,
    pendingOrders,
    completedOrders,
    totalRevenue,
    isBotActive,
  }
}

// QRIS Settings operations
export async function getQrisSettings(type: 'admin' | 'user', userId?: string): Promise<QrisSettings | null> {
  const { content } = await getFileContent()
  if (type === 'admin') {
    return content.qrisSettings.find((q) => q.type === 'admin') || null
  }
  return content.qrisSettings.find((q) => q.type === 'user' && q.userId === userId) || null
}

export async function createOrUpdateQrisSettings(
  type: 'admin' | 'user',
  settings: Omit<QrisSettings, 'id' | 'createdAt' | 'updatedAt' | 'type'>,
  userId?: string
): Promise<QrisSettings | null> {
  const { content, sha } = await getFileContent()
  let index = -1

  if (type === 'admin') {
    index = content.qrisSettings.findIndex((q) => q.type === 'admin')
  } else {
    index = content.qrisSettings.findIndex((q) => q.type === 'user' && q.userId === userId)
  }

  const now = new Date().toISOString()

  if (index === -1) {
    const newQrisSettings: QrisSettings = {
      ...settings,
      id: generateId(),
      type,
      userId: type === 'user' ? userId : undefined,
      createdAt: now,
      updatedAt: now,
    }
    content.qrisSettings.push(newQrisSettings)
    const success = await updateFile(content, sha)
    return success ? newQrisSettings : null
  } else {
    content.qrisSettings[index] = {
      ...content.qrisSettings[index],
      ...settings,
      updatedAt: now,
    }
    const success = await updateFile(content, sha)
    return success ? content.qrisSettings[index] : null
  }
}

// Payment operations
export async function getPaymentByOrderId(orderId: string): Promise<Payment | null> {
  const { content } = await getFileContent()
  return content.payments.find((p) => p.orderId === orderId) || null
}

export async function getPayments(userId: string): Promise<Payment[]> {
  const { content } = await getFileContent()
  return content.payments.filter((p) => p.userId === userId)
}

export async function createPayment(
  paymentData: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Payment | null> {
  const { content, sha } = await getFileContent()
  const now = new Date().toISOString()

  const newPayment: Payment = {
    ...paymentData,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  }

  content.payments.push(newPayment)
  const success = await updateFile(content, sha)
  return success ? newPayment : null
}

export async function updatePayment(id: string, paymentData: Partial<Payment>): Promise<Payment | null> {
  const { content, sha } = await getFileContent()
  const index = content.payments.findIndex((p) => p.id === id)

  if (index === -1) return null

  content.payments[index] = {
    ...content.payments[index],
    ...paymentData,
    updatedAt: new Date().toISOString(),
  }

  const success = await updateFile(content, sha)
  return success ? content.payments[index] : null
}

export async function updatePaymentByOrderId(
  orderId: string,
  paymentData: Partial<Payment>
): Promise<Payment | null> {
  const { content, sha } = await getFileContent()
  const index = content.payments.findIndex((p) => p.orderId === orderId)

  if (index === -1) return null

  content.payments[index] = {
    ...content.payments[index],
    ...paymentData,
    updatedAt: new Date().toISOString(),
  }

  const success = await updateFile(content, sha)
  return success ? content.payments[index] : null
}

// Payment Settings operations (Admin)
export async function getPaymentSettings(): Promise<PaymentSettings | null> {
  const { content } = await getFileContent()
  return content.paymentSettings
}

export async function savePaymentSettings(
  settings: Partial<Omit<PaymentSettings, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<PaymentSettings | null> {
  const { content, sha } = await getFileContent()
  const now = new Date().toISOString()

  if (content.paymentSettings) {
    // Update existing
    content.paymentSettings = {
      ...content.paymentSettings,
      ...settings,
      updatedAt: now,
    }
  } else {
    // Create new
    content.paymentSettings = {
      id: generateId(),
      orkutEnabled: false,
      orkutUsername: '',
      orkutApiKey: '',
      orkutToken: '',
      orkutMerchantId: '',
      orkutCodeQr: '',
      midtransEnabled: false,
      midtransServerKey: '',
      midtransClientKey: '',
      midtransIsProduction: false,
      midtransMerchantId: '',
      defaultPaymentMethod: 'orkut',
      ...settings,
      createdAt: now,
      updatedAt: now,
    }
  }

  const success = await updateFile(content, sha)
  return success ? content.paymentSettings : null
}

// Admin check
export async function isUserAdmin(userId: string): Promise<boolean> {
  const user = await getUserById(userId)
  if (!user) return false
  
  // Check if user has admin role
  if (user.role === 'admin') return true
  
  // Check if user email is in ADMIN_EMAILS env var
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || []
  if (adminEmails.includes(user.email.toLowerCase())) return true
  
  return false
}

// Get all users (for admin)
export async function getAllUsers(): Promise<User[]> {
  const { content } = await getFileContent()
  return content.users
}

// Withdrawal operations
export async function getWithdrawals(userId: string): Promise<Withdrawal[]> {
  const { content } = await getFileContent()
  return content.withdrawals.filter((w) => w.userId === userId)
}

export async function getAllWithdrawals(): Promise<Withdrawal[]> {
  const { content } = await getFileContent()
  return content.withdrawals
}

export async function getWithdrawalById(id: string): Promise<Withdrawal | null> {
  const { content } = await getFileContent()
  return content.withdrawals.find((w) => w.id === id) || null
}

// Check if user can withdraw today (1x per day limit)
export async function canUserWithdrawToday(userId: string): Promise<boolean> {
  const { content } = await getFileContent()
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  
  const todayWithdrawals = content.withdrawals.filter((w) => {
    const withdrawalDate = w.createdAt.split('T')[0]
    return w.userId === userId && withdrawalDate === today
  })
  
  return todayWithdrawals.length === 0
}

// Get user's last withdrawal
export async function getLastWithdrawal(userId: string): Promise<Withdrawal | null> {
  const { content } = await getFileContent()
  const userWithdrawals = content.withdrawals
    .filter((w) => w.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  
  return userWithdrawals[0] || null
}

export async function createWithdrawal(
  withdrawalData: Omit<Withdrawal, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Withdrawal | null> {
  const { content, sha } = await getFileContent()
  const now = new Date().toISOString()

  const newWithdrawal: Withdrawal = {
    ...withdrawalData,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  }

  content.withdrawals.push(newWithdrawal)
  const success = await updateFile(content, sha)
  return success ? newWithdrawal : null
}

export async function updateWithdrawal(id: string, data: Partial<Withdrawal>): Promise<Withdrawal | null> {
  const { content, sha } = await getFileContent()
  const index = content.withdrawals.findIndex((w) => w.id === id)

  if (index === -1) return null

  content.withdrawals[index] = {
    ...content.withdrawals[index],
    ...data,
    updatedAt: new Date().toISOString(),
  }

  const success = await updateFile(content, sha)
  return success ? content.withdrawals[index] : null
}

// Get withdrawal stats for admin
export async function getWithdrawalStats() {
  const { content } = await getFileContent()
  const withdrawals = content.withdrawals

  const pending = withdrawals.filter((w) => w.status === 'pending').length
  const processing = withdrawals.filter((w) => w.status === 'processing').length
  const completed = withdrawals.filter((w) => w.status === 'completed').length
  const rejected = withdrawals.filter((w) => w.status === 'rejected').length
  
  const totalDisbursed = withdrawals
    .filter((w) => w.status === 'completed')
    .reduce((sum, w) => sum + w.netAmount, 0)

  return {
    pending,
    processing,
    completed,
    rejected,
    total: withdrawals.length,
    totalDisbursed,
  }
}

// Balance Adjustment operations (Admin)
export async function getBalanceAdjustments(userId?: string): Promise<BalanceAdjustment[]> {
  const { content } = await getFileContent()
  if (userId) {
    return content.balanceAdjustments.filter((b) => b.userId === userId)
  }
  return content.balanceAdjustments
}

export async function createBalanceAdjustment(
  data: Omit<BalanceAdjustment, 'id' | 'createdAt'>
): Promise<BalanceAdjustment | null> {
  const { content, sha } = await getFileContent()
  const now = new Date().toISOString()

  const newAdjustment: BalanceAdjustment = {
    ...data,
    id: generateId(),
    createdAt: now,
  }

  content.balanceAdjustments.push(newAdjustment)
  const success = await updateFile(content, sha)
  return success ? newAdjustment : null
}

// Get user balance including adjustments
export async function getUserBalance(userId: string) {
  const { content } = await getFileContent()
  
  // Get user info for email matching
  const user = content.users.find(u => u.id === userId)
  const userEmail = user?.email?.toLowerCase()
  
  // Revenue from completed orders (non-sandbox)
  const orders = content.orders.filter(o => o.userId === userId)
  const completedOrders = orders.filter(o => o.status === 'completed' && !o.isSandbox)
  const totalRevenue = completedOrders.reduce((sum, o) => sum + o.totalPrice, 0)
  
  // Completed withdrawals
  const withdrawals = content.withdrawals.filter(w => w.userId === userId)
  const completedWithdrawals = withdrawals.filter(w => w.status === 'completed')
  const totalWithdrawn = completedWithdrawals.reduce((sum, w) => sum + w.amount, 0)
  
  // Balance adjustments - match by userId OR by email (more reliable)
  const allAdjustments = content.balanceAdjustments || []
  const adjustments = allAdjustments.filter(b => {
    // Match by userId
    if (b.userId === userId) return true
    // Also match by email as fallback (in case ID mismatch)
    if (userEmail && b.userEmail?.toLowerCase() === userEmail) return true
    return false
  })
  
  const totalAdjustments = adjustments.reduce((sum, b) => {
    return sum + (b.type === 'add' ? b.amount : -b.amount)
  }, 0)
  
  const availableBalance = totalRevenue - totalWithdrawn + totalAdjustments
  
  return {
    totalRevenue,
    totalWithdrawn,
    totalAdjustments,
    availableBalance: Math.max(0, availableBalance),
  }
}

// Bot Subscription operations
export async function getUserSubscription(userId: string): Promise<BotSubscription | null> {
  const { content } = await getFileContent()
  const subscriptions = content.botSubscriptions || []
  
  // Find active subscription for user
  const now = new Date()
  const activeSubscription = subscriptions.find(s => {
    if (s.userId !== userId) return false
    if (s.status !== 'active') return false
    if (s.endDate && new Date(s.endDate) < now) return false
    return true
  })
  
  return activeSubscription || null
}

export async function createSubscription(
  data: Omit<BotSubscription, 'id' | 'createdAt' | 'updatedAt'>
): Promise<BotSubscription | null> {
  const { content, sha } = await getFileContent()
  const now = new Date().toISOString()

  const newSubscription: BotSubscription = {
    ...data,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  }

  content.botSubscriptions = content.botSubscriptions || []
  content.botSubscriptions.push(newSubscription)
  const success = await updateFile(content, sha)
  return success ? newSubscription : null
}

export async function activateSubscription(subscriptionId: string): Promise<BotSubscription | null> {
  const { content, sha } = await getFileContent()
  const now = new Date()
  
  const subscription = content.botSubscriptions?.find(s => s.id === subscriptionId)
  if (!subscription) return null

  // Set start and end dates (3 months from now)
  const endDate = new Date(now)
  endDate.setMonth(endDate.getMonth() + 3)
  
  subscription.status = 'active'
  subscription.startDate = now.toISOString()
  subscription.endDate = endDate.toISOString()
  subscription.updatedAt = now.toISOString()

  const success = await updateFile(content, sha)
  return success ? subscription : null
}

export async function getAllSubscriptions(): Promise<BotSubscription[]> {
  const { content } = await getFileContent()
  return content.botSubscriptions || []
}

// Get all bot settings (for admin monitoring)
export async function getAllBotSettings(): Promise<BotSettings[]> {
  const { content } = await getFileContent()
  return content.botSettings || []
}

// Admin Fee Income operations
export async function createAdminFeeIncome(
  data: Omit<AdminFeeIncome, 'id' | 'createdAt'>
): Promise<AdminFeeIncome | null> {
  const { content, sha } = await getFileContent()
  const now = new Date().toISOString()

  const newFeeIncome: AdminFeeIncome = {
    ...data,
    id: generateId(),
    createdAt: now,
  }

  content.adminFeeIncomes = content.adminFeeIncomes || []
  content.adminFeeIncomes.push(newFeeIncome)
  const success = await updateFile(content, sha)
  return success ? newFeeIncome : null
}

export async function getAdminFeeIncomes(): Promise<AdminFeeIncome[]> {
  const { content } = await getFileContent()
  return content.adminFeeIncomes || []
}

export async function getAdminTotalFeeBalance(): Promise<number> {
  const { content } = await getFileContent()
  const feeIncomes = content.adminFeeIncomes || []
  return feeIncomes.reduce((sum, f) => sum + f.totalFee, 0)
}

// Bot Activity Log operations
export async function createBotActivityLog(
  data: Omit<BotActivityLog, 'id' | 'createdAt'>
): Promise<BotActivityLog | null> {
  const { content, sha } = await getFileContent()
  const now = new Date().toISOString()

  const newLog: BotActivityLog = {
    ...data,
    id: generateId(),
    createdAt: now,
  }

  content.botActivityLogs = content.botActivityLogs || []
  // Keep only last 500 logs to prevent database bloat
  if (content.botActivityLogs.length >= 500) {
    content.botActivityLogs = content.botActivityLogs.slice(-499)
  }
  content.botActivityLogs.push(newLog)
  const success = await updateFile(content, sha)
  return success ? newLog : null
}

export async function getBotActivityLogs(limit: number = 100): Promise<BotActivityLog[]> {
  const { content } = await getFileContent()
  const logs = content.botActivityLogs || []
  // Return latest logs first
  return logs.slice(-limit).reverse()
}

// Get order stats by date for charts
export async function getOrderStatsForChart(days: number = 7): Promise<{ date: string; orders: number; revenue: number }[]> {
  const { content } = await getFileContent()
  const orders = content.orders || []
  
  const result: { date: string; orders: number; revenue: number }[] = []
  const now = new Date()
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    
    const dayOrders = orders.filter(o => {
      const orderDate = o.createdAt.split('T')[0]
      return orderDate === dateStr && o.status === 'completed' && !o.isSandbox
    })
    
    result.push({
      date: dateStr,
      orders: dayOrders.length,
      revenue: dayOrders.reduce((sum, o) => sum + o.totalPrice, 0),
    })
  }
  
  return result
}

// Get fee income stats by date for charts
export async function getFeeStatsForChart(days: number = 7): Promise<{ date: string; fees: number; count: number }[]> {
  const { content } = await getFileContent()
  const feeIncomes = content.adminFeeIncomes || []
  
  const result: { date: string; fees: number; count: number }[] = []
  const now = new Date()
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    
    const dayFees = feeIncomes.filter(f => {
      const feeDate = f.createdAt.split('T')[0]
      return feeDate === dateStr
    })
    
    result.push({
      date: dateStr,
      fees: dayFees.reduce((sum, f) => sum + f.totalFee, 0),
      count: dayFees.length,
    })
  }
  
  return result
}

// Detect potential spam bots based on activity
export async function detectSpamActivity(telegramUserId: string): Promise<boolean> {
  const { content } = await getFileContent()
  const logs = content.botActivityLogs || []
  
  // Check for suspicious activity in last 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const recentLogs = logs.filter(l => 
    l.telegramUserId === telegramUserId && 
    l.createdAt > fiveMinutesAgo
  )
  
  // If more than 20 actions in 5 minutes, consider it spam
  return recentLogs.length > 20
}
