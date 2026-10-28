"use client";

import { SelectField, TextField } from "@/components/ui/Field";
import { PHONE_HINT } from "@/lib/phone";
import { NIGERIAN_STATES, type Address } from "@/lib/types";

export const emptyAddress: Address = { firstName: "", lastName: "", phone: "", line1: "", line2: "", city: "", state: "", landmark: "", country: "NG" };

/** Nigerian delivery address fields, shared by checkout and saved addresses. */
export function AddressFields({ value, onChange, errors = {} }: { value: Address; onChange(a: Address): void; errors?: Record<string, string | undefined> }) {
  const set = (k: keyof Address) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="form-grid">
      <TextField label="First name" value={value.firstName} onChange={set("firstName")} error={errors.firstName} required autoComplete="given-name" />
      <TextField label="Last name" value={value.lastName} onChange={set("lastName")} error={errors.lastName} required autoComplete="family-name" />
      <TextField label="Phone" type="tel" value={value.phone} onChange={set("phone")} error={errors.phone} required autoComplete="tel" inputMode="tel" placeholder="0803 123 4567" hint={PHONE_HINT} wrapperClassName="form-grid__full" />
      <TextField label="Street address" value={value.line1} onChange={set("line1")} error={errors.line1} required autoComplete="address-line1" wrapperClassName="form-grid__full" />
      <TextField label="Nearest landmark (optional)" value={value.landmark ?? ""} onChange={set("landmark")} placeholder="e.g. Opposite the filling station" wrapperClassName="form-grid__full" />
      <SelectField label="State" value={value.state} onChange={set("state")} error={errors.state} required autoComplete="address-level1">
        <option value="" disabled>
          Choose a state
        </option>
        {NIGERIAN_STATES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </SelectField>
      <TextField label="Town or city" value={value.city} onChange={set("city")} error={errors.city} required autoComplete="address-level2" placeholder="e.g. Ilesha" />
    </div>
  );
}
