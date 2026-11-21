import { Suspense } from "react";
import { ItemFlow } from "@/components/ItemFlow";

export default function FoundPage() {
  return (
    <Suspense>
      <ItemFlow type="found" />
    </Suspense>
  );
}
