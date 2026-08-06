import React, { useId } from "react";
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

  const customStyles = {
    control: (provided: any, state: any) => ({
      ...provided,
      borderColor: state.isFocused ? "#008060" : "#c9cccf",
      boxShadow: state.isFocused ? "0 0 0 1px #008060" : "none",
      "&:hover": {
        borderColor: state.isFocused ? "#008060" : "#8c9196",
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
      color: state.isSelected ? "white" : "#202223",
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
      {/* Hidden input for form submission if name is provided */}
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
