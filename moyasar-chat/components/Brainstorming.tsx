"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Search, Book, Code, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

const statusMessages = [
  { icon: Search, text: "Searching through Examples..." },
  { icon: Book, text: "Consulting Documentation..." },
  { icon: Code, text: "Structuring SwiftUI Code..." },
  { icon: Sparkles, text: "Crafting the perfect answer..." },
];

export default function Brainstorming() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % statusMessages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const CurrentIcon = statusMessages[currentIndex].icon;

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl glass-light">
      {/* Pulsing AI Avatar */}
      <div className="relative flex items-center justify-center w-8 h-8">
        <motion.div
          className="absolute inset-0 rounded-full bg-primary-500/20"
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="relative z-10 w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
          <CurrentIcon className="w-4 h-4 text-white" />
        </div>
      </div>

      {/* Status Text with Animation */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="text-sm text-zinc-400"
          >
            {statusMessages[currentIndex].text}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Loading Dots */}
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-primary-400"
            animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
    </div>
  );
}