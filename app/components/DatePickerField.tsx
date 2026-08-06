import type { CSSProperties } from "react";

const fieldLabelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  color: "#202223",
  fontSize: "13px",
  fontWeight: 600,
};

const dateInputStyle: CSSProperties = {
  height: "40px",
  border: "1px solid #8c9196",
  borderRadius: "8px",
  padding: "0 12px",
  fontSize: "14px",
  width: "100%",
  backgroundColor: "#ffffff",
  color: "#202223",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

interface DatePickerFieldProps {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
}

export function DatePickerField({
  label,
  name,
  defaultValue = "",
  required = false,
  placeholder,
}: DatePickerFieldProps) {
  return (
    <label style={fieldLabelStyle}>
      <span>
        {label} {required ? <span style={{ color: "#d72c0d" }}>*</span> : null}
      </span>
      <input
        name={name}
        type="date"
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        style={dateInputStyle}
      />
    </label>
  );
}
