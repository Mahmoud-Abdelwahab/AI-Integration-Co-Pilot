"use client";

import { motion } from "framer-motion";
import { CreditCard, Wallet, Smartphone, HelpCircle } from "lucide-react";

interface QuickActionsProps {
  onAction: (question: string) => void;
}

const actions = [
  { icon: CreditCard, label: "Credit Card", question: "How to integrate credit card payment in SwiftUI?" },
  { icon: Wallet, label: "Apple Pay", question: "How to set up Apple Pay with Moyasar SDK?" },
  { icon: Smartphone, label: "STC Pay", question: "How to integrate STC Pay payment method?" },
  { icon: HelpCircle, label: "Testing", question: "What are the test cards for Moyasar sandbox?" },
];

export default function QuickActions({ onAction }: QuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {actions.map((action, index) => (
        <motion.button
          key={action.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          onClick={() => onAction(action.question)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass-light hover:bg-white/10 transition-colors group"
        >
          <action.icon className="w-4 h-4 text-primary-400 group-hover:text-primary-300 transition-colors" />
          <span className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors">
            {action.label}
          </span>
        </motion.button>
      ))}
    </div>
  );
}