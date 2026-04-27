import axios from 'axios';
import { API_TIMEOUTS, createApiClient } from './apiClient';

const axiosClient = createApiClient(API_TIMEOUTS.standard);

interface AgentChatResponse {
  response: string;
}

interface AgentChatError {
  error: string;
  details?: unknown;
}

/**
 * Agent 服务类 - 处理 AI 对话
 */
export class AgentService {
  /**
   * 发送消息给 AI Agent
   * @param message - 用户消息
   * @returns AI 回复
   */
  async sendMessage(message: string): Promise<string> {
    try {
      const response = await axiosClient.post<AgentChatResponse>('/agent', {
        message,
      });

      const content = response.data?.response;
      if (!content || content.trim().length === 0) {
        throw new Error('AI 返回内容为空');
      }

      return content;
    } catch (error) {
      console.error('Error calling AI agent:', error);

      if (axios.isAxiosError(error)) {
        const data = error.response?.data as AgentChatError | undefined;
        const errorMessage = data?.error || error.message || 'AI 助手响应失败';
        throw new Error(errorMessage);
      }

      throw new Error('AI 助手响应失败，请稍后重试');
    }
  }
}

// 导出单例实例
export const agentService = new AgentService();
