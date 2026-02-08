import { useState, useEffect, useCallback } from "react";
import type { ModelInfo } from "../types";

const STORAGE_KEY = "pi-swarm-model";
const PREFERRED_MODEL = "claude-sonnet-4-20250514";

export function useModelSelection(models: ModelInfo[]) {
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) || "";
  });

  useEffect(() => {
    if (models.length > 0 && !selectedModel) {
      const preferred = models.find((m) => m.modelId === PREFERRED_MODEL);
      const defaultModel = preferred
        ? `${preferred.provider}/${preferred.modelId}`
        : `${models[0].provider}/${models[0].modelId}`;
      setSelectedModel(defaultModel);
      localStorage.setItem(STORAGE_KEY, defaultModel);
    }
  }, [models, selectedModel]);

  const handleModelChange = useCallback((model: string) => {
    setSelectedModel(model);
    localStorage.setItem(STORAGE_KEY, model);
  }, []);

  return { selectedModel, handleModelChange };
}
