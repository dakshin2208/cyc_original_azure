'use client'

import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Button } from '@/components/ui/button'
import { Download, Printer, Heart } from 'lucide-react'

type Block =
  | { type: 'title'; text: string }
  | { type: 'note'; text: string }
  | { type: 'para'; text: string }
  | { type: 'blanks'; lines: number }
  | { type: 'hint'; text: string }
  | { type: 'signature'; text: string }

const BLOCKS: Block[] = [
  { type: 'title', text: 'For the night before you leave' },
  {
    type: 'note',
    text:
      'A note before you fill this in: Use a pen. Your child will recognise your handwriting before they recognise your words. Fill what you can. Leave what you cannot. The blanks you leave empty will say as much as the ones you fill.',
  },
  { type: 'para', text: 'The night before you leave, I am writing this.' },
  {
    type: 'para',
    text:
      'Your mother has been packing your bag since evening. She keeps adding things, taking them out, adding them again. She is not packing for the journey. She is packing because if her hands stop moving, she will start crying, and she does not want you to see that tonight.',
  },
  { type: 'para', text: 'I am sitting in the next room. Pretending to read. Doing neither.' },
  {
    type: 'para',
    text:
      'I am not good at saying things, ______________. You know this. In our house, love has always been a quiet thing. Paid for, worked for, prayed for — but not spoken. That is how my father was with me.',
  },
  {
    type: 'para',
    text:
      'Tomorrow you will leave, and I am breaking that pattern. Once. On paper. Because I do not want you to spend the next four years guessing what I felt.',
  },
  { type: 'para', text: 'I want to tell you about something you do not know.' },
  {
    type: 'para',
    text:
      'The year you were __________, things were not what they seemed at home. I had',
  },
  { type: 'blanks', lines: 4 },
  {
    type: 'hint',
    text:
      'the thing that went wrong — lost a job, a business that failed, a debt I could not see a way out of',
  },
  {
    type: 'para',
    text:
      'and for almost ______________ we were running on borrowed time. Your mother knew. I knew. You did not. We made sure you did not. You went to school in the same uniform, ate the same food, slept in the same bed, and never once felt that anything had changed. That was the only thing I was determined to give you in that year — a childhood that did not know.',
  },
  {
    type: 'para',
    text:
      'I am telling you this now because tomorrow you are going somewhere I have spent more money on than I have ever spent on anything in my life. And I want you to know that the money is not the point. The point is — there has never been a moment, from the year you were born until tonight, when your mother and I were not building toward this.',
  },
  {
    type: 'para',
    text:
      'Whatever I have, I have put into you. Not as a debt. As a choice. The proudest choice of my life.',
  },
  { type: 'para', text: 'I want to say something hard now. Listen carefully.' },
  {
    type: 'para',
    text:
      'The college will not make you. The degree will not make you. The placement will not make you. Somewhere in the second year, you will start to believe your future is being handed to you by the institution. It will not be. The institution is a building. The future is built by the person inside it. If you wait for the college to do its job, you will graduate and find out that the job was always yours.',
  },
  {
    type: 'para',
    text:
      'So work. Not the way I worked — long hours, head down, body breaking. Work with your eyes open. Read more than the syllabus. Build something every year that did not exist before you made it. Find one teacher who actually teaches — there will only be one or two — and stay close to them. Find two friends who are honest, and keep them for life. The rest will fade.',
  },
  {
    type: 'para',
    text:
      'About money — you will see classmates with more than you, and classmates with less. Both will make you feel like you do not quite belong. You belong, ______________. You belong because you come from a family that has not borrowed beyond its means and has not loved beyond its limits. Spend on what nourishes you. Do not spend to impress people who will not be in your life in five years.',
  },
  {
    type: 'para',
    text:
      'About failure — you will fail at something. A paper. A year. A friendship. A job interview. I want you to know I have already forgiven you for it. Do not hide it from us. The worst nights of my life were the nights I hid my failures from my own father. Do not do what I did. Tell us. Always tell us. We will not be angry. We will be relieved that you still trust us enough to say it.',
  },
  { type: 'para', text: 'There is one more thing.' },
  {
    type: 'para',
    text:
      'I have not been a perfect father. I was hard on you when I should have been gentle. I missed',
  },
  { type: 'blanks', lines: 3 },
  {
    type: 'hint',
    text:
      'a specific moment — your school prize day, a match, the evening you got your rank, a birthday',
  },
  {
    type: 'para',
    text:
      'because of work that I now realise did not matter as much as I told myself. I did not say I love you when I should have. I let your mother be the soft one because I did not know how to be soft myself.',
  },
  {
    type: 'para',
    text:
      'I am sorry. The silence was never indifference. It was only that I did not have the language. My father did not give it to me. I am giving it to you now, in writing, so you do not have to wait as long as I did to find the words.',
  },
  {
    type: 'para',
    text:
      'When you read this — and you will read it many times in the years ahead, on nights when something is heavy and you do not know who to call — remember three things.',
  },
  { type: 'para', text: 'You are loved. More than you know. More than we have ever shown.' },
  {
    type: 'para',
    text:
      'You are enough. Whatever marks you get, whatever job you land, whatever salary you earn — you were enough on the day you were born, and you will be enough on the day I am gone.',
  },
  {
    type: 'para',
    text:
      'You are not alone. As long as we are alive, there is a house with the light on for you.',
  },
  {
    type: 'para',
    text: 'Go now. Go and become whatever you are meant to become. We will be here.',
  },
  {
    type: 'para',
    text:
      'And one day, many years from now, you will sit down to write a letter to your own child, and you will understand why I am crying as I write this.',
  },
  { type: 'para', text: 'I love you, ______________.' },
  { type: 'signature', text: '— Your Father' },
]

export default function LetterToYourKidPage() {
  const handlePrint = () => window.print()

  const handleDownload = async () => {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const margin = 64
    const maxW = pageW - margin * 2
    const lineH = 16
    let y = margin

    const ensure = (h: number) => {
      if (y + h > pageH - margin) {
        doc.addPage()
        y = margin
      }
    }

    const writePara = (
      text: string,
      opts: { style?: string; size?: number; color?: [number, number, number]; gap?: number; align?: 'center' | 'left' } = {},
    ) => {
      const { style = 'normal', size = 11.5, color = [45, 45, 45], gap = 11, align = 'left' } = opts
      doc.setFont('times', style)
      doc.setFontSize(size)
      doc.setTextColor(color[0], color[1], color[2])
      const lines = doc.splitTextToSize(text, maxW) as string[]
      for (const ln of lines) {
        ensure(lineH)
        doc.text(ln, align === 'center' ? pageW / 2 : margin, y, { align })
        y += lineH
      }
      y += gap
    }

    for (const b of BLOCKS) {
      if (b.type === 'title') writePara(b.text, { style: 'bold', size: 18, color: [11, 85, 136], gap: 16, align: 'center' })
      else if (b.type === 'note') writePara(b.text, { style: 'italic', size: 10.5, color: [110, 110, 110], gap: 16 })
      else if (b.type === 'para') writePara(b.text)
      else if (b.type === 'hint') writePara(b.text, { style: 'italic', size: 9.5, color: [140, 140, 140], gap: 12 })
      else if (b.type === 'signature') writePara(b.text, { style: 'bold', size: 12, gap: 4 })
      else if (b.type === 'blanks') {
        for (let i = 0; i < b.lines; i++) {
          ensure(lineH + 8)
          doc.setDrawColor(190)
          doc.line(margin, y, margin + maxW, y)
          y += lineH + 8
        }
        y += 6
      }
    }

    doc.save('letter-to-your-kid.pdf')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container py-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-6 print:hidden">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#0B5588]/10 mb-4">
              <Heart className="h-7 w-7 text-[#0B5588]" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-3 text-[#0B5588]">Letter to Your Kid</h1>
            <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
              A letter for the night before your child leaves. Read it, fill in the blanks by hand,
              and download a copy to keep.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3 mb-8 print:hidden">
            <Button onClick={handleDownload} className="bg-[#0B5588] hover:bg-[#094670]">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>

          {/* The letter */}
          <article className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 sm:p-10 font-serif text-gray-800 leading-relaxed print:border-0 print:shadow-none">
            {BLOCKS.map((b, i) => {
              if (b.type === 'title')
                return (
                  <h2 key={i} className="text-2xl sm:text-3xl font-bold text-[#0B5588] text-center mb-6">
                    {b.text}
                  </h2>
                )
              if (b.type === 'note')
                return (
                  <p key={i} className="italic text-gray-500 text-sm sm:text-base border-l-4 border-gray-200 pl-4 mb-8">
                    {b.text}
                  </p>
                )
              if (b.type === 'para')
                return (
                  <p key={i} className="mb-5 text-[15px] sm:text-base">
                    {b.text}
                  </p>
                )
              if (b.type === 'hint')
                return (
                  <p key={i} className="italic text-gray-400 text-xs sm:text-sm mb-5">
                    {b.text}
                  </p>
                )
              if (b.type === 'signature')
                return (
                  <p key={i} className="font-semibold mt-2 text-[15px] sm:text-base">
                    {b.text}
                  </p>
                )
              // blanks
              return (
                <div key={i} className="mb-5 space-y-6">
                  {Array.from({ length: b.lines }).map((_, li) => (
                    <div key={li} className="border-b border-gray-300" />
                  ))}
                </div>
              )
            })}
          </article>
        </div>
      </main>
      <div className="print:hidden">
        <Footer />
      </div>
    </div>
  )
}
