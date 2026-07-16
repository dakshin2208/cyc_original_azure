"use client"

import Link from "next/link"
import Image from "next/image"
import logo from "@/app/img/logo.jpeg"
import { Button } from "./ui/button"
import {
  Menu,
  PlusCircle,
  Scale,
  BookOpen,
  Compass,
  ClipboardList,
  LogOut,
  Shield,
  User,
  Users,
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
    { href: "/choice-filling", label: "Choice Filling" },
    { href: "/pricing", label: "Pricing" },
    { href: "/college-search", label: "Discover" },
    { href: "/rank-predictor", label: "College Predictor" },
  ]

  const burgerMenuItems = [
    { href: "/branch-explorer", icon: BookOpen, label: "Branch Explorer" },
    { href: "/choice-filling-guide", icon: BookOpen, label: "Choice Filling Guide" },
    { href: "/compare-colleges", icon: Scale, label: "Compare Colleges" },
    { href: "/nirf-upload", icon: PlusCircle, label: "Add College Data" },
    { href: "/blogs", icon: BookOpen, label: "Blogs" },
  ]

  return (
    <header className="w-full sticky top-0 z-50 bg-card border-b border-border">
      <div className="relative max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop flex justify-between items-center h-16 md:h-20">
        {/* Brand */}
        <Link href="/home" className="flex items-center gap-stack-sm shrink-0">
          <Image src={logo} alt="Choose Your College" width={160} height={48} className="h-9 md:h-10 w-auto object-contain" />
        </Link>

        {/* Desktop nav — centered in the header */}
        <nav className="hidden md:flex items-center gap-stack-lg absolute left-1/2 -translate-x-1/2 -ml-16">
          {desktopNavItems.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-body-md transition-colors duration-200 active:scale-95 ${
                  active
                    ? "text-primary font-bold border-b-2 border-primary pb-1"
                    : "text-slate hover:text-primary font-medium"
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Right side actions */}
        <div className="flex items-center gap-stack-sm md:gap-stack-md">
          {user && <span className="hidden md:inline"><TrackReferrals /></span>}

          {/* Profile / auth dropdown (desktop) */}
          <div className="hidden md:block">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2 h-11 hover:bg-muted">
                  <span className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                    <User className="h-4 w-4" />
                  </span>
                  <span className="flex flex-col items-start leading-tight">
                    <span className="text-body-sm font-semibold text-foreground max-w-[120px] truncate">
                      {user ? (user.fullName || "Account") : "Sign In"}
                    </span>
                    <span className="text-xs text-slate">{user ? "Student" : "Log in / Join"}</span>
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {user ? (
                  <>
                    <DropdownMenuItem
                      onClick={() => {
                        const btn = document.querySelector('[data-track-referrals]') as HTMLButtonElement
                        if (btn) btn.click()
                      }}
                      className="cursor-pointer"
                    >
                      <Users className="mr-2 h-4 w-4" />
                      <span>Track Your Referrals</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={signOut} className="text-destructive cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Logout</span>
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => (window.location.href = "/login?tab=login")} className="cursor-pointer">
                      <Shield className="mr-2 h-4 w-4" />
                      <span>Login</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => (window.location.href = "/login?tab=signup")} className="cursor-pointer">
                      <Users className="mr-2 h-4 w-4" />
                      <span>Sign Up</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* "More" sheet (desktop) */}
          <div className="hidden md:block">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-11 w-11 text-slate hover:text-primary hover:bg-muted">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 bg-card">
                <h3 className="font-heading text-headline-md text-primary mb-6 mt-2">Menu</h3>
                <nav className="flex flex-col space-y-1">
                  {burgerMenuItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-3 text-body-md transition-colors ${
                        pathname === item.href
                          ? "bg-secondary text-secondary-foreground font-semibold"
                          : "text-slate hover:bg-muted hover:text-primary"
                      }`}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>

          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="h-10 w-10 text-slate">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 bg-card overflow-y-auto">
              <h3 className="font-heading text-headline-md text-primary mb-6 mt-2">Menu</h3>
              <nav className="flex flex-col space-y-1">
                {[...desktopNavItems.map((i) => ({ ...i, icon: Compass })), ...burgerMenuItems].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-3 text-body-md transition-colors ${
                      pathname === item.href
                        ? "bg-secondary text-secondary-foreground font-semibold"
                        : "text-slate hover:bg-muted hover:text-primary"
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                ))}
              </nav>

              <div className="border-t border-border my-5" />

              {user ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-3 px-3 py-2">
                    <span className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                      <User className="h-4 w-4" />
                    </span>
                    <div className="flex flex-col leading-tight">
                      <span className="font-semibold text-foreground truncate max-w-[180px]">{user.fullName || user.email}</span>
                      <span className="text-body-sm text-slate">Student</span>
                    </div>
                  </div>
                  <div className="px-3"><TrackReferrals /></div>
                  <button
                    onClick={signOut}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-body-md text-destructive hover:bg-muted transition-colors font-medium"
                  >
                    <LogOut className="h-5 w-5" />
                    <span>Logout</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <button
                    onClick={() => (window.location.href = "/login?tab=login")}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-body-md text-slate hover:bg-muted hover:text-primary transition-colors"
                  >
                    <Shield className="h-5 w-5" />
                    <span>Login</span>
                  </button>
                  <button
                    onClick={() => (window.location.href = "/login?tab=signup")}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-body-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-semibold justify-center"
                  >
                    <Users className="h-5 w-5" />
                    <span>Join Now</span>
                  </button>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
