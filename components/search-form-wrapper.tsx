"use client";

import { SearchForm } from "@/components/search-form";

export function SearchFormWrapper() {
  const handleSearch = (data: {
    query: string;
    category: string;
    location: string;
    duration: string;
    parameters: string[];
    isBasic: boolean;
  }) => {
    console.log("Search data:", data);
    // Add your search logic here (e.g., API call, state update, etc.)
  };

  return <SearchForm onSearchAction={handleSearch} />;
}