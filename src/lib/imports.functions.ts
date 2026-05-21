import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type ExtractedBusiness,
  buildBusinessSlug,
  detectSource,
  fetchFacebook,
  fetchGoogle,
  geminiExtract,
  persistCatalogGrowth,
  resolveBarangay,
} from "@/lib/imports.server";
import { BUSINESS_TYPES } from "@/lib/business-types";

const PreviewInput = z.object({
  url: z.string().trim().url().max(2000),
  hint: z.string().trim().max(500).optional(),
});

export const previewImport = createServerFn({ method: "POST" })
  .inputValidator((input) => PreviewInput.parse(input))
  .handler(async ({ data }) => {
    const source = detectSource(data.url);
    if (!source) {
      return { ok: false as const, error: "URL must be a Google Maps or Facebook page link." };
    }

    // Audit row first so we can record failures too
    const { data: importRow, error: insertErr } = await supabaseAdmin
      .from("business_imports")
      .insert({ source, source_url: data.url, status: "pending" })
      .select("id")
      .single();
    if (insertErr || !importRow) {
      return { ok: false as const, error: "Could not start the import. Please try again." };
    }
    const importId = importRow.id as string;

    try {
      let payload: unknown;
      let textHint = "";
      if (source === "google") {
        const r = await fetchGoogle(data.url);
        payload = r.place;
        textHint = r.rawText;
      } else {
        const r = await fetchFacebook(data.url);
        payload = r.raw;
        textHint = r.markdown;
      }

      const extracted = await geminiExtract({ source, url: data.url, hint: data.hint, payload, textHint });

      // Check for duplicates by source_external_id
      if (extracted.source_external_id) {
        const { data: dup } = await supabaseAdmin
          .from("businesses")
          .select("id, slug, name")
          .eq("imported_from", source)
          .eq("import_source_id", extracted.source_external_id)
          .maybeSingle();
        if (dup) {
          await supabaseAdmin
            .from("business_imports")
            .update({ status: "failed", error: "duplicate", extracted: extracted as unknown as Record<string, unknown> })
            .eq("id", importId);
          return {
            ok: false as const,
            error: `This place is already listed as "${dup.name}".`,
            duplicateSlug: dup.slug as string,
          };
        }
      }

      // Resolve barangay best-effort
      const barangayCode = await resolveBarangay({
        address: extracted.address,
        lat: extracted.latitude,
        lng: extracted.longitude,
      });

      await supabaseAdmin
        .from("business_imports")
        .update({
          status: "completed",
          raw_payload: payload as Record<string, unknown>,
          extracted: { ...extracted, barangay_code: barangayCode } as unknown as Record<string, unknown>,
          source_external_id: extracted.source_external_id,
        })
        .eq("id", importId);

      return {
        ok: true as const,
        importId,
        source,
        extracted: { ...extracted, barangay_code: barangayCode },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      await supabaseAdmin.from("business_imports").update({ status: "failed", error: msg }).eq("id", importId);
      return { ok: false as const, error: msg };
    }
  });

const CommitInput = z.object({
  importId: z.string().uuid(),
  publish: z.enum(["unclaimed", "mine"]),
  overrides: z.object({
    name: z.string().trim().min(2).max(120),
    description: z.string().max(2000).nullable(),
    address: z.string().max(500).nullable(),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
    contact_phone: z.string().max(40).nullable(),
    contact_email: z.string().max(120).nullable(),
    website: z.string().max(500).nullable(),
    hours: z.string().max(500).nullable(),
    type: z.enum(BUSINESS_TYPES),
    additional_types: z.array(z.enum(BUSINESS_TYPES)).max(8),
    custom_types: z.array(z.string().min(2).max(40)).max(8),
    tags: z.array(z.string().min(1).max(40)).max(40),
    barangay_code: z.string().min(1),
    cover_image_url: z.string().max(2000).nullable(),
  }),
});

export const commitImport = createServerFn({ method: "POST" })
  .inputValidator((input) => CommitInput.parse(input))
  .handler(async ({ data }) => {
    const { data: imp } = await supabaseAdmin
      .from("business_imports")
      .select("id, source, source_external_id, extracted")
      .eq("id", data.importId)
      .single();
    if (!imp) return { ok: false as const, error: "Import not found." };

    let ownerId: string | null = null;
    if (data.publish === "mine") {
      // We need an auth context for this branch — read from session via auth middleware-less approach
      // Get auth via supabase admin user lookup using the bearer token from cookies isn't available here,
      // so we delegate to a separate authenticated server function instead.
      return { ok: false as const, error: "Use commitImportAsMine for claimed publishing." };
    }

    const o = data.overrides;
    const slug = buildBusinessSlug(o.name);
    const additional_types = o.additional_types.filter((t) => t !== o.type);
    const insertRow = {
      name: o.name,
      slug,
      type: o.type,
      additional_types,
      custom_types: o.custom_types,
      tags: o.tags,
      description: o.description ?? null,
      address: o.address ?? null,
      latitude: o.latitude,
      longitude: o.longitude,
      contact_phone: o.contact_phone,
      contact_email: o.contact_email,
      website: o.website,
      hours: o.hours,
      barangay_code: o.barangay_code,
      cover_image_url: o.cover_image_url,
      owner_id: ownerId,
      is_published: true,
      is_claimed: false,
      imported_from: imp.source,
      import_source_id: imp.source_external_id,
    };

    const { data: biz, error: bizErr } = await supabaseAdmin
      .from("businesses")
      .insert(insertRow)
      .select("id, slug")
      .single();
    if (bizErr || !biz) {
      return { ok: false as const, error: bizErr?.message ?? "Could not create business." };
    }

    await persistCatalogGrowth({
      tags: o.tags.map((s) => ({ slug: s, label: s })),
      custom_types: o.custom_types,
    } as ExtractedBusiness);

    await supabaseAdmin
      .from("business_imports")
      .update({ created_business_id: biz.id })
      .eq("id", data.importId);

    return { ok: true as const, businessId: biz.id as string, slug: biz.slug as string };
  });

export const commitImportAsMine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CommitInput.omit({ publish: true }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: imp } = await supabaseAdmin
      .from("business_imports")
      .select("id, source, source_external_id")
      .eq("id", data.importId)
      .single();
    if (!imp) return { ok: false as const, error: "Import not found." };

    const o = data.overrides;
    const slug = buildBusinessSlug(o.name);
    const additional_types = o.additional_types.filter((t) => t !== o.type);

    const { data: biz, error } = await supabaseAdmin
      .from("businesses")
      .insert({
        name: o.name,
        slug,
        type: o.type,
        additional_types,
        custom_types: o.custom_types,
        tags: o.tags,
        description: o.description,
        address: o.address,
        latitude: o.latitude,
        longitude: o.longitude,
        contact_phone: o.contact_phone,
        contact_email: o.contact_email,
        website: o.website,
        hours: o.hours,
        barangay_code: o.barangay_code,
        cover_image_url: o.cover_image_url,
        owner_id: context.userId,
        is_published: true,
        is_claimed: true,
        imported_from: imp.source,
        import_source_id: imp.source_external_id,
      })
      .select("id, slug")
      .single();
    if (error || !biz) return { ok: false as const, error: error?.message ?? "Could not create business." };

    await persistCatalogGrowth({
      tags: o.tags.map((s) => ({ slug: s, label: s })),
      custom_types: o.custom_types,
    } as ExtractedBusiness);

    await supabaseAdmin
      .from("business_imports")
      .update({ created_business_id: biz.id, created_by: context.userId })
      .eq("id", data.importId);

    return { ok: true as const, businessId: biz.id as string, slug: biz.slug as string };
  });

const ClaimInput = z.object({
  businessId: z.string().uuid(),
  message: z.string().max(1000).optional(),
});

export const requestClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ClaimInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin.from("claim_requests").insert({
      business_id: data.businessId,
      user_id: context.userId,
      message: data.message ?? null,
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });
