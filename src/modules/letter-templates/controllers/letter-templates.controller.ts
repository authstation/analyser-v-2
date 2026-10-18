import type { Handler } from "hono";
import { db } from "@/framework/facade.js";
import { eq, desc, and } from "drizzle-orm";
import { letterTemplates, userLetterDrafts } from "@/modules/letter-templates/database/models/letter-templates.js";

/**
 * Seed initial default template if none exists.
 */
async function ensureDefaultTemplate() {
  const existing = await db.select().from(letterTemplates).limit(1);
  if (existing.length === 0) {
    const defaultBodyHtml = `উপযুক্ত বিষয়ের প্রেক্ষিতে আপনার অবগতির জন্য জানানো যাচ্ছে যে, মূল্য সংযোজন কর ও সম্পূরক শুল্ক আইন, ২০১২ এর ধারা ৪, ৬, ১৬, ৫১, ৬৪ ও ১০৭ এবং সাধারণ আদেশ-১৭/মূসক/২০১৯, তাং ১৭/০৭/২০১৯ খ্রি. অনুযায়ী হিসাব সংরক্ষণ, কর চালানপত্র ইস্যুকরণ এবং প্রতি মাসের ০১-১৫ তারিখের মধ্যে পূর্ববর্তী মাসের প্রদেয় ভ্যাট ট্রেজারী চালানের মাধ্যমে সরকারী কোষাগারে জমাদানপূর্বক অনলাইনে রিটার্ন দাখিল করার বাধ্যবাধকতা রয়েছে।

০২। e-VAT সিস্টেমে সংরক্ষিত তথ্যাদি পর্যালোচনায় দেখা যায় যে, আপনার প্রতিষ্ঠানটি {{reg_month_year}} কর মেয়াদ হতে মূসক নিবন্ধিত। নিবন্ধন গ্রহণের পর {{non_filed_months_count}}টি কর মেয়াদ অতিক্রান্ত হলেও অদ্যাবধি আপনার প্রতিষ্ঠানের বিপরীতে প্রদেয় মূসক পরিশোধ এবং অনলাইনে রিটার্ন দাখিলের কোনো তথ্য পাওয়া যায়নি। এ ধরনের ব্যর্থতা বিদ্যমান মূসক আইন, ২০১২-এর ধারা ৮৫ অনুযায়ী শাস্তিযোগ্য এবং এ ক্ষেত্রে প্রযোজ্য বিধান অনুসারে বকেয়া মূসক, সুদ ও জরিমানা আদায়যোগ্য।

০৩। উল্লেখ্য, সংশ্লিষ্ট কর মেয়াদের রিটার্ন দাখিলের সময়সীমা আগামী [তারিখ লিখুন] খ্রি. তারিখ পর্যন্ত বর্ধিত করা হয়েছে। অতএব, উক্ত কর মেয়াদের রিটার্ন বর্ধিত সময়সীমা অর্থাৎ [তারিখ লিখুন] খ্রি. তারিখের মধ্যে অনলাইনে দাখিল নিশ্চিত করার জন্য অনুরোধ করা হলো।

০৪। এছাড়াও, গণপ্রজাতন্ত্রী বাংলাদেশ সরকারের আইন, বিচার ও সংসদ বিষয়ক মন্ত্রণালয় কর্তৃক জারীকৃত সূত্রীয় অধ্যাদেশের বিধান অনুযায়ী, প্রত্যেক নিবন্ধিত বা তালিকাভুক্ত ব্যক্তির জন্য বোর্ড কর্তৃক নির্ধারিত পদ্ধতিতে সংশ্লিষ্ট কর মেয়াদ সমাপ্তির অনধিক ১৫ (পনেরো) দিনের মধ্যে রিটার্ন দাখিল করা বাধ্যতামূলক। উক্ত বাধ্যবাধকতা প্রতিপালনে ব্যর্থ হলে প্রচলিত আইন ও বিধি অনুযায়ী প্রয়োজনীয় আইনানুগ ব্যবস্থা গ্রহণ করা হবে।

০৫। জাতীয় রাজস্ব আহরণের স্বার্থে বিষয়টি অতীব জরুরী বিবেচ্য।`;

    await db.insert(letterTemplates).values({
      title: "প্রদেয় ভ্যাট পরিশোধপূর্বক রিটার্ন দাখিলকরণ পত্র (স্ট্যান্ডার্ড ফরম্যাট)",
      category: "non-filer-notice",
      description: "মূসক নিবন্ধন গ্রহণের পর নির্ধারিত মেয়াদে রিটার্ন দাখিল না করায় আইনানুগ ব্যবস্থা ও দাখিলের অনুরোধ সংবলিত পত্র।",
      subject: "প্রদেয় ভ্যাট পরিশোধপূর্বক রিটার্ন দাখিলকরণ।",
      reference: "মূল্য সংযোজন কর ও সম্পূরক শুল্ক (সংশোধন) অধ্যাদেশ, ২০২৬ (অধ্যাদেশ নং ৩৮, ২০২৬), তারিখ: ১৪ অক্টোবর, ২০২৬।",
      bodyHtml: defaultBodyHtml,
      signatoryTitle: "(শেখ শাহির আহমেদ)",
      signatorySubtitle: "সহকারী কমিশনার ও বিভাগীয় কর্মকর্তা",
      ccItems: ["সদয় অবগতির জন্যঃ কমিশনার, কাস্টমস, এক্সাইজ ও ভ্যাট কমিশনারেট, কুমিল্লা।"],
      isActive: true
    });
  }
}

