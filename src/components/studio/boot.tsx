import { useEffect } from "react";
import { aiStatus } from "@/lib/studio/ai";
import { useStudio } from "@/lib/studio/store";

export function StudioBoot() {
  const hydrate = useStudio((state) => state.hydrate);
  const setAiAvailable = useStudio((state) => state.setAiAvailable);

  useEffect(() => {
    void hydrate();
    void aiStatus()
      .then((status) => setAiAvailable(status.available))
      .catch(() => setAiAvailable(false));
  }, [hydrate, setAiAvailable]);

  return null;
}
