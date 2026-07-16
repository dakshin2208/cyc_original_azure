import Link from 'next/link'
import Image from 'next/image'
import logo from '@/app/img/logo.jpeg'

export function Footer() {
  const columns: { title: string; links: { href: string; label: string }[] }[] = [
    {
      title: 'Explore',
      links: [
        { href: '/college-search', label: 'Discover Colleges' },
        { href: '/compare-colleges', label: 'Compare Colleges' },
        { href: '/branch-explorer', label: 'Branch Explorer' },
        { href: '/rank-predictor', label: 'College Predictor' },
      ],
    },
    {
      title: 'Resources',
      links: [
        { href: '/choice-filling-guide', label: 'Choice Filling Guide' },
        { href: '/nirf-apply-data', label: 'Data Transparency' },
        { href: '/cheatsheet', label: 'Cheat Sheet' },
        { href: '/letter-to-your-kid', label: 'Letter to Your Kid' },
        { href: '/vote', label: 'Vote for Your State' },
      ],
    },
    {
      title: 'Support',
      links: [
        { href: '/pricing', label: 'Pricing' },
        { href: '/contact', label: 'Contact Us' },
        { href: '/shipping-delivery', label: 'Shipping & Delivery' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { href: '/privacy-policy', label: 'Privacy Policy' },
        { href: '/refund-policy', label: 'Cancellation & Refund' },
        { href: '/terms-and-conditions', label: 'Terms & Conditions' },
      ],
    },
  ]

  return (
    <footer className="w-full mt-auto bg-surface-container-low border-t border-border">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-stack-lg">
          {/* Brand */}
          <div className="md:col-span-4 space-y-stack-md">
            <Link href="/home" className="flex items-center gap-stack-sm">
              <Image src={logo} alt="Choose Your College" width={150} height={40} className="h-9 w-auto object-contain" />
            </Link>
            <p className="text-body-sm text-slate max-w-xs">
              Empowering academic futures through clarity and trust. We provide the tools for the next generation of leaders.
            </p>
          </div>

          {/* Link columns */}
          <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-stack-lg">
            {columns.map((col) => (
              <div key={col.title} className="space-y-stack-md">
                <h4 className="font-label-bold text-label-bold uppercase tracking-widest text-primary">{col.title}</h4>
                <nav className="flex flex-col gap-2.5">
                  {col.links.map((link) => (
                    <Link key={link.href} href={link.href} className="text-body-sm text-slate hover:text-primary hover:underline decoration-primary transition-colors">
                      {link.label}
                    </Link>
                  ))}
                </nav>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-stack-lg pt-stack-md border-t border-border">
          <p className="text-body-sm text-slate">
            &copy; {new Date().getFullYear()} ChooseYourCollege.com (Happi Global Ventures LLP). All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
