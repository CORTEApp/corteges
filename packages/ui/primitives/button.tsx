import Link from "next/link";
import type { ReactNode } from "react";

type ButtonProps = {
  href?: string;
  variant?: "primary" | "secondary";
  children: ReactNode;
};

export function Button({
  href = "#",
  variant = "primary",
  children,
}: ButtonProps) {
  const className =
    variant === "primary" ? "button-primary" : "button-secondary";

  return (
    <Link className={className} href={href}>
      {children}
    </Link>
  );
}
