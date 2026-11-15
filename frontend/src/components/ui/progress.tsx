import { Progress as ProgressPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

// Desvio deliberado do registry (docs/ui-contract.md): base aparada para deferir
// ao CSS do app (.meter [data-slot=progress]), que define track/fill/raio/cores.
// O Indicator mantém o transform Radix (preenchimento a partir da esquerda) e o
// value é repassado ao Root para aria-valuenow/data-state.
function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      className={cn("relative w-full overflow-hidden", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="size-full"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
