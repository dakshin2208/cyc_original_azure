import { toast } from "@/components/ui/use-toast"

export function showSuccessToast(message: string) {
  toast({
    title: "Success! 🎉",
    description: message,
    duration: 10000,
    className: "bg-green-100 border-2 border-green-500 text-green-900 font-semibold shadow-xl",
    variant: "default",
    action: (
      <div className="h-full flex items-center">
        <span className="text-green-600">✓</span>
      </div>
    ),
  })
}

export function showErrorToast(message: string) {
  toast({
    title: "Error",
    description: message,
    duration: 5000,
    className: "bg-red-100 border-2 border-red-500 text-red-900 font-semibold shadow-xl",
    variant: "destructive",
    action: (
      <div className="h-full flex items-center">
        <span className="text-red-600">✕</span>
      </div>
    ),
  })
} 