import { render, type RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";
import { MotionProvider } from "@/components/motion/motion-provider";
import { ToastProvider } from "@/components/ui/toast";

/** Render con los providers globales (Motion + Toast). */
export function renderWithProviders(ui: ReactElement): RenderResult {
  return render(
    <MotionProvider>
      <ToastProvider>{ui}</ToastProvider>
    </MotionProvider>,
  );
}
