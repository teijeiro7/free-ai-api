import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it } from "vitest";
import { getConfiguredProviders } from "../src/providers";

describe("getConfiguredProviders", () => {
  afterEach(() => {
    const mutableEnv = env as unknown as Record<string, unknown>;
    delete mutableEnv.MISTRAL_API_KEY;
    delete mutableEnv.NVIDIA_API_KEY;
  });

  it("skips mistral and nvidia when their keys are absent", () => {
    const ids = getConfiguredProviders(env).map((p) => p.id);
    expect(ids).not.toContain("mistral");
    expect(ids).not.toContain("nvidia");
  });

  it("includes mistral and nvidia once their keys are set", () => {
    env.MISTRAL_API_KEY = "mistral-key";
    env.NVIDIA_API_KEY = "nvidia-key";

    const ids = getConfiguredProviders(env).map((p) => p.id);
    expect(ids).toContain("mistral");
    expect(ids).toContain("nvidia");
  });
});
