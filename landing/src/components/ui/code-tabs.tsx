"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { motion } from "framer-motion";

interface CodeTabsProps {
  tabs: {
    label: string;
    icon?: React.ReactNode;
    code: string;
  }[];
  className?: string;
}

export function CodeTabs({ tabs, className }: CodeTabsProps) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className={cn("w-full max-w-3xl mx-auto", className)}>
      {/* Tab headers */}
      <div className="flex gap-1 p-1 bg-[var(--surface)] rounded-t-xl border border-b-0 border-[var(--border)]">
        {tabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => setActiveTab(index)}
            className={cn(
              "relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              activeTab === index
                ? "text-[var(--foreground)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            )}
          >
            {activeTab === index && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-[var(--border)] rounded-lg"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {tab.icon}
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* Code content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="relative bg-[var(--background)] rounded-b-xl border border-[var(--border)] overflow-hidden"
      >
        <pre className="p-6 overflow-x-auto">
          <code
            className="text-sm font-mono"
            dangerouslySetInnerHTML={{ __html: tabs[activeTab].code }}
          />
        </pre>
      </motion.div>
    </div>
  );
}
