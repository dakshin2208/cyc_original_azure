'use client'

import dynamic from 'next/dynamic'

const CutoffRankPredictionClient = dynamic(
  () => import('./client'),
  { ssr: false }
)

export default function ClientWrapper() {
  return <CutoffRankPredictionClient />
} 