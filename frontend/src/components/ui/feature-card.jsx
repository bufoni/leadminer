import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function FeatureCard({ icon: Icon, title, description, className, iconClassName }) {
  return (
    <Card
      className={cn(
        "bg-white dark:bg-gray-900/50 border-gray-200 dark:border-white/5 p-6 hover:border-violet-500/30 transition-all",
        className
      )}
    >
      <div
        className={cn(
          "w-12 h-12 rounded-lg bg-violet-500/10 flex items-center justify-center mb-4",
          iconClassName
        )}
      >
        {Icon ? <Icon className="h-6 w-6 text-violet-400" /> : null}
      </div>
      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-gray-600 dark:text-gray-400">{description}</p>
    </Card>
  );
}
