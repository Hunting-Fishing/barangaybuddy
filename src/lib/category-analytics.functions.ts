import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type RpcError = { message: string };
type RpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: RpcError | null }>;
};

const rpcClient = supabaseAdmin as unknown as RpcClient;

const CategoryEventInput = z.object({
  groupId: z.string().trim().min(1).max(80),
  itemId: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(120),
  action: z.enum(["category_view", "type_search"]),
});

const CategorySuggestionInput = z.object({
  groupId: z.string().trim().min(1).max(80),
  groupLabel: z.string().trim().min(1).max(120),
  suggestion: z.string().trim().min(2).max(80),
  note: z.string().trim().max(500).optional(),
});

function normalizeSuggestion(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s&\-'./+]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

export const recordCategoryEvent = createServerFn({ method: "POST" })
  .inputValidator((input) => CategoryEventInput.parse(input))
  .handler(async ({ data }) => {
    const { error } = await rpcClient.rpc("increment_business_category_interaction", {
      p_group_id: data.groupId,
      p_item_id: data.itemId,
      p_label: data.label,
      p_action: data.action,
    });

    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const submitCategorySuggestion = createServerFn({ method: "POST" })
  .inputValidator((input) => CategorySuggestionInput.parse(input))
  .handler(async ({ data }) => {
    const normalized = normalizeSuggestion(data.suggestion);

    if (normalized.length < 2) {
      return { ok: false as const, error: "Suggestion is too short." };
    }

    const { error } = await rpcClient.rpc("upsert_business_category_suggestion", {
      p_group_id: data.groupId,
      p_group_label: data.groupLabel,
      p_suggestion: data.suggestion,
      p_normalized_suggestion: normalized,
      p_note: data.note ?? null,
    });

    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });
