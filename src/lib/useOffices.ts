"use client";

import { useEffect, useState } from "react";
import { OFFICES } from "./offices";
import { listOffices } from "./store";
import type { Office } from "./types";

export function useOffices(): Office[] {
  const [offices, setOffices] = useState<Office[]>(OFFICES);
  useEffect(() => {
    listOffices().then(setOffices).catch(() => {});
  }, []);
  return offices;
}
