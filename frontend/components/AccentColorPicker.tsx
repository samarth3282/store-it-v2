"use client";

import * as React from "react";
import { Palette, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
//   DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  accentColors,
  type AccentColorKey,
  useAccentColor,
} from "@/contexts/AccentColorContext";

export function AccentColorPicker() {
  const { accentColor, setAccentColorAnimated } = useAccentColor();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleColorChange = async (colorKey: AccentColorKey, event: React.MouseEvent<HTMLButtonElement>) => {
    if (!mounted) return;
    
    const button = event.currentTarget;
    const { top, left, width, height } = button.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;

    await setAccentColorAnimated(colorKey, x, y);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="flex-center h-[52px] min-w-[54px] items-center rounded-full border-none bg-brand/10 p-0 text-brand shadow-none transition-all hover:bg-brand/20"
          aria-label="Select accent color"
        >
          <Palette className="size-[1.2rem]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[200px] dark:border-light-100/20 dark:bg-dark-200"
      >
        <div className="p-2">
          <p className="mb-3 px-2 text-sm font-medium">Accent Color</p>
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(accentColors) as AccentColorKey[]).map((colorKey) => {
              const color = accentColors[colorKey];
              const isSelected = accentColor === colorKey;

              return (
                <button
                  key={colorKey}
                  onClick={(e) => handleColorChange(colorKey, e)}
                  className="relative size-10 rounded-full transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2"
                  style={{
                    backgroundColor: color.hex,
                    boxShadow: isSelected
                      ? `0 0 0 2px white, 0 0 0 4px ${color.hex}`
                      : "none",
                  }}
                  aria-label={`Select ${color.name}`}
                  title={color.name}
                >
                  {isSelected && (
                    <Check className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 text-white" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
