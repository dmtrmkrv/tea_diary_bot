import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-[#e5e5e5] bg-white px-3 py-2.5 text-[14px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] transition-colors outline-none placeholder:text-[#a8a29e] focus-visible:border-[#b45309] focus-visible:ring-2 focus-visible:ring-[#b45309]/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
