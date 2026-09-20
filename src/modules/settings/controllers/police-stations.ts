import type { Handler } from "hono";
import { db } from "@/framework/facade.js";
import { policeStations } from "@/modules/settings/database/models/settings.js";

export const getPoliceStations: Handler = async (c) => {
  try {
    const data = await db.select({
      id: policeStations.id,
      name: policeStations.name,
      circleId: policeStations.circleId,
      divisionId: policeStations.divisionId,
      circle_id: policeStations.circleId,
      division_id: policeStations.divisionId
    })
    .from(policeStations)
    .orderBy(policeStations.name);
    return c.json({ data });
  } catch (error) {
    return c.json({ error: 'Failed to fetch police stations' }, 500);
  }
};
