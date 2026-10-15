import { eq } from "drizzle-orm";
import { db, password } from "@/framework/facade.js";
import { users } from "@/modules/auth/database/models/user.js";

export const table = users;

export default async function UserSeeder() {
  const rows: {
    name: string;
    email: string;
    password: string;
    role: "admin" | "user";
  }[] = [
    {
      name: "Admin",
      email: "admin@example.com",
      password: await password.hashPassword("Password@123"),
      role: "admin"
    },
    {
      name: "User One",
      email: "user1@example.com",
      password: await password.hashPassword("Password@123"),
      role: "user"
    }
  ];

  for (const row of rows) {
    const existing = await db.query.users.findFirst({ where: eq(users.email, row.email) });
    if (!existing) {
      await db.insert(users).values(row);
    }
  }

  console.log("User seeder completed");
}
