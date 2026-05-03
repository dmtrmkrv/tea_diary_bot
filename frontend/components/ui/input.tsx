import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-lg border border-[#e5e5e5] bg-white px-4 py-1 text-[14px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] transition-colors outline-none placeholder:text-[#a8a29e] focus-visible:border-[#b45309] focus-visible:ring-2 focus-visible:ring-[#b45309]/20 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
