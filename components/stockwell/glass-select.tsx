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
  searchable?: boolean;
  searchPlaceholder?: string;
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

function searchableText(value: string) {
  return value.normalize("NFKD").replace(/[^\p{L}\p{N}]/gu, "").toLocaleLowerCase();
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
  searchable = false,
  searchPlaceholder = "Search…",
  className,
  "aria-label": label,
}: Props) {
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  );
  const [search, setSearch] = useState("");
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
  const visibleOptions = searchable && search.trim()
    ? options.filter((option) => searchableText(option.text).includes(searchableText(search.trim())))
    : options;

  return (
    <Select.Root<string>
      name={name}
      id={id}
      required={required}
      disabled={disabled}
      value={value}
      defaultValue={defaultValue ?? options[0]?.value ?? ""}
      items={options}
      onValueChange={(next) => {
        setSearch("");
        onValueChange?.(next ?? "");
      }}
      onOpenChange={(open) => {
        if (!open) setSearch("");
      }}
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
      {/* Explicit null delays portal rendering; undefined uses document.body. */}
      <Select.Portal container={portalContainer ?? undefined}>
        <Select.Positioner
          className={styles.positioner}
          side="bottom"
          sideOffset={8}
          align="start"
          alignItemWithTrigger={false}
          positionMethod="fixed"
        >
          <Select.Popup className={styles.popup}>
            {searchable && (
              <input
                className={styles.search}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                autoFocus
              />
            )}
            <Select.List className={styles.list}>
              {visibleOptions.map((option) => (
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
            {searchable && visibleOptions.length === 0 && (
              <div className={styles.noResults}>No matching options</div>
            )}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
