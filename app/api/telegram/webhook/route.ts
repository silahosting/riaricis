import { NextRequest, NextResponse } from 'next/server'
import { getBotSettingsByToken, getAllProducts, getProductsByUserId, getProductCategories, getAllOrders, getOrdersByUserId, getOrderById, getProductById, updateProduct, createOrder, getQrisSettings, createPayment, updatePaymentByOrderId, getPaymentByOrderId, updateOrder, getPaymentSettings, createBotActivityLog, createAdminFeeIncome, detectSpamActivity, getUserById } from '@/lib/github-db'
import { createOrkutQrisPayment, checkOrkutPaymentStatus } from '@/lib/orkut'
import { createMidtransQrisPayment, checkMidtransPaymentStatus, isMidtransPaymentPaid } from '@/lib/midtrans'
import { logBotError, logWebhookError } from '@/lib/error-logger'
import type { Product, ProductCategory, PaymentSettings } from '@/types'

// Telegram API base URL
const TELEGRAM_API = 'https://api.telegram.org/bot'

// Items per page for pagination
const ITEMS_PER_PAGE = 10

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
}

interface TelegramChat {
  id: number
  type: string
}

interface TelegramMessage {
  message_id: number
  from: TelegramUser
  chat: TelegramChat
  text?: string
  date: number
}

interface TelegramCallbackQuery {
  id: string
  from: TelegramUser
  message?: TelegramMessage
  chat_instance: string
  data?: string
}

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  callback_query?: TelegramCallbackQuery
}

// Store for order sessions (in production, use Redis/DB)
const orderSessions = new Map<string, {
  productId: string
  quantity: number
  chatId: number
  messageId: number
}>()

// Format number to Rupiah
function toRupiah(num: number): string {
  return new Intl.NumberFormat('id-ID').format(num)
}

// Get current time in WIB
function getWIBTime(): string {
  const now = new Date()
  const wibTime = new Date(now.getTime() + (7 * 60 * 60 * 1000))
  return wibTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// Get current date in Indonesian format
function getIndonesianDate(): string {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
  const now = new Date()
  const wibTime = new Date(now.getTime() + (7 * 60 * 60 * 1000))
  return `${days[wibTime.getDay()]}, ${wibTime.getDate().toString().padStart(2, '0')} ${months[wibTime.getMonth()]} ${wibTime.getFullYear()} ${getWIBTime()}`
}
async function replaceWithPhoto(
  botToken: string,
  chatId: number,
  messageId: number,
  photoUrl: string,
  caption: string,
  keyboard?: any
) {
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/editMessageMedia`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        media: {
          type: 'photo',
          media: photoUrl,
          caption,
          parse_mode: 'HTML'
        },
        reply_markup: keyboard
      })
    }
  )

  return response.json()
}
// Send message to Telegram
async function sendMessage(
  botToken: string, 
  chatId: number, 
  text: string, 
  options?: {
    parseMode?: string
    replyMarkup?: object
  }
) {
  const response = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: options?.parseMode || 'Markdown',
      reply_markup: options?.replyMarkup,
    }),
  })
  return response.json()
}

// Send photo to Telegram
async function sendPhoto(
  botToken: string,
  chatId: number,
  photo: string,
  options?: {
    caption?: string
    parseMode?: string
    replyMarkup?: object
  }
) {
  console.log('[v0] sendPhoto called, chatId:', chatId, 'photo:', photo?.slice(0, 50))
  
  const body: Record<string, unknown> = {
    chat_id: chatId,
    photo,
    caption: options?.caption,
    reply_markup: options?.replyMarkup,
  }
  
  // Only add parse_mode if explicitly provided
  if (options?.parseMode) {
    body.parse_mode = options.parseMode
  }
  
  const response = await fetch(`${TELEGRAM_API}${botToken}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const result = await response.json()
  console.log('[v0] sendPhoto result:', JSON.stringify(result).slice(0, 200))
  return result
}

// Answer callback query
async function answerCallbackQuery(botToken: string, callbackQueryId: string, text?: string, showAlert?: boolean) {
  const response = await fetch(`${TELEGRAM_API}${botToken}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert,
    }),
  })
  return response.json()
}

// Edit message text
async function editMessageText(
  botToken: string,
  chatId: number,
  messageId: number,
  text: string,
  options?: {
    parseMode?: string
    replyMarkup?: object
  }
) {
  const response = await fetch(`${TELEGRAM_API}${botToken}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: options?.parseMode || 'Markdown',
      reply_markup: options?.replyMarkup,
    }),
  })
  return response.json()
}

// Delete a message
async function deleteMessage(botToken: string, chatId: number, messageId: number) {
  const response = await fetch(`${TELEGRAM_API}${botToken}/deleteMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
    }),
  })
  return response.json()
}

// Helper to replace message (delete old, send new) - works with both text and photo messages
async function replaceWithMessage(
  botToken: string,
  chatId: number,
  messageId: number,
  text: string,
  options?: { replyMarkup?: object }
) {
  try {
    await deleteMessage(botToken, chatId, messageId)
  } catch (e) {
    // Ignore delete errors
  }
  return sendMessage(botToken, chatId, text, options)
}

// Generate paginated category list text (Produk Utama)
function generateCategoryListText(categories: ProductCategory[], products: Product[], page: number, totalPages: number): string {
  if (!categories || categories.length === 0) {
    return '┌──────────────────────────\n│  Belum ada produk tersedia  │\n└──────────────────────────'
  }

  let teks = '╭ - - - - - - - - - - - - - - - - - - - ╮\n'
  teks += `┊   DAFTAR PRODUK\n`
  teks += `┊   Pilih produk yang kamu mau\n`
  teks += `┊   page ${page} / ${totalPages}\n`
  teks += `┊ - - - - - - - - - - - - - - - - - - - \n`
  
  const startIndex = (page - 1) * ITEMS_PER_PAGE
  categories.forEach((category, index) => {
    // Count total stock for this category
    const categoryProducts = products.filter(p => p.categoryCode === category.code)
    const totalStock = categoryProducts.reduce((sum, p) => sum + (p.items?.length || p.stock || 0), 0)
    teks += `┊ [${startIndex + index + 1}] ${category.name} [${totalStock} STOCK]\n`
  })
  
  teks += '╰ - - - - - - - - - - - - - - - - - - - ╯'
  return teks
}

// Generate keyboard for paginated category list
function generateCategoryListKeyboard(categories: ProductCategory[], page: number, totalPages: number) {
  const keyboard: { text: string; callback_data: string }[][] = []
  
  // Number buttons in 2 columns
  for (let i = 0; i < categories.length; i += 2) {
    const row: { text: string; callback_data: string }[] = []
    const startIndex = (page - 1) * ITEMS_PER_PAGE
    
    row.push({
      text: `${startIndex + i + 1}`,
      callback_data: `select_cat_${categories[i].code}`
    })
    
    if (categories[i + 1]) {
      row.push({
        text: `${startIndex + i + 2}`,
        callback_data: `select_cat_${categories[i + 1].code}`
      })
    }
    
    keyboard.push(row)
  }
  
  // Pagination buttons
  if (totalPages > 1) {
    const navRow: { text: string; callback_data: string }[] = []
    if (page > 1) {
      navRow.push({ text: `Sebelumnya ${page - 1}`, callback_data: `cat_page_${page - 1}` })
    }
    if (page < totalPages) {
      navRow.push({ text: `Selanjutnya ${page + 1}`, callback_data: `cat_page_${page + 1}` })
    }
    if (navRow.length > 0) keyboard.push(navRow)
  }
  
  // Main menu button
  keyboard.push([{ text: '🏠 Main Menu', callback_data: 'menu_main' }])
  
  return { inline_keyboard: keyboard }
}

// Generate variant list text (Varian dalam Produk)
function generateVariantListText(
  category: ProductCategory,
  variants: Product[],
  page: number,
  totalPages: number
): string {
  if (!variants || variants.length === 0) {
    return `┌---------------------\n│  Belum ada varian untuk\n│  ${category.name}\n└---------------------`
  }

  let teks = '┌---------------------\n'
  teks += `   ${category.name.toUpperCase()}\n`
  teks += `   Pilih paket yang kamu mau\n`

  if (totalPages > 1) {
    teks += `   page ${page} / ${totalPages}\n`
  }

  teks += '└---------------------\n\n'

  teks += '╭ - - - - - - - - - - - - - - - - - - - ╮\n'

  const startIndex = (page - 1) * ITEMS_PER_PAGE

variants.forEach((variant, index) => {
  const stock = variant.items?.length || variant.stock || 0
  const nomor = startIndex + index + 1

  teks += `┊ [${nomor}] ${variant.name}\n`
  teks += `┊     Rp ${toRupiah(variant.price)} (${stock} stok)\n`
})
  teks += '╰ - - - - - - - - - - - - - - - - - - - ╯'

  return teks
}

// Generate keyboard for variant list
function generateVariantListKeyboard(categoryCode: string, variants: Product[], page: number, totalPages: number) {
  const keyboard: { text: string; callback_data: string }[][] = []
  
  // Number buttons in 2 columns
  for (let i = 0; i < variants.length; i += 2) {
    const row: { text: string; callback_data: string }[] = []
    const startIndex = (page - 1) * ITEMS_PER_PAGE
    
    row.push({
      text: `${startIndex + i + 1}`,
      callback_data: `select_${variants[i].id}`
    })
    
    if (variants[i + 1]) {
      row.push({
        text: `${startIndex + i + 2}`,
        callback_data: `select_${variants[i + 1].id}`
      })
    }
    
    keyboard.push(row)
  }
  
  // Pagination buttons
  if (totalPages > 1) {
    const navRow: { text: string; callback_data: string }[] = []
    if (page > 1) {
      navRow.push({ text: `Sebelumnya`, callback_data: `var_page_${categoryCode}_${page - 1}` })
    }
    if (page < totalPages) {
      navRow.push({ text: `Selanjutnya`, callback_data: `var_page_${categoryCode}_${page + 1}` })
    }
    if (navRow.length > 0) keyboard.push(navRow)
  }
  
  // Back and main menu buttons
  keyboard.push([
    { text: '⬅️ Kembali', callback_data: 'list_products_1' },
    { text: '🏠 Main Menu', callback_data: 'menu_main' }
  ])
  
  return { inline_keyboard: keyboard }
}

// Generate paginated product list text (legacy - kept for backward compatibility)
function generateProductListText(products: Product[], page: number, totalPages: number): string {
  if (!products || products.length === 0) {
    return '┌---------------------\n│  Belum ada produk tersedia  │\n└---------------------'
  }

  let teks = '┌---------------------\n'
  teks += `   LIST PRODUK\n`
  teks += `   page ${page} / ${totalPages}\n`
  teks += '└---------------------\n\n'
  
  teks += '┌-------------------------------\n'

  const startIndex = (page - 1) * ITEMS_PER_PAGE
  products.forEach((product, index) => {
    teks += `│ [${startIndex + index + 1}] ${product.name}\n`
  })
  
  teks += '└-------------------------------'
  
  return teks
}

// Generate keyboard for paginated product list
function generateProductListKeyboard(products: Product[], page: number, totalPages: number) {
  const keyboard: { text: string; callback_data: string }[][] = []
  
  // Number buttons in 2 columns
  for (let i = 0; i < products.length; i += 2) {
    const row: { text: string; callback_data: string }[] = []
    const startIndex = (page - 1) * ITEMS_PER_PAGE
    
    row.push({
      text: `${startIndex + i + 1}`,
      callback_data: `select_${products[i].id}`
    })
    
    if (products[i + 1]) {
      row.push({
        text: `${startIndex + i + 2}`,
        callback_data: `select_${products[i + 1].id}`
      })
    }
    
    keyboard.push(row)
  }
  
  // Pagination buttons
  if (totalPages > 1) {
    const navRow: { text: string; callback_data: string }[] = []
    if (page > 1) {
      navRow.push({ text: `Sebelumnya ${page - 1}`, callback_data: `page_${page - 1}` })
    }
    if (page < totalPages) {
      navRow.push({ text: `Selanjutnya ${page + 1}`, callback_data: `page_${page + 1}` })
    }
    if (navRow.length > 0) keyboard.push(navRow)
  }
  
  // Main menu button
  keyboard.push([{ text: '🏠 Main Menu', callback_data: 'menu_main' }])
  
  return { inline_keyboard: keyboard }
}

// Generate product info text
function generateProductInfoText(product: Product, categoryName?: string): string {
  let teks = '┌────────────────────────\n'
  teks += `│ • Produk : ${product.name.toUpperCase()}\n`
  teks += `│ • Code : ${product.code}\n`
  if (product.description) {
    teks += `│ • Deskripsi : ${product.description}\n`
  }
  teks += `│ • Kategori : ${categoryName || product.categoryCode}\n`
  teks += '└──────────────────────────\n\n'
  
  teks += '┌──────────────────────────\n'
  teks += `  Harga & Stok:\n`
  teks += `│ • Harga: Rp ${toRupiah(product.price)}\n`
  teks += `│ • Stok: ${product.stock}\n`
  teks += '└───────────────────────────\n'
  teks += `➤ Refresh at ${getWIBTime()} WIB`
  
  return teks
}

// Generate order confirmation text
function generateOrderConfirmText(product: Product, quantity: number): string {
  const total = product.price * quantity
  
  let teks = `KONFIRMASI PESANAN 🛒\n`
  teks += '┌─────────────────────────────\n'
  teks += '│\n'
  teks += `│ Produk : ${product.name.toUpperCase()}\n`
  teks += `│ Harga satuan : Rp. ${toRupiah(product.price)}\n`
  teks += `│ Stok tersedia : ${product.stock}\n`
  teks += '│─────────────────────────────\n'
  teks += '│\n'
  teks += `│ Jumlah Pesanan : x${quantity}\n`
  teks += `│ Total Pembayaran : Rp. ${toRupiah(total)}\n`
  teks += '│\n'
  teks += '└─────────────────────────────\n'
  teks += `➤ Refresh at ${getWIBTime()} WIB`
  
  return teks
}

// Escape HTML special characters to prevent parsing errors
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Generate start menu text (using HTML formatting)
function generateStartMenuText(user: TelegramUser, botStats: { totalSold: number; totalRevenue: number; totalUsers: number }, userStats: { transactions: number; purchased: number; balance: number }): string {
  // Escape user input to prevent HTML injection
  const firstName = escapeHtml(user.first_name || 'User')
  const username = user.username ? `@${escapeHtml(user.username)}` : 'Tidak ada'
  
  let teks = `<b>Halo kak ${firstName}</b> 👋🏻\n`
  teks += `${getIndonesianDate()}\n\n`
  
  teks += `<b>User Info :</b>\n`
  teks += `└ ID : <code>${user.id}</code>\n`
  teks += `└ Username : ${username}\n`
  teks += `└ Transaksi: <b>Rp. ${toRupiah(userStats.transactions)}</b>\n`
  teks += `└ Produk dibeli : ${userStats.purchased}x\n`
  teks += `└ Saldo Pengguna : <b>Rp. ${toRupiah(userStats.balance)}</b>\n\n`
  
  teks += `<b>BOT Stats :</b>\n`
  teks += `└ Terjual : ${botStats.totalSold} pcs\n`
  teks += `└ Total Transaksi : <b>Rp. ${toRupiah(botStats.totalRevenue)}</b>\n`
  teks += `└ Total User : ${botStats.totalUsers}\n\n`
  
  teks += `<b>Shortcuts :</b>\n`
  teks += `/start - Mulai bot\n`
  teks += `/dashboard - Dashboard saya\n`
  teks += `/stock - Cek stok produk\n`
  teks += `/saldo - Cek saldo\n`
  teks += `/riwayat - Riwayat transaksi`
  
  return teks
}

// Generate main menu keyboard
function generateMainMenuKeyboard(userBalance: number) {
  return {
    inline_keyboard: [
      [
        { text: '🛍️ List Produk', callback_data: 'list_products_1' },
        { text: `💰 Saldo: Rp. ${toRupiah(userBalance)}`, callback_data: 'balance' }
      ],
      [
        { text: '📊 Dashboard Saya', callback_data: 'my_dashboard' }
      ],
      [
        { text: '👩‍💼 Customer Service', callback_data: 'cs' },
        { text: '❓ Cara Order', callback_data: 'how_to_order' }
      ],
      [
        { text: '✨ Produk Populer', callback_data: 'popular' }
      ]
    ]
  }
}

// Generate dashboard menu text
function generateDashboardMenuText(user: TelegramUser, userStats: { transactions: number; purchased: number; balance: number }): string {
  const firstName = escapeHtml(user.first_name || 'User')
  
  let teks = `<b>📊 DASHBOARD</b>\n`
  teks += `━━━━━━━━━━━━━━━━━━━━━\n\n`
  teks += `Halo <b>${firstName}</b>!\n`
  teks += `Berikut ringkasan akun kamu:\n\n`
  teks += `💰 <b>Saldo:</b> Rp. ${toRupiah(userStats.balance)}\n`
  teks += `📦 <b>Total Pembelian:</b> ${userStats.purchased}x\n`
  teks += `💵 <b>Total Transaksi:</b> Rp. ${toRupiah(userStats.transactions)}\n\n`
  teks += `━━━━━━━━━━━━━━━━━━━━━\n`
  teks += `Pilih menu di bawah untuk detail:`
  
  return teks
}

// Generate dashboard keyboard
function generateDashboardKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '👤 Profil Saya', callback_data: 'dash_profile' },
        { text: '💳 Saldo & Keuangan', callback_data: 'dash_balance' }
      ],
      [
        { text: '📜 Riwayat Transaksi', callback_data: 'dash_history_1' },
        { text: '📈 Statistik', callback_data: 'dash_stats' }
      ],
      [
        { text: '🏠 Kembali ke Menu', callback_data: 'menu_main' }
      ]
    ]
  }
}

// Generate profile text
function generateProfileText(user: TelegramUser, userStats: { transactions: number; purchased: number; balance: number }, joinDate?: string): string {
  const firstName = escapeHtml(user.first_name || 'User')
  const lastName = user.last_name ? escapeHtml(user.last_name) : ''
  const username = user.username ? `@${escapeHtml(user.username)}` : 'Tidak ada'
  const fullName = lastName ? `${firstName} ${lastName}` : firstName
  
  let teks = `<b>👤 PROFIL SAYA</b>\n`
  teks += `━━━━━━━━━━━━━━━━━━━━━\n\n`
  teks += `<b>Informasi Akun</b>\n`
  teks += `├ Nama: <b>${fullName}</b>\n`
  teks += `├ Username: ${username}\n`
  teks += `├ ID Telegram: <code>${user.id}</code>\n`
  teks += `└ Status: <b>Aktif</b>\n\n`
  teks += `<b>Statistik Pembelian</b>\n`
  teks += `├ Total Transaksi: <b>${userStats.purchased}x</b>\n`
  teks += `├ Total Belanja: <b>Rp. ${toRupiah(userStats.transactions)}</b>\n`
  teks += `└ Saldo: <b>Rp. ${toRupiah(userStats.balance)}</b>\n\n`
  teks += `━━━━━━━━━━━━━━━━━━━━━\n`
  teks += `<i>ID digunakan untuk verifikasi transaksi</i>`
  
  return teks
}

// Generate balance/finance text
function generateBalanceText(userStats: { transactions: number; purchased: number; balance: number }): string {
  let teks = `<b>💳 SALDO & KEUANGAN</b>\n`
  teks += `━━━━━━━━━━━━━━━━━━━━━\n\n`
  teks += `<b>💰 Saldo Tersedia</b>\n`
  teks += `<code>Rp. ${toRupiah(userStats.balance)}</code>\n\n`
  teks += `<b>📊 Ringkasan Keuangan</b>\n`
  teks += `├ Total Pembelian: ${userStats.purchased}x\n`
  teks += `├ Total Belanja: Rp. ${toRupiah(userStats.transactions)}\n`
  teks += `└ Rata-rata/Transaksi: Rp. ${toRupiah(userStats.purchased > 0 ? Math.round(userStats.transactions / userStats.purchased) : 0)}\n\n`
  teks += `━━━━━━━━━━━━━━━━━━━━━\n`
  teks += `<i>Hubungi admin untuk top up saldo</i>`
  
  return teks
}

// Generate detailed history text with pagination
function generateDetailedHistoryText(orders: Array<{ productName: string; quantity: number; totalPrice: number; createdAt: string; status: string }>, page: number, totalPages: number): string {
  let teks = `<b>📜 RIWAYAT TRANSAKSI</b>\n`
  teks += `━━━━━━━━━━━━━━━━━━━━━\n`
  teks += `Halaman ${page}/${totalPages}\n\n`
  
  if (orders.length === 0) {
    teks += `<i>Belum ada transaksi</i>\n\n`
  } else {
    orders.forEach((order, i) => {
      const startIndex = (page - 1) * 5
      const date = new Date(order.createdAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
      const statusEmoji = order.status === 'completed' ? '✅' : order.status === 'pending' ? '⏳' : '❌'
      
      teks += `<b>${startIndex + i + 1}. ${order.productName}</b>\n`
      teks += `├ Qty: ${order.quantity}x\n`
      teks += `├ Total: Rp. ${toRupiah(order.totalPrice)}\n`
      teks += `├ Status: ${statusEmoji} ${order.status === 'completed' ? 'Selesai' : order.status === 'pending' ? 'Pending' : 'Dibatalkan'}\n`
      teks += `└ Tanggal: ${date}\n\n`
    })
  }
  
  teks += `━━━━━━━━━━━━━━━━━━━━━`
  
  return teks
}

// Generate history pagination keyboard
function generateHistoryKeyboard(page: number, totalPages: number) {
  const keyboard: { text: string; callback_data: string }[][] = []
  
  // Pagination buttons
  if (totalPages > 1) {
    const navRow: { text: string; callback_data: string }[] = []
    if (page > 1) {
      navRow.push({ text: `⬅️ Hal ${page - 1}`, callback_data: `dash_history_${page - 1}` })
    }
    if (page < totalPages) {
      navRow.push({ text: `Hal ${page + 1} ➡️`, callback_data: `dash_history_${page + 1}` })
    }
    if (navRow.length > 0) keyboard.push(navRow)
  }
  
  keyboard.push([
    { text: '📊 Dashboard', callback_data: 'my_dashboard' },
    { text: '🏠 Menu Utama', callback_data: 'menu_main' }
  ])
  
  return { inline_keyboard: keyboard }
}

// Generate stats text
function generateStatsText(userStats: { transactions: number; purchased: number; balance: number }, orders: Array<{ productName: string; quantity: number; totalPrice: number; createdAt: string }>): string {
  // Calculate additional stats
  const thisMonth = new Date()
  const thisMonthStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1)
  const thisMonthOrders = orders.filter(o => new Date(o.createdAt) >= thisMonthStart)
  const thisMonthSpent = thisMonthOrders.reduce((sum, o) => sum + o.totalPrice, 0)
  const thisMonthQty = thisMonthOrders.reduce((sum, o) => sum + o.quantity, 0)
  
  // Most purchased product
  const productCounts: Record<string, number> = {}
  orders.forEach(o => {
    productCounts[o.productName] = (productCounts[o.productName] || 0) + o.quantity
  })
  const topProduct = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0]
  
  let teks = `<b>📈 STATISTIK PEMBELIAN</b>\n`
  teks += `━━━━━━━━━━━━━━━━━━━━━\n\n`
  teks += `<b>📅 Bulan Ini</b>\n`
  teks += `├ Transaksi: ${thisMonthOrders.length}x\n`
  teks += `├ Produk dibeli: ${thisMonthQty} pcs\n`
  teks += `└ Total belanja: Rp. ${toRupiah(thisMonthSpent)}\n\n`
  teks += `<b>📊 Sepanjang Waktu</b>\n`
  teks += `├ Total transaksi: ${orders.length}x\n`
  teks += `├ Total produk: ${userStats.purchased} pcs\n`
  teks += `└ Total belanja: Rp. ${toRupiah(userStats.transactions)}\n\n`
  
  if (topProduct) {
    teks += `<b>🏆 Produk Favorit</b>\n`
    teks += `└ ${topProduct[0]} (${topProduct[1]}x)\n\n`
  }
  
  teks += `━━━━━━━━━━━━━━━━━━━━━`
  
  return teks
}

// Handle callback queries (button clicks)
async function handleCallbackQuery(
  botToken: string, 
  callbackQuery: TelegramCallbackQuery,
  ownerId: string,
  telegramUserId: string,
  botOwnerId: string, // Database user ID of bot owner
  botSettings: { preferredPaymentMethod?: 'orkut' | 'midtrans'; botPhotoUrl?: string } // Bot settings with payment preference and photo
) {
  const chatId = callbackQuery.message?.chat.id
  const messageId = callbackQuery.message?.message_id
  const data = callbackQuery.data || ''
  const user = callbackQuery.from
  
  if (!chatId || !messageId) return
  
  // Get products for this bot owner only (filtered by userId)
  const allProducts = await getProductsByUserId(botOwnerId)
  const products = allProducts?.filter(p => p.isActive) || []
  const orders = await getOrdersByUserId(botOwnerId)
  
  // Calculate stats
  const completedOrders = orders?.filter(o => o.status === 'completed') || []
  // Exclude sandbox orders from revenue calculation (sandbox = testing, not real money)
  const realOrders = completedOrders.filter(o => !o.isSandbox)
  const totalSold = realOrders.reduce((sum, o) => sum + o.quantity, 0)
  const totalRevenue = realOrders.reduce((sum, o) => sum + o.totalPrice, 0)
  const totalUsers = new Set(orders?.map(o => o.buyerId).filter(Boolean) || []).size
  
  const userOrders = completedOrders.filter(o => o.buyerId === telegramUserId)
  const userStats = {
    transactions: userOrders.reduce((sum, o) => sum + o.totalPrice, 0),
    purchased: userOrders.reduce((sum, o) => sum + o.quantity, 0),
    balance: 0 // In production, get from user balance table
  }
  
  // Handle main menu
  if (data === 'menu_main') {
    await answerCallbackQuery(botToken, callbackQuery.id)
    const menuText = generateStartMenuText(user, { totalSold, totalRevenue, totalUsers }, userStats)
    const startMenuPhoto = botSettings.botPhotoUrl || 'https://files.catbox.moe/992896.jpg'
    
    // Delete old message and send new photo message
    try {
      await deleteMessage(botToken, chatId, messageId)
    } catch (e) {
      // Ignore delete errors
    }
    
    await sendPhoto(botToken, chatId, startMenuPhoto, {
      caption: menuText,
      parseMode: 'HTML',
      replyMarkup: generateMainMenuKeyboard(userStats.balance)
    })
    return
  }
  
  // Get categories for this bot owner
  const allCategories = await getProductCategories(botOwnerId)
  const categories = allCategories?.filter(c => c.isActive) || []
  
  // Handle product list pages (now shows categories/products first)
  if (data.startsWith('list_products_') || data.startsWith('cat_page_')) {
    const page = parseInt(data.split('_').pop() || '1')
    const totalPages = Math.ceil(categories.length / ITEMS_PER_PAGE)
    const startIndex = (page - 1) * ITEMS_PER_PAGE
    const pageCategories = categories.slice(startIndex, startIndex + ITEMS_PER_PAGE)
    
    await answerCallbackQuery(botToken, callbackQuery.id)
    
    const listText = generateCategoryListText(pageCategories, products, page, totalPages)
    const keyboard = generateCategoryListKeyboard(pageCategories, page, totalPages)
    
    const photoUrl = botSettings.botPhotoUrl || 'https://files.catbox.moe/992896.jpg'
    await replaceWithPhoto(
  botToken,
  chatId,
  messageId,
  photoUrl,
  listText,
  keyboard
)
    return
  }
  
  // Handle category selection (show variants/products in category)
  if (data.startsWith('select_cat_')) {
    const categoryCode = data.replace('select_cat_', '')
    const category = categories.find(c => c.code === categoryCode)
    
    if (!category) {
      await answerCallbackQuery(botToken, callbackQuery.id, 'Produk tidak ditemukan', true)
      return
    }
    
    // Get variants (products) in this category
    const variants = products.filter(p => p.categoryCode === categoryCode && p.isActive)
    const page = 1
    const totalPages = Math.ceil(variants.length / ITEMS_PER_PAGE)
    const pageVariants = variants.slice(0, ITEMS_PER_PAGE)
    
    await answerCallbackQuery(botToken, callbackQuery.id)
    
    const listText = generateVariantListText(category, pageVariants, page, totalPages)
    const keyboard = generateVariantListKeyboard(categoryCode, pageVariants, page, totalPages)
    
    await replaceWithMessage(botToken, chatId, messageId, listText, { replyMarkup: keyboard })
    return
  }
  
  // Handle variant pagination within category
  if (data.startsWith('var_page_')) {
    // Format: var_page_CATCODE_PAGE
    const parts = data.replace('var_page_', '').split('_')
    const page = parseInt(parts.pop() || '1')
    const categoryCode = parts.join('_')
    
    const category = categories.find(c => c.code === categoryCode)
    if (!category) {
      await answerCallbackQuery(botToken, callbackQuery.id, 'Produk tidak ditemukan', true)
      return
    }
    
    const variants = products.filter(p => p.categoryCode === categoryCode && p.isActive)
    const totalPages = Math.ceil(variants.length / ITEMS_PER_PAGE)
    const startIndex = (page - 1) * ITEMS_PER_PAGE
    const pageVariants = variants.slice(startIndex, startIndex + ITEMS_PER_PAGE)
    
    await answerCallbackQuery(botToken, callbackQuery.id)
    
    const listText = generateVariantListText(category, pageVariants, page, totalPages)
    const keyboard = generateVariantListKeyboard(categoryCode, pageVariants, page, totalPages)
    
    await replaceWithMessage(botToken, chatId, messageId, listText, { replyMarkup: keyboard })
    return
  }
  
  // Handle product/variant selection (show info)
  if (data.startsWith('select_')) {
    const productId = data.replace('select_', '')
    const product = await getProductById(productId)
    
    if (!product) {
      await answerCallbackQuery(botToken, callbackQuery.id, 'Produk tidak ditemukan', true)
      return
    }
    
    // Find category for back button
    const category = categories.find(c => c.code === product.categoryCode)
    
    await answerCallbackQuery(botToken, callbackQuery.id)
    
    const infoText = generateProductInfoText(product, category?.name)
    const keyboard = {
      inline_keyboard: [
        [{ text: `🛒 Beli - Rp ${toRupiah(product.price)}`, callback_data: `buy_${product.id}` }],
        [{ text: '🔄 Refresh', callback_data: `refresh_${product.id}` }],
        [
          { text: '⬅️ Kembali', callback_data: `select_cat_${product.categoryCode}` },
          { text: '🏠 Main Menu', callback_data: 'menu_main' }
        ]
      ]
    }
    
    await replaceWithMessage(botToken, chatId, messageId, infoText, { replyMarkup: keyboard })
    return
  }
  
  // Handle refresh product info
  if (data.startsWith('refresh_')) {
    const productId = data.replace('refresh_', '')
    const product = await getProductById(productId)
    
    if (!product) {
      await answerCallbackQuery(botToken, callbackQuery.id, 'Produk tidak ditemukan', true)
      return
    }
    
    // Find category for back button
    const category = categories.find(c => c.code === product.categoryCode)
    
    await answerCallbackQuery(botToken, callbackQuery.id, 'Data diperbarui!')
    
    const infoText = generateProductInfoText(product, category?.name)
    const keyboard = {
      inline_keyboard: [
        [{ text: `🛒 Beli - Rp ${toRupiah(product.price)}`, callback_data: `buy_${product.id}` }],
        [{ text: '🔄 Refresh', callback_data: `refresh_${product.id}` }],
        [
          { text: '⬅️ Kembali', callback_data: `select_cat_${product.categoryCode}` },
          { text: '🏠 Main Menu', callback_data: 'menu_main' }
        ]
      ]
    }
    
    await replaceWithMessage(botToken, chatId, messageId, infoText, { replyMarkup: keyboard })
    return
  }
  
  // Handle buy button (show order confirmation)
  if (data.startsWith('buy_')) {
    const productId = data.replace('buy_', '')
    const product = await getProductById(productId)
    
    if (!product || product.stock === 0) {
      await answerCallbackQuery(botToken, callbackQuery.id, 'Stok habis!', true)
      return
    }
    
    // Store order session
    const sessionKey = `${chatId}_${messageId}`
    orderSessions.set(sessionKey, {
      productId,
      quantity: 1,
      chatId,
      messageId
    })
    
    await answerCallbackQuery(botToken, callbackQuery.id)
    
    const confirmText = generateOrderConfirmText(product, 1)
    
    // Check if seller has their own QRIS settings first
    const sellerQrisSettings = await getQrisSettings('user', botOwnerId)
    // Check merchantId and token (token is the auth token field in QrisSettings interface)
    const hasSellerQris = sellerQrisSettings && sellerQrisSettings.isActive && sellerQrisSettings.merchantId && sellerQrisSettings.token
    
    // Get global payment settings as fallback
    const paymentSettings = await getPaymentSettings()
    const orkutEnabled = paymentSettings?.orkutEnabled ?? false
    const midtransEnabled = paymentSettings?.midtransEnabled ?? false
    
    // Build payment buttons based on seller's QRIS availability
    const paymentButtons: { text: string; callback_data: string }[][] = []
    
    // Always show saldo button
    paymentButtons.push([{ text: 'Bayar dengan Saldo', callback_data: `pay_saldo_${productId}` }])
    
    // Priority: Seller's own QRIS > Global payment settings
    if (hasSellerQris) {
      // Seller has their own QRIS configured - use Orkut
      paymentButtons.push([{ text: '💳 Bayar dengan QRIS', callback_data: `pay_qris_orkut_${productId}` }])
    } else if (midtransEnabled) {
      // No seller QRIS, fallback to Midtrans if enabled globally
      paymentButtons.push([{ text: '💳 Bayar dengan QRIS', callback_data: `pay_qris_midtrans_${productId}` }])
    } else if (orkutEnabled) {
      // Fallback to admin Orkut if enabled globally
      paymentButtons.push([{ text: '💳 Bayar dengan QRIS', callback_data: `pay_qris_orkut_${productId}` }])
    }
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: '-', callback_data: `qty_minus_${productId}` },
          { text: '+', callback_data: `qty_plus_${productId}` }
        ],
        [
          { text: '-5', callback_data: `qty_minus5_${productId}` },
          { text: '+5', callback_data: `qty_plus5_${productId}` }
        ],
        ...paymentButtons,
        [{ text: '🔄 Refresh Data', callback_data: `refresh_order_${productId}` }],
        [{ text: '⬅️ BACK', callback_data: `select_${productId}` }]
      ]
    }
    
    await replaceWithMessage(botToken, chatId, messageId, confirmText, { replyMarkup: keyboard })
    return
  }
  
  // Handle quantity adjustments
  if (data.startsWith('qty_')) {
    const parts = data.split('_')
    const action = parts[1]
    const productId = parts.slice(2).join('_')
    const product = await getProductById(productId)
    
    if (!product) {
      await answerCallbackQuery(botToken, callbackQuery.id, 'Produk tidak ditemukan', true)
      return
    }
    
    const sessionKey = `${chatId}_${messageId}`
    let session = orderSessions.get(sessionKey)
    
    if (!session) {
      session = { productId, quantity: 1, chatId, messageId }
      orderSessions.set(sessionKey, session)
    }
    
    // Adjust quantity
    let newQty = session.quantity
    if (action === 'minus') newQty = Math.max(1, newQty - 1)
    else if (action === 'plus') newQty = Math.min(product.stock, newQty + 1)
    else if (action === 'minus5') newQty = Math.max(1, newQty - 5)
    else if (action === 'plus5') newQty = Math.min(product.stock, newQty + 5)
    
    session.quantity = newQty
    orderSessions.set(sessionKey, session)
    
    await answerCallbackQuery(botToken, callbackQuery.id, `Jumlah: ${newQty}`)
    
    const confirmText = generateOrderConfirmText(product, newQty)
    
    // Check if seller has their own QRIS settings first
    const sellerQrisSettings2 = await getQrisSettings('user', botOwnerId)
    const hasSellerQris2 = sellerQrisSettings2 && sellerQrisSettings2.isActive && sellerQrisSettings2.merchantId && sellerQrisSettings2.token
    
    // Get global payment settings as fallback
    const paymentSettings2 = await getPaymentSettings()
    const orkutEnabled2 = paymentSettings2?.orkutEnabled ?? false
    const midtransEnabled2 = paymentSettings2?.midtransEnabled ?? false
    
    // Build payment buttons based on seller's QRIS availability
    const paymentButtons2: { text: string; callback_data: string }[][] = []
    paymentButtons2.push([{ text: 'Bayar dengan Saldo', callback_data: `pay_saldo_${productId}` }])
    
    // Priority: Seller's own QRIS > Global payment settings
    if (hasSellerQris2) {
      paymentButtons2.push([{ text: '💳 Bayar dengan QRIS', callback_data: `pay_qris_orkut_${productId}` }])
    } else if (midtransEnabled2) {
      paymentButtons2.push([{ text: '💳 Bayar dengan QRIS', callback_data: `pay_qris_midtrans_${productId}` }])
    } else if (orkutEnabled2) {
      paymentButtons2.push([{ text: '💳 Bayar dengan QRIS', callback_data: `pay_qris_orkut_${productId}` }])
    }
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: '-', callback_data: `qty_minus_${productId}` },
          { text: '+', callback_data: `qty_plus_${productId}` }
        ],
        [
          { text: '-5', callback_data: `qty_minus5_${productId}` },
          { text: '+5', callback_data: `qty_plus5_${productId}` }
        ],
        ...paymentButtons2,
        [{ text: '🔄 Refresh Data', callback_data: `refresh_order_${productId}` }],
        [{ text: '⬅️ BACK', callback_data: `select_${productId}` }]
      ]
    }
    
    await replaceWithMessage(botToken, chatId, messageId, confirmText, { replyMarkup: keyboard })
    return
  }
  
  // Handle refresh order
  if (data.startsWith('refresh_order_')) {
    const productId = data.replace('refresh_order_', '')
    const product = await getProductById(productId)
    
    if (!product) {
      await answerCallbackQuery(botToken, callbackQuery.id, 'Produk tidak ditemukan', true)
      return
    }
    
    const sessionKey = `${chatId}_${messageId}`
    const session = orderSessions.get(sessionKey) || { productId, quantity: 1, chatId, messageId }
    
    await answerCallbackQuery(botToken, callbackQuery.id, 'Data diperbarui!')
    
    const confirmText = generateOrderConfirmText(product, session.quantity)
    
    // Check if seller has their own QRIS settings first
    const sellerQrisSettings3 = await getQrisSettings('user', botOwnerId)
    const hasSellerQris3 = sellerQrisSettings3 && sellerQrisSettings3.isActive && sellerQrisSettings3.merchantId && sellerQrisSettings3.token
    
    // Get global payment settings as fallback
    const paymentSettings3 = await getPaymentSettings()
    const orkutEnabled3 = paymentSettings3?.orkutEnabled ?? false
    const midtransEnabled3 = paymentSettings3?.midtransEnabled ?? false
    
    // Build payment buttons based on seller's QRIS availability
    const paymentButtons3: { text: string; callback_data: string }[][] = []
    paymentButtons3.push([{ text: 'Bayar dengan Saldo', callback_data: `pay_saldo_${productId}` }])
    
    // Priority: Seller's own QRIS > Global payment settings
    if (hasSellerQris3) {
      paymentButtons3.push([{ text: '✅️ Bayar dengan QRIS [ ORKUT ]', callback_data: `pay_qris_orkut_${productId}` }])
    } else if (midtransEnabled3) {
      paymentButtons3.push([{ text: '✅️ Bayar dengan QRIS [ MIDTRANS ]', callback_data: `pay_qris_midtrans_${productId}` }])
    } else if (orkutEnabled3) {
      paymentButtons3.push([{ text: '✅️ Bayar dengan QRIS [ ORKUT ]', callback_data: `pay_qris_orkut_${productId}` }])
    }
    
    const keyboard3 = {
      inline_keyboard: [
        [
          { text: '-', callback_data: `qty_minus_${productId}` },
          { text: '+', callback_data: `qty_plus_${productId}` }
        ],
        [
          { text: '-5', callback_data: `qty_minus5_${productId}` },
          { text: '+5', callback_data: `qty_plus5_${productId}` }
        ],
        ...paymentButtons3,
        [{ text: '🔄 Refresh Data', callback_data: `refresh_order_${productId}` }],
        [{ text: '⬅️ BACK', callback_data: `select_${productId}` }]
      ]
    }
    
    await replaceWithMessage(botToken, chatId, messageId, confirmText, { replyMarkup: keyboard3 })
    return
  }
  
  // Handle payment with saldo
  if (data.startsWith('pay_saldo_')) {
    const productId = data.replace('pay_saldo_', '')
    const product = await getProductById(productId)
    
    if (!product || !product.items || product.items.length === 0) {
      await answerCallbackQuery(botToken, callbackQuery.id, 'Stok habis!', true)
      return
    }
    
    const sessionKey = `${chatId}_${messageId}`
    const session = orderSessions.get(sessionKey) || { productId, quantity: 1, chatId, messageId }
    const quantity = Math.min(session.quantity, product.stock, product.items.length)
    
    if (quantity === 0) {
      await answerCallbackQuery(botToken, callbackQuery.id, 'Stok habis!', true)
      return
    }
    
    // Get items to send
    const itemsToSend = product.items.slice(0, quantity)
    const remainingItems = product.items.slice(quantity)
    
    // Update product stock
    await updateProduct(product.id, {
      items: remainingItems,
      stock: remainingItems.length
    })
    
    // Create order record (saldo payment is real money, not sandbox)
    await createOrder({
      userId: botOwnerId,
      productId: product.id,
      productName: product.name,
      buyerId: telegramUserId,
      buyerName: user.first_name,
      buyerContact: user.username || user.first_name,
      quantity,
      totalPrice: product.price * quantity,
      status: 'completed',
      paymentStatus: 'paid',
      paymentMethod: 'saldo',
      isSandbox: false
    })
    
    // Clean up session
    orderSessions.delete(sessionKey)
    
    await answerCallbackQuery(botToken, callbackQuery.id, 'Pembayaran berhasil!')
    
    // Generate unique code
    const uniqueCode = `${product.code || 'TRX'}-${Math.random().toString(36).substring(2, 15)}`
    const transactionDate = new Date().toLocaleString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    // New format for success message
    let successText = `╭────〔 TRANSAKSI SUKSES 〕─\n`
    successText += `┊\n`
    successText += `┊・Pay ID : SALDO-${Date.now()}\n`
    successText += `┊・Kode Unik : ${uniqueCode}\n`
    successText += `┊・Nama Produk : ${product.name}\n`
    successText += `┊・ID Buyer : ${user.id || chatId}\n`
    successText += `┊・Nomor Buyer : ${chatId}\n`
    successText += `┊・Jumlah Beli : ${quantity}\n`
    successText += `┊・Berhasil Dipenuhi : ${itemsToSend.length} akun\n`
    successText += `┊・Harga Terpakai : ${toRupiah(product.price * quantity)}\n`
    successText += `┊・Fee : 0\n`
    successText += `┊・Total Dibayar : ${toRupiah(product.price * quantity)}\n`
    successText += `┊・Methode Pay : Saldo\n`
    successText += `┊・Tanggal/Jam Transaksi : ${transactionDate}\n`
    successText += `╰┈┈┈┈┈┈┈┈\n\n`
    
    successText += `〔 *PRODUCT DETAIL* 〕\n`
    itemsToSend.forEach((item, i) => {
      successText += `${i + 1}. \`${item}\`\n`
    })
    
    const keyboard = {
      inline_keyboard: [
        [{ text: '🛍️ Beli Lagi', callback_data: 'list_products_1' }],
        [{ text: '🏠 Main Menu', callback_data: 'menu_main' }]
      ]
    }
    
    await replaceWithMessage(botToken, chatId, messageId, successText, { replyMarkup: keyboard })
    
    // Send additional success message if product has one
    if (product.successMessage) {
      await sendMessage(botToken, chatId, product.successMessage)
    }
    return
  }
  
  // Handle payment with Orkut QRIS
  if (data.startsWith('pay_qris_orkut_')) {
    const productId = data.replace('pay_qris_orkut_', '')
    const product = await getProductById(productId)

    if (!product) {
      await answerCallbackQuery(botToken, callbackQuery.id, 'Produk tidak ditemukan', true)
      return
    }

    const sessionKey = `${chatId}_${messageId}`
    const session = orderSessions.get(sessionKey) || { productId, quantity: 1, chatId, messageId }
    const quantity = Math.min(session.quantity, product.stock, product.items?.length || 0)

    if (quantity === 0) {
      await answerCallbackQuery(botToken, callbackQuery.id, 'Stok habis!', true)
      return
    }

    try {
      const totalPrice = product.price * quantity

      // Create order first (Orkut is always production, not sandbox)
      const newOrder = await createOrder({
        userId: botOwnerId,
        productId: product.id,
        productName: product.name,
        buyerId: telegramUserId,
        buyerName: user.first_name,
        buyerContact: user.username || user.first_name,
        quantity,
        totalPrice,
        status: 'pending',
        paymentStatus: 'pending',
        paymentMethod: 'qris',
        isSandbox: false
      })

      if (!newOrder) {
        await answerCallbackQuery(botToken, callbackQuery.id, 'Gagal membuat order', true)
        return
      }

      // Try to get seller/bot owner QRIS first, fallback to admin QRIS
      // botOwnerId = database user ID of the seller who owns this bot
      let qrisResult = await createOrkutQrisPayment(totalPrice, `Pembayaran ${product.name}`, 'user', botOwnerId)
      
      if (!qrisResult.success) {
        // Fallback to admin QRIS if seller doesn't have their own QRIS configured
        console.log('[v0] Seller QRIS not found or failed, falling back to admin QRIS')
        qrisResult = await createOrkutQrisPayment(totalPrice, `Pembayaran ${product.name}`, 'admin')
      }

      if (!qrisResult.success) {
        await answerCallbackQuery(botToken, callbackQuery.id, 'Gagal membuat QRIS: ' + qrisResult.error, true)
        return
      }

      // Update order with QRIS details
      await updatePaymentByOrderId(newOrder.id, {
        status: 'pending',
        transactionId: qrisResult.transactionId,
        qrisUrl: qrisResult.qrString,
      })

      // Create payment record
      await createPayment({
        orderId: newOrder.id,
        userId: telegramUserId,
        amount: qrisResult.amount,
        qrisUrl: qrisResult.qrString,
        transactionId: qrisResult.transactionId,
        status: 'pending',
        paymentMethod: 'qris',
      })

      // Log order creation
      await createBotActivityLog({
        botToken,
        botName: botSettings?.botName || 'Unknown Bot',
        userId: botSettings?.userId || '',
        userName: botSettings?.ownerId || '',
        action: 'order',
        telegramUserId: String(user.id),
        telegramUsername: user.username,
        message: `Orkut Order: ${product.name} x${quantity} = Rp ${toRupiah(qrisResult.amount)}`,
      })

      // Clean up session
      orderSessions.delete(sessionKey)

      await answerCallbackQuery(botToken, callbackQuery.id)

      // Send QRIS payment message with image
      let qrisText = `💳 *PEMBAYARAN QRIS*\n\n`
      qrisText += `📦 *Produk:* ${product.name}\n`
      qrisText += `📊 *Jumlah:* ${quantity}x\n`
      qrisText += `💰 *Harga:* Rp ${toRupiah(qrisResult.originalAmount)}\n`
      qrisText += `💸 *Admin Fee:* Rp ${toRupiah(qrisResult.fee)}\n`
      qrisText += `━━━━━━━━━━━━�����━━━━━━━━\n`
      qrisText += `💵 *Total Bayar:* Rp ${toRupiah(qrisResult.amount)}\n\n`
      qrisText += `🆔 *ID Transaksi:* \`${qrisResult.transactionId}\`\n\n`
      qrisText += `📌 *Instruksi Pembayaran:*\n`
      qrisText += `1. Buka aplikasi e-wallet/banking\n`
      qrisText += `2. Scan QR Code di bawah\n`
      qrisText += `3. Ikuti proses pembayaran\n`
      qrisText += `4. Tunggu konfirmasi (otomatis)\n\n`
      qrisText += `⏱️ *Berlaku sampai:* ${new Date(qrisResult.expiresAt).toLocaleString('id-ID')}\n\n`
      qrisText += `_Pembayaran akan diproses secara otomatis setelah berhasil._`

      const keyboard = {
        inline_keyboard: [
          [{ text: '✅ Cek Status Pembayaran', callback_data: `check_payment_${newOrder.id}` }],
          [{ text: '🔄 Refresh', callback_data: `refresh_payment_${newOrder.id}` }],
          [{ text: '❌ Batal', callback_data: `cancel_order_${newOrder.id}` }]
        ]
      }

      // Send QR code image from Orkut API
      try {
        const photoResult = await sendPhoto(botToken, chatId, qrisResult.qrsImageUrl, {
          caption: qrisText,
          replyMarkup: keyboard
        })
        if (photoResult.ok && photoResult.result?.message_id) {
          // Save message ID for auto-delete later
          await updatePaymentByOrderId(newOrder.id, {
            qrisMessageId: photoResult.result.message_id,
            qrisChatId: chatId
          })
        }
        if (!photoResult.ok) {
          await sendMessage(botToken, chatId, qrisText, { replyMarkup: keyboard })
        }
      } catch (photoError) {
        console.error('Failed to send photo:', photoError)
        await sendMessage(botToken, chatId, qrisText, { replyMarkup: keyboard })
      }

      return
    } catch (error) {
      console.error('[v0] QRIS Payment Error:', error)
      await answerCallbackQuery(botToken, callbackQuery.id, 'Gagal memproses pembayaran QRIS', true)
      return
    }
  }
  
  // Handle payment with Midtrans QRIS
  if (data.startsWith('pay_qris_midtrans_')) {
    const productId = data.replace('pay_qris_midtrans_', '')
    const product = await getProductById(productId)

    if (!product) {
      await answerCallbackQuery(botToken, callbackQuery.id, 'Produk tidak ditemukan', true)
      return
    }

    const sessionKey = `${chatId}_${messageId}`
    const session = orderSessions.get(sessionKey) || { productId, quantity: 1, chatId, messageId }
    const quantity = Math.min(session.quantity, product.stock, product.items?.length || 0)

    if (quantity === 0) {
      await answerCallbackQuery(botToken, callbackQuery.id, 'Stok habis!', true)
      return
    }

    try {
      const basePrice = product.price * quantity

      // Get payment settings to check if sandbox mode
      const paymentSettingsMidtrans = await getPaymentSettings()
      const isSandboxMode = !(paymentSettingsMidtrans?.midtransIsProduction ?? false)

      // Create order first with base price
      const newOrder = await createOrder({
        userId: botOwnerId,
        productId: product.id,
        productName: product.name,
        buyerId: telegramUserId,
        buyerName: user.first_name,
        buyerContact: user.username || user.first_name,
        quantity,
        totalPrice: basePrice, // Store base price in order
        status: 'pending',
        paymentStatus: 'pending',
        paymentMethod: 'midtrans',
        isSandbox: isSandboxMode
      })

      if (!newOrder) {
        await answerCallbackQuery(botToken, callbackQuery.id, 'Gagal membuat order', true)
        return
      }

      // Create Midtrans QRIS payment - fee is calculated inside this function
      const midtransResult = await createMidtransQrisPayment(
        newOrder.id,
        basePrice, // Pass base price, fee will be added automatically
        user.first_name,
        undefined
      )

      if (!midtransResult.success) {
        await answerCallbackQuery(botToken, callbackQuery.id, 'Gagal membuat QRIS: ' + midtransResult.error, true)
        return
      }

      // Get fee info from midtrans result
      const baseFee = midtransResult.feeAmount || 0
      const randomFee = midtransResult.randomFee || 0
      const totalFee = baseFee + randomFee
      const totalPrice = midtransResult.totalAmount || basePrice

      // Update order with payment details
      await updateOrder(newOrder.id, {
        paymentQrisUrl: midtransResult.qrCodeUrl,
        paymentTransactionId: midtransResult.transactionId,
      })

      // Create payment record with total amount including fee
      await createPayment({
        orderId: newOrder.id,
        userId: telegramUserId,
        amount: totalPrice, // Total with fee
        qrisUrl: midtransResult.qrCodeUrl,
        transactionId: midtransResult.transactionId,
        status: 'pending',
        paymentMethod: 'midtrans',
      })

      // Log order creation
      await createBotActivityLog({
        botToken,
        botName: botSettings?.botName || 'Unknown Bot',
        userId: botSettings?.userId || '',
        userName: botSettings?.ownerId || '',
        action: 'order',
        telegramUserId: String(user.id),
        telegramUsername: user.username,
        message: `Order: ${product.name} x${quantity} = Rp ${toRupiah(totalPrice)}`,
      })

      // Clean up session
      orderSessions.delete(sessionKey)

      await answerCallbackQuery(botToken, callbackQuery.id)

      // Send QRIS payment message
      let qrisText = `💳 *PEMBAYARAN QRIS (MIDTRANS)*\n\n`
      qrisText += `📦 *Produk:* ${product.name}\n`
      qrisText += `📊 *Jumlah:* ${quantity}x\n`
      qrisText += `💵 *Harga:* Rp ${toRupiah(basePrice)}\n`
      if (totalFee > 0) {
        qrisText += `💳 *Admin Fee:* Rp ${toRupiah(baseFee)}\n`
        qrisText += `🔢 *Kode Unik:* Rp ${toRupiah(randomFee)}\n`
      }
      qrisText += `━━━━━━━━━━━━━━━━━━━━\n`
      qrisText += `💰 *Total Bayar:* Rp ${toRupiah(totalPrice)}\n\n`
      qrisText += `🆔 *ID Transaksi:* \`${midtransResult.transactionId}\`\n\n`
      qrisText += `📌 *Instruksi Pembayaran:*\n`
      qrisText += `1. Buka aplikasi e-wallet/banking\n`
      qrisText += `2. Scan QR Code di bawah\n`
      qrisText += `3. Ikuti proses pembayaran\n`
      qrisText += `4. Tunggu konfirmasi (otomatis)\n\n`
      if (midtransResult.expiryTime) {
        qrisText += `⏱️ *Berlaku sampai:* ${new Date(midtransResult.expiryTime).toLocaleString('id-ID')}\n\n`
      }
      qrisText += `_Pembayaran akan diproses secara otomatis setelah berhasil._`

      const keyboard = {
        inline_keyboard: [
          [{ text: '✅ Cek Status Pembayaran', callback_data: `check_payment_midtrans_${newOrder.id}` }],
          [{ text: '❌ Batal', callback_data: `cancel_order_${newOrder.id}` }]
        ]
      }

      // Send QR code image if available
      if (midtransResult.qrCodeUrl) {
        const photoResult = await sendPhoto(botToken, chatId, midtransResult.qrCodeUrl, {
          caption: qrisText,
          replyMarkup: keyboard
        })
        if (photoResult.ok && photoResult.result?.message_id) {
          // Save message ID for auto-delete later
          await updatePaymentByOrderId(newOrder.id, {
            qrisMessageId: photoResult.result.message_id,
            qrisChatId: chatId
          })
        }
        if (!photoResult.ok) {
          await sendMessage(botToken, chatId, qrisText, { replyMarkup: keyboard })
        }
      } else {
        await sendMessage(botToken, chatId, qrisText, { replyMarkup: keyboard })
      }

      return
    } catch (error) {
      console.error('[v0] Midtrans QRIS Payment Error:', error)
      await answerCallbackQuery(botToken, callbackQuery.id, 'Gagal memproses pembayaran Midtrans QRIS', true)
      return
    }
  }

  // Handle cancel order
  if (data.startsWith('cancel_order_')) {
    const orderId = data.replace('cancel_order_', '')
    
    try {
      const order = await getOrderById(orderId)
      
      if (!order) {
        await answerCallbackQuery(botToken, callbackQuery.id, 'Order tidak ditemukan', true)
        return
      }

      // Update order status to cancelled
      await updateOrder(orderId, {
        status: 'cancelled',
        paymentStatus: 'cancelled'
      })

      // Delete the payment message (QR code message)
      try {
        await deleteMessage(botToken, chatId, messageId)
      } catch (deleteError) {
        console.error('Failed to delete message:', deleteError)
      }

      // Send cancellation confirmation
      const cancelText = `❌ *PESANAN DIBATALKAN*\n\n` +
        `📦 *Produk:* ${order.productName}\n` +
        `📊 *Jumlah:* ${order.quantity}x\n` +
        `💰 *Total:* Rp ${toRupiah(order.totalPrice)}\n` +
        `🆔 *Order ID:* \`${order.id}\`\n\n` +
        `📋 *Status:* Dibatalkan\n` +
        `📅 *Waktu:* ${new Date().toLocaleString('id-ID')}\n\n` +
        `_Pesanan Anda telah dibatalkan. Silakan order kembali jika diperlukan._`

      const keyboard = {
        inline_keyboard: [
          [{ text: '🏠 Menu Utama', callback_data: 'menu_main' }],
          [{ text: '🛒 Order Lagi', callback_data: 'menu_products' }]
        ]
      }

      await sendMessage(botToken, chatId, cancelText, { replyMarkup: keyboard })
      await answerCallbackQuery(botToken, callbackQuery.id, 'Pesanan berhasil dibatalkan')
      return
    } catch (error) {
      console.error('[v0] Cancel Order Error:', error)
      await answerCallbackQuery(botToken, callbackQuery.id, 'Gagal membatalkan pesanan', true)
      return
    }
  }

  // Handle check Midtrans payment status
  if (data.startsWith('check_payment_midtrans_')) {
    const orderId = data.replace('check_payment_midtrans_', '')
    
    try {
      const order = await getOrderById(orderId)
      
      if (!order) {
        await answerCallbackQuery(botToken, callbackQuery.id, 'Order tidak ditemukan', true)
        return
      }

      // Get payment record
      const payment = await getPaymentByOrderId(orderId)
      if (!payment || !payment.transactionId) {
        await answerCallbackQuery(botToken, callbackQuery.id, 'Pembayaran tidak ditemukan', true)
        return
      }

      // Log payment check
      await createBotActivityLog({
        botToken,
        botName: botSettings?.botName || 'Unknown Bot',
        userId: botSettings?.userId || '',
        userName: botSettings?.ownerId || '',
        action: 'payment',
        telegramUserId: String(user.id),
        telegramUsername: user.username,
        message: `Cek status pembayaran: ${order.productName}`,
      })

      // Check status from Midtrans
      const isPaid = await isMidtransPaymentPaid(payment.transactionId)

      if (isPaid) {
        // Update order and payment status to completed
        await updateOrder(orderId, { paymentStatus: 'paid', status: 'completed' })
        await updatePaymentByOrderId(orderId, { status: 'paid' })

        // Calculate and save admin fee income
        const feeAmount = payment.amount - order.totalPrice
        if (feeAmount > 0) {
          await createAdminFeeIncome({
            orderId: order.id,
            buyerName: order.buyerName,
            productName: order.productName,
            originalAmount: order.totalPrice,
            baseFee: Math.floor(feeAmount * 0.8), // Estimate base fee as 80%
            randomFee: Math.ceil(feeAmount * 0.2), // Estimate random fee as 20%
            totalFee: feeAmount,
            paymentMethod: 'midtrans',
          })
        }

        // Log payment completion
        await createBotActivityLog({
          botToken,
          botName: botSettings?.botName || 'Unknown Bot',
          userId: botSettings?.userId || '',
          userName: botSettings?.ownerId || '',
          action: 'complete',
          telegramUserId: String(chatId),
          telegramUsername: user.username,
          message: `Payment completed: ${order.productName} - Rp ${order.totalPrice}`,
        })

        // Delete QRIS message if exists
        if (payment.qrisMessageId && payment.qrisChatId) {
          try {
            await deleteMessage(botToken, payment.qrisChatId, payment.qrisMessageId)
          } catch (deleteErr) {
            // Ignore delete errors
          }
        }

        // Deliver product
        const product = await getProductById(order.productId)
        let itemsDelivered: string[] = []
        
        if (product && product.items && product.items.length > 0) {
          const itemsToSend = product.items.slice(0, order.quantity)
          const remainingItems = product.items.slice(order.quantity)

          await updateProduct(product.id, {
            items: remainingItems,
            stock: remainingItems.length
          })
          
          itemsDelivered = itemsToSend
        }

        // Generate unique code
        const uniqueCode = `${product?.code || 'TRX'}-${Math.random().toString(36).substring(2, 15)}`
        const transactionDate = new Date().toLocaleString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })

        // New format for success message
        let successText = `╭────〔 TRANSAKSI SUKSES 〕─\n`
        successText += `┊\n`
        successText += `┊・Pay ID : ${payment.transactionId}\n`
        successText += `┊・Kode Unik : ${uniqueCode}\n`
        successText += `┊・Nama Produk : ${order.productName}\n`
        successText += `┊・ID Buyer : ${order.buyerId || chatId}\n`
        successText += `┊・Nomor Buyer : ${chatId}\n`
        successText += `┊・Jumlah Beli : ${order.quantity}\n`
        successText += `┊・Berhasil Dipenuhi : ${itemsDelivered.length} akun\n`
        successText += `┊・Harga Terpakai : ${toRupiah(order.totalPrice)}\n`
        successText += `┊・Fee : ${toRupiah(payment.amount - order.totalPrice)}\n`
        successText += `┊・Total Dibayar : ${toRupiah(payment.amount)}\n`
        successText += `┊・Methode Pay : Midtrans QRIS\n`
        successText += `┊・Tanggal/Jam Transaksi : ${transactionDate}\n`
        successText += `╰┈┈┈┈┈┈┈┈\n\n`
        
        if (itemsDelivered.length > 0) {
          successText += `〔 *PRODUCT DETAIL* 〕\n`
          itemsDelivered.forEach((item, i) => {
            successText += `${i + 1}. \`${item}\`\n`
          })
        } else {
          successText += `_Produk akan dikirim oleh admin._`
        }

        await answerCallbackQuery(botToken, callbackQuery.id, 'Pembayaran berhasil!', false)
        await sendMessage(botToken, chatId, successText)
        
        // Send additional success message if product has one
        if (product?.successMessage) {
          await sendMessage(botToken, chatId, product.successMessage)
        }
      } else {
        let pendingText = `⏳ *PEMBAYARAN BELUM DIKONFIRMASI*\n\n`
        pendingText += `🆔 *ID Transaksi:* \`${payment.transactionId}\`\n`
        pendingText += `📝 *Status:* Menunggu pembayaran\n\n`
        pendingText += `_Silakan coba lagi dalam beberapa detik_`

        await answerCallbackQuery(botToken, callbackQuery.id, 'Masih menunggu pembayaran...', false)
        await sendMessage(botToken, chatId, pendingText)
      }

      return
    } catch (error) {
      console.error('Check Midtrans Payment Error:', error)
      const errorMsg = error instanceof Error ? error.message : 'Terjadi kesalahan'
      await answerCallbackQuery(botToken, callbackQuery.id, `Gagal cek status: ${errorMsg}`, true)
      return
    }
  }
  
  // Handle check payment status
  if (data.startsWith('check_payment_')) {
    const orderId = data.replace('check_payment_', '')
    
    try {
      const order = await getOrderById(orderId)
      
      if (!order) {
        await answerCallbackQuery(botToken, callbackQuery.id, 'Order tidak ditemukan', true)
        return
      }

      // Get payment transaction ID
      const payments = await getPaymentByOrderId(orderId)
      if (!payments) {
        await answerCallbackQuery(botToken, callbackQuery.id, 'Pembayaran tidak ditemukan', true)
        return
      }

      // Log payment check
      await createBotActivityLog({
        botToken,
        botName: botSettings?.botName || 'Unknown Bot',
        userId: botSettings?.userId || '',
        userName: botSettings?.ownerId || '',
        action: 'payment',
        telegramUserId: String(user.id),
        telegramUsername: user.username,
        message: `Cek status Orkut: ${order.productName}`,
      })

  // Check status real-time from Orkut (include amount and codeqr for API)
  // Use order.userId (seller's database ID) to check their QRIS settings
const statusCheck = await checkOrkutPaymentStatus(
  payments.transactionId,
  'user',
  order.userId, // Use seller's database ID, not buyer's telegram ID
  payments.amount,
  payments.qrString
  )

      if (statusCheck.status === 'paid') {
        // Log payment completion
        await createBotActivityLog({
          botToken,
          botName: botSettings?.botName || 'Unknown Bot',
          userId: botSettings?.userId || '',
          userName: botSettings?.ownerId || '',
          action: 'complete',
          telegramUserId: String(user.id),
          telegramUsername: user.username,
          message: `Orkut paid: ${order.productName} - Rp ${toRupiah(order.totalPrice)}`,
        })
        // Update order and payment status to completed
        await updateOrder(orderId, { paymentStatus: 'paid', status: 'completed' })
        await updatePaymentByOrderId(orderId, { status: 'paid' })

        // Delete QRIS message if exists
        if (payments.qrisMessageId && payments.qrisChatId) {
          try {
            await deleteMessage(botToken, payments.qrisChatId, payments.qrisMessageId)
          } catch (deleteErr) {
            // Ignore delete errors
          }
        }

        // Deliver product
        const product = await getProductById(order.productId)
        let itemsDelivered: string[] = []
        
        if (product && product.items && product.items.length > 0) {
          const itemsToSend = product.items.slice(0, order.quantity)
          const remainingItems = product.items.slice(order.quantity)
          
          await updateProduct(product.id, {
            items: remainingItems,
            stock: remainingItems.length
          })
          
          itemsDelivered = itemsToSend
        }

        // Generate unique code
        const uniqueCode = `${product?.code || 'TRX'}-${Math.random().toString(36).substring(2, 15)}`
        const transactionDate = new Date().toLocaleString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })

        // New format for success message
        let statusText = `╭────〔 TRANSAKSI SUKSES 〕─\n`
        statusText += `┊\n`
        statusText += `┊・Pay ID : ${payments.transactionId}\n`
        statusText += `┊・Kode Unik : ${uniqueCode}\n`
        statusText += `┊・Nama Produk : ${order.productName}\n`
        statusText += `┊・ID Buyer : ${order.buyerId || chatId}\n`
        statusText += `┊・Nomor Buyer : ${chatId}\n`
        statusText += `┊・Jumlah Beli : ${order.quantity}\n`
        statusText += `┊・Berhasil Dipenuhi : ${itemsDelivered.length} akun\n`
        statusText += `┊・Harga Terpakai : ${toRupiah(order.totalPrice)}\n`
        statusText += `┊・Fee : ${toRupiah(payments.amount - order.totalPrice)}\n`
        statusText += `┊・Total Dibayar : ${toRupiah(payments.amount)}\n`
        statusText += `┊・Methode Pay : ${statusCheck.brand || 'QRIS auto'}\n`
        statusText += `┊・Tanggal/Jam Transaksi : ${transactionDate}\n`
        statusText += `╰┈┈┈┈┈┈┈┈\n\n`
        
        if (itemsDelivered.length > 0) {
          statusText += `〔 *PRODUCT DETAIL* 〕\n`
          itemsDelivered.forEach((item, i) => {
            statusText += `${i + 1}. \`${item}\`\n`
          })
        } else {
          statusText += `_Produk akan dikirim oleh admin._`
        }

        await answerCallbackQuery(botToken, callbackQuery.id, 'Pembayaran terkonfirmasi!', false)
        await sendMessage(botToken, chatId, statusText)
        
        // Send additional success message if product has one
        if (product?.successMessage) {
          await sendMessage(botToken, chatId, product.successMessage)
        }
      } else if (statusCheck.status === 'pending') {
        let pendingText = `⏳ *PEMBAYARAN BELUM DIKONFIRMASI*\n\n`
        pendingText += `🆔 *ID Transaksi:* \`${statusCheck.transactionId}\`\n`
        pendingText += `📝 *Status:* ${statusCheck.error || 'Menunggu pembayaran'}\n\n`
        pendingText += `_Silakan coba lagi dalam beberapa detik_`

        await answerCallbackQuery(botToken, callbackQuery.id, 'Masih menunggu pembayaran...', false)
        await sendMessage(botToken, chatId, pendingText)
      } else {
        let failText = `❌ *PEMBAYARAN GAGAL/EXPIRED*\n\n`
        failText += `🆔 *ID Transaksi:* \`${statusCheck.transactionId}\`\n`
        failText += `📝 *Alasan:* ${statusCheck.error || 'Pembayaran tidak terdeteksi'}\n\n`
        failText += `_Silakan coba ulang pembayaran_`

        await answerCallbackQuery(botToken, callbackQuery.id, 'Pembayaran gagal atau expired', true)
        await sendMessage(botToken, chatId, failText)
      }

      return
    } catch (error) {
      console.error('[v0] Check Payment Error:', error)
      await answerCallbackQuery(botToken, callbackQuery.id, 'Gagal check status: ' + String(error), true)
      return
    }
  }

  // Handle refresh payment status
  if (data.startsWith('refresh_payment_')) {
    const orderId = data.replace('refresh_payment_', '')
    await editMessageReplyMarkup(botToken, chatId, messageId, {
      inline_keyboard: [
        [{ text: '⏳ Mengecek...', callback_data: 'noop' }]
      ]
    })
    
    // Trigger check status again
    await fetch(`${TELEGRAM_API}${botToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQuery.id,
        text: 'Mengecek status pembayaran...',
        show_alert: false,
      }),
    })

    // Simulate a check_payment call
    const checkData = `check_payment_${orderId}`
    // Re-process as check_payment
    Object.assign(data, checkData)
    return
  }
  
  // Handle balance check (quick view)
  if (data === 'balance') {
    await answerCallbackQuery(botToken, callbackQuery.id, `Saldo Anda: Rp. ${toRupiah(userStats.balance)}`, true)
    return
  }
  
  // Handle My Dashboard menu
  if (data === 'my_dashboard') {
    await answerCallbackQuery(botToken, callbackQuery.id)
    const dashboardText = generateDashboardMenuText(user, userStats)
    await replaceWithMessage(botToken, chatId, messageId, dashboardText, {
      parseMode: 'HTML',
      replyMarkup: generateDashboardKeyboard()
    })
    return
  }
  
  // Handle Dashboard - Profile
  if (data === 'dash_profile') {
    await answerCallbackQuery(botToken, callbackQuery.id)
    const profileText = generateProfileText(user, userStats)
    await replaceWithMessage(botToken, chatId, messageId, profileText, {
      parseMode: 'HTML',
      replyMarkup: {
        inline_keyboard: [
          [
            { text: '📊 Dashboard', callback_data: 'my_dashboard' },
            { text: '🏠 Menu Utama', callback_data: 'menu_main' }
          ]
        ]
      }
    })
    return
  }
  
  // Handle Dashboard - Balance/Finance
  if (data === 'dash_balance') {
    await answerCallbackQuery(botToken, callbackQuery.id)
    const balanceText = generateBalanceText(userStats)
    await replaceWithMessage(botToken, chatId, messageId, balanceText, {
      parseMode: 'HTML',
      replyMarkup: {
        inline_keyboard: [
          [{ text: '💳 Top Up Saldo', callback_data: 'topup_info' }],
          [
            { text: '📊 Dashboard', callback_data: 'my_dashboard' },
            { text: '🏠 Menu Utama', callback_data: 'menu_main' }
          ]
        ]
      }
    })
    return
  }
  
  // Handle Top Up Info
  if (data === 'topup_info') {
    await answerCallbackQuery(botToken, callbackQuery.id)
    const topupText = `<b>💳 TOP UP SALDO</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Untuk top up saldo, silakan hubungi admin/CS dengan menyertakan:\n\n` +
      `1. ID Telegram: <code>${user.id}</code>\n` +
      `2. Jumlah top up\n` +
      `3. Bukti transfer\n\n` +
      `<i>Admin akan memproses dalam 1x24 jam</i>`
    
    await replaceWithMessage(botToken, chatId, messageId, topupText, {
      parseMode: 'HTML',
      replyMarkup: {
        inline_keyboard: [
          [{ text: '👩‍💼 Hubungi CS', callback_data: 'cs' }],
          [
            { text: '💳 Kembali', callback_data: 'dash_balance' },
            { text: '🏠 Menu Utama', callback_data: 'menu_main' }
          ]
        ]
      }
    })
    return
  }
  
  // Handle Dashboard - History with pagination
  if (data.startsWith('dash_history_')) {
    const page = parseInt(data.replace('dash_history_', '') || '1')
    const itemsPerPage = 5
    const totalPages = Math.max(1, Math.ceil(userOrders.length / itemsPerPage))
    const startIndex = (page - 1) * itemsPerPage
    const pageOrders = userOrders.slice(startIndex, startIndex + itemsPerPage)
    
    await answerCallbackQuery(botToken, callbackQuery.id)
    const historyText = generateDetailedHistoryText(pageOrders, page, totalPages)
    await replaceWithMessage(botToken, chatId, messageId, historyText, {
      parseMode: 'HTML',
      replyMarkup: generateHistoryKeyboard(page, totalPages)
    })
    return
  }
  
  // Handle Dashboard - Stats
  if (data === 'dash_stats') {
    await answerCallbackQuery(botToken, callbackQuery.id)
    const statsText = generateStatsText(userStats, userOrders)
    await replaceWithMessage(botToken, chatId, messageId, statsText, {
      parseMode: 'HTML',
      replyMarkup: {
        inline_keyboard: [
          [
            { text: '📊 Dashboard', callback_data: 'my_dashboard' },
            { text: '🏠 Menu Utama', callback_data: 'menu_main' }
          ]
        ]
      }
    })
    return
  }
  
  // Handle CS
  if (data === 'cs') {
    await answerCallbackQuery(botToken, callbackQuery.id)
    const csText = `*Customer Service*\n\nHubungi admin untuk bantuan:\n\n_Silakan chat langsung untuk pertanyaan atau keluhan._`
    await replaceWithMessage(botToken, chatId, messageId, csText, {
      replyMarkup: {
        inline_keyboard: [[{ text: 'Kembali', callback_data: 'menu_main' }]]
      }
    })
    return
  }
  
  // Handle history (redirect to dashboard history)
  if (data === 'history') {
    // Redirect to the new dashboard history
    const page = 1
    const itemsPerPage = 5
    const totalPages = Math.max(1, Math.ceil(userOrders.length / itemsPerPage))
    const pageOrders = userOrders.slice(0, itemsPerPage)
    
    await answerCallbackQuery(botToken, callbackQuery.id)
    const historyText = generateDetailedHistoryText(pageOrders, page, totalPages)
    await replaceWithMessage(botToken, chatId, messageId, historyText, {
      parseMode: 'HTML',
      replyMarkup: generateHistoryKeyboard(page, totalPages)
    })
    return
  }
  
  // Handle popular products
  if (data === 'popular') {
    await answerCallbackQuery(botToken, callbackQuery.id)
    
    // Sort by sold count (in production, track this properly)
    const popularProducts = products.slice(0, 5)
    
    let popularText = `*Produk Populer*\n\n`
    if (popularProducts.length === 0) {
      popularText += `Belum ada produk populer.`
    } else {
      popularProducts.forEach((p, i) => {
        popularText += `${i + 1}. *${p.name}*\n`
        popularText += `   Rp ${toRupiah(p.price)} | Stok: ${p.stock}\n\n`
      })
    }
    
    const keyboard = {
      inline_keyboard: [
        ...popularProducts.map(p => ([{ text: `${p.name}`, callback_data: `select_${p.id}` }])),
        [{ text: 'Kembali', callback_data: 'menu_main' }]
      ]
    }
    
    await replaceWithMessage(botToken, chatId, messageId, popularText, { replyMarkup: keyboard })
    return
  }
  
  // Handle how to order
  if (data === 'how_to_order') {
    await answerCallbackQuery(botToken, callbackQuery.id)
    
    const howText = `*Cara Order*\n\n` +
      `1. Klik *List Produk* untuk melihat daftar produk\n` +
      `2. Pilih nomor produk yang ingin dibeli\n` +
      `3. Klik tombol *Beli* untuk konfirmasi\n` +
      `4. Atur jumlah pesanan dengan tombol +/-\n` +
      `5. Pilih metode pembayaran\n` +
      `6. Data akan dikirim otomatis setelah pembayaran\n\n` +
      `_Hubungi CS jika ada kendala._`
    
    await replaceWithMessage(botToken, chatId, messageId, howText, {
      replyMarkup: {
        inline_keyboard: [[{ text: 'Kembali', callback_data: 'menu_main' }]]
      }
    })
    return
  }
  
  // Default: answer callback
  await answerCallbackQuery(botToken, callbackQuery.id)
}

// Handle bot commands and messages
async function handleMessage(botToken: string, message: TelegramMessage, ownerId: string, botOwnerId: string, botSettings: { botPhotoUrl?: string }) {
  const chatId = message.chat.id
  const text = message.text || ''
  const userId = message.from.id.toString()
  const user = message.from
  
  // Get data for stats - only products from this bot owner
  const allProducts = await getProductsByUserId(botOwnerId)
  const products = allProducts?.filter(p => p.isActive) || []
  const orders = await getOrdersByUserId(botOwnerId)
  
  const completedOrders = orders?.filter(o => o.status === 'completed') || []
  // Exclude sandbox orders from revenue calculation (sandbox = testing, not real money)
  const realOrders = completedOrders.filter(o => !o.isSandbox)
  const totalSold = realOrders.reduce((sum, o) => sum + o.quantity, 0)
  const totalRevenue = realOrders.reduce((sum, o) => sum + o.totalPrice, 0)
  const totalUsers = new Set(orders?.map(o => o.buyerId).filter(Boolean) || []).size

  const userOrders = completedOrders.filter(o => o.buyerId === userId)
  const userStats = {
    transactions: userOrders.reduce((sum, o) => sum + o.totalPrice, 0),
    purchased: userOrders.reduce((sum, o) => sum + o.quantity, 0),
    balance: 0
  }

  // Check for spam activity
  const isSpam = await detectSpamActivity(String(user.id))
  if (isSpam) {
    // Log spam detection
    await createBotActivityLog({
      botToken,
      botName: botSettings.botName || 'Unknown Bot',
      userId: botSettings.userId,
      userName: botSettings.ownerId,
      action: 'spam_detected',
      telegramUserId: String(user.id),
      telegramUsername: user.username,
      message: `Spam detected from ${user.first_name}`,
    })
    await sendMessage(botToken, chatId, 'Terlalu banyak request. Mohon tunggu beberapa menit.', {})
    return
  }

  // Handle /start command
  if (text.startsWith('/start')) {
    console.log('[v0] Handling /start command for user:', user.first_name)
    
    // Log start action
    await createBotActivityLog({
      botToken,
      botName: botSettings.botName || 'Unknown Bot',
      userId: botSettings.userId,
      userName: botSettings.ownerId,
      action: 'start',
      telegramUserId: String(user.id),
      telegramUsername: user.username,
      message: `/start from ${user.first_name}`,
    })

    const menuText = generateStartMenuText(user, { totalSold, totalRevenue, totalUsers }, userStats)
    console.log('[v0] Generated menu text length:', menuText?.length)
    
    const startMenuPhoto = botSettings.botPhotoUrl || 'https://files.catbox.moe/992896.jpg'
    console.log('[v0] Using photo URL:', startMenuPhoto)
    
    try {
      const result = await sendPhoto(botToken, chatId, startMenuPhoto, {
        caption: menuText,
        parseMode: 'HTML',
        replyMarkup: generateMainMenuKeyboard(userStats.balance)
      })
      console.log('[v0] /start sendPhoto completed')
    } catch (err) {
      console.error('[v0] /start sendPhoto error:', err)
    }
    return
  }

  // Handle /stock or /menu command
  if (text.startsWith('/stock') || text.startsWith('/menu') || text.startsWith('/listproduk')) {
    const totalPages = Math.ceil(products.length / ITEMS_PER_PAGE)
    const pageProducts = products.slice(0, ITEMS_PER_PAGE)
    
    const listText = generateProductListText(pageProducts, 1, totalPages)
    const keyboard = generateProductListKeyboard(pageProducts, 1, totalPages)
    
    await sendMessage(botToken, chatId, listText, { replyMarkup: keyboard })
    return
  }

  // Handle /saldo command
  if (text.startsWith('/saldo')) {
    const balanceText = generateBalanceText(userStats)
    await sendMessage(botToken, chatId, balanceText, {
      parseMode: 'HTML',
      replyMarkup: {
        inline_keyboard: [
          [{ text: '💳 Top Up Saldo', callback_data: 'topup_info' }],
          [{ text: '📊 Dashboard', callback_data: 'my_dashboard' }],
          [{ text: '🏠 Main Menu', callback_data: 'menu_main' }]
        ]
      }
    })
    return
  }
  
  // Handle /dashboard or /profil command
  if (text.startsWith('/dashboard') || text.startsWith('/profil') || text.startsWith('/profile')) {
    const dashboardText = generateDashboardMenuText(user, userStats)
    await sendMessage(botToken, chatId, dashboardText, {
      parseMode: 'HTML',
      replyMarkup: generateDashboardKeyboard()
    })
    return
  }
  
  // Handle /riwayat or /history command
  if (text.startsWith('/riwayat') || text.startsWith('/history')) {
    const page = 1
    const itemsPerPage = 5
    const totalPages = Math.max(1, Math.ceil(userOrders.length / itemsPerPage))
    const pageOrders = userOrders.slice(0, itemsPerPage)
    
    const historyText = generateDetailedHistoryText(pageOrders, page, totalPages)
    await sendMessage(botToken, chatId, historyText, {
      parseMode: 'HTML',
      replyMarkup: generateHistoryKeyboard(page, totalPages)
    })
    return
  }

  // Handle /help command
  if (text.startsWith('/help')) {
    const helpText = `<b>❓ BANTUAN</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `<b>📋 Perintah Tersedia:</b>\n` +
      `├ /start - Menu utama\n` +
      `├ /stock - Cek stok produk\n` +
      `├ /saldo - Cek saldo\n` +
      `├ /dashboard - Dashboard profil\n` +
      `├ /riwayat - Riwayat transaksi\n` +
      `└ /help - Bantuan\n\n` +
      `<b>🛒 Cara Order:</b>\n` +
      `1. Ketik /stock atau klik List Produk\n` +
      `2. Pilih nomor produk\n` +
      `3. Klik Beli dan atur jumlah\n` +
      `4. Pilih metode pembayaran\n` +
      `5. Produk dikirim otomatis\n\n` +
      `<i>Hubungi CS jika ada kendala</i>`
    
    await sendMessage(botToken, chatId, helpText, {
      parseMode: 'HTML',
      replyMarkup: generateMainMenuKeyboard(userStats.balance)
    })
    return
  }

  // For other messages, show menu
  await sendMessage(botToken, chatId, `Ketik /start untuk memulai atau /stock untuk melihat produk.`, {
    replyMarkup: generateMainMenuKeyboard(userStats.balance)
  })
}

