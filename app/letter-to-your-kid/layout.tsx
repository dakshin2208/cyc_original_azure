import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Letter to Your Kid | ChooseYourCollege',
  description:
    'A letter for the night before your child leaves for college — read it, fill it in by hand, and download a copy to keep.',
}

export default function LetterToYourKidLayout({ children }: { children: React.ReactNode }) {
  return children
}
