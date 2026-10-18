import { createRoute, group, HttpStatusCodes, jsonContent, z } from "@/framework/facade.js";
import { authMiddleware } from "@/middlewares/auth-middleware.js";
import {
  destroy,
  getDraft,
  index,
  saveDraft,
  show,
  store,
  update
} from "@/modules/letter-templates/controllers/letter-templates.controller.js";
import {
  CreateLetterTemplateSchema,
  LetterTemplateIdParamSchema,
  SaveDraftSchema,
  UpdateLetterTemplateSchema
} from "@/modules/letter-templates/controllers/letter-templates.schema.js";

const indexRoute = createRoute({
  path: "/",
  method: "get",
  tags: ["LetterTemplates"],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.any(), "Letter templates list")
  }
});

const getDraftRoute = createRoute({
  path: "/draft",
  method: "get",
  tags: ["LetterTemplates"],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.any(), "User draft")
  }
});

const saveDraftRoute = createRoute({
  path: "/draft",
  method: "post",
  tags: ["LetterTemplates"],
  request: {
    body: jsonContent(SaveDraftSchema, "Save draft payload")
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.any(), "Draft saved")
  }
});

const showRoute = createRoute({
  path: "/{id}",
  method: "get",
  tags: ["LetterTemplates"],
  request: {
    params: LetterTemplateIdParamSchema
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.any(), "Letter template item"),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(z.any(), "Not found")
  }
});

const storeRoute = createRoute({
  path: "/",
  method: "post",
  tags: ["LetterTemplates"],
  request: {
    body: jsonContent(CreateLetterTemplateSchema, "Create letter template payload")
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(z.any(), "Created")
  }
});

const updateRoute = createRoute({
  path: "/{id}",
  method: "put",
  tags: ["LetterTemplates"],
  request: {
    params: LetterTemplateIdParamSchema,
    body: jsonContent(UpdateLetterTemplateSchema, "Update letter template payload")
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.any(), "Updated"),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(z.any(), "Not found")
  }
});

const destroyRoute = createRoute({
  path: "/{id}",
  method: "delete",
  tags: ["LetterTemplates"],
  request: {
    params: LetterTemplateIdParamSchema
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.any(), "Deleted"),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(z.any(), "Not found")
  }
});

export const alias = "/api/letter-templates";

export default group(authMiddleware)
  .api(indexRoute, index)
  .api(getDraftRoute, getDraft)
  .api(saveDraftRoute, saveDraft)
  .api(showRoute, show)
  .api(storeRoute, store)
  .api(updateRoute, update)
  .api(destroyRoute, destroy);