// POST handler for Telegram webhook
export async function POST(request: NextRequest) {
  try {
    // Get bot token from URL or header
    const url = new URL(request.url)
    const botToken = request.headers.get('x-telegram-bot-token') || url.searchParams.get('token')

    console.log('[v0] Webhook received, token:', botToken ? `${botToken.slice(0, 10)}...` : 'NONE')

    if (!botToken) {
      console.error('[v0] No bot token provided')
      return NextResponse.json({ error: 'No bot token' }, { status: 400 })
    }

    // Get bot settings to verify token and get owner ID
    const settings = await getBotSettingsByToken(botToken)
    
    console.log('[v0] Bot settings found:', settings ? {
      userId: settings.userId,
      botName: settings.botName,
      isActive: settings.isActive,
      ownerId: settings.ownerId
    } : 'NOT FOUND')
    
    if (!settings) {
      console.error('[v0] Invalid bot token or bot not found')
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    if (!settings.isActive) {
      console.log('[v0] Bot is not active, ignoring message')
      return NextResponse.json({ ok: true })
    }

    const update: TelegramUpdate = await request.json()
    console.log('[v0] Update type:', update.message ? 'message' : update.callback_query ? 'callback_query' : 'unknown')
    
    if (update.message) {
      console.log('[v0] Message from:', update.message.from.first_name, 'Text:', update.message.text)
    }

    // Handle callback queries (button clicks)
    if (update.callback_query) {
      const telegramUserId = update.callback_query.from.id.toString()
      await handleCallbackQuery(botToken, update.callback_query, settings.ownerId, telegramUserId, settings.userId, settings)
      return NextResponse.json({ ok: true })
    }

    // Handle messages
    if (update.message) {
      await handleMessage(botToken, update.message, settings.ownerId, settings.userId, settings)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[v0] Webhook error:', error)
    
    // Log error to error logs
    const botToken = request.nextUrl.searchParams.get('token')
    let userId: string | undefined
    let userName: string | undefined
    
    if (botToken) {
      const settings = await getBotSettingsByToken(botToken)
      if (settings) {
        userId = settings.userId
        const user = await getUserById(settings.userId)
        userName = user?.name
      }
    }
    
    await logWebhookError(
      'telegram-webhook',
      error instanceof Error ? error.message : String(error),
      {
        userId,
        userName,
        severity: 'error',
        stackTrace: error instanceof Error ? error.stack : undefined,
        metadata: {
          botToken: botToken?.slice(0, 10) + '...',
        },
        isSensitive: true,
      }
    )
    
    return NextResponse.json({ ok: true })
  }
}

// GET handler for webhook verification
export async function GET() {
  return NextResponse.json({ 
    status: 'SewaBot Webhook Active',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  })
}
