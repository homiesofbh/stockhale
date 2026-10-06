"use client";

import { Select } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import {
  Children,
  isValidElement,
  useCallback,
  useState,
  type ReactNode,
} from "react";
import styles from "./glass-select.module.css";

type Props = {
  children: ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  "aria-label"?: string;
};
type OptionProps = { value?: string; children?: ReactNode; disabled?: boolean };

function optionText(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) =>
      isValidElement<OptionProps>(child)
        ? optionText(child.props.children)
        : String(child),
    )
    .join("");
}

export function GlassSelect({
  children,
  value,
  defaultValue,
  onValueChange,
  name,
  id,
  required,
  disabled,
  autoFocus,
  className,
  "aria-label": label,
}: Props) {
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  );
  const triggerRef = useCallback((node: HTMLButtonElement | null) => {
    if (node) setPortalContainer(node.closest("dialog"));
  }, []);
  const options = Children.toArray(children)
    .filter(isValidElement<OptionProps>)
    .map((option) => ({
      value: String(option.props.value ?? optionText(option.props.children)),
      label: option.props.children,
      text: optionText(option.props.children),
      disabled: option.props.disabled,
    }));
  const placeholder = options.find((option) => option.value === "")?.label;

  return (
    <Select.Root<string>
      name={name}
      id={id}
      required={required}
      disabled={disabled}
      value={value}
      defaultValue={defaultValue ?? options[0]?.value ?? ""}
      items={options}
      onValueChange={(next) => onValueChange?.(next ?? "")}
      modal={false}
    >
      <Select.Trigger
        ref={triggerRef}
        aria-label={label}
        autoFocus={autoFocus}
        className={`${styles.trigger} glass-select ${className ?? ""}`}
      >
        <Select.Value className={styles.value} placeholder={placeholder} />
        <Select.Icon className={styles.icon}>
          <ChevronDown size={17} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal container={portalContainer}>
        <Select.Positioner
          className={styles.positioner}
          sideOffset={8}
          align="start"
          alignItemWithTrigger={false}
          positionMethod="fixed"
        >
          <Select.Popup className={styles.popup}>
            <Select.List className={styles.list}>
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  label={option.text}
                  disabled={option.disabled}
                  className={styles.item}
                >
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator className={styles.indicator}>
                    <Check size={16} />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
