import { BookOpen } from 'lucide-react'

export function TitleBar() {
  return (
    <div className="flex h-10 shrink-0 items-center justify-between border-b bg-sidebar px-4 [-webkit-app-region:drag]">
      {/* App title/logo */}
      <div className="flex items-center gap-2 [-webkit-app-region:no-drag]">
        <BookOpen className="h-5 w-5 text-primary" />
        <span className="text-sm font-semibold">NovelTranslate</span>
      </div>

      {/* Spacer for macOS traffic lights */}
      <div className="w-20" />
    </div>
  )
}
