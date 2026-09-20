import type { Handler } from "hono";
import { db } from "@/framework/facade.js";
import { penaltyRules } from "@/modules/settings/database/models/settings.js";
import { eq } from "drizzle-orm";

export const getPenalties: Handler = async (c) => {
  try {
    const data = await db.query.penaltyRules.findMany({
      orderBy: (rules, { asc }) => [asc(rules.effectiveDate)]
    });
    return c.json({ data });
  } catch (error) {
    return c.json({ error: 'Failed to fetch penalty rules' }, 500);
  }
};

export const createPenalty: Handler = async (c) => {
  try {
    const { amount, effectiveDate } = await c.req.json();
    if (amount === undefined || !effectiveDate) return c.json({ error: 'Amount and effective date are required' }, 400);

    const newRule = await db.insert(penaltyRules).values({ amount: Number(amount), effectiveDate: new Date(effectiveDate) }).returning();
    return c.json({ data: newRule[0], message: 'Penalty rule created' }, 201);
  } catch (error) {
    return c.json({ error: 'Failed to create penalty rule' }, 500);
  }
};

export const updatePenalty: Handler = async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const { amount, effectiveDate } = await c.req.json();
    if (amount === undefined || !effectiveDate) return c.json({ error: 'Amount and effective date are required' }, 400);

    const updated = await db.update(penaltyRules).set({ amount: Number(amount), effectiveDate: new Date(effectiveDate) }).where(eq(penaltyRules.id, id)).returning();
    if (updated.length === 0) return c.json({ error: 'Penalty rule not found' }, 404);

    return c.json({ data: updated[0], message: 'Penalty rule updated' });
  } catch (error) {
    return c.json({ error: 'Failed to update penalty rule' }, 500);
  }
};

export const deletePenalty: Handler = async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const deleted = await db.delete(penaltyRules).where(eq(penaltyRules.id, id)).returning();
    if (deleted.length === 0) return c.json({ error: 'Penalty rule not found' }, 404);

    return c.json({ message: 'Penalty rule deleted' });
  } catch (error) {
    return c.json({ error: 'Failed to delete penalty rule' }, 500);
  }
};
