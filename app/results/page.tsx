import { ResultsTable } from "@/components/results-table";
import { Suspense } from "react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { CategoryProvider } from "@/components/category-context";
import { ResultsPage } from "@/components/results-page";

export default async function Resultspage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  // Await the searchParams promise
  const resolvedSearchParams = await searchParams;

  // Parse search parameters
  const query = resolvedSearchParams.q || "";
  const location = resolvedSearchParams.location || "";
  const duration = resolvedSearchParams.duration || "";
  const paramsString = resolvedSearchParams.params || "placement,salary";
  const selectedParameters = paramsString.split(",");
  const isBasicSearch = resolvedSearchParams.basic === "true";

  return (
    <CategoryProvider>
      <div className="flex flex-col min-h-screen bg-black text-white">
        <Header />
        <main className="flex-1">
          <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading...</div>}>
            <ResultsTable
              query={query}
              location={location}
              duration={duration}
              selectedParameters={selectedParameters}
              isBasicSearch={isBasicSearch}
              loading={false}
            />
          </Suspense>
        </main>
        <Footer />
      </div>
    </CategoryProvider>
  );
}