import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import AgentPanel from '@/components/AgentPanel';
import { agentService } from '@/services/agentService';

jest.mock('@/services/agentService', () => ({
  agentService: {
    streamMessage: jest.fn(),
    openRuntime: jest.fn(),
    closeRuntime: jest.fn(),
    resetRuntimeContext: jest.fn(),
  },
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 'user_123', email: 'test@example.com', user_metadata: {} },
  }),
}));

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('remark-gfm', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('AgentPanel', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = jest.fn();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  it('renders the closed panel without crashing', () => {
    render(<AgentPanel />);

    expect(screen.getByTitle('Open Agent')).toBeInTheDocument();
  });

  it('collapses repeated bash tool progress into one concise trace item', async () => {
    jest.mocked(agentService.streamMessage).mockImplementation(async (_message, options) => {
      options.onRuntime?.({ runtimeId: 'local:1', model: 'deepseek:deepseek-v4-flash' });
      options.onTool?.({ name: 'bash', status: 'start', detail: '$ npm install', isError: false });
      options.onTool?.({ name: 'bash', status: 'update', detail: 'added 12 packages', isError: false });
      options.onTool?.({ name: 'bash', status: 'end', detail: 'exit code 0', isError: false });
      options.onDone?.('处理完成');
      return '处理完成';
    });

    render(<AgentPanel />);

    fireEvent.click(screen.getByTitle('Open Agent'));
    const input = screen.getByPlaceholderText('输入消息...');
    fireEvent.change(input, {
      target: { value: '整理运行过程' },
    });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('处理完成')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('运行过程'));

    expect(screen.getAllByText('执行命令')).toHaveLength(1);
    expect(screen.getByText('exit code 0')).toBeInTheDocument();
    expect(screen.queryByText('调用工具 bash')).not.toBeInTheDocument();
  });

  it('shows sandbox status details in the run trace', async () => {
    jest.mocked(agentService.streamMessage).mockImplementation(async (_message, options) => {
      options.onStatus?.({
        label: '复制内置 Skills 文件夹到沙箱',
        detail: 'lib/agents/skills/official',
        status: 'active',
      });
      options.onStatus?.({
        label: '内置 Skills 文件夹复制完成',
        detail: '24 files · 120.0 KB · copied lib/agents/skills/official',
        status: 'done',
      });
      options.onDone?.('处理完成');
      return '处理完成';
    });

    render(<AgentPanel />);

    fireEvent.click(screen.getByTitle('Open Agent'));
    const input = screen.getByPlaceholderText('输入消息...');
    fireEvent.change(input, {
      target: { value: '启动沙箱' },
    });
    fireEvent.click(screen.getByTitle('发送'));

    await waitFor(() => {
      expect(screen.getByText('处理完成')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('运行过程'));

    expect(screen.getByText('复制内置 Skills 文件夹到沙箱')).toBeInTheDocument();
    expect(screen.getByText('24 files · 120.0 KB · copied lib/agents/skills/official')).toBeInTheDocument();
  });

  it('lets the user close the current sandbox runtime', async () => {
    jest.mocked(agentService.streamMessage).mockImplementation(async (_message, options) => {
      options.onStatus?.({
        label: 'E2B 沙箱已就绪',
        detail: 'sbx_123 · /home/user/musesAOS',
        status: 'done',
      });
      options.onDone?.('处理完成');
      return '处理完成';
    });
    jest.mocked(agentService.closeRuntime).mockResolvedValue(undefined);

    render(<AgentPanel />);

    fireEvent.click(screen.getByTitle('Open Agent'));
    const input = screen.getByPlaceholderText('输入消息...');
    fireEvent.change(input, {
      target: { value: '启动沙箱' },
    });
    fireEvent.click(screen.getByTitle('发送'));

    await waitFor(() => {
      expect(screen.getByTitle('沙箱已启动，点击关闭')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('沙箱已启动，点击关闭'));
    expect(screen.getByText('是否确定关闭沙箱？')).toBeInTheDocument();
    fireEvent.click(screen.getByText('确认关闭'));

    await waitFor(() => {
      expect(agentService.closeRuntime).toHaveBeenCalled();
    });
    expect(screen.getByText('沙箱已关闭')).toBeInTheDocument();
    fireEvent.click(screen.getByText('运行过程'));
    expect(screen.getByText('已 kill 当前用户的 E2B 沙箱；左下角刷新只重置会话，不删除沙箱文件')).toBeInTheDocument();
  });

  it('shows sandbox power state after the sandbox starts and resets after closing it', async () => {
    jest.mocked(agentService.streamMessage).mockImplementation(async (_message, options) => {
      options.onStatus?.({
        label: 'E2B 沙箱已就绪',
        detail: 'sbx_123 · /home/user/musesAOS',
        status: 'done',
      });
      options.onDone?.('处理完成');
      return '处理完成';
    });
    jest.mocked(agentService.closeRuntime).mockResolvedValue(undefined);

    render(<AgentPanel />);

    fireEvent.click(screen.getByTitle('Open Agent'));
    expect(screen.getByTitle('沙箱未启动，点击开启')).toBeInTheDocument();

    const input = screen.getByPlaceholderText('输入消息...');
    fireEvent.change(input, {
      target: { value: '运行一个命令' },
    });
    fireEvent.click(screen.getByTitle('发送'));

    await waitFor(() => {
      expect(screen.getByTitle('沙箱已启动，点击关闭')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('沙箱已启动，点击关闭'));
    expect(screen.getByText('关闭会直接 kill 当前用户的 E2B 沙箱。左下角刷新只重置会话，不删除沙箱文件。')).toBeInTheDocument();
    fireEvent.click(screen.getByText('确认关闭'));

    await waitFor(() => {
      expect(screen.getByTitle('沙箱未启动，点击开启')).toBeInTheDocument();
    });
  });

  it('confirms before opening the sandbox runtime', async () => {
    jest.mocked(agentService.openRuntime).mockImplementation(async (options) => {
      options.onStatus?.({
        label: 'E2B 沙箱已开启',
        detail: 'sbx_123 · /home/user/musesAOS',
        status: 'done',
      });
    });

    render(<AgentPanel />);

    fireEvent.click(screen.getByTitle('Open Agent'));
    fireEvent.click(screen.getByTitle('沙箱未启动，点击开启'));

    expect(screen.getByText('是否确定开启沙箱？')).toBeInTheDocument();
    expect(agentService.openRuntime).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('确认开启'));

    await waitFor(() => {
      expect(agentService.openRuntime).toHaveBeenCalled();
    });
    expect(screen.queryByText('E2B 沙箱已开启')).not.toBeInTheDocument();
    expect(screen.queryByText('运行过程')).not.toBeInTheDocument();
    expect(screen.getByTitle('沙箱已启动，点击关闭')).toBeInTheDocument();
  });

  it('does not mark sandbox active when the runtime reports sandbox disabled', async () => {
    jest.mocked(agentService.openRuntime).mockImplementation(async (options) => {
      options.onStatus?.({
        label: 'E2B 沙箱未启用',
        detail: '当前环境没有配置 E2B_API_KEY',
        status: 'info',
      });
    });

    render(<AgentPanel />);

    fireEvent.click(screen.getByTitle('Open Agent'));
    fireEvent.click(screen.getByTitle('沙箱未启动，点击开启'));
    fireEvent.click(screen.getByText('确认开启'));

    await waitFor(() => {
      expect(screen.getByText('沙箱没有真正启动，请检查 E2B 配置或启动日志')).toBeInTheDocument();
    });
    expect(screen.getByTitle('沙箱未启动，点击开启')).toBeInTheDocument();
  });

  it('recognizes sandbox opening status labels as active', async () => {
    jest.mocked(agentService.openRuntime).mockImplementation(async (options) => {
      options.onStatus?.({
        label: 'E2B 沙箱已开启',
        detail: 'sbx_123 · /home/user/musesAOS',
        status: 'done',
      });
    });

    render(<AgentPanel />);

    fireEvent.click(screen.getByTitle('Open Agent'));
    fireEvent.click(screen.getByTitle('沙箱未启动，点击开启'));
    fireEvent.click(screen.getByText('确认开启'));

    await waitFor(() => {
      expect(screen.getByTitle('沙箱已启动，点击关闭')).toBeInTheDocument();
    });
  });

  it('keeps a loading dialog while opening the sandbox from the power button', async () => {
    jest.mocked(agentService.openRuntime).mockImplementation(() => new Promise(() => undefined));

    render(<AgentPanel />);

    fireEvent.click(screen.getByTitle('Open Agent'));
    fireEvent.click(screen.getByTitle('沙箱未启动，点击开启'));
    fireEvent.click(screen.getByText('确认开启'));

    await waitFor(() => {
      expect(screen.getByText('正在开启沙箱...')).toBeInTheDocument();
    });
    expect(screen.getByText('正在创建 E2B 运行环境并配置 Skills，请稍等。')).toBeInTheDocument();
    expect(screen.queryByText('确认开启沙箱')).not.toBeInTheDocument();
  });

  it('keeps the sandbox power button inactive until E2B is ready', async () => {
    jest.mocked(agentService.streamMessage).mockImplementation(async (_message, options) => {
      options.onStatus?.({
        label: '启动 E2B 沙箱',
        detail: '首次使用执行工具，正在创建远程运行环境',
        status: 'active',
      });
      return new Promise<string>(() => undefined);
    });

    render(<AgentPanel />);

    fireEvent.click(screen.getByTitle('Open Agent'));
    const input = screen.getByPlaceholderText('输入消息...');
    fireEvent.change(input, {
      target: { value: '运行一个命令' },
    });
    fireEvent.click(screen.getByTitle('发送'));

    await waitFor(() => {
      expect(screen.getByTitle('终止运行')).toBeInTheDocument();
    });
    expect(screen.getByTitle('沙箱未启动，点击开启')).toBeInTheDocument();
  });

  it('turns the send button into a stop button for the current agent run only', async () => {
    let streamSignal: AbortSignal | undefined;
    jest.mocked(agentService.streamMessage).mockImplementation(async (_message, options) => {
      streamSignal = options.signal;
      return new Promise<string>((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => {
          const abortError = new Error('aborted');
          abortError.name = 'AbortError';
          reject(abortError);
        });
      });
    });
    jest.mocked(agentService.closeRuntime).mockResolvedValue(undefined);

    render(<AgentPanel />);

    fireEvent.click(screen.getByTitle('Open Agent'));
    const input = screen.getByPlaceholderText('输入消息...');
    fireEvent.change(input, {
      target: { value: '请调用 skill 生成短片' },
    });
    fireEvent.click(screen.getByTitle('发送'));

    await waitFor(() => {
      expect(screen.getByTitle('终止运行')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('终止运行'));

    await waitFor(() => {
      expect(streamSignal?.aborted).toBe(true);
    });
    expect(agentService.closeRuntime).not.toHaveBeenCalled();
    expect(screen.getByText('运行已终止')).toBeInTheDocument();
  });

  it('shows stream errors inside the panel without logging a page-level console error', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.mocked(agentService.streamMessage).mockRejectedValue(new Error('AI 助手响应失败，请稍后重试'));

    render(<AgentPanel />);

    fireEvent.click(screen.getByTitle('Open Agent'));
    const input = screen.getByPlaceholderText('输入消息...');
    fireEvent.change(input, {
      target: { value: '触发错误' },
    });
    fireEvent.click(screen.getByTitle('发送'));

    await waitFor(() => {
      expect(screen.getByText('AI 助手响应失败，请稍后重试')).toBeInTheDocument();
    });
    expect(screen.getByText('运行失败')).toBeInTheDocument();
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('starts a fresh agent session without closing the sandbox', async () => {
    jest.mocked(agentService.streamMessage).mockImplementation(async (message, options) => {
      options.onDone?.(`回复 ${message}`);
      return `回复 ${message}`;
    });
    jest.mocked(agentService.resetRuntimeContext).mockResolvedValue(undefined);

    render(<AgentPanel />);

    fireEvent.click(screen.getByTitle('Open Agent'));
    const input = screen.getByPlaceholderText('输入消息...');
    fireEvent.change(input, {
      target: { value: '第一轮上下文' },
    });
    fireEvent.click(screen.getByTitle('发送'));

    await waitFor(() => {
      expect(screen.getByText('回复 第一轮上下文')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('新建会话'));

    await waitFor(() => {
      expect(agentService.resetRuntimeContext).toHaveBeenCalled();
    });
    expect(agentService.closeRuntime).not.toHaveBeenCalled();
    expect(screen.queryByText('第一轮上下文')).not.toBeInTheDocument();
    expect(screen.getByText(/你好！我是 Muses AI 助手/)).toBeInTheDocument();
  });
});
