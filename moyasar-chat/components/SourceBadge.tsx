"use client";

import { motion } from "framer-motion";
import { FileCode, BookOpen, Package } from "lucide-react";

interface SourceBadgeProps {
  source: string;
}

const sourceConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  example: { icon: FileCode, color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", label: "Examples" },
  docs: { icon: BookOpen, color: "text-blue-400 bg-blue-400/10 border-blue-400/20", label: "Documentation" },
  sdk: { icon: Package, color: "text-purple-400 bg-purple-400/10 border-purple-400/20", label: "SDK Source" },
};

export default function SourceBadge({ source }: SourceBadgeProps) {
  const config = sourceConfig[source] || sourceConfig.docs;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.color}`}
    >
      <Icon className="w-3 h-3" />
      <span>Source: {config.label}</span>
    </motion.div>
  );
}