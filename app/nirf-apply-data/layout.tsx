import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Data Transparency | ChooseYourCollege',
  description:
    'A colour-coded transparency rating of Tamil Nadu engineering colleges based on how openly they publish their NIRF data.',
}

export default function NirfApplyDataLayout({ children }: { children: React.ReactNode }) {
  return children
}
