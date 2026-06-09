import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tasarım Dili POC — UPU Platform",
  description: "Faz 0.5 tasarım dili karşılaştırması. Mock data, internal use.",
  robots: { index: false, follow: false },
};

export default function PocLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
