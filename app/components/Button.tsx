import React from "react";
import { Link } from "react-router";

export const primaryColor = "#008060";
export const primaryHoverColor = "#006e52";

export const buttonPrimaryStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "0",
  borderRadius: "8px",
  padding: "0 20px",
  height: "42px",
  boxSizing: "border-box",
  background: primaryColor,
  color: "#ffffff",
  fontWeight: 650,
  fontSize: "14px",
  cursor: "pointer",
  transition: "all 0.15s ease",
  whiteSpace: "nowrap",
  textDecoration: "none",
  boxShadow: "0 1px 2px rgba(0,0,0,0.12)",
};

export const buttonSecondaryStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  padding: "0 20px",
  height: "42px",
  boxSizing: "border-box",
  background: "#ffffff",
  color: "#374151",
  fontWeight: 600,
  fontSize: "14px",
  cursor: "pointer",
  transition: "all 0.15s ease",
  whiteSpace: "nowrap",
  textDecoration: "none",
};

export const buttonDangerStyle: React.CSSProperties = {
  ...buttonSecondaryStyle,
  border: "1px solid #fca5a5",
  color: "#dc2626",
  background: "#fef2f2",
};

export const buttonSmallStyle: React.CSSProperties = {
  ...buttonSecondaryStyle,
  height: "36px",
  padding: "0 14px",
  fontSize: "13px",
};

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "variant"> {
  variant?: "primary" | "secondary" | "danger" | "small" | "status";
  to?: string;
}

export function Button({
  variant = "primary",
  to,
  disabled,
  style,
  children,
  ...props
}: ButtonProps) {
  let baseStyle = buttonPrimaryStyle;
  if (variant === "secondary") baseStyle = buttonSecondaryStyle;
  if (variant === "danger") baseStyle = buttonDangerStyle;
  if (variant === "small" || variant === "status") baseStyle = buttonSmallStyle;

  const combinedStyle: React.CSSProperties = {
    ...baseStyle,
    opacity: disabled ? 0.6 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
    ...style,
  };

  if (to) {
    return (
      <Link to={to} style={combinedStyle}>
        {children}
      </Link>
    );
  }

  return (
    <button disabled={disabled} style={combinedStyle} {...props}>
      {children}
    </button>
  );
}

export function PrimaryButton(props: Omit<ButtonProps, "variant">) {
  return <Button variant="primary" {...props} />;
}

export function SecondaryButton(props: Omit<ButtonProps, "variant">) {
  return <Button variant="secondary" {...props} />;
}

export function DangerButton(props: Omit<ButtonProps, "variant">) {
  return <Button variant="danger" {...props} />;
}

export default Button;
