import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white dark:bg-gray-900">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4 text-[#0B5588]">404 - Page Not Found</h2>
        <p className="mb-4 text-gray-600 dark:text-gray-300">The page you are looking for does not exist.</p>
        <Link
          href="/"
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Go back home
        </Link>
      </div>
    </div>
  )
} 