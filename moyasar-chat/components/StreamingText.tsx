"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface StreamingTextProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
}

export default function StreamingText({ text, speed = 10, onComplete }: StreamingTextProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex >= text.length) {
      onComplete?.();
      return;
    }

    const timeout = setTimeout(() => {
      setDisplayedText((prev) => prev + text[currentIndex]);
      setCurrentIndex((prev) => prev + 1);
    }, speed);

    return () => clearTimeout(timeout);
  }, [currentIndex, text, speed, onComplete]);

  // For instant display (when text is already complete)
  useEffect(() => {
    if (speed === 0) {
      setDisplayedText(text);
      setCurrentIndex(text.length);
    }
  }, [text, speed]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="markdown-content"
      dangerouslySetInnerHTML={{ __html: formatText(displayedText) }}
    />
  );
}

function formatText(text: string): string {
  // Simple markdown-like formatting
  return text
    // Code blocks
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    // Line breaks
    .replace(/\n/g, '<br/>');
}