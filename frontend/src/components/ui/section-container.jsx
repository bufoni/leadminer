import * as React from "react";
import { cn } from "@/lib/utils";

export function SectionContainer({ className, children, ...props }) {
  return (
    <section className={cn("section-container", className)} {...props}>
      <div className="section-inner">{children}</div>
    </section>
  );
}

export function SectionHeading({ className, title, subtitle }) {
  return (
    <div className={cn("section-heading", className)}>
      {title ? <h2 className="font-semibold text-gray-900 dark:text-white mb-4">{title}</h2> : null}
      {subtitle ? <p className="text-base md:text-lg text-gray-600 dark:text-gray-400">{subtitle}</p> : null}
    </div>
  );
}
