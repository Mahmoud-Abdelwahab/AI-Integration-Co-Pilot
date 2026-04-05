"use client";

import { motion } from "framer-motion";
import { Send, Loader2 } from "lucide-react";
import { useState, KeyboardEvent } from "react";

interface InputFieldProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

export default function InputField({ onSend, isLoading }: InputFieldProps) {
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      onSend(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative">
      {/* Glow effect background */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary-500/20 via-accent-500/20 to-primary-500/20 blur-xl opacity-50" />
      
      <div className="relative glass rounded-2xl p-2">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about Moyasar SDK integration..."
            rows={1}
            className="flex-1 bg-transparent border-none outline-none resize-none text-zinc-200 placeholder-zinc-500 px-3 py-2 max-h-32 min-h-[44px]"
            style={{ scrollbarWidth: "thin" }}
          />
          <motion.button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            whileHover={{ scale: input.trim() && !isLoading ? 1.05 : 1 }}
            whileTap={{ scale: input.trim() && !isLoading ? 0.95 : 1 }}
            className={`p-2.5 rounded-xl transition-all ${
              input.trim() && !isLoading
                ? "bg-gradient-to-r from-primary-500 to-accent-500 text-white shadow-lg shadow-primary-500/25"
                : "bg-zinc-800 text-zinc-600"
            }`}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
}