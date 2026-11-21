import { Suspense } from "react";
import { ItemFlow } from "@/components/ItemFlow";

export default function LostPage() {
  return (
    <Suspense>
      <ItemFlow type="lost" />
    </Suspense>
  );
}
