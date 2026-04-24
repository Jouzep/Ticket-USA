"use client";

import { StopCircle } from "lucide-react";

import { Button } from "@/components/atoms/button";

interface Props {
  onCancel: () => void;
  disabled?: boolean;
}

export function CancelControl({ onCancel, disabled = false }: Props) {
  return (
    <div className="flex justify-end">
      <Button variant="secondary" size="sm" onClick={onCancel} disabled={disabled}>
        <StopCircle className="h-4 w-4" aria-hidden />
        Cancel Job
      </Button>
    </div>
  );
}
