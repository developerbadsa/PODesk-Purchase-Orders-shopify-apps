import React, { useId, useState, useEffect } from "react";
import Select, { Props as SelectProps } from "react-select";

export interface OptionType {
  label: string;
  value: string;
}

export interface SearchableSelectProps extends Omit<SelectProps<OptionType, false>, 'options' | 'value' | 'onChange'> {
  options: OptionType[];
  value: string;
  onChange: (value: string) => void;
  name?: string;
  required?: boolean;
}

export function SearchableSelect({ options, value, onChange, name, required, ...rest }: SearchableSelectProps) {
  const id = useId();
  const selectedOption = options.find((opt) => opt.value === value) || null;
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const customStyles = {
    control: (provided: any, state: any) => ({
      ...provided,
      borderColor: state.isFocused ? "#008060" : "#d1d5db",
      boxShadow: state.isFocused ? "0 0 0 1px #008060" : "none",
      "&:hover": {
        borderColor: state.isFocused ? "#008060" : "#9ca3af",
      },
      borderRadius: "8px",
      minHeight: "42px",
      padding: "2px",
    }),
    option: (provided: any, state: any) => ({
      ...provided,
      backgroundColor: state.isSelected
        ? "#008060"
        : state.isFocused
        ? "#f4f6f8"
        : "transparent",
      color: state.isSelected ? "white" : "#111827",
      "&:active": {
        backgroundColor: state.isSelected ? "#008060" : "#f4f6f8",
      },
      cursor: "pointer",
    }),
    input: (provided: any) => ({
      ...provided,
      color: "#202223",
      "input:focus": {
        boxShadow: "none",
      },
    }),
    placeholder: (provided: any) => ({
      ...provided,
      color: "#6d7175",
      fontSize: "14px",
    }),
    singleValue: (provided: any) => ({
      ...provided,
      color: "#202223",
      fontSize: "14px",
    }),
    menu: (provided: any) => ({
      ...provided,
      borderRadius: "8px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      overflow: "hidden",
      zIndex: 50,
    }),
  };

  if (!isMounted) {
    return (
      <select 
        name={name} 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        required={required}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: "8px",
          border: "1px solid #c9cccf",
          minHeight: "42px",
          color: "#202223",
          fontSize: "14px"
        }}
      >
        <option value="">{rest.placeholder || "Select..."}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    );
  }

  return (
    <>
      <Select
        instanceId={id}
        options={options}
        value={selectedOption}
        onChange={(newValue) => onChange(newValue?.value || "")}
        styles={customStyles}
        {...rest}
      />
      {name && (
        <input 
          type="hidden" 
          name={name} 
          value={value} 
          required={required && !value} 
        />
      )}
    </>
  );
}
