"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export const accentColors = {
  pink: {
    name: "Pink",
    primary: "250 114 117",
    secondary: "234 99 101",
    hex: "#FA7275",
  },
  blue: {
    name: "Blue",
    primary: "59 130 246",
    secondary: "37 99 235",
    hex: "#3B82F6",
  },
  purple: {
    name: "Purple",
    primary: "168 85 247",
    secondary: "147 51 234",
    hex: "#A855F7",
  },
  green: {
    name: "Green",
    primary: "16 185 129",
    secondary: "5 150 105",
    hex: "#10B981",
  },
  orange: {
    name: "Orange",
    primary: "249 115 22",
    secondary: "234 88 12",
    hex: "#F97316",
  },
  red: {
    name: "Red",
    primary: "239 68 68",
    secondary: "220 38 38",
    hex: "#EF4444",
  },
  teal: {
    name: "Teal",
    primary: "20 184 166",
    secondary: "13 148 136",
    hex: "#14B8A6",
  },
  indigo: {
    name: "Indigo",
    primary: "99 102 241",
    secondary: "79 70 229",
    hex: "#6366F1",
  },
} as const;

export type AccentColorKey = keyof typeof accentColors;

interface AccentColorContextType {
  accentColor: AccentColorKey;
  setAccentColor: (color: AccentColorKey) => void;
  setAccentColorAnimated: (color: AccentColorKey, x: number, y: number) => Promise<void>;
}

const AccentColorContext = createContext<AccentColorContextType | undefined>(
  undefined
);

export function AccentColorProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [accentColor, setAccentColorState] =
    useState<AccentColorKey>("pink");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("accent-color") as AccentColorKey;
    if (stored && accentColors[stored]) {
      setAccentColorState(stored);
      applyAccentColor(stored);
    } else {
      applyAccentColor("pink");
    }
  }, []);

  const applyAccentColor = (color: AccentColorKey) => {
    const selectedColor = accentColors[color];
    document.documentElement.style.setProperty(
      "--color-brand",
      selectedColor.primary
    );
    document.documentElement.style.setProperty(
      "--color-brand-100",
      selectedColor.secondary
    );
  };

  const setAccentColor = (color: AccentColorKey) => {
    setAccentColorState(color);
    localStorage.setItem("accent-color", color);
    applyAccentColor(color);
  };

  const setAccentColorAnimated = async (color: AccentColorKey, x: number, y: number) => {
    // Check if View Transitions API is supported
    if (!document.startViewTransition) {
      setAccentColor(color);
      return;
    }

    const maxRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const transition = document.startViewTransition(() => {
      setAccentColorState(color);
      localStorage.setItem("accent-color", color);
      applyAccentColor(color);
    });

    await transition.ready;

    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${maxRadius}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration: 800,
        easing: "ease-in-out",
        pseudoElement: "::view-transition-new(root)",
      }
    );
  };

  if (!mounted) {
    return null;
  }

  return (
    <AccentColorContext.Provider value={{ accentColor, setAccentColor, setAccentColorAnimated }}>
      {children}
    </AccentColorContext.Provider>
  );
}

export function useAccentColor() {
  const context = useContext(AccentColorContext);
  if (context === undefined) {
    throw new Error("useAccentColor must be used within AccentColorProvider");
  }
  return context;
}
