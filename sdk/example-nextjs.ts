// Example: import only from a Next.js server component or route handler.
import { QuestKernelClient } from "./index";
const client = new QuestKernelClient(
  process.env.QUESTKERNEL_URL!,
  process.env.QUESTKERNEL_API_KEY!,
);
export async function getQuestStats(campaignId: string) {
  return client.stats(campaignId);
}
