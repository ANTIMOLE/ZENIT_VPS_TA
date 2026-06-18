"use client";

import { motion } from "framer-motion";

/**
 * template.tsx re-renders on EVERY navigation (unlike layout.tsx).
 * Ini yang bikin page transition bisa jalan — framer-motion
 * animate ulang setiap kali route berubah.
 */
export default function MainTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.20,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
