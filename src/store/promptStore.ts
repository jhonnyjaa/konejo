import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Prompt } from "@/types";
import { promptService } from "@/services/mock";

interface PromptState {
  prompts: Prompt[];
  loaded: boolean;
  load: () => Promise<void>;
  create: (p: Omit<Prompt, "id" | "created_at">) => Promise<void>;
  update: (id: string, patch: Partial<Prompt>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  markUsed: (id: string) => Promise<void>;
}

export const usePromptStore = create<PromptState>()(
  immer((set) => ({
    prompts: [],
    loaded: false,
    load: async () => {
      const prompts = await promptService.getAll();
      set((s) => { s.prompts = prompts; s.loaded = true; });
    },
    create: async (p) => {
      const created = await promptService.create(p);
      set((s) => { s.prompts.unshift(created); });
    },
    update: async (id, patch) => {
      await promptService.update(id, patch);
      set((s) => {
        const idx = s.prompts.findIndex((p) => p.id === id);
        if (idx !== -1) Object.assign(s.prompts[idx], patch);
      });
    },
    remove: async (id) => {
      await promptService.delete(id);
      set((s) => { s.prompts = s.prompts.filter((p) => p.id !== id); });
    },
    markUsed: async (id) => {
      await promptService.markUsed(id);
      set((s) => {
        const p = s.prompts.find((x) => x.id === id);
        if (p) p.used_at = Date.now() / 1000;
      });
    },
  }))
);
