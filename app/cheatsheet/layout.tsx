import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Engineering College Cheat Sheet | ChooseYourCollege',
  description:
    'Download or print the ChooseYourCollege engineering college cheat sheet — a quick reference for your admission journey.',
}

export default function CheatsheetLayout({ children }: { children: React.ReactNode }) {
  return children
}
