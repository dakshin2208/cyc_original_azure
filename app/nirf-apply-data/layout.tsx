import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'NIRF Apply Data | ChooseYourCollege',
  description:
    'View and download Tamil Nadu engineering college NIRF participation lists and colleges with NIRF data on their websites.',
}

export default function NirfApplyDataLayout({ children }: { children: React.ReactNode }) {
  return children
}
