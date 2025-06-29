import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import AIGenerator from "./ai-generator";

interface AIGeneratorTriggerProps {
  onGenerate: (questions: any[]) => void;
  examTitle: string;
  language: string;
}

export function AIGeneratorTrigger({ 
  onGenerate, 
  examTitle, 
  language 
}: AIGeneratorTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Trigger Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", duration: 0.3 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-8 right-8 z-40 group"
          >
            <div className="relative">
              {/* Button background with gradient */}
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-pink-600 rounded-full blur-lg opacity-75 group-hover:opacity-100 transition-opacity" />
              
              {/* Main button */}
              <div className="relative bg-gradient-to-r from-violet-600 to-pink-600 text-white rounded-full p-4 shadow-xl group-hover:shadow-2xl transition-all duration-300 group-hover:scale-110">
                <Sparkles className="h-6 w-6" />
              </div>
              
              {/* Floating animation */}
              <motion.div
                className="absolute inset-0 rounded-full bg-white/20"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0, 0.3],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </div>
            
            {/* Tooltip */}
            <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              AI Question Generator
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ y: "100%", opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: "100%", opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="fixed right-6 bottom-6 top-6 w-[400px] z-50"
          >
            <AIGenerator 
              onQuestionsGenerated={onGenerate}
              onClose={() => setIsOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
} 