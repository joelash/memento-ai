"use client";

import { cn } from "@/lib/utils";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

interface TypingAnimationProps {
  text: string;
  className?: string;
  duration?: number;
}

export function TypingAnimation({
  text,
  className,
  duration = 0.05,
}: TypingAnimationProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  return (
    <span ref={ref} className={cn("inline-block", className)}>
      {text.split("").map((char, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{
            duration: 0.1,
            delay: index * duration,
          }}
        >
          {char}
        </motion.span>
      ))}
    </span>
  );
}
