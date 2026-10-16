import "server-only";
import { getHealthModelFull } from "./health-models";
import { healthHistory, insightsData, latestHealthByTeam } from "./insights";
import type { HealthInsights } from "@/components/insights/insights-view";

export async function loadInsights(teamIds: string[], sp: Record<string, string | string[] | undefined>) {
  const range = typeof sp.range === "string" ? sp.range : "90";
  const from = range === "all" ? new Date(0) : new Date(Date.now() - Number(range) * 86400000);
  const data = await insightsData({ teamIds, from, to: new Date() });
  const models = (await Promise.all(data.healthModels.map((id) => getHealthModelFull(id)))).filter(Boolean).map((m) => ({ id: m!.id, name: m!.name, min: m!.minRating, max: m!.maxRating }));
  const selected = (typeof sp.model === "string" && models.some((m) => m.id === sp.model) ? sp.model : models[0]?.id) ?? null;
  const health: HealthInsights = {
    models,
    selected,
    latest: selected ? await latestHealthByTeam(teamIds, selected) : null,
    history: selected ? await healthHistory(teamIds, selected) : null,
  };
  return { data, health, range };
}
