import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export default function BlogsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  )
} 