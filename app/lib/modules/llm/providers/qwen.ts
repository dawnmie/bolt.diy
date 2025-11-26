import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class QwenProvider extends BaseProvider {
  name = 'Qwen';
  getApiKeyLink = 'https://dashscope.console.aliyun.com/apiKey';
  labelForGetApiKey = '获取 API Key';

  config = {
    apiTokenKey: 'QWEN_API_KEY',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'qwen3-coder-plus',
      label: 'Qwen3 Coder Plus',
      provider: 'Qwen',
      maxTokenAllowed: 65536,
      maxCompletionTokens: 65536,
    },
    {
      name: 'qwen3-coder-plus-2025-09-23',
      label: 'Qwen3 Coder Plus 2025-09-23',
      provider: 'Qwen',
      maxTokenAllowed: 65536,
      maxCompletionTokens: 65536,
    },
    {
      name: 'qwen3-max',
      label: 'Qwen3 Max',
      provider: 'Qwen',
      maxTokenAllowed: 65536,
      maxCompletionTokens: 65536,
    },
  ];

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: 'QWEN_API_BASE_URL',
      defaultApiTokenKey: 'QWEN_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const openai = createOpenAI({
      baseURL: baseUrl || this.config.baseUrl,
      apiKey,
    });

    return openai(model);
  }
}
