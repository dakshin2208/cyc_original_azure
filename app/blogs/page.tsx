'use client'

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

// Blog data type
interface BlogPost {
  id: number
  title: string
  description: string
  image: string
  slug: string
  date: string
  readTime: string
}

// Sample blog data
const blogPosts: BlogPost[] = [
  {
    id: 1,
    title: "How to Choose the Best College Based on Your Cutoff Marks",
    description: "Choosing the right college is one of the most critical decisions in a student's academic journey. Learn how to make informed choices based on your cutoff marks.",
    image: "/blog1.jpg",
    slug: "how-to-choose-best-college-cutoff-marks",
    date: "March 15, 2024",
    readTime: "5 min read"
  },
  {
    id: 2,
    title: "Why Cutoff Scores Matter More Than You Think",
    description: "Your cutoff score acts as a crucial gateway, determining the colleges, courses, and future possibilities available to you. Learn why these scores are more important than you might realize.",
    image: "/blog2.jpg",
    slug: "why-cutoff-scores-matter",
    date: "March 16, 2024",
    readTime: "4 min read"
  },
  {
    id: 3,
    title: "How to Shortlist Colleges Based on Your Exam Results",
    description: "Shortlisting the right colleges after exam results can feel overwhelming. Learn a structured approach to narrow down the best options suited to your goals.",
    image: "/blog3.jpg",
    slug: "how-to-shortlist-colleges-exam-results",
    date: "March 17, 2024",
    readTime: "6 min read"
  },
  {
    id: 4,
    title: "Understanding Merit Seats and Cutoff Score Requirements",
    description: "Understanding how merit seats work and how cutoff scores are determined is key to unlocking better college opportunities. Learn how these factors impact your admission choices.",
    image: "/blog4.jpg",
    slug: "understanding-merit-seats-cutoff-requirements",
    date: "March 18, 2024",
    readTime: "7 min read"
  },
  {
    id: 5,
    title: "What Is a Good Cutoff for Top Placement Colleges?",
    description: "When aiming for the best placement opportunities after graduation, selecting a college with the right cutoff becomes critical. Learn how cutoff scores impact your future career prospects.",
    image: "/blog5.jpg",
    slug: "good-cutoff-top-placement-colleges",
    date: "March 19, 2024",
    readTime: "6 min read"
  },
  {
    id: 6,
    title: "Difference Between Merit Admission and Management Admission",
    description: "Understanding the difference between merit admission and management admission is essential when applying to colleges. Learn how these pathways differ in selection process, cost, and outcomes.",
    image: "/blog6.jpg",
    slug: "merit-vs-management-admission",
    date: "March 20, 2024",
    readTime: "7 min read"
  },
  {
    id: 7,
    title: "Choosing a College With the Best Placement for Your Score",
    description: "For students and parents, finding the right college isn't just about clearing a cutoff — it's about ensuring that the college offers strong placement opportunities. Learn how to maximize your career prospects.",
    image: "/blog7.jpg",
    slug: "choosing-college-best-placement",
    date: "March 21, 2024",
    readTime: "6 min read"
  },
  {
    id: 8,
    title: "How Verified College Data Helps You Choose Smarter",
    description: "In today's world, information is everywhere — but not all information is reliable. Learn why verified college data is crucial for making informed decisions about your education and future.",
    image: "/blog8.jpg",
    slug: "verified-college-data-choose-smarter",
    date: "March 22, 2024",
    readTime: "5 min read"
  },
  {
    id: 9,
    title: "Top Colleges Accepting Students With 80%+ Cutoffs",
    description: "Scoring above 80% in your board exams or entrance tests opens doors to excellent colleges across India. Learn how to leverage your score to secure admissions at top institutions.",
    image: "/blog9.jpg",
    slug: "top-colleges-80-percent-cutoff",
    date: "March 23, 2024",
    readTime: "6 min read"
  },
  {
    id: 10,
    title: "Choosing a Good College if Your Marks Are Average",
    description: "Not every student scores in the top percentile — and that's perfectly okay. Learn how to find colleges that offer great learning environments and opportunities for growth, even with average marks.",
    image: "/blog10.jpg",
    slug: "choosing-college-average-marks",
    date: "March 24, 2024",
    readTime: "6 min read"
  },
  {
    id: 11,
    title: "Using Cutoff Search Tools to Find Colleges Faster",
    description: "In the highly competitive college admission landscape, time is critical. Learn how cutoff search tools can help you instantly match marks to eligible colleges — saving time, effort, and confusion.",
    image: "/blog11.jpg",
    slug: "using-cutoff-search-tools",
    date: "March 25, 2024",
    readTime: "5 min read"
  },
  {
    id: 12,
    title: "How Scholarship Options Depend on Your Cutoff Marks",
    description: "Winning a scholarship can be a game-changer for students aiming to pursue quality education without financial pressure. Learn how your cutoff marks impact your scholarship eligibility and opportunities.",
    image: "/blog12.jpg",
    slug: "scholarship-options-cutoff-marks",
    date: "March 26, 2024",
    readTime: "7 min read"
  },
  {
    id: 13,
    title: "Things Parents Should Check Before Finalizing a College",
    description: "Choosing the right college for your child is one of the most critical decisions parents face. Learn about the key factors to consider beyond just the name of the institution.",
    image: "/blog13.jpg",
    slug: "things-parents-should-check-before-finalizing-college",
    date: "March 27, 2024",
    readTime: "7 min read"
  },
  {
    id: 14,
    title: "Understanding Passing Percentage and Graduation Outcomes",
    description: "Graduating from college with good marks is not just a matter of personal pride — it's a key indicator of a college's education quality and the student's future prospects. Learn why these metrics matter.",
    image: "/blog14.jpg",
    slug: "understanding-passing-percentage-graduation-outcomes",
    date: "March 28, 2024",
    readTime: "6 min read"
  },
  {
    id: 15,
    title: "Why NIRF Ranking Matters When Selecting Colleges",
    description: "When it comes to choosing the right college, rankings play a crucial role. Learn why NIRF rankings matter and how they can help you make a well-informed decision for your future.",
    image: "/blog15.jpg",
    slug: "why-nirf-ranking-matters-selecting-colleges",
    date: "March 29, 2024",
    readTime: "5 min read"
  },
  {
    id: 16,
    title: "Protect Yourself From Fake College Promises",
    description: "In the rush to secure a college admission, many students and parents fall victim to flashy advertisements and misleading promises. Learn how to identify and avoid fake college claims.",
    image: "/blog16.jpg",
    slug: "protect-yourself-fake-college-promises",
    date: "March 30, 2024",
    readTime: "6 min read"
  },
  {
    id: 17,
    title: "Common Mistakes Students Make During College Search",
    description: "Choosing the right college is a significant decision that shapes a student's future. Learn about the most common mistakes to avoid during your college search process.",
    image: "/blog17.jpg",
    slug: "common-mistakes-college-search",
    date: "March 31, 2024",
    readTime: "5 min read"
  },
  {
    id: 18,
    title: "What to Do If Your Cutoff Is Lower Than Expected",
    description: "Not meeting your expected cutoff marks can be disheartening, but it doesn't mean your dreams of a great education are over. Learn how to find quality colleges that match your scores.",
    image: "/blog18.jpg",
    slug: "what-to-do-lower-cutoff",
    date: "April 1, 2024",
    readTime: "6 min read"
  }
]

