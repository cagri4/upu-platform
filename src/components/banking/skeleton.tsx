"use client";

export interface SkeletonProps {
  className?: string;
  height?: string;
}

export function Skeleton({ className = "", height = "h-16" }: SkeletonProps) {
  return (
    <div
      className={`${height} rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}
