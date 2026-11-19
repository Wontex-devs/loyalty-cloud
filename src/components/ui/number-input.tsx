"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "./index";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "min" | "max"> & {
  value: number;
  /** Recibe siempre un número entero dentro de [min, max]. */
  onValueChange: (n: number) => void;
  min: number;
  max: number;
  /** Avisar solo al salir del campo (para lo que se guarda solo, sin botón). */
  soloAlSalir?: boolean;
};

/**
 * Campo de número que se escribe como texto normal: sin flechas, solo dígitos y con el teclado
 * numérico en el celular. Mientras se escribe se puede borrar todo; al salir del campo el número
 * se ajusta a los límites (por debajo del mínimo queda el mínimo, por encima del máximo el máximo)
 * y, si quedó vacío, vuelve al valor anterior.
 */
export function NumberInput({ value, onValueChange, min, max, soloAlSalir, className, onFocus, onBlur, ...props }: Props) {
  const [texto, setTexto] = useState<string | null>(null);
  const digitos = String(max).length;

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      maxLength={digitos}
      className={cn("tabular-nums", className)}
      value={texto ?? String(value)}
      onFocus={(e) => {
        setTexto(String(value));
        onFocus?.(e);
      }}
      onChange={(e) => {
        const t = e.target.value.replace(/\D/g, "").slice(0, digitos);
        setTexto(t);
        const n = Number(t);
        if (!soloAlSalir && t !== "" && n >= min && n <= max && n !== value) onValueChange(n);
      }}
      onBlur={(e) => {
        const n = texto === null || texto === "" ? value : Math.min(max, Math.max(min, Number(texto)));
        setTexto(null);
        if (n !== value) onValueChange(n);
        onBlur?.(e);
      }}
    />
  );
}
