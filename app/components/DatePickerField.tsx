import type { CSSProperties } from "react";

const fieldLabelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  color: "#202223",
  fontSize: "13px",
  fontWeight: 600,
};

const inputStyle: CSSProperties = {
  height: "40px",
  border: "1px solid #8c9196",
  borderRadius: "8px",
  padding: "0 12px",
  fontSize: "14px",
  width: "100%",
  backgroundColor: "#ffffff",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

interface DatePickerFieldProps {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
}

export function DatePickerField({ label, name, defaultValue, required }: DatePickerFieldProps) {
  return (
    <label style={fieldLabelStyle}>
      <span>{label} {required ? <span style={{ color: "#d72c0d" }}>*</span> : null}</span>
      <input type="date" name={name} defaultValue={defaultValue} required={required} style={inputStyle} />
    </label>
  );
}