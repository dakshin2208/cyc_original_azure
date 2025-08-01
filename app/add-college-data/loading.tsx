import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container py-8">
        <div className="max-w-2xl mx-auto">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded mb-6 animate-pulse"></div>
          <div className="h-4 w-full bg-gray-200 dark:bg-gray-800 rounded mb-8 animate-pulse"></div>

          <div className="border rounded-lg p-6 space-y-6">
            <div className="space-y-2">
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
              <div className="h-10 w-full bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
            </div>

            <div className="space-y-2">
              <div className="h-4 w-32 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
              <div className="h-10 w-full bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
            </div>

            <div className="space-y-2">
              <div className="h-4 w-48 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
              <div className="h-10 w-full bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
            </div>

            <div className="space-y-2">
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
              <div className="h-32 w-full bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
            </div>

            <div className="h-10 w-full bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
