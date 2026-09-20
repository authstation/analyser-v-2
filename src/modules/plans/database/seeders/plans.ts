import { eq } from "drizzle-orm";
import { db } from "@/framework/facade.js";
import { plans } from "@/modules/plans/database/models/plans.js";

export const table = plans;

export default async function PlansSeeder() {
  const defaultPlans = [
    {
      name: "Basic Plan",
      price: 500,
      durationDays: 30,
      maxCircles: 1,
      isActive: true
    },
    {
      name: "Standard Plan",
      price: 1000,
      durationDays: 30,
      maxCircles: 3,
      isActive: true
    },
    {
      name: "Premium Plan",
      price: 2000,
      durationDays: 30,
      maxCircles: 9999,
      isActive: true
    }
  ];

  for (const row of defaultPlans) {
    const existing = await db.query.plans.findFirst({
      where: eq(plans.name, row.name)
    });
    if (!existing) {
      await db.insert(plans).values(row);
    }
  }

  console.log("Plans seeder completed");
}