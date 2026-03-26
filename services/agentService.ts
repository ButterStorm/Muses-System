import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

const DMX_API_KEY = process.env.NEXT_PUBLIC_DMX_API_KEY || process.env.NEXT_PUBLIC_302AI_API_KEY;
const DMX_BASE_URL = 'https://www.dmxapi.cn/v1';
const AGENT_MODEL = process.env.NEXT_PUBLIC_AGENT_MODEL || 'gpt-5-mini';

export class AgentService {
    private chatModel: ChatOpenAI;

    constructor() {
        if (!DMX_API_KEY) {
            console.warn('DMX API Key is missing. Agent features may not work.');
        }

        console.log('Agent Service initialized with:', {
            baseURL: DMX_BASE_URL,
            model: AGENT_MODEL,
            hasApiKey: !!DMX_API_KEY
        });

        this.chatModel = new ChatOpenAI({
            apiKey: DMX_API_KEY,
            configuration: {
                baseURL: DMX_BASE_URL,
            },
            modelName: AGENT_MODEL,
            temperature: 0.7,
        });
    }

    async sendMessage(message: string): Promise<string> {
        try {
            const messages = [
                new SystemMessage('You are a helpful AI assistant embedded in a creative canvas application called MusesSystem. You help users with their tasks, answer questions, and provide creative inspiration.'),
                new HumanMessage(message),
            ];

            const response = await this.chatModel.invoke(messages);

            if (typeof response.content === 'string') {
                return response.content;
            } else {
                return Array.isArray(response.content)
                    ? response.content.map(c => (c as any).text || '').join('')
                    : String(response.content);
            }
        } catch (error: any) {
            console.error('Error calling AI agent:', error);
            throw new Error(error?.message || JSON.stringify(error) || 'Failed to get response from AI agent.');
        }
    }
}

export const agentService = new AgentService();
