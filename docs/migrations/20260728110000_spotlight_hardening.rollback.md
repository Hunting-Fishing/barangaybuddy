# Spotlight hardening rollback

Archive moderation and scoring records first. Drop `spotlight_peoples_choice`, the booking/vote functions, the rubric trigger/function, and the admin vote-update policy. Recreate the earlier leaderboard definition before removing rubric and invalidation columns. PostgreSQL enum values cannot be safely removed in place; retain the additional booking values or recreate the enum during a maintenance window.
