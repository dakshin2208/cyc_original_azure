"use client";

import type React from "react";
import dynamic from 'next/dynamic'

const ThemeProvider = dynamic(() => import('@/components/theme-provider').then(mod => mod.ThemeProvider), { ssr: false })
const CategoryProvider = dynamic(() => import('@/components/category-context').then(mod => mod.CategoryProvider), { ssr: false })

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light">
      <CategoryProvider>
        {children}
      </CategoryProvider>
    </ThemeProvider>
  );
}