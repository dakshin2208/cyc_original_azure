'use client'

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { SearchResultsClient } from "@/components/search-results-client"
import type { UserCategory } from "@/components/user-category-selector"

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // Await the searchParams promise
  const resolvedSearchParams = await searchParams

  // Extract search parameters with proper type checking
  const query = typeof resolvedSearchParams.q === "string" ? resolvedSearchParams.q : ""
  const category =
    typeof resolvedSearchParams.category === "string"
      ? (resolvedSearchParams.category as UserCategory)
      : "student"
  const location =
    typeof resolvedSearchParams.location === "string" ? resolvedSearchParams.location : "any"
  const duration =
    typeof resolvedSearchParams.duration === "string" ? resolvedSearchParams.duration : "0-4"
  const params =
    typeof resolvedSearchParams.params === "string" ? resolvedSearchParams.params : ""

  // Determine if this is a basic or advanced search
  const isBasicSearch =
    !resolvedSearchParams.location &&
    !resolvedSearchParams.duration &&
    !resolvedSearchParams.params

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container py-8">
        <div className="w-full max-w-4xl mx-auto">
          <SearchResultsClient
            query={query}
            category={category}
            location={location}
            duration={duration}
            params={params}
            isBasicSearch={isBasicSearch}
          />
        </div>
      </main>
      <Footer />
    </div>
  )
}