/** Server-side SDK. Keep API keys out of browser bundles. */
export type Campaign = {
  id: string;
  slug: string;
  name: string;
  description: string;
  chainId: number;
  status: string;
  maxApplicants: number;
  acceptedCount: number;
  remaining: number;
};
export type Task = {
  id: string;
  title: string;
  description: string;
  type: string;
  required: boolean;
};
export class QuestKernelClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey?: string,
  ) {}
  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(new URL(path, this.baseUrl), {
      ...init,
      headers: {
        ...(init?.headers || {}),
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
      },
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        data.error?.message || `QuestKernel HTTP ${response.status}`,
      );
    return data as T;
  }
  campaign(id: string) {
    return this.request<{ campaign: Campaign }>(
      `/api/v1/campaigns/${encodeURIComponent(id)}`,
    );
  }
  tasks(id: string) {
    return this.request<{ tasks: Task[] }>(
      `/api/v1/campaigns/${encodeURIComponent(id)}/tasks`,
    );
  }
  stats(id: string) {
    return this.request<{
      accepted: number;
      maxApplicants: number;
      remaining: number;
      duplicateAttempts: number;
    }>(`/api/v1/campaigns/${encodeURIComponent(id)}/stats`);
  }
  applicants(id: string, cursor?: string) {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    return this.request<{
      applicants: {
        id: string;
        address: string;
        eligibility: string;
        acceptedAt: string;
      }[];
      nextCursor: string | null;
    }>(`/api/v1/campaigns/${encodeURIComponent(id)}/applicants${query}`);
  }
  decideCustomTask(
    id: string,
    input: {
      taskId: string;
      address: string;
      status: "verified" | "rejected";
      detail?: string;
    },
  ) {
    return this.request<{ status: string }>(
      `/api/v1/campaigns/${encodeURIComponent(id)}/custom-verify`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    );
  }
}
