import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it } from "vitest";
import { getConfiguredProviders } from "../src/providers";

describe("getConfiguredProviders", () => {
  afterEach(() => {
    const mutableEnv = env as unknown as Record<string, unknown>;
    delete mutableEnv.MISTRAL_API_KEY;
    delete mutableEnv.NVIDIA_API_KEY;
    delete mutableEnv.GITHUB_MODELS_TOKEN;
  });

  it("skips mistral, nvidia and github when their keys are absent", () => {
    const ids = getConfiguredProviders(env).map((p) => p.id);
    expect(ids).not.toContain("mistral");
    expect(ids).not.toContain("nvidia");
    expect(ids).not.toContain("github");
  });

  it("includes mistral, nvidia and github once their keys are set", () => {
    env.MISTRAL_API_KEY = "mistral-key";
    env.NVIDIA_API_KEY = "nvidia-key";
    env.GITHUB_MODELS_TOKEN = "github-token";

    const ids = getConfiguredProviders(env).map((p) => p.id);
    expect(ids).toContain("mistral");
    expect(ids).toContain("nvidia");
    expect(ids).toContain("github");
  });
});
