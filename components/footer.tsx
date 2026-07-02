import Link from 'next/link'

export function Footer() {
  return (
    <footer className="w-full border-t border-gray-200 bg-white text-gray-600 py-6 sm:py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="text-xs sm:text-sm text-center md:text-left">
            <p>&copy; {new Date().getFullYear()} ChooseYourCollege.com (Happi Global Ventures LLP). All rights reserved.</p>
          </div>
          
          <div className="flex flex-wrap justify-center md:justify-end gap-4 sm:gap-6 text-xs sm:text-sm">
            <Link
              href="/nirf-apply-data"
              className="text-gray-600 hover:text-[#0B5588] transition-colors duration-200 px-2 py-1"
            >
              Data Transparency
            </Link>
            <Link
              href="/cheatsheet"
              className="text-gray-600 hover:text-[#0B5588] transition-colors duration-200 px-2 py-1"
            >
              Cheat Sheet
            </Link>
            <Link
              href="/letter-to-your-kid"
              className="text-gray-600 hover:text-[#0B5588] transition-colors duration-200 px-2 py-1"
            >
              Letter to Your Kid
            </Link>
            <Link 
              href="/vote" 
              className="text-gray-600 hover:text-[#0B5588] transition-colors duration-200 px-2 py-1"
            >
              Vote for Your State
            </Link>
            <Link 
              href="/contact" 
              className="text-gray-600 hover:text-[#0B5588] transition-colors duration-200 px-2 py-1"
            >
              Contact Us
            </Link>
            <Link 
              href="/shipping-delivery" 
              className="text-gray-600 hover:text-[#0B5588] transition-colors duration-200 px-2 py-1"
            >
              Shipping & Delivery
            </Link>
            <Link 
              href="/privacy-policy" 
              className="text-gray-600 hover:text-[#0B5588] transition-colors duration-200 px-2 py-1"
            >
              Privacy Policy
            </Link>
            <Link 
              href="/refund-policy" 
              className="text-gray-600 hover:text-[#0B5588] transition-colors duration-200 px-2 py-1"
            >
              Cancellation & Refund
            </Link>
            <Link 
              href="/terms-and-conditions" 
              className="text-gray-600 hover:text-[#0B5588] transition-colors duration-200 px-2 py-1"
            >
              Terms & Conditions
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
