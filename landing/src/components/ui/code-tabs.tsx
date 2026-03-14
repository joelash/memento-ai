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
      <div className="flex gap-1 p-1 bg-zinc-900 rounded-t-xl border border-b-0 border-zinc-800">
        {tabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => setActiveTab(index)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              activeTab === index
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-zinc-300"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Code content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="relative bg-zinc-950 rounded-b-xl border border-zinc-800 overflow-hidden"
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
