'use client'

import dynamic from 'next/dynamic'

const RankPredictorClient = dynamic(
  () => import('./client'),
  { ssr: false }
)

export default function ClientWrapper() {
  return <RankPredictorClient />
}
