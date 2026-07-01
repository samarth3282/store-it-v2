"use client";

import Image from "next/image";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { FormattedDateTime } from "@/components/FormattedDateTime";
import { Separator } from "@/components/ui/separator";
import { convertFileSize } from "@/lib/utils";

interface SummaryCardProps {
  title: string;
  size: number;
  latestDate: string;
  icon: string;
  url: string;
}

export const SummaryCard = ({
  title,
  size,
  latestDate,
  icon,
  url,
}: SummaryCardProps) => {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  // Use regular icons (darker) for dark mode, light icons for light mode
  // Default to light icon during SSR to match initial render
  const iconSrc = mounted && theme === "dark" 
    ? icon.replace("-light.svg", ".svg")
    : icon;

  return (
    <Link href={url} className="dashboard-summary-card" prefetch={true}>
      <div className="space-y-4 ">
        <div className="flex justify-between gap-3">
          <Image
            src={iconSrc}
            width={100}
            height={100}
            alt={`${title} icon`}
            className="summary-type-icon"
          />
          <h4 className="summary-type-size">
            {convertFileSize(size) || 0}
          </h4>
        </div>

        <h5 className="summary-type-title">{title}</h5>
        <Separator className="bg-light-400 dark:bg-light-100" />
        <FormattedDateTime
          date={latestDate}
          className="text-center text-light-100 dark:text-light-200"
        />
      </div>
    </Link>
  );
};
