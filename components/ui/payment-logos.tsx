'use client'

import { SVGProps } from 'react'

// Bank BCA Logo
export function BCALogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 32" fill="none" {...props}>
      <rect width="100" height="32" rx="4" fill="#0066AE"/>
      <text x="50" y="22" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold" fontFamily="Arial, sans-serif">BCA</text>
    </svg>
  )
}

// Bank BNI Logo
export function BNILogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 32" fill="none" {...props}>
      <rect width="100" height="32" rx="4" fill="#F15A22"/>
      <text x="50" y="22" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold" fontFamily="Arial, sans-serif">BNI</text>
    </svg>
  )
}

// Bank BRI Logo
export function BRILogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 32" fill="none" {...props}>
      <rect width="100" height="32" rx="4" fill="#00529C"/>
      <text x="50" y="22" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold" fontFamily="Arial, sans-serif">BRI</text>
    </svg>
  )
}

// Bank Mandiri Logo
export function MandiriLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 32" fill="none" {...props}>
      <rect width="100" height="32" rx="4" fill="#003366"/>
      <text x="50" y="22" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="Arial, sans-serif">mandiri</text>
    </svg>
  )
}

// DANA Logo
export function DANALogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 32" fill="none" {...props}>
      <rect width="100" height="32" rx="4" fill="#108EE9"/>
      <text x="50" y="22" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold" fontFamily="Arial, sans-serif">DANA</text>
    </svg>
  )
}

// OVO Logo
export function OVOLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 32" fill="none" {...props}>
      <rect width="100" height="32" rx="4" fill="#4C2A86"/>
      <text x="50" y="22" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold" fontFamily="Arial, sans-serif">OVO</text>
    </svg>
  )
}

// GoPay Logo
export function GopayLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 32" fill="none" {...props}>
      <rect width="100" height="32" rx="4" fill="#00AA13"/>
      <text x="50" y="22" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="Arial, sans-serif">GoPay</text>
    </svg>
  )
}

// ShopeePay Logo
export function ShopeePayLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 32" fill="none" {...props}>
      <rect width="100" height="32" rx="4" fill="#EE4D2D"/>
      <text x="50" y="21" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="Arial, sans-serif">ShopeePay</text>
    </svg>
  )
}

// Payment Logo Component
export function PaymentLogo({ type, className }: { type: string; className?: string }) {
  const logos: Record<string, React.FC<SVGProps<SVGSVGElement>>> = {
    bca: BCALogo,
    bni: BNILogo,
    bri: BRILogo,
    mandiri: MandiriLogo,
    dana: DANALogo,
    ovo: OVOLogo,
    gopay: GopayLogo,
    shopeepay: ShopeePayLogo,
  }

  const Logo = logos[type.toLowerCase()]
  
  if (!Logo) return null
  
  return <Logo className={className} />
}

// Mapping for payment icons with proper brand colors
export const PAYMENT_BRAND_COLORS: Record<string, { bg: string; text: string }> = {
  bca: { bg: '#0066AE', text: 'white' },
  bni: { bg: '#F15A22', text: 'white' },
  bri: { bg: '#00529C', text: 'white' },
  mandiri: { bg: '#003366', text: 'white' },
  dana: { bg: '#108EE9', text: 'white' },
  ovo: { bg: '#4C2A86', text: 'white' },
  gopay: { bg: '#00AA13', text: 'white' },
  shopeepay: { bg: '#EE4D2D', text: 'white' },
}
