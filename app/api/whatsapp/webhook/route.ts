import { NextRequest, NextResponse } from 'next/server'
import { 
  getAllProducts, 
  getProductsByUserId, 
  getProductCategories,
  getProductById,
  updateProduct,
  createOrder,
  getPaymentSettings,
  createWhatsAppActivityLog,
} from '@/lib/github-db'
import { createOrkutQrisPayment } from '@/lib/orkut'
import { createMidtransQrisPayment } from '@/lib/midtrans'
import type { Product, ProductCategory } from '@/types'

// Helper to format number to Rupiah
function toRupiah(num: number): string {
  return new Intl.NumberFormat('id-ID').format(num)
}

// Store for order sessions
const orderSessions = new Map<string, {
  productId: string
  quantity: number
  step: 'confirm' | 'payment'
}>()

export async function POST(request: NextRequest) {
  try {
    const botSecret = request.headers.get('X-Bot-Secret')
    const body = await request.json()
    const { from, message, pushName, messageId } = body

    if (!botSecret) {
      return NextResponse.json({ error: 'Missing bot secret' }, { status: 401 })
    }

    // Find user by bot secret
    const { getFileContent } = await import('@/lib/github-db')
    const { content } = await getFileContent()
    
    const settings = content.whatsappSettings?.find(s => s.botSecret === botSecret)
    
    if (!settings) {
      return NextResponse.json({ error: 'Invalid bot secret' }, { status: 401 })
    }

    const userId = settings.userId
    const whatsappNumber = from.replace('@s.whatsapp.net', '')

    // Log activity
    await createWhatsAppActivityLog({
      userId,
      whatsappNumber,
      whatsappName: pushName,
      action: 'menu',
      message: message?.slice(0, 100),
    })

    // Process message
    const text = message?.toLowerCase().trim() || ''
    
    // Handle commands
    if (text === '/start' || text === 'menu' || text === 'hi' || text === 'halo') {
      const reply = await handleStart(userId, pushName)
      return NextResponse.json({ reply })
    }

    if (text === '/produk' || text === 'produk' || text === 'katalog') {
      const reply = await handleProducts(userId)
      return NextResponse.json({ reply })
    }

    // Handle product selection (format: /beli_PRODUCTID)
    if (text.startsWith('/beli_') || text.startsWith('beli ')) {
      const productId = text.replace('/beli_', '').replace('beli ', '').trim()
      const reply = await handleBuyProduct(userId, productId, whatsappNumber, pushName)
      return NextResponse.json({ reply })
    }

    // Handle quantity confirmation
    if (text.startsWith('/qty_')) {
      const [productId, qty] = text.replace('/qty_', '').split('_')
      const reply = await handleQuantity(userId, productId, parseInt(qty) || 1, whatsappNumber, pushName)
      return NextResponse.json({ reply })
    }

    // Default response
    const defaultReply = `Halo ${pushName}! 👋

Saya adalah bot otomatis untuk pembelian produk digital.

*Perintah yang tersedia:*
• Ketik *menu* - Lihat menu utama
• Ketik *produk* - Lihat daftar produk
• Ketik */beli_[kode]* - Beli produk

Contoh: /beli_AM001`

    return NextResponse.json({ reply: defaultReply })
  } catch (error) {
    console.error('WhatsApp webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function handleStart(userId: string, pushName: string): Promise<string> {
  return `Selamat datang, ${pushName}! 🎉

Terima kasih sudah menghubungi kami.

*Menu Utama:*
1️⃣ Ketik *produk* - Lihat katalog produk
2️⃣ Ketik */beli_[kode]* - Beli produk langsung

Silakan pilih menu di atas untuk melanjutkan.`
}

async function handleProducts(userId: string): Promise<string> {
  const products = await getProductsByUserId(userId)
  const categories = await getProductCategories(userId)
  
  if (!products || products.length === 0) {
    return 'Maaf, belum ada produk yang tersedia saat ini.'
  }

  // Group products by category
  const categoryMap = new Map<string, Product[]>()
  
  for (const product of products) {
    if (!product.isActive || product.stock <= 0) continue
    
    const categoryProducts = categoryMap.get(product.categoryCode) || []
    categoryProducts.push(product)
    categoryMap.set(product.categoryCode, categoryProducts)
  }

  let reply = '📦 *DAFTAR PRODUK*\n\n'

  for (const [categoryCode, categoryProducts] of categoryMap) {
    const category = categories.find(c => c.code === categoryCode)
    const categoryName = category?.name || categoryCode

    reply += `━━━ *${categoryName}* ━━━\n\n`

    for (const product of categoryProducts) {
      reply += `📌 *${product.name}*\n`
      reply += `💰 Harga: Rp ${toRupiah(product.price)}\n`
      reply += `📊 Stok: ${product.stock}\n`
      reply += `🛒 Beli: /beli_${product.code}\n\n`
    }
  }

  reply += `\n_Ketik /beli_[kode] untuk membeli produk_`

  return reply
}

async function handleBuyProduct(
  userId: string, 
  productCode: string, 
  whatsappNumber: string,
  pushName: string
): Promise<string> {
  // Find product by code
  const products = await getProductsByUserId(userId)
  const product = products.find(p => p.code.toLowerCase() === productCode.toLowerCase())

  if (!product) {
    return `Produk dengan kode *${productCode}* tidak ditemukan.\n\nKetik *produk* untuk melihat daftar produk.`
  }

  if (!product.isActive) {
    return `Maaf, produk *${product.name}* sedang tidak aktif.`
  }

  if (product.stock <= 0) {
    return `Maaf, stok produk *${product.name}* sudah habis.`
  }

  // Show product details and quantity options
  let reply = `🛒 *KONFIRMASI PEMBELIAN*\n\n`
  reply += `📦 Produk: *${product.name}*\n`
  reply += `💰 Harga: Rp ${toRupiah(product.price)}/pcs\n`
  reply += `📊 Stok tersedia: ${product.stock}\n\n`
  reply += `Pilih jumlah yang ingin dibeli:\n\n`

  const maxQty = Math.min(5, product.stock)
  for (let i = 1; i <= maxQty; i++) {
    reply += `${i}️⃣ /qty_${product.code}_${i} - ${i} pcs (Rp ${toRupiah(product.price * i)})\n`
  }

  reply += `\n_Ketik perintah di atas untuk melanjutkan_`

  return reply
}

async function handleQuantity(
  userId: string,
  productCode: string,
  quantity: number,
  whatsappNumber: string,
  pushName: string
): Promise<string> {
  // Find product by code
  const products = await getProductsByUserId(userId)
  const product = products.find(p => p.code.toLowerCase() === productCode.toLowerCase())

  if (!product) {
    return `Produk tidak ditemukan. Ketik *produk* untuk melihat daftar produk.`
  }

  if (product.stock < quantity) {
    return `Maaf, stok tidak mencukupi. Stok tersedia: ${product.stock}`
  }

  // Get payment settings
  const paymentSettings = await getPaymentSettings()
  
  const totalPrice = product.price * quantity

  // Create order
  const order = await createOrder({
    userId,
    productId: product.id,
    productName: product.name,
    quantity,
    totalPrice,
    buyerName: pushName,
    buyerContact: whatsappNumber,
    buyerId: whatsappNumber,
    status: 'pending',
    paymentStatus: 'unpaid',
    paymentMethod: 'qris',
  })

  if (!order) {
    return `Maaf, terjadi kesalahan saat membuat pesanan. Silakan coba lagi.`
  }

  // Create QRIS payment
  let qrisUrl = ''
  
  if (paymentSettings?.midtransEnabled) {
    try {
      const midtransPayment = await createMidtransQrisPayment({
        orderId: order.id,
        amount: totalPrice,
        customerName: pushName,
        customerPhone: whatsappNumber,
      })
      qrisUrl = midtransPayment.qrisUrl || ''
    } catch (error) {
      console.error('Midtrans error:', error)
    }
  } else if (paymentSettings?.orkutEnabled) {
    try {
      const orkutPayment = await createOrkutQrisPayment({
        orderId: order.id,
        amount: totalPrice,
        username: paymentSettings.orkutUsername,
        apiKey: paymentSettings.orkutApiKey,
        token: paymentSettings.orkutToken,
        merchantId: paymentSettings.orkutMerchantId,
        codeQr: paymentSettings.orkutCodeQr,
      })
      qrisUrl = orkutPayment.qrisUrl || ''
    } catch (error) {
      console.error('Orkut error:', error)
    }
  }

  let reply = `✅ *PESANAN DIBUAT*\n\n`
  reply += `📋 Order ID: *${order.id}*\n`
  reply += `📦 Produk: ${product.name}\n`
  reply += `🔢 Jumlah: ${quantity}\n`
  reply += `💰 Total: Rp ${toRupiah(totalPrice)}\n\n`

  if (qrisUrl) {
    reply += `📱 Silakan scan QRIS di bawah ini untuk melakukan pembayaran:\n\n`
    reply += `${qrisUrl}\n\n`
    reply += `⏰ Pembayaran akan otomatis terverifikasi.\n`
    reply += `📩 Anda akan menerima produk setelah pembayaran berhasil.`

    return JSON.stringify({
      type: 'image',
      url: qrisUrl,
      caption: reply,
    })
  } else {
    reply += `⚠️ Pembayaran QRIS tidak tersedia saat ini.\n`
    reply += `Silakan hubungi admin untuk metode pembayaran lain.`
  }

  return reply
}
