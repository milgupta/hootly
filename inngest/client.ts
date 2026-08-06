import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "hootly",
  eventKey: process.env.INNGEST_EVENT_KEY || undefined,
});
