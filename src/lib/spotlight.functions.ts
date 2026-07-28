import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
const input = z.object({
  submissionId: z.string().uuid(),
  status: z.enum(["pending", "needs_changes", "approved", "rejected", "featured"]),
  moderationNotes: z.string().max(2000).optional(),
  score: z.number().min(0).max(100).optional(),
  rubric: z
    .object({
      talent: z.number().int().min(0).max(100),
      originality: z.number().int().min(0).max(100),
      presentation: z.number().int().min(0).max(100),
      barangayAppeal: z.number().int().min(0).max(100),
      bookingPotential: z.number().int().min(0).max(100),
    })
    .optional(),
});
export const moderateSpotlightSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => input.parse(v))
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("Administrator access required.");
    const { data: submission, error: readError } = await supabaseAdmin
      .from("spotlight_submissions")
      .select("id,private_photo_path,public_photo_url,child_profile_id")
      .eq("id", data.submissionId)
      .single();
    if (readError) throw readError;
    if (submission.child_profile_id && (data.status === "approved" || data.status === "featured")) {
      const required: Array<
        "spotlight_participation" | "public_profile" | "public_media" | "leaderboard"
      > = ["spotlight_participation", "public_profile", "public_media"];
      if (data.status === "featured") required.push("leaderboard");
      for (const permission of required) {
        const { data: allowed, error: permissionError } = await supabaseAdmin.rpc(
          "has_minor_permission",
          { p_child: submission.child_profile_id, p_permission: permission },
        );
        if (permissionError) throw permissionError;
        if (!allowed) throw new Error(`Active guardian permission required: ${permission}.`);
      }
    }
    let publicUrl = submission.public_photo_url;
    if ((data.status === "approved" || data.status === "featured") && !publicUrl) {
      const { data: file, error: downloadError } = await supabaseAdmin.storage
        .from("spotlight-submissions")
        .download(submission.private_photo_path);
      if (downloadError) throw downloadError;
      const ext = submission.private_photo_path.split(".").pop() || "jpg",
        path = `talent/${submission.id}.${ext}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from("spotlight-media")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      publicUrl = supabaseAdmin.storage.from("spotlight-media").getPublicUrl(path).data.publicUrl;
    }
    const { error } = await supabaseAdmin
      .from("spotlight_submissions")
      .update({
        status: data.status,
        moderation_notes: data.moderationNotes || null,
        public_photo_url: publicUrl,
        featured_at: data.status === "featured" ? new Date().toISOString() : null,
      })
      .eq("id", data.submissionId);
    if (error) throw error;
    if (data.score !== undefined || data.rubric) {
      const { error: scoreError } = await (supabaseAdmin as any)
        .from("spotlight_judge_scores")
        .upsert(
          {
            submission_id: data.submissionId,
            judge_id: context.userId,
            score: data.score ?? 0,
            ...(data.rubric
              ? {
                  talent: data.rubric.talent,
                  originality: data.rubric.originality,
                  presentation: data.rubric.presentation,
                  barangay_appeal: data.rubric.barangayAppeal,
                  booking_potential: data.rubric.bookingPotential,
                }
              : {}),
          },
          { onConflict: "submission_id,judge_id" },
        );
      if (scoreError) throw scoreError;
    }
    return { ok: true };
  });
