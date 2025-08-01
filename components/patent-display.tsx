"use client"

interface PatentData {
  total: number
  published: number
  granted: number
  commercialized: number
}

interface PatentDisplayProps {
  data: PatentData
}

export function PatentDisplay({ data }: PatentDisplayProps) {
  return (
    <div className="w-full">
      <div className="grid grid-cols-4 gap-1 text-xs">
        <div className="text-center">
          <div className="font-medium mb-1">Total</div>
          <div>{data.total}</div>
        </div>
        <div className="text-center">
          <div className="font-medium mb-1">Published</div>
          <div>{data.published}</div>
        </div>
        <div className="text-center">
          <div className="font-medium mb-1">Granted</div>
          <div>{data.granted}</div>
        </div>
        <div className="text-center">
          <div className="font-medium mb-1">Commercialized</div>
          <div>{data.commercialized}</div>
        </div>
      </div>
    </div>
  )
}
