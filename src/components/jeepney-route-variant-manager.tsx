/* eslint-disable @typescript-eslint/no-explicit-any -- route-variant tables are migration-backed ahead of generated Supabase types. */
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownUp, CheckCircle2, CircleStop, MapPinned, RadioTower, Save, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  TRACK_MAX_ACCURACY_M,
  TRACK_MIN_METRES,
  haversineKm,
  parsePath,
  simplifyPath,
  type LatLng,
} from "@/lib/jeepney";
import {
  directionLabel,
  parseRouteVariant,
  type JeepneyRouteVariant,
} from "@/lib/jeepney-variants";

const VariantPathEditor = lazy(() => import("@/components/jeepney-variant-path-editor"));

type ManagedStop = {
  id: string;
  name: string;
  position: number;
  latitude: number;
  longitude: number;
};

type ManagedRoute = {
  id: string;
  name: string;
  code: string | null;
  status: string;
  colour: string;
  path: LatLng[];
  stops: ManagedStop[];
};

export function JeepneyRouteVariantManager({
  operatorId,
  onChanged,
}: {
  operatorId: string;
  onChanged?: () => void | Promise<void>;
}) {
  const [routes, setRoutes] = useState<ManagedRoute[]>([]);
  const [variants, setVariants] = useState<JeepneyRouteVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [editPath, setEditPath] = useState<LatLng[]>([]);
  const [recordingVariantId, setRecordingVariantId] = useState<string | null>(null);
  const watchRef = useRef<number | null>(null);
  const recordingPathRef = useRef<LatLng[]>([]);

  const routeById = useMemo(() => new Map(routes.map((route) => [route.id, route])), [routes]);
  const editingVariant = useMemo(
    () => variants.find((variant) => variant.id === editingVariantId) ?? null,
    [variants, editingVariantId],
  );
  const editingRoute = editingVariant ? routeById.get(editingVariant.route_id) ?? null : null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: routeRows, error: routeError } = await (supabase as any)
        .from("jeepney_routes")
        .select("id,name,code,status,colour,path,jeepney_stops(id,name,position,latitude,longitude)")
        .eq("operator_id", operatorId)
        .order("name", { ascending: true });
      if (routeError) throw routeError;

      const parsedRoutes: ManagedRoute[] = (routeRows ?? []).map((route: any) => ({
        id: route.id,
        name: route.name,
        code: route.code ?? null,
        status: route.status,
        colour: route.colour || "#1465ff",
        path: parsePath(route.path),
        stops: (route.jeepney_stops ?? [])
          .slice()
          .sort((a: ManagedStop, b: ManagedStop) => a.position - b.position)
          .map((stop: any) => ({
            id: stop.id,
            name: stop.name,
            position: Number(stop.position),
            latitude: Number(stop.latitude),
            longitude: Number(stop.longitude),
          })),
      }));
      setRoutes(parsedRoutes);

      const ids = parsedRoutes.map((route) => route.id);
      if (!ids.length) {
        setVariants([]);
        return;
      }
      const { data: variantRows, error: variantError } = await (supabase as any)
        .from("jeepney_route_variants")
        .select("id,route_id,code,name,direction,path,is_default,active")
        .in("route_id", ids)
        .order("created_at", { ascending: true });
      if (variantError) throw variantError;
      setVariants((variantRows ?? []).map(parseRouteVariant));
    } catch (error) {
      console.error("Route direction manager load failed", error);
      toast.error("Route directions are unavailable until the Phase 4 migration is applied.");
    } finally {
      setLoading(false);
    }
  }, [operatorId]);

  useEffect(() => {
    void load();
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, [load]);

  function beginEdit(variant: JeepneyRouteVariant) {
    if (variant.is_default) {
      toast.info("Edit the primary/outbound path in the normal route editor.");
      return;
    }
    if (variant.active) {
      toast.info("Deactivate this direction before changing its geometry.");
      return;
    }
    setEditingVariantId(variant.id);
    setEditPath(variant.path.slice());
  }

  async function createInbound(route: ManagedRoute) {
    const existing = variants.find(
      (variant) => variant.route_id === route.id && variant.direction === "inbound",
    );
    if (existing) {
      beginEdit(existing);
      toast.info("This route already has an inbound/return direction.");
      return;
    }

    if (route.path.length < 2) {
      toast.error("Draw the primary route first before creating its return direction.");
      return;
    }

    setBusy(route.id);
    const starterPath = route.path.slice().reverse();
    const { data: created, error } = await (supabase as any)
      .from("jeepney_route_variants")
      .insert({
        route_id: route.id,
        code: "inbound",
        name: "Return / inbound",
        direction: "inbound",
        path: starterPath,
        is_default: false,
        active: false,
      })
      .select("id,route_id,code,name,direction,path,is_default,active")
      .maybeSingle();

    if (error || !created) {
      setBusy(null);
      toast.error("Could not create the return-direction draft.");
      return;
    }

    const reverseStops = route.stops
      .slice()
      .sort((a, b) => b.position - a.position)
      .map((stop, index) => ({ variant_id: created.id, stop_id: stop.id, position: index }));
    if (reverseStops.length) {
      const { error: stopError } = await (supabase as any)
        .from("jeepney_route_variant_stops")
        .insert(reverseStops);
      if (stopError) {
        await (supabase as any).from("jeepney_route_variants").delete().eq("id", created.id);
        setBusy(null);
        toast.error("Could not build the return stop order; the draft was rolled back.");
        return;
      }
    }

    setBusy(null);
    const parsed = parseRouteVariant(created);
    setVariants((current) => [...current, parsed]);
    setEditingVariantId(parsed.id);
    setEditPath(parsed.path.slice());
    toast.success(
      "Inactive return-direction draft created. The reversed outbound line is only a starter—review, correct or GPS-record it before activation.",
    );
    await onChanged?.();
  }

  async function savePath() {
    if (!editingVariant || editingVariant.is_default || editingVariant.active) return;
    if (editPath.length < 2) {
      toast.error("A route direction needs at least two path points.");
      return;
    }
    setBusy(editingVariant.id);
    const { error } = await (supabase as any)
      .from("jeepney_route_variants")
      .update({ path: editPath })
      .eq("id", editingVariant.id)
      .eq("active", false);
    setBusy(null);
    if (error) {
      toast.error("Could not save the return geometry.");
      return;
    }
    toast.success("Return-direction geometry saved. Review it before activation.");
    await load();
    await onChanged?.();
  }

  async function setActive(variant: JeepneyRouteVariant, active: boolean) {
    const path = variant.id === editingVariantId ? editPath : variant.path;
    if (active && path.length < 2) {
      toast.error("Review or record this direction before activation.");
      return;
    }
    if (active) {
      const confirmed = window.confirm(
        "Activate this travel direction for live dispatch? Confirm the path and stop order have been reviewed for the real road direction.",
      );
      if (!confirmed) return;
    }

    setBusy(variant.id);
    const { error } = await (supabase as any)
      .from("jeepney_route_variants")
      .update({ ...(active ? { path } : {}), active })
      .eq("id", variant.id);
    setBusy(null);
    if (error) {
      toast.error(
        active
          ? "Could not activate this direction. Check the geometry and active trips."
          : "Could not deactivate this direction. End all active trips using it first.",
      );
      return;
    }
    toast.success(active ? "Direction activated for dispatch." : "Direction deactivated.");
    if (active) setEditingVariantId(null);
    await load();
    await onChanged?.();
  }

  async function removeVariant(variant: JeepneyRouteVariant) {
    if (variant.is_default || variant.active) return;
    if (!window.confirm(`Delete ${variant.name}?`)) return;
    setBusy(variant.id);
    const { error } = await (supabase as any)
      .from("jeepney_route_variants")
      .delete()
      .eq("id", variant.id);
    setBusy(null);
    if (error) {
      toast.error("Could not delete this direction. End any trips using it first.");
      return;
    }
    if (editingVariantId === variant.id) setEditingVariantId(null);
    toast.success("Route direction deleted.");
    await load();
    await onChanged?.();
  }

  function useReversedStarter() {
    if (!editingRoute) return;
    setEditPath(editingRoute.path.slice().reverse());
    toast.info("Reversed outbound starter loaded. It is not saved or activated yet.");
  }

  function startRecording() {
    if (!editingVariant || editingVariant.active) return;
    if (!("geolocation" in navigator)) {
      toast.error("This device does not support GPS recording.");
      return;
    }
    if (!window.confirm("Start a fresh GPS trace for this return direction? The current unsaved editor path will be replaced.")) return;

    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    recordingPathRef.current = [];
    setEditPath([]);
    setRecordingVariantId(editingVariant.id);

    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        if (position.coords.accuracy > TRACK_MAX_ACCURACY_M) return;
        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        const current = recordingPathRef.current;
        const last = current[current.length - 1];
        if (last && haversineKm(last, point) * 1000 < TRACK_MIN_METRES) return;
        const next = [...current, point];
        recordingPathRef.current = next;
        setEditPath(next);
      },
      (error) => {
        toast.error(error.code === error.PERMISSION_DENIED ? "Location permission denied." : "Could not record GPS route.");
        stopRecording();
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    );
    toast.success("Recording return route. Travel the real inbound path, then finish recording.");
  }

  function stopRecording() {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    const simplified = simplifyPath(recordingPathRef.current);
    recordingPathRef.current = [];
    setRecordingVariantId(null);
    if (simplified.length >= 2) {
      setEditPath(simplified);
      toast.success("GPS trace captured. Review the line, then save and activate when correct.");
    }
  }

  if (loading && !routes.length) return null;

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b bg-blue-50/60 px-4 py-3">
        <p className="flex items-center gap-2 font-semibold">
          <ArrowDownUp className="h-4 w-4 text-blue-600" /> Route directions
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Primary/outbound remains tied to the normal route editor. Return directions stay inactive until their real geometry is reviewed.
        </p>
      </div>

      <div className="divide-y">
        {routes.map((route) => {
          const routeVariants = variants.filter((variant) => variant.route_id === route.id);
          const hasInbound = routeVariants.some((variant) => variant.direction === "inbound");
          return (
            <div key={route.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{route.code ? `${route.code} · ` : ""}{route.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {routeVariants.map((variant) => (
                      <Badge key={variant.id} variant={variant.active ? "secondary" : "outline"} className="text-[10px]">
                        {directionLabel(variant.direction)} · {variant.active ? "active" : "review needed"}
                      </Badge>
                    ))}
                  </div>
                </div>
                {!hasInbound ? (
                  <Button size="sm" variant="outline" disabled={busy === route.id} onClick={() => void createInbound(route)}>
                    <ArrowDownUp className="mr-1.5 h-4 w-4" /> {busy === route.id ? "Creating…" : "Add return direction"}
                  </Button>
                ) : null}
              </div>

              <div className="mt-3 space-y-2">
                {routeVariants.map((variant) => (
                  <div key={variant.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{variant.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {directionLabel(variant.direction)} · {variant.path.length} path points
                        {variant.is_default ? " · managed in route editor" : variant.active ? " · available to dispatch" : " · inactive until reviewed"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!variant.is_default && !variant.active ? (
                        <Button size="sm" variant="outline" onClick={() => beginEdit(variant)} disabled={busy === variant.id}>
                          <MapPinned className="mr-1.5 h-4 w-4" /> Review path
                        </Button>
                      ) : null}
                      {!variant.is_default && !variant.active ? (
                        <Button size="sm" onClick={() => void setActive(variant, true)} disabled={busy === variant.id}>
                          <CheckCircle2 className="mr-1.5 h-4 w-4" /> Activate
                        </Button>
                      ) : null}
                      {!variant.is_default && variant.active ? (
                        <Button size="sm" variant="outline" onClick={() => void setActive(variant, false)} disabled={busy === variant.id}>
                          <CircleStop className="mr-1.5 h-4 w-4" /> Deactivate
                        </Button>
                      ) : null}
                      {!variant.is_default && !variant.active ? (
                        <Button size="sm" variant="ghost" onClick={() => void removeVariant(variant)} disabled={busy === variant.id}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {editingVariant && editingRoute && !editingVariant.active ? (
        <div className="border-t bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold">Review {editingRoute.name} · {directionLabel(editingVariant.direction)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Correct the starter line by clicking points, or record the real return journey with phone GPS. Nothing becomes live until you activate it.
              </p>
            </div>
            <Badge variant="outline">{editPath.length} points</Badge>
          </div>

          <div className="mt-3">
            <ClientOnly fallback={<div className="h-[320px] rounded-xl border bg-white" />}>
              <Suspense fallback={<div className="h-[320px] rounded-xl border bg-white" />}>
                <VariantPathEditor
                  canonicalPath={editingRoute.path}
                  path={editPath}
                  colour={editingRoute.colour}
                  stops={editingRoute.stops.map((stop) => ({
                    name: stop.name,
                    lat: stop.latitude,
                    lng: stop.longitude,
                  }))}
                  onPathChange={setEditPath}
                />
              </Suspense>
            </ClientOnly>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={useReversedStarter} disabled={Boolean(recordingVariantId)}>
              <ArrowDownUp className="mr-1.5 h-4 w-4" /> Reversed outbound starter
            </Button>
            <Button
              size="sm"
              variant={recordingVariantId ? "destructive" : "outline"}
              onClick={recordingVariantId ? stopRecording : startRecording}
            >
              <RadioTower className="mr-1.5 h-4 w-4" /> {recordingVariantId ? "Finish GPS recording" : "Record real return path"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditPath((current) => current.slice(0, -1))} disabled={!editPath.length || Boolean(recordingVariantId)}>
              <Undo2 className="mr-1.5 h-4 w-4" /> Undo point
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditPath([])} disabled={!editPath.length || Boolean(recordingVariantId)}>
              Clear
            </Button>
            <Button size="sm" onClick={() => void savePath()} disabled={busy === editingVariant.id || editPath.length < 2 || Boolean(recordingVariantId)}>
              <Save className="mr-1.5 h-4 w-4" /> {busy === editingVariant.id ? "Saving…" : "Save geometry"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingVariantId(null)} disabled={Boolean(recordingVariantId)}>
              Close editor
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