export default function BlogsPage() {
  return (
    <div className="bg-background">
      {/* Hero Section */}
      <div className="relative h-[300px] sm:h-[400px] md:h-[500px] w-full">
        <Image
          src="/headimg.jpg"
          alt="Blogs Hero Background"
          fill
          className="object-cover brightness-50"
          priority
        />
        <div className="absolute inset-0 flex items-center">
          <div className="container max-w-6xl px-4 sm:px-6 md:px-8">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4 text-[#005596]">Our Blogs</h1>
            <p className="text-base sm:text-lg md:text-xl text-white">Insights and guidance for your college journey</p>
          </div>
        </div>
      </div>

      {/* Blog Posts Grid */}
      <div className="container py-8 sm:py-12 px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {blogPosts.map((post) => (
            <Link href={`/blogs/${post.slug}`} key={post.id}>
              <Card className="h-full hover:shadow-lg transition-shadow duration-200">
                <div className="relative h-40 sm:h-48 w-full">
                  <Image
                    src={post.image}
                    alt={post.title}
                    fill
                    className="object-cover rounded-t-lg"
                  />
                </div>
                <CardHeader className="p-4 sm:p-6">
                  <div className="flex justify-between items-center text-xs sm:text-sm text-muted-foreground mb-2">
                    <span>{post.date}</span>
                    <span>{post.readTime}</span>
                  </div>
                  <CardTitle className="line-clamp-2 text-base sm:text-lg">{post.title}</CardTitle>
                  <CardDescription className="line-clamp-3 text-sm sm:text-base">
                    {post.description}
                  </CardDescription>
                </CardHeader>
                <CardFooter className="p-4 sm:p-6 pt-0">
                  <Button variant="ghost" className="w-full group text-sm sm:text-base">
                    Read More
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
} 