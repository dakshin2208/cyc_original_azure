"use client"

import Link from "next/link"
import Image from "next/image"
import logo from "@/app/img/logo.jpeg"
import { Button } from "./ui/button"
import {
  Menu,
  PlusCircle,
  LineChart,
  Scale,
  BookOpen,
  Compass,
  MoreVertical,
  ClipboardList,
  User,
  LogOut,
  Shield,
  DollarSign,
  Users,
  IndianRupeeIcon
} from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "./ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "./ui/dropdown-menu"
import { useAuth } from "@/app/contexts/AuthContext"
import { usePathname } from "next/navigation"
import { TrackReferrals } from "./track-referrals"

export function Header() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()

  const desktopNavItems = [
    {
      href: "/choice-filling",
      icon: ClipboardList,
      label: "Choice Filling",
      className: "px-4 py-2"
    },
    {
      href: "/pricing",
      icon: IndianRupeeIcon,
      label: "Pricing",
      className: "px-4 py-2"
    },
    {
      href: "/college-search",
      icon: Compass,
      label: (
        <div className="flex flex-col">
          <span>Discover</span>
          <span>Compare</span>
          <span>Choose</span>
        </div>
      ),
      className: "px-4 py-2"
    },
    {
      href: "/branch-explorer",
      icon: BookOpen,
      label: "Branch Explorer",
      className: "px-4 py-2"
    }
  ]

  const burgerMenuItems = [
    {
      href: "/rank-predictor",
      icon: LineChart,
      label: "College Predictor"
    },
    {
      href: "/choice-filling-guide",
      icon: BookOpen,
      label: "Choice Filling Guide"
    },
    {
      href: "/compare-colleges",
      icon: Scale,
      label: "Compare Colleges"
    },
    {
      href: "/nirf-upload",
      icon: PlusCircle,
      label: "Add College Data"
    },
    {
      href: "/blogs",
      icon: BookOpen,
      label: "Blogs"
    }
  ]

  return (
    <header className="w-full border-b border-gray-800 bg-white">
      <div className="container mx-auto px-4 py-2 sm:py-4 flex justify-between items-center">
        <div className="flex items-center space-x-2 sm:space-x-6">
          <div className="flex items-center">
            <Link href="/home">
              <Image 
                src={logo} 
                alt="App Logo" 
                width={200} 
                height={200} 
                className="w-32 sm:w-40 md:w-48 h-auto mr-2" 
              />
            </Link>
          </div>
          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-4 lg:space-x-6">
            {desktopNavItems.map((item) => (
            <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1 sm:gap-2 rounded-md text-sm lg:text-lg ${
                  pathname === item.href
                  ? "bg-[#0B5588] text-white"
                  : "text-gray-600 hover:text-black transition-colors"
                } ${item.className}`}
            >
                <item.icon className="h-6 w-6 lg:h-8 lg:w-8" />
                {item.label}
            </Link>
            ))}
          </nav>
        </div>

        {/* Profile Menu */}
        <div className="hidden md:flex items-center gap-2">
          {user && <TrackReferrals />}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-12 w-12 lg:h-16 lg:w-16">
                <div className="flex flex-col items-center">
                  <div className="relative w-8 h-8 lg:w-10 lg:h-10 bg-[#0B5588] rounded-full flex items-center justify-center shadow-lg">
                    <div className="w-3 h-3 lg:w-4 lg:h-4 bg-white rounded-full mb-1"></div>
                    <div className="absolute bottom-1 w-5 h-2 lg:w-6 lg:h-2.5 bg-white rounded-full"></div>
                  </div>
                  {user ? (
                    <>
                      <span className="text-xs mt-1">{user.fullName}</span>
                      <span className="text-xs text-gray-500">User</span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs mt-1 text-gray-500">Login</span>
                    </>
                  )}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {user ? (
                <>
                  <DropdownMenuItem 
                    onClick={() => {
                      // Open the track referrals dialog
                      const trackReferralsButton = document.querySelector('[data-track-referrals]') as HTMLButtonElement
                      if (trackReferralsButton) {
                        trackReferralsButton.click()
                      }
                    }} 
                    className="cursor-pointer"
                  >
                    <Users className="mr-2 h-4 w-4" />
                    <span>Track Your Referrals</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="text-red-600 cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem 
                    onClick={() => window.location.href = '/login?tab=login'} 
                    className="cursor-pointer"
                  >
                    <Shield className="mr-2 h-4 w-4" />
                    <span>Login</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => window.location.href = '/login?tab=signup'} 
                    className="cursor-pointer"
                  >
                    <Users className="mr-2 h-4 w-4" />
                    <span>Sign Up</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Desktop More Menu */}
        <div className="hidden md:block">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-12 w-12 lg:h-16 lg:w-16">
                <Menu className="h-8 w-8 lg:h-12 lg:w-12" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <nav className="flex flex-col space-y-4 mt-8">
                {burgerMenuItems.map((item) => (
                <Link
                    key={item.href}
                    href={item.href}
                  className={`flex items-center gap-3 text-lg ${
                      pathname === item.href
                      ? "text-[#0B5588] font-semibold"
                      : "text-gray-600 hover:text-black transition-colors"
                  }`}
                >
                    <item.icon className="h-6 w-6" />
                    {item.label}
                </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>

        {/* Mobile Navigation */}
        <Sheet>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-12 sm:w-12">
              <Menu className="h-6 w-6 sm:h-8 sm:w-8" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80">
            <nav className="flex flex-col space-y-3 mt-6">
              {[...desktopNavItems, ...burgerMenuItems].map((item) => (
              <Link
                  key={item.href}
                  href={item.href}
                className={`flex items-center gap-3 text-base sm:text-lg py-2 ${
                    pathname === item.href
                    ? "text-[#0B5588] font-semibold"
                    : "text-gray-600 hover:text-black transition-colors"
                }`}
              >
                  <item.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                  {item.label}
                </Link>
              ))}

              {/* Profile Menu in Mobile Navigation */}
              <div className="border-t border-gray-200 my-4"></div>
              {user ? (
                <>
                  <div className="flex items-center gap-3 text-base sm:text-lg py-2 text-gray-600">
                    <div className="relative w-6 h-6 sm:w-8 sm:h-8 bg-[#0B5588] rounded-full flex items-center justify-center shadow-lg">
                      <div className="w-2 h-2 sm:w-3 sm:h-3 bg-white rounded-full mb-0.5"></div>
                      <div className="absolute bottom-0.5 w-3 h-1.5 sm:w-4 sm:h-2 bg-white rounded-full"></div>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">{user.fullName || user.email}</span>
                      <span className="text-sm text-gray-500">User</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      // Open the track referrals dialog
                      const trackReferralsButton = document.querySelector('[data-track-referrals]') as HTMLButtonElement
                      if (trackReferralsButton) {
                        trackReferralsButton.click()
                      }
                    }}
                    className="flex items-center gap-3 text-base sm:text-lg py-2 text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <Users className="h-5 w-5 sm:h-6 sm:w-6" />
                    <span>Track Your Referrals</span>
                  </button>
                  <div className="px-3">
                    <TrackReferrals />
                  </div>
                  <button
                    onClick={signOut}
                    className="flex items-center gap-3 text-base sm:text-lg py-2 text-red-600 hover:text-red-700 transition-colors font-medium"
                  >
                    <LogOut className="h-5 w-5 sm:h-6 sm:w-6" />
                    <span>Logout</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 text-base sm:text-lg py-2 text-gray-600">
                    <div className="relative w-6 h-6 sm:w-8 sm:h-8 bg-[#0B5588] rounded-full flex items-center justify-center shadow-lg">
                      <div className="w-2 h-2 sm:w-3 sm:h-3 bg-white rounded-full mb-0.5"></div>
                      <div className="absolute bottom-0.5 w-3 h-1.5 sm:w-4 sm:h-2 bg-white rounded-full"></div>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-500">Login to continue</span>
                    </div>
                  </div>
                  <button
                    onClick={() => window.location.href = '/login?tab=login'}
                    className="flex items-center gap-3 text-base sm:text-lg py-2 text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <Shield className="h-5 w-5 sm:h-6 sm:w-6" />
                    <span>Login</span>
                  </button>
                  <button
                    onClick={() => window.location.href = '/login?tab=signup'}
                    className="flex items-center gap-3 text-base sm:text-lg py-2 text-green-600 hover:text-green-700 transition-colors"
                  >
                    <Users className="h-5 w-5 sm:h-6 sm:w-6" />
                    <span>Sign Up</span>
                  </button>
                </>
              )}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