/**
 * GET /api/letter-templates
 */
export const index: Handler = async (c: any) => {
  await ensureDefaultTemplate();
  const list = await db.select().from(letterTemplates).orderBy(desc(letterTemplates.id));
  return c.json({ data: list });
};

/**
 * GET /api/letter-templates/:id
 */
export const show: Handler = async (c: any) => {
  const id = Number(c.req.param("id"));
  const row = await db.select().from(letterTemplates).where(eq(letterTemplates.id, id)).limit(1);
  if (!row || row.length === 0) {
    return c.json({ error: "Template not found" }, 404);
  }
  return c.json({ data: row[0] });
};

/**
 * POST /api/letter-templates
 */
export const store: Handler = async (c: any) => {
  const body = c.req.valid("json");
  const inserted = await db.insert(letterTemplates).values(body).returning();
  return c.json({ message: "Template created successfully", data: inserted[0] }, 201);
};

/**
 * PUT /api/letter-templates/:id
 */
export const update: Handler = async (c: any) => {
  const id = Number(c.req.param("id"));
  const body = c.req.valid("json");
  const updated = await db
    .update(letterTemplates)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(letterTemplates.id, id))
    .returning();
  return c.json({ message: "Template updated successfully", data: updated[0] });
};

/**
 * DELETE /api/letter-templates/:id
 */
export const destroy: Handler = async (c: any) => {
  const id = Number(c.req.param("id"));
  await db.delete(letterTemplates).where(eq(letterTemplates.id, id));
  return c.json({ message: "Template deleted successfully" });
};

/**
 * GET /api/letter-templates/draft (Get user draft by BIN or template)
 */
export const getDraft: Handler = async (c: any) => {
  const user = c.get("auth");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const bin = c.req.query("bin");
  const templateId = c.req.query("templateId");

  const conditions: any[] = [eq(userLetterDrafts.userId, user.sub ?? user.id)];
  if (bin) conditions.push(eq(userLetterDrafts.entityBin, bin));
  if (templateId) conditions.push(eq(userLetterDrafts.templateId, Number(templateId)));

  const drafts = await db
    .select()
    .from(userLetterDrafts)
    .where(and(...conditions))
    .orderBy(desc(userLetterDrafts.updatedAt))
    .limit(1);

  return c.json({ data: drafts[0] || null });
};

/**
 * POST /api/letter-templates/draft (Save or update draft)
 */
export const saveDraft: Handler = async (c: any) => {
  const user = c.get("auth");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const body = c.req.valid("json");
  const userId = user.sub ?? user.id;

  // Check if draft already exists for this user and BIN
  let existing = null;
  if (body.entityBin) {
    const rows = await db
      .select()
      .from(userLetterDrafts)
      .where(and(eq(userLetterDrafts.userId, userId), eq(userLetterDrafts.entityBin, body.entityBin)))
      .limit(1);
    existing = rows[0];
  }

  if (existing) {
    const updated = await db
      .update(userLetterDrafts)
      .set({
        templateId: body.templateId || existing.templateId,
        customData: body.customData,
        updatedAt: new Date()
      })
      .where(eq(userLetterDrafts.id, existing.id))
      .returning();
    return c.json({ message: "Draft updated successfully", data: updated[0] });
  }

  const inserted = await db
    .insert(userLetterDrafts)
    .values({
      userId,
      templateId: body.templateId || null,
      entityBin: body.entityBin || null,
      customData: body.customData
    })
    .returning();

  return c.json({ message: "Draft saved successfully", data: inserted[0] });
};
