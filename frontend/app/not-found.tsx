"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white dark:bg-dark-100 p-4">
      <div className="space-y-4 text-center">
        <h1 className="text-4xl font-bold text-brand">404</h1>
        <h2 className="text-2xl font-semibold text-slate-800 dark:text-white">Page Not Found</h2>
        <p className="text-slate-600 dark:text-light-200">
          The page you are looking for doesn't exist or has been moved.
        </p>
        <Link href="/">
          <Button className="mt-4 bg-brand hover:bg-brand-100">
            Go back home
          </Button>
        </Link>
      </div>
    </div>
  );
}
