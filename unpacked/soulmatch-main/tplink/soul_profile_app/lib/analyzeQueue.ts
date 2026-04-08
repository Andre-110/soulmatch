class AnalyzeInProgressError extends Error {
  constructor() {
    super('ANALYZE_IN_PROGRESS');
    this.name = 'AnalyzeInProgressError';
  }
}

type AnalyzeTask<T> = () => Promise<T>;

const g = globalThis as typeof globalThis & {
  __soulmatchAnalyzeQueue?: Promise<void>;
  __soulmatchActiveUsers?: Set<string>;
};

function getQueueState() {
  if (!g.__soulmatchAnalyzeQueue) g.__soulmatchAnalyzeQueue = Promise.resolve();
  if (!g.__soulmatchActiveUsers) g.__soulmatchActiveUsers = new Set<string>();
  return {
    queue: g.__soulmatchAnalyzeQueue,
    activeUsers: g.__soulmatchActiveUsers,
  };
}

/**
 * 全局串行执行 analyze 重任务，避免多次并发占满内存导致进程不稳定。
 * 同一用户在任务进行中重复触发会直接抛错（前端应提示“正在分析中”）。
 */
export async function runAnalyzeTask<T>(userId: string, task: AnalyzeTask<T>): Promise<T> {
  const { queue, activeUsers } = getQueueState();

  if (activeUsers.has(userId)) {
    throw new AnalyzeInProgressError();
  }
  activeUsers.add(userId);

  const run = async () => {
    try {
      return await task();
    } finally {
      activeUsers.delete(userId);
    }
  };

  const job = queue.then(run, run);
  g.__soulmatchAnalyzeQueue = job.then(
    () => undefined,
    () => undefined,
  );
  return job;
}

export { AnalyzeInProgressError };
