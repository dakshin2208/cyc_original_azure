import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Vote for Your State | ChooseYourCollege',
  description:
    'Vote to bring AI-assisted college choice filling to Karnataka, Andhra Pradesh, Telangana, Maharashtra, or Kerala.',
}

export default function VoteLayout({ children }: { children: React.ReactNode }) {
  return children
}
