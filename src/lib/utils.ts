import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely extracts error message from unknown error objects
 * @param error - The error object to extract message from
 * @param defaultMessage - Default message if extraction fails
 * @returns The error message string
 */
export function getErrorMessage(error: unknown, defaultMessage = "Erro desconhecido"): string {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return defaultMessage;
}
